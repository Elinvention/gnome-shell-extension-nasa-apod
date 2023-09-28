import GLib from 'gi://GLib';


export default class Timer {
    constructor(interval, name, callback) {
        Timer.remove(name);

        Timer.timeouts[name] = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, interval, () => {
            delete Timer.timeouts[name];
            callback();
        });
    }

    static remove(name) {
        if (Timer.timeouts[name] !== undefined) {
            GLib.Source.remove(Timer.timeouts[name]);
            Timer.timeouts[name] = undefined;
        }
    }

    static remove_all() {
        for (const timer in Timer.timeouts) {
            GLib.Source.remove(Timer.timeouts[timer]);
            delete Timer.timeouts[timer];
        }
    }
}
Timer.timeouts = {};

