
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

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const NasaApodURL = "https://api.nasa.gov/planetary/apod";
const NasaApodWebsiteURL = "https://apod.nasa.gov/apod/";
const IndicatorName = "NasaApodIndicator";
const TIMEOUT_SECONDS = 6 * 3600;
const ICON = "saturn"

function log(msg) {
    print("NASA APOD extension: " + msg);
}

// Utility function
function dump(object) {
    let output = '';
    for (let property in object) {
        output += property + ': ' + object[property]+'; ';
    }
    log(output);
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

function notify(msg, details, transient) {
    // set notifications icon
    let source = new MessageTray.Source("NASA APOD", ICON);
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

function doSetBackground(uri, schema) {
    let gsettings = new Gio.Settings({schema: schema});
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

        this.icon = new St.Icon({icon_name: ICON, style_class: 'system-status-icon'});
        this.actor.add_child(this.icon);

        this.title = "";
        this.explanation = "";
        this.filename = "";
        this.copyright = "";
        this._updatePending = false;
        this._timeout = null;

        this._settings = Utils.getSettings();
        this._settings.connect('changed::hide', Lang.bind(this, function() {
            this.actor.visible = !this._settings.get_boolean('hide');
        }));

        this.showItem = new PopupMenu.PopupMenuItem("Show description");
        this.wallpaperItem = new PopupMenu.PopupMenuItem("Set wallpaper");
        this.refreshItem = new PopupMenu.PopupMenuItem("Refresh");
        this.settingsItem = new PopupMenu.PopupMenuItem("Settings");
        this.menu.addMenuItem(this.showItem);
        this.menu.addMenuItem(this.wallpaperItem);
        this.menu.addMenuItem(this.refreshItem);
        this.menu.addMenuItem(this.settingsItem);
        this.showItem.connect('activate', Lang.bind(this, this._showDescription));
        this.wallpaperItem.connect('activate', Lang.bind(this, this._setBackground));
        this.refreshItem.connect('activate', Lang.bind(this, this._refresh));
        this.settingsItem.connect('activate', function() {
            Util.spawn(["gnome-shell-extension-prefs", Me.metadata.uuid]);
        });

        this.actor.connect('button-press-event', Lang.bind(this, function () {
            // Grey out menu items if an update is pending
            this.refreshItem.setSensitive(!this._updatePending);
            this.showItem.setSensitive(!this._updatePending && this.title != "" && this.explanation != "");
            this.wallpaperItem.setSensitive(!this._updatePending && this.filename != "");
        }));

        this._refresh();
    },

    _setBackground: function() {
        if (this.filename == "")
            return;
        if (this._settings.get_boolean('set-background'))
            doSetBackground(this.filename, 'org.gnome.desktop.background');
        if (this._settings.get_boolean('set-lock-screen'))
            doSetBackground(this.filename, 'org.gnome.desktop.screensaver');
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
            let message = this.explanation;
            if (this.copyright != "")
                message += "\n**Copyright © " + this.copyright + "**"
            notify(this.title, message, this._settings.get_boolean('transient'));
        }
    },

    _refresh: function() {
        if (this._updatePending)
            return;
        this._updatePending = true;

        this._restartTimeout();

        let apiKey = this._settings.get_string('api-key');
        log("API key: " + apiKey);

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
            } else {
                notifyError("Network error");
                this._updatePending = false;
            }
        }));
    },

    _parseData: function(data) {
        let parsed = JSON.parse(data);

        if (parsed['media_type'] == "image") {
            this.title = parsed['title']
            this.explanation = parsed['explanation'];
            if ('copyright' in parsed)
                this.copyright = parsed['copyright'];
            let url = ('hdurl' in parsed) ? parsed['hdurl'] : parsed['url'];

            let NasaApodDir = this._settings.get_string('download-folder');
            if (NasaApodDir == "")
                NasaApodDir = GLib.get_home_dir() + "/.cache/apod/";
            else if (!NasaApodDir.endsWith('/'))
                NasaApodDir += '/';
            this.filename = NasaApodDir + parsed['date'] + '-' + parsed['title'] + '.jpg';

            let file = Gio.file_new_for_path(this.filename);
            if (!file.query_exists(null)) {
                let dir = Gio.file_new_for_path(NasaApodDir);
                if (!dir.query_exists(null)) {
                    dir.make_directory_with_parents(null);
                }
                this._download_image(url, file);
            } else {
                log("Image already downloaded");
                this._setBackground();
                this._updatePending = false;
            }
        } else {
            this.title = "Media type " + parsed['media_type'] + " not supported.";
            this.explanation = "No picture for today 😞. Please visit NASA APOD website.";
            this.filename = "";
            this._updatePending = false;
            if (this._settings.get_boolean('notify'))
                this._showDescription();
        }
    },

    _download_image: function(url, file) {
        log("Downloading " + url + " to " + file.get_uri())

        // open the Gfile
        let fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

        // variables for the progress bar
        let total_size;
        let bytes_so_far = 0;

        // create an http message
        let request = Soup.Message.new('GET', url);

        // got_headers event
        request.connect('got_headers', Lang.bind(this, function(message){
            log("got_headers")
            total_size = message.response_headers.get_content_length()
        }));

        // got_chunk event
        request.connect('got_chunk', Lang.bind(this, function(message, chunk){
            bytes_so_far += chunk.length;

            if(total_size) {
                let fraction = bytes_so_far / total_size;
                let percent = Math.floor(fraction * 100);
                log("Download "+percent+"% done ("+bytes_so_far+" / "+total_size+" bytes)");
            }
            fstream.write(chunk.get_data(), null, chunk.length);
        }));

        // queue the http request
        httpSession.queue_message(request, Lang.bind(this, function(httpSession, message) {
            // request completed
            fstream.close(null);
            this._updatePending = false;
            if (message.status_code == 200) {
                log('Download successful');
                this.filename = 
                this._setBackground();
                if (this._settings.get_boolean('notify'))
                    this._showDescription();
            } else {
                notifyError("Couldn't fetch image from " + url);
                file.delete(null);
            }
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
