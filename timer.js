const Mainloop = imports.mainloop;


class Timer {
    constructor(interval, name, callback) {
        Timer.remove(name);

        Timer.timeouts[name] = Mainloop.timeout_add_seconds(interval, () => {
            delete Timer.timeouts[name];
            callback();
        });
    }

    static remove(name) {
        if (Timer.timeouts[name] !== undefined)
            Mainloop.source_remove(Timer.timeouts[name]);
    }

    static remove_all() {
        for (const timer in Timer.timeouts) {
            Mainloop.source_remove(Timer.timeouts[timer]);
            delete Timer.timeouts[timer];
        }
    }
}
Timer.timeouts = {};
