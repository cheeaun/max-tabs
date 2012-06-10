const widgets = require('widget');
const tabs = require('tabs');
const simplePrefs = require('simple-prefs');
const notifications = require('notifications');
const windows = require('windows');
const timers = require('timers');
const l10n = require('l10n');

exports.main = function(){
	var maxTabs = simplePrefs.prefs.maxTabs;
	var max = maxTabs>1 ? maxTabs : 10; // Max at least 2 tabs please
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
			if (view) view.content = window.tabs.length + '/' + max;
		}
	};
	updateWidgetState();
	simplePrefs.on('maxTabs', function(){
		var maxTabs = simplePrefs.prefs.maxTabs;
		max = maxTabs>1 ? maxTabs : 10;
		updateWidgetState();
	});
	
	tabs.on('open', function(tab){
		var window = tab.window;
		timers.setTimeout(function(){
			// setTimeout is needed because window.tabs.length value seems to update *slower*
			if (window.tabs.length>max){
				tab.close();
				notifications.notify({
					title: 'Max Tabs',
					text: _('not_open_max_tabs', max)
				});
			} else {
				var view = widget.getView(window);
				if (view) view.content = window.tabs.length + '/' + max;
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