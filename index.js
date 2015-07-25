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

exports.main = function(){
	var maxTabs = simplePrefs.prefs.maxTabs;
	var max = (maxTabs > 1) ? maxTabs : 2; // Max at least 2 tabs please
	var maxPrivateBrowsing = simplePrefs.prefs.maxPrivateBrowsing;
    var maxOpenInNextWindow = simplePrefs.prefs.maxOpenInNextWindow;
    var maxExcludePinnedTabs = simplePrefs.prefs.maxExcludePinnedTabs;

	var button = ActionButton({
		id: 'max-tabs-button',
	    label: title,
		icon: './icon.svg',
		disabled: true
	});

    var calcTabsLen = function(win){
        let len = win.tabs.length;
        if(maxExcludePinnedTabs){
            let pinned = 0;
            for(let i = 0; i < len; i++){
                if(win.tabs[i].isPinned)
                    pinned++;
            }
            len -= pinned;
        }

        return len;
    }

    var notifyMax = function(){
        notifications.notify({
            title: title,
            text: _('not_open_max_tabs', max)
        });
    };

	var colorScale = chroma.scale(['#A6A6A6', '#B90000']);
	var updateButton = function(win, tabsLen){
		if (win == 'window') tabsLen = calcTabsLen(windows.browserWindows.activeWindow);
		button.state(win, {
			label: title + ' - ' + tabsLen + '/' + max,
			badge: (tabsLen > 99) ? '99+' : tabsLen,
			badgeColor: colorScale(tabsLen/max).hex()
		});
	};
	var updateAllButtons = function(){
		for (let win of windows.browserWindows){
			updateButton(win, calcTabsLen(win));
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
    simplePrefs.on('maxOpenInNextWindow', function(){
        maxOpenInNextWindow = simplePrefs.prefs.maxOpenInNextWindow;
    });
    simplePrefs.on('maxExcludePinnedTabs', function(){
        maxExcludePinnedTabs = simplePrefs.prefs.maxExcludePinnedTabs;
        updateAllButtons();
    });


    // TODO: hook tab (un)pinned events


    tabs.on('open', function(tab){
        let win = tab.window;
        if(privateBrowsing.isPrivate(win) && !maxPrivateBrowsing){
            setTimeout(function(){
                updateButton(win, calcTabsLen(win));
            }, 1);
            return;
        }

        // setTimeout is needed because win.tabs.length value seems to update *slower*
        setTimeout(function(){
            let tabsLen = calcTabsLen(win);
            if (tabsLen <= max){
                updateButton(win, tabsLen);
            } else if (maxOpenInNextWindow){
                let tabHasFocus = (tab === win.activeTab);
                let numWindows = windows.browserWindows.length;
                let i = 0;
                let nextWin;

                // lookup another available window (private windows are not listed)
                while(i < numWindows){
                    nextWin = windows.browserWindows[i];
                    tabsLen = calcTabsLen(nextWin);

                    if (nextWin !== win && tabsLen < max){
                        // real moving of tabs in FF is low level stuff and not much portable
                        // see http://stackoverflow.com/a/26744281/2566213

                        let onReady = function(){
                            // to keep total number stable, first tab needs to be closed before opening a new one
                            let url = tab.url;
                            tab.close();
                            nextWin.tabs.open(url);
                            if(tabHasFocus){
                                nextWin.activate();
                                tab.activate();
                            }
                        };

                        // FF sometimes doesn't fire ready event
                        // http://stackoverflow.com/a/30013206/2566213
                        if(tab.readyState == "complete")
                            onReady();
                        else
                            tab.on('ready', onReady);

                        break;
                    }

                    i++;
                }

                if(i >= numWindows){
                    tab.close();
                    notifyMax();
                }
            } else {
                tab.close();
                notifyMax();
            }
        }, 1);
    });

	var updateOnClose = function(tab){
		let win = tab.window;
        let len = calcTabsLen(win);
        if(len <= 0) return; // tab closed the window too
		setTimeout(function(){
			updateButton(win, len);
		}, 1);
	};
	tabs.on('close', updateOnClose);
	tabs.on('activate', updateOnClose);
};
