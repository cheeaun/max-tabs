const widgets = require('sdk/widget');
const tabs = require('sdk/tabs');
const simplePrefs = require('sdk/simple-prefs');
const notifications = require('sdk/notifications');
const windows = require('sdk/windows');
const timers = require('sdk/timers');
const l10n = require('sdk/l10n');
const privateBrowsing = require('sdk/private-browsing');

exports.main = function(){
	var maxTabs = simplePrefs.prefs.maxTabs;
	var max = maxTabs>1 ? maxTabs : 10; // Max at least 2 tabs please
	var maxPrivateBrowsing = simplePrefs.prefs.maxPrivateBrowsing;
	var _ = l10n.get;

	var widget = widgets.Widget({
	  id: 'max-tabs-widget',
	  label: 'Max Tabs',
	  content: '1/' + max,
	  width: 30
	});
	var updateWidgetState = function(){
		for each (var window in windows.browserWindows){
			var view = widget.getView(window);
			if (view){
				view.content = window.tabs.length + '/' + max;
			}
		}
	};
	updateWidgetState();

	simplePrefs.on('maxTabs', function(){
		var maxTabs = simplePrefs.prefs.maxTabs;
		max = maxTabs>1 ? maxTabs : 10;
		updateWidgetState();
	});
	simplePrefs.on('maxPrivateBrowsing', function(){
		maxPrivateBrowsing = simplePrefs.prefs.maxPrivateBrowsing;
	});

	tabs.on('open', function(tab){
		var window = tab.window;
		// setTimeout is needed because window.tabs.length value seems to update *slower*
		timers.setTimeout(function(){
			if (window.tabs.length <= max || (privateBrowsing.isPrivate(window) && !maxPrivateBrowsing)){
				var view = widget.getView(window);
				if (view) view.content = window.tabs.length + '/' + max;
			} else {
				tab.close();
				notifications.notify({
					title: 'Max Tabs',
					text: _('not_open_max_tabs', max)
				});
			}
		}, 1);
	});
	tabs.on('close', function(tab){
		var window = tab.window;
		var view = widget.getView(window);
		if (view) timers.setTimeout(function(){
			view.content = tab.window.tabs.length + '/' + max;
		}, 1);
	});
};