
const St = imports.gi.St;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Soup = imports.gi.Soup
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const NasaApodURL = "https://api.nasa.gov/planetary/apod";
const NasaApodWebsiteURL = "https://apod.nasa.gov/apod/";
const DefaultAPIKey = "XKSoS8Bv05ij8JH8UWa7eqMavXgGfFStcc6Pu3KH";
const NasaApodDir = GLib.get_home_dir() + "/.cache/apod/";
const IndicatorName = "NasaApodIndicator";
const TIMEOUT_SECONDS = 6 * 3600;

// Utility function
function dump(object) {
    let output = '';
    for (let property in object) {
        output += property + ': ' + object[property]+'; ';
    }
    print(output);
}

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

function notify(msg, details) {
    // set notifications icon
    let source = new MessageTray.Source("NASA APOD", 'nasa');
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
    notification.setTransient(true);
    // Add action to open NASA APOD website with default browser
    notification.addAction("NASA APOD website", Lang.bind(this, function() {
        Util.spawn(["xdg-open", NasaApodWebsiteURL]);
    }));
    source.notify(notification);
}

function notifyError(msg) {
    Main.notifyError("NASA APOD extension error", msg);
}

function setBackground(uri) {
    let gsettings = new Gio.Settings({schema: 'org.gnome.desktop.background'});
    gsettings.set_string('picture-uri', uri);
    Gio.Settings.sync();
    gsettings.apply();
}


let httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(httpSession, new Soup.ProxyResolverDefault());

const NasaApodIndicator = new Lang.Class({
    Name: IndicatorName,
    Extends: PanelMenu.Button,

    _init: function() {
        this.parent(0.0, IndicatorName);

        this.icon = new St.Icon({icon_name: 'nasa', style_class: 'system-status-icon'});
        this.actor.add_child(this.icon);

        this.title = "";
        this.explanation = "";
        this.filename = "";
        this._updatePending = false;
        this._timeout = null;

        this.showItem = new PopupMenu.PopupMenuItem("Show description");
        this.wallpaperItem = new PopupMenu.PopupMenuItem("Set wallpaper");
        this.refreshItem = new PopupMenu.PopupMenuItem("Refresh");
        this.menu.addMenuItem(this.showItem);
        this.menu.addMenuItem(this.wallpaperItem);
        this.menu.addMenuItem(this.refreshItem);
        this.showItem.connect('activate', Lang.bind(this, this._showDescription));
        this.wallpaperItem.connect('activate', Lang.bind(this, function () {
            if (this.filename != "")
                setBackground(this.filename);
            else
                this._refresh();
        }));
        this.refreshItem.connect('activate', Lang.bind(this, this._refresh));

        this.actor.connect('button-press-event', Lang.bind(this, function () {
            this.refreshItem.setSensitive(!this._updatePending);
            this.showItem.setSensitive(!this._updatePending);
        }));

        this._refresh();
    },

    _restartTimeout: function() {
        if (this._timeout)
            Mainloop.source_remove(this._timeout);
        this._timeout = Mainloop.timeout_add_seconds(TIMEOUT_SECONDS, Lang.bind(this, this._refresh));
    },

    _showDescription: function() {
        if (this.title == "" && this.explanation == "") {
            this._refresh();
        } else {
            notify(this.title, this.explanation);
        }
    },

    _refresh: function() {
        if (this._updatePending)
            return;
        this._updatePending = true;

        this._restartTimeout();

        // TODO: add settings to specify user's API key
        let apiKey = DefaultAPIKey;

        // create an http message
        let request = Soup.Message.new('GET', NasaApodURL + '?api_key=' + apiKey);

        // queue the http request
        httpSession.queue_message(request, Lang.bind(this, function(httpSession, message) {
            if (message.status_code == 200) {
                let data = message.response_body.data;
                this._parseData(data);
            } else if (message.status_code == 403) {
                notifyError("Error 403: check your NASA API key");
                this._updatePending = false;
            }
        }));
    },

    _parseData: function(data) {
        let parsed = JSON.parse(data);

        this.title = parsed['title']
        this.explanation = parsed['explanation'];

        if (parsed['media_type'] == "image") {
            let url = parsed['hdurl'];
            this.filename = NasaApodDir + parsed['date'] + '-' + parsed['title'] + '.jpg';
            let file = Gio.file_new_for_path(this.filename);
            if (!file.query_exists(null)) {
                this._download_image(url, file);
            } else {
                this._updatePending = false;
            }
        } else {
            notifyError("Media type " + parsed['media_type'] + " not supported.");
            this._updatePending = false;
        }
    },

    _download_image: function(url, file) {
        print("Downloading " + url + " to " + file.get_uri())

        // open the Gfile
        fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

        // variables for the progress bar
        var total_size;
        var bytes_so_far = 0;

        // create an http message
        var request = Soup.Message.new('GET', url);

        // got_headers event
        request.connect('got_headers', Lang.bind(this, function(message){
            print("got_headers")
            total_size = message.response_headers.get_content_length()
        }));

        // got_chunk event
        request.connect('got_chunk', Lang.bind(this, function(message, chunk){
            bytes_so_far += chunk.length;

            if(total_size) {
                let fraction = bytes_so_far / total_size;
                let percent = Math.floor(fraction * 100);
                print("Download "+percent+"% done ("+bytes_so_far+" / "+total_size+" bytes)");
            }
            fstream.write(chunk.get_data(), null, chunk.length);
        }));

        // queue the http request
        httpSession.queue_message(request, Lang.bind(this, function(httpSession, message) {
            print('Download is done');
            // close the file
            fstream.close(null);
            setBackground(file.get_uri());
            this._showDescription();
            this._updatePending = false;
        }));
    },

    stop: function () {
        if (this._timeout)
            Mainloop.source_remove(this._timeout);
        this._timeout = undefined;
        this.menu.removeAll();
    }
});

let nasaApodIndicator;

function init(extensionMeta) {
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(extensionMeta.path + "/icons");
}

function enable() {
    nasaApodIndicator = new NasaApodIndicator();
    Main.panel.addToStatusArea(IndicatorName, nasaApodIndicator);
}

function disable() {
    nasaApodIndicator.stop();
    nasaApodIndicator.destroy();
}

