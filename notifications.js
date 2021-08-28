const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;


function addActionsToNotification(notification, actions) {
    actions.forEach(function(action) {
        notification.addAction(action['name'], action['fun']);
    });
}

function notify(msg, details, transient, actions=[]) {
    // this should also set notifications icon,
    // but it doesn't anymore on GNOME 40
    let source = new MessageTray.Source("NASA APOD", "saturn");

    // force expanded notification
    // FIXME: it doesn't work anymore on GNOME 40
    //source.policy = new MessageTray.NotificationPolicy({ enable: true,
    //                                    enableSound: true,
    //                                    showBanners: true,
    //                                    forceExpanded: true,
    //                                    showInLockScreen: true,
    //                                    detailsInLockScreen: true
    //                                  });

    // Manually get and set notification icon
    let my_gicon = Gio.icon_new_for_string(`${Me.path}/icons/saturn.svg`);
    Main.messageTray.add(source);
    let notification = new MessageTray.Notification(source, msg, details, {gicon: my_gicon});
    notification.setTransient(transient);
    addActionsToNotification(notification, actions);
    source.showNotification(notification);
}

function notifyError(msg, details, actions=[], user_initiated=true) {
    let prefix = 'NASA APOD extension error';
    // Always log the errors
    if (details)
        log(prefix + ': ' + msg + ': ' + details);
    else
        log(prefix + ': ' + msg)

    // Actually show the notification if user_initiated
    if (user_initiated) {
        // Manually get and set notification icon
        let my_gicon = Gio.icon_new_for_string(`${Me.path}/icons/saturn.svg`);

        let source = new MessageTray.Source("NASA APOD", "saturn");
        Main.messageTray.add(source);
        let notification = details ?
            new MessageTray.Notification(source, prefix + ': ' + msg, details, {gicon: my_gicon}) :
            new MessageTray.Notification(source, prefix, msg, {gicon: my_gicon})
        ;
        notification.setTransient(false);
        addActionsToNotification(notification, actions);
        source.showNotification(notification);
    }
}
