const Lang = imports.lang;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;


const LongNotification = new Lang.Class({
    Name: 'LongNotification',
    Extends: MessageTray.Notification,

    createBanner: function() {
        // Explanations are usually longer than default
        let banner = this.source.createBanner(this);
        banner.setExpandedLines(20);
        return banner;
    }
});

function notify(msg, details, transient) {
    // set notifications icon
    let source = new MessageTray.Source("NASA APOD", "saturn");
    // force expanded notification
    source.policy = new MessageTray.NotificationPolicy({ enable: true,
                                        enableSound: true,
                                        showBanners: true,
                                        forceExpanded: true,
                                        showInLockScreen: true,
                                        detailsInLockScreen: true
                                      });
    Main.messageTray.add(source);
    let notification = new LongNotification(source, msg, details);
    notification.setTransient(transient);
    // Add action to open NASA APOD website with default browser
    notification.addAction("NASA APOD website", Lang.bind(this, function() {
        Util.spawn(["xdg-open", NasaApodWebsiteURL]);
    }));
    source.notify(notification);
}

function notifyError(msg) {
    Main.notifyError("NASA APOD extension error", msg);
}
