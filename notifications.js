const Lang = imports.lang;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;


function addActionsToNotification(notification, actions) {
    actions.forEach(function(action) {
        notification.addAction(action['name'], action['fun']);
    });
}

function notify(msg, details, transient, actions=[]) {
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
    let notification = new MessageTray.Notification(source, msg, details);
    notification.setTransient(transient);
    addActionsToNotification(notification, actions);
    source.notify(notification);
}

function notifyError(msg, details, actions=[]) {
    let prefix = 'NASA APOD extension error';
    let source = new MessageTray.Source("NASA APOD", "saturn");
    Main.messageTray.add(source);
    let notification;
    if (details) {
        prefix += ": " + msg;
        log(prefix + ': ' + details);
        notification = new MessageTray.Notification(source, prefix, details);
    } else {
        log(prefix + ': ' + msg);
        notification = new MessageTray.Notification(source, prefix, msg);
    }
    notification.setTransient(false);
    addActionsToNotification(notification, actions);
    source.notify(notification);
}

