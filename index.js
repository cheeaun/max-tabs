var title = require('./package.json').title;
var { ActionButton } = require('sdk/ui/button/action');
var simplePrefs = require('sdk/simple-prefs');
var _ = require('sdk/l10n').get;
var windows = require('sdk/windows');
var tabs = require('sdk/tabs');
var notifications = require('sdk/notifications');
var { setTimeout } = require('sdk/timers');
var privateBrowsing = require('sdk/private-browsing');
var chroma = require('chroma-js');
var minBy = require('lodash.minby');

exports.main = function(){
	var maxTabs = simplePrefs.prefs.maxTabs;
	var max = (maxTabs > 1) ? maxTabs : 10; // Max at least 2 tabs please
	var maxPrivateBrowsing = simplePrefs.prefs.maxPrivateBrowsing;
	var tabCloseMode = simplePrefs.prefs.tabCloseMode;

	var tabUsedCounts = new WeakMap();
	var tabLastUsed = new WeakMap();

	var button = ActionButton({
		id: 'max-tabs-button',
	  label: title,
		icon: './icon.svg',
		disabled: true
	});

	var colorScale = chroma.scale(['#A6A6A6', '#B90000']);

	var updateButton = function(win, tabsLen){
		if (win == 'window') tabsLen = windows.browserWindows.activeWindow.tabs.length;
		button.state(win, {
			label: title + ' - ' + tabsLen + '/' + max,
			badge: (tabsLen > 99) ? '99+' : tabsLen,
			badgeColor: colorScale(tabsLen/max).hex()
		});
	};

	var updateAllButtons = function(){
		for (let window of windows.browserWindows){
			updateButton(window, window.tabs.length);
		}
	};

	updateAllButtons();

	simplePrefs.on('maxTabs', function(){
		var maxTabs = simplePrefs.prefs.maxTabs;
		max = (maxTabs > 1) ? maxTabs : 10;
		updateAllButtons();
	});

	simplePrefs.on('maxPrivateBrowsing', function(){
		maxPrivateBrowsing = simplePrefs.prefs.maxPrivateBrowsing;
	});

	simplePrefs.on('tabCloseMode', function(){
		tabCloseMode = simplePrefs.prefs.tabCloseMode;
	});

	tabs.on('activate', function(tab){
		tabUsedCounts.set(tab, tabUsedCounts.get(tab) + 1);
		tabLastUsed.set(tab, Date.now());
	});

	tabs.on('close', function(tab){
		tabUsedCounts.delete(tab);
		tabLastUsed.delete(tab);
		updateAllButtons();
	})

	tabs.on('open', function(tab){
		var window = tab.window;

		tabUsedCounts.set(tab, 1);
		tabLastUsed.set(tab, Date.now());

		// setTimeout is needed because window.tabs.length value seems to update *slower*
		setTimeout(function(){
			var tabsLen = window.tabs.length;

			if (tabsLen <= max || (privateBrowsing.isPrivate(window) && !maxPrivateBrowsing)){
				updateButton(window, tabsLen);
			} else {
				var tabToClose;

				switch(tabCloseMode){
					case 0: {
						tabToClose = tab;
						break;
					}
					case 1: {
						tabToClose = minBy(window.tabs, function(otherTab){
							if(tab === otherTab) {
								return Infinity;
							}

							return tabUsedCounts.get(otherTab);
						});
						break;
					}
					case 2: {
						tabToClose = minBy(window.tabs, function(otherTab){
							return tabLastUsed.get(otherTab);
						});
						break;
					}
				}

				tabToClose.close();
				notifications.notify({
					title: title,
					text: _('not_open_max_tabs', max)
				});
			}
		}, 1);
	});
};
