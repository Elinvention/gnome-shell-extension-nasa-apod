
const St = imports.gi.St;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
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
const Notifications = Me.imports.notifications;

const Gettext = imports.gettext.domain('nasa_apod');
const _ = Gettext.gettext;

const NasaApodURL = "https://api.nasa.gov/planetary/apod";
const NasaApodWebsiteURL = "https://apod.nasa.gov/apod/";
const NasaApodGetYourAPIURL = "https://api.nasa.gov/";

const IndicatorName = "NasaApodIndicator";
const TIMEOUT_SECONDS = 6 * 3600;
const RETRY_RATE_LIMIT_SECONDS = 60 * 5;
const RETRY_NETWORK_UNAVAILABLE = 60;
const ICON = "saturn";


let nasaApodIndicator;
let httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(httpSession, new Soup.ProxyResolverDefault());


function openPrefs() {
    Util.spawn(["gnome-shell-extension-prefs", Me.metadata.uuid]);
}

function xdg_open(url) {
    Utils.log("xdg-open " + url);
    Util.spawn(["xdg-open", url]);
}

const NasaApodIndicator = new Lang.Class({
    Name: IndicatorName,
    Extends: PanelMenu.Button,

    _descriptionActions:  [ {"name": _("NASA APOD website"), "fun": function() { xdg_open(NasaApodWebsiteURL) }} ],
    _apiKeyErrorActions:  [ {"name": _("Get an API key"),    "fun": function() { xdg_open(NasaApodGetYourAPIURL) }},
                            {"name": _("Settings"),          "fun": openPrefs} ],
    _networkErrorActions: [ {"name": _("Retry"),             "fun": Lang.bind(this, function() { this._refresh() })},
                            {"name": _("Settings"),          "fun": openPrefs} ],

    _init: function() {
        this.parent(0.0, IndicatorName);

        this.icon = new St.Icon({icon_name: ICON, style_class: 'system-status-icon'});
        this.actor.add_child(this.icon);

        this.title = "";
        this.explanation = "";
        this.filename = "";
        this.copyright = "";

        this._network_monitor = Gio.network_monitor_get_default();

        this._updatePending = false;
        this._timeout = null;
        this._settings = Utils.getSettings();
        this.actor.visible = !this._settings.get_boolean('hide'); // set initial indicator visibility state
        this._settings.connect('changed::hide', Lang.bind(this, function() {
            this.actor.visible = !this._settings.get_boolean('hide');
        }));

        this.refreshStatusItem = new PopupMenu.PopupMenuItem(_("No refresh scheduled"));
        this.showItem = new PopupMenu.PopupMenuItem(_("Show description"));
        this.wallpaperItem = new PopupMenu.PopupMenuItem(_("Set wallpaper"));
        this.refreshItem = new PopupMenu.PopupMenuItem(_("Refresh"));
        this.settingsItem = new PopupMenu.PopupMenuItem(_("Settings"));
        this.menu.addMenuItem(this.refreshStatusItem);
        this.menu.addMenuItem(this.showItem);
        this.menu.addMenuItem(this.wallpaperItem);
        this.menu.addMenuItem(this.refreshItem);
        this.menu.addMenuItem(this.settingsItem);
        this.refreshStatusItem.setSensitive(false);
        this.showItem.connect('activate', Lang.bind(this, this._showDescription));
        this.wallpaperItem.connect('activate', Lang.bind(this, this._setBackground));
        this.refreshItem.connect('activate', Lang.bind(this, this._refresh));
        this.settingsItem.connect('activate', openPrefs);
        this.actor.connect('button-press-event', Lang.bind(this, this._updateMenuItems));

        this._bgSettings = Utils.getBackgroundSettings();
        this._bgSettings.connect('changed::picture-uri', Lang.bind(this, this._backgroundChanged));
        this._bgChanged = false;

        let json = this._settings.get_string("last-json");
        try {
            this._parseData(json);
        } catch (err) {
            Utils.log("Refresh of JSON data is needed.");
            this._restartTimeout(60);
            return;
        }

        let last_refresh = this._settings.get_uint64("last-refresh");
        let seconds = Math.floor(TIMEOUT_SECONDS - (Date.now() - last_refresh) / 1000);
        if (seconds < 60)
            this._restartTimeout(60);
        else
            this._restartTimeout(seconds);
    },

    _backgroundChanged: function() {
        let uri = this._bgSettings.get_string("picture-uri");
        let info = Utils.parse_uri(uri);
        if (!this._bgChanged && info.directory == Utils.getDownloadFolder(this._settings)) {
            this._refresh(info.date);
        }
        this._bgChanged = false;
    },

    _updateMenuItems: function() {
        // Grey out menu items if an update is pending
        this.refreshItem.setSensitive(!this._updatePending && this._network_monitor.get_network_available());
        this.showItem.setSensitive(!this._updatePending && this.title != "" && this.explanation != "");
        this.wallpaperItem.setSensitive(!this._updatePending && this.filename != "");
    },

    _setBackground: function() {
        if (this.filename == "")
            return;
        this._bgChanged = true;
        Utils.setBackgroundBasedOnSettings(this.filename);
    },

    _restartTimeout: function(seconds = TIMEOUT_SECONDS) {
        if (this._timeout)
            Mainloop.source_remove(this._timeout);
        if (seconds < 0) {
            this.refreshStatusItem.label.set_text(_('No refresh scheduled'));
        } else {
            this._timeout = Mainloop.timeout_add_seconds(seconds, Lang.bind(this, this._refresh));
            let timezone = GLib.TimeZone.new_local();
            let localTime = GLib.DateTime.new_now(timezone).add_seconds(seconds).format('%R');
            this.refreshStatusItem.label.set_text(_('Next refresh: {0}').replace("{0}", localTime));
            Utils.log('Next check in ' + seconds + ' seconds @ local time ' + localTime);
        }
    },

    _showDescription: function() {
        if (this.title == "" && this.explanation == "") {
            this._refresh();
        } else {
            let message = this.explanation;
            if (this.copyright != "")
                message += "\n**Copyright © " + this.copyright + "**"
            Notifications.notify(this.title, message, this._settings.get_boolean('transient'), this._descriptionActions);
        }
    },

    _refresh: function(date = null) {
        if (this._updatePending || !this._network_monitor.get_network_available())
            return true;

        this._updatePending = true;
        this.refreshStatusItem.label.set_text(_('Pending refresh'));

        let apiKey = this._settings.get_string('api-key');

        let url = NasaApodURL + '?api_key=' + apiKey;
        if (typeof date == "string" || date instanceof String)
            url += '&date=' + date;
        Utils.log(url);

        // create an http message
        let request = Soup.Message.new('GET', url);

        // queue the http request
        httpSession.queue_message(request, Lang.bind(this, function(httpSession, message) {
            if (message.status_code == 200) {
                // log remaining requests
                let limit = message.response_headers.get("X-RateLimit-Limit");
                let remaining = message.response_headers.get("X-RateLimit-Remaining");
                Utils.log(remaining + "/" + limit + " requests per hour remaining");

                let data = message.response_body.data;
                this._settings.set_string("last-json", data);
                this._settings.set_uint64("last-refresh", Date.now());
                try {
                    let url = this._parseData(data);
                    this._prepareDownload(url);
                } catch(err) {
                    if ('media_type' in err)
                        if (this._settings.get_boolean('notify'))
                            this._showDescription();
                    else
                        Notifications.notifyError(_("Error downloading image"), err);
                    this._refreshDone();
                }
            } else if (message.status_code == 403) {
                this._refreshDone(-1);
                Notifications.notifyError(_("Invalid NASA API key (error 403)"), 
                    _("Check that your key is correct or use the default key."),
                    this._apiKeyErrorActions
                );
            } else if (message.status_code == 429) {
                Notifications.notifyError(_("Over rate limit (error 429)"),
                    _("Get your API key at https://api.nasa.gov/ to have 1000 requests per hour just for you. Will retry in 5 minutes."),
                    this._apiKeyErrorActions
                );
                this._refreshDone(RETRY_RATE_LIMIT_SECONDS);
            } else {
                Notifications.notifyError(_("Network error"),
                    _("HTTP status code {0}").replace("{0}", message.status_code),
                    this._networkErrorActions
                );
                this._refreshDone();
            }
        }));
    },

    _refreshDone: function(seconds = TIMEOUT_SECONDS) {
        this._updatePending = false;
        this._restartTimeout(seconds);
        this._updateMenuItems();
        Utils.log("Refresh done.");
    },

    _parseData: function(json) {
        let parsed = JSON.parse(json);

        if (parsed['media_type'] == "image") {
            this.title = parsed['title']
            this.explanation = parsed['explanation'];
            if ('copyright' in parsed)
                this.copyright = parsed['copyright'].replace("\n", " ");
            let url = ('hdurl' in parsed) ? parsed['hdurl'] : parsed['url'];
            let url_split = url.split(".");
            let extension = url_split[url_split.length - 1];

            let NasaApodDir = Utils.getDownloadFolder();
            this.filename = NasaApodDir + parsed['date'] + '-' + parsed['title'] + '.' + extension;

            return url;
        } else {
            this.title = _("Media type {0} not supported.").replace("{0}", parsed['media_type']);
            this.explanation = _("No picture for today 😞. Please visit NASA APOD website.");
            this.filename = "";
            this.copyright = "";
            let error = new Error(this.title);
            error.media_type = parsed['media_type'];
            throw error;
        }
    },

    _prepareDownload: function(url) {
        let file = Gio.file_new_for_path(this.filename);
        let NasaApodDir = Utils.getDownloadFolder();
        if (!file.query_exists(null)) {
            let dir = Gio.file_new_for_path(NasaApodDir);
            if (!dir.query_exists(null)) {
                dir.make_directory_with_parents(null);
            }
            this._download_image(url, file);
        } else {
            Utils.log(this.filename + " already downloaded");
            this._setBackground();
            this._refreshDone();
        }
    },

    _download_image: function(url, file) {
        Utils.log("Downloading " + url + " to " + file.get_uri())

        // open the Gfile
        let fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

        // variables for the progress bar
        let total_size;
        let bytes_so_far = 0;

        // create an http message
        let request = Soup.Message.new('GET', url);

        // got_headers event
        request.connect('got_headers', Lang.bind(this, function(message){
            total_size = message.response_headers.get_content_length()
            Utils.log("Download size: " + total_size + "B")
        }));

        // got_chunk event
        request.connect('got_chunk', Lang.bind(this, function(message, chunk){
            bytes_so_far += chunk.length;

            if(total_size) {
                let fraction = bytes_so_far / total_size;
                let percent = Math.floor(fraction * 100);
                this.refreshStatusItem.label.set_text(_("Download {0} done").replace("{0}", percent + '%'));
            }
            let written = fstream.write(chunk.get_data(), null);
            if (written != chunk.length)
                Utils.log("Write error: fstream.write returned " + written + ", but " + chunk.length + " expected");
        }));

        // queue the http request
        httpSession.queue_message(request, Lang.bind(this, function(httpSession, message) {
            // request completed
            fstream.close(null);
            this._refreshDone();
            if (message.status_code == 200) {
                Utils.log('Download successful');
                this._setBackground();
                if (this._settings.get_boolean('notify'))
                    this._showDescription();
            } else {
                Notifications.notifyError(_("Couldn't fetch image from {0}").replace("{0}", url), 
                    _("HTTP status code {0}").replace("{0}", message.status_code),
                    this._networkErrorActions
                );
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

function init(extensionMeta) {
    let theme = imports.gi.Gtk.IconTheme.get_default();
    theme.append_search_path(extensionMeta.path + "/icons");
    Utils.initTranslations("nasa_apod");
}

function enable() {
    nasaApodIndicator = new NasaApodIndicator();
    Main.panel.addToStatusArea(IndicatorName, nasaApodIndicator);
}

function disable() {
    nasaApodIndicator.stop();
    nasaApodIndicator.destroy();
}

