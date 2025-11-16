'use strict';

import GObject from 'gi://GObject';
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


const NotificationPolicy = GObject.registerClass(
class NotificationPolicy extends MessageTray.NotificationPolicy {
    /**
     * Whether notifications will be shown.
     *
     * @type {boolean}
     */
    get enable() {
        return true;
    }

    /**
     * Whether sound will be played.
     *
     * @type {boolean}
     */
    get enableSound() {
        return true;
    }

    /**
     * Whether the notification will popup outside of the tray.
     *
     * @type {boolean}
     */
    get showBanners() {
        return true;
    }

    /**
     * Whether the notification will always be expanded.
     *
     * @type {boolean}
     */
    get forceExpanded() {
        return true;
    }

    /**
     * Whether the notification will be shown on the lock screen.
     *
     * @type {boolean}
     */
    get showInLockScreen() {
        return true;
    }

    /**
     * Whether the notification content will be shown on the lock screen.
     *
     * @type {boolean}
     */
    get detailsInLockScreen() {
        return true;
    }

    /**
     * Called when the source is added to the message tray
     */
    store() {
    }
});


let notificationSource = null;

/**
 * @returns a custom notification source
 */
function getNotificationSource() {
    if (!notificationSource) {
        const notificationPolicy = new NotificationPolicy();

        notificationSource = new MessageTray.Source({
            // The source name (e.g. application name)
            title: 'NASA APOD',
            // An icon for the source, used a fallback by notifications
            icon: new Gio.ThemedIcon({name: 'saturn-symbolic'}),
            // Same as `icon`, but takes a themed icon name
            iconName: 'saturn-symbolic',
            // The notification policy
            policy: notificationPolicy,
        });

        // Reset the notification source if it's destroyed
        notificationSource.connect('destroy', _source => {
            notificationSource = null;
        });
        Main.messageTray.add(notificationSource);
    }

    return notificationSource;
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
    // reference: https://gjs.guide/extensions/topics/notifications.html
    let customSource = getNotificationSource();

    // Manually get and set notification icon
    let notification = new MessageTray.Notification({
        source: customSource,
        title: msg,
        body: details,
        'is-transient': transient,
    });

    addActionsToNotification(notification, actions);
    customSource.addNotification(notification);
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
        console.log(`${prefix}: ${msg}: ${details}`);
    else
        console.log(`${prefix}: ${msg}`);

    // Actually show the notification if user_initiated
    if (user_initiated) {
        if (details)
            notify(`${prefix}: ${msg}`, details, false, actions);
        else
            notify(prefix, msg, false, actions);
    }
}
