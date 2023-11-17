import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';


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
export function notify(msg, details, transient, actions = []) {
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
    Main.messageTray.add(source);
    let notification = new MessageTray.Notification(source, msg, details, {});
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
export function notifyError(msg, details, actions = [], user_initiated = true) {
    let prefix = 'NASA APOD extension error';
    // Always log the errors
    if (details)
        log(`${prefix}: ${msg}: ${details}`);
    else
        log(`${prefix}: ${msg}`);

    // Actually show the notification if user_initiated
    if (user_initiated) {
        // Manually get and set notification icon
        // FIXME: GNOME 45 made this more difficult
        //let my_gicon = Gio.icon_new_for_string(`./icons/saturn.svg`);

        let source = new MessageTray.Source('NASA APOD', 'saturn');
        Main.messageTray.add(source);
        let notification = details
            ? new MessageTray.Notification(source, `${prefix}: ${msg}`, details, {}) //, {gicon: my_gicon})
            : new MessageTray.Notification(source, prefix, msg, {gicon: null});
        notification.setTransient(false);
        addActionsToNotification(notification, actions);
        source.showNotification(notification);
    }
}

