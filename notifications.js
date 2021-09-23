const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;


/* exported notify */
/* exported notifyError */


/**
 * @param {MessageTray.Notification} notification The notification object to attach actions to
 * @param {Object[]} actions Each action is translated to a button under the notification bubble
 * @param {string} actions[].name The name of the action shown on the button
 * @param {Function} actions[].fun The function to call when the user clicks on the button
 */
function addActionsToNotification(notification, actions) {
    actions.forEach(function (action) {
        notification.addAction(action['name'], action['fun']);
    });
}

/**
 * @param {string} msg Message of the notification
 * @param {string} details Detailed notification message
 * @param {bool} transient Whether notification is transient or not
 * @param {Object[]} [actions=[]] Each action is translated to a button under the notification bubble
 * @param {string} actions[].name The name of the action shown on the button
 * @param {Function} actions[].fun The function to call when the user clicks on the button
 */
function notify(msg, details, transient, actions = []) {
    // this should also set notifications icon,
    // but it doesn't anymore on GNOME 40
    let source = new MessageTray.Source('NASA APOD', 'saturn');

    // force expanded notification
    // FIXME: it doesn't work anymore on GNOME 40
    // source.policy = new MessageTray.NotificationPolicy({ enable: true,
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

/**
 * @param {string} msg Message of the notification
 * @param {string} details Detailed notification message
 * @param {Object[]} [actions=[]] Each action is translated to a button under the notification bubble
 * @param {string} actions[].name The name of the action shown on the button
 * @param {Function} actions[].fun The function to call when the user clicks on the button
 * @param {bool} [user_initiated=true] Whether the user initiated the action or not (to avoid spamming notifications from background activity)
 */
function notifyError(msg, details, actions = [], user_initiated = true) {
    let prefix = 'NASA APOD extension error';
    // Always log the errors
    if (details)
        log(`${prefix}: ${msg}: ${details}`);
    else
        log(`${prefix}: ${msg}`);

    // Actually show the notification if user_initiated
    if (user_initiated) {
        // Manually get and set notification icon
        let my_gicon = Gio.icon_new_for_string(`${Me.path}/icons/saturn.svg`);

        let source = new MessageTray.Source('NASA APOD', 'saturn');
        Main.messageTray.add(source);
        let notification = details
            ? new MessageTray.Notification(source, `${prefix}: ${msg}`, details, {gicon: my_gicon})
            : new MessageTray.Notification(source, prefix, msg, {gicon: my_gicon});
        notification.setTransient(false);
        addActionsToNotification(notification, actions);
        source.showNotification(notification);
    }
}
