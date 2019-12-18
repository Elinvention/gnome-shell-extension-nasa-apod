
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
const RETRY_RATE_LIMIT_SECONDS = 60 * 30;
const RETRY_NETWORK_UNAVAILABLE = 60;

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

function open_website() {
    xdg_open(NasaApodWebsiteURL);
}

function open_getapi() {
    xdg_open(NasaApodGetYourAPIURL);
}

function open_wallpapers_folder() {
    xdg_open(Utils.getDownloadFolder());
}

function MediaTypeError(parsed) {
    this.title = _("Media type {0} not supported.").replace("{0}", parsed['media_type']);
    this.message = _("No picture for today 😞. Please visit NASA APOD website.")
    this.parsed = parsed;
}
MediaTypeError.prototype = Object.create(Error.prototype);
MediaTypeError.prototype.name = "MediaTypeError";
MediaTypeError.prototype.constructor = MediaTypeError;

function set_text(item, text) {
    item.actor.visible = Boolean(text);
    item.label.set_text(text);
}

const NasaApodIndicator = new Lang.Class({
    Name: IndicatorName,
    Extends: PanelMenu.Button,

    _descriptionActions:  [ {"name": _("NASA APOD website"), "fun": open_website} ],
    _apiKeyErrorActions:  [ {"name": _("Get an API key"),    "fun": open_getapi},
                            {"name": _("Settings"),          "fun": openPrefs} ],
    _networkErrorActions: [ {"name": _("Retry"),             "fun": Lang.bind(this, function() { this._refresh(true) })},
                            {"name": _("Settings"),          "fun": openPrefs} ],

    _init: function() {
        this.parent(0.0, IndicatorName);

        this.indicatorIcon = new St.Icon({style_class: 'system-status-icon'});
        this.indicatorIcon.gicon = Gio.icon_new_for_string(`${Me.path}/icons/saturn.svg`);
        this.actor.add_child(this.indicatorIcon);

        // This object holds title, explanation, copyright and filename
        this.data = {};

        this._network_monitor = Gio.network_monitor_get_default();

        this._updatePending = false;
        this._timeout = null;
        this._settings = Utils.getSettings();

        // Indicator visibility
        this.actor.visible = !this._settings.get_boolean('hide'); // set initial state
        this._settings.connect('changed::hide', Lang.bind(this, function() {
            this.actor.visible = !this._settings.get_boolean('hide');
        }));

        // Build the menu
        this.titleItem = new PopupMenu.PopupMenuItem(_("No title available"));
        this.titleItem.setSensitive(false);
        this.titleItem.actor.remove_style_pseudo_class('insensitive');

        this.descItem = new PopupMenu.PopupMenuItem(_("No description available"));
        this.descItem.label.get_clutter_text().set_line_wrap(true);
        this.descItem.label.set_style("max-width: 400px;");
        this.descItem.setSensitive(false);
        this.descItem.actor.remove_style_pseudo_class('insensitive');

        this.copyItem = new PopupMenu.PopupMenuItem(_("No copyright information available"));
        this.copyItem.setSensitive(false);
        this.copyItem.actor.remove_style_pseudo_class('insensitive');

        this.webItem = new PopupMenu.PopupMenuItem(_("NASA APOD website"));
        this.webItem.connect('activate', open_website);

        this.refreshStatusItem = new PopupMenu.PopupMenuItem(_("No refresh scheduled"));
        this.refreshStatusItem.setSensitive(false);

        this.openWallpaperFolderItem = new PopupMenu.PopupMenuItem(_("Open Wallpaper Folder"));
        this.openWallpaperFolderItem.connect('activate', open_wallpapers_folder);

        this.wallpaperItem = new PopupMenu.PopupMenuItem(_("Set Wallpaper"));
        this.wallpaperItem.connect('activate', Lang.bind(this, this._setBackground));

        this.refreshItem = new PopupMenu.PopupMenuItem(_("Refresh"));
        this.refreshItem.connect('activate', Lang.bind(this, this._refreshButton));

        this.settingsItem = new PopupMenu.PopupMenuItem(_("Settings"));
        this.settingsItem.connect('activate', openPrefs);

        this.menu.addMenuItem(this.titleItem);
        this.menu.addMenuItem(this.descItem);
        this.menu.addMenuItem(this.copyItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this.webItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this.refreshStatusItem);
        this.menu.addMenuItem(this.refreshItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this.openWallpaperFolderItem);
        this.menu.addMenuItem(this.wallpaperItem);
        this.menu.addMenuItem(this.settingsItem);

        this.actor.connect('button-press-event', Lang.bind(this, this._updateMenuItems));

        // Try to parse stored JSON
        let json = this._settings.get_string("last-json");
        try {
            this._parseData(json);
        } catch (e) {
            if (e instanceof MediaTypeError) {
                Utils.log(e.title);
            } else {
                Utils.log("Error parsing stored JSON.");
                Utils.dump(e);
                this._settings.reset("last-json");
                this._settings.reset("last-refresh");
                this._restartTimeout(60);
                return;
            }
        }

        this._settings.connect('changed::api-keys', Lang.bind(this, this._populateKeys));
        this._settings.connect('changed::pinned-background', Lang.bind(this, this._pinnedBackground));

        if (this._settings.get_string('pinned-background') == "") {
            // Schedule a refresh only if user did not pin a background.
            let seconds = Math.floor(TIMEOUT_SECONDS - this._secondsFromLastRefresh());
            // Wait at least 60 seconds and up to 119 to prevent startup slowness
            if (seconds < 60)
                this._restartTimeout(60 + Math.floor(Math.random() * 60));
            else
                this._restartTimeout(seconds);
        }
    },

    _secondsFromLastRefresh: function() {
        let last_refresh = this._settings.get_uint64("last-refresh");
        return (Date.now() - last_refresh) / 1000;
    },

    _canRefresh: function() {
        return !this._updatePending
            && this._network_monitor.get_network_available()
            && this._secondsFromLastRefresh() > 10;
    },

    _updateMenuItems: function() {
        // refreshItem
        if (this._updatePending) {
            this.refreshItem.setSensitive(false);
            set_text(this.refreshItem, _("Refreshing..."));
        } else if (!this._network_monitor.get_network_available()) {
            this.refreshItem.setSensitive(false);
            set_text(this.refreshItem, _("Network unavailable"));
        } else if (this._secondsFromLastRefresh() < 10) {
            this.refreshItem.setSensitive(false);
            set_text(this.refreshItem, _("Wait 10 seconds..."));
        } else {
            this.refreshItem.setSensitive(true);
            if (this._settings.get_string('pinned-background') != "")
                set_text(this.refreshItem, _("Unpin and Refresh"));
            else
                set_text(this.refreshItem, _("Refresh"));
        }

        if (this._updatePending) {
            set_text(this.titleItem, "");
            set_text(this.descItem, "");
            set_text(this.copyItem, "");
        } else if ('error' in this.data) {
            set_text(this.titleItem, this.data.error.title);
            set_text(this.descItem, this.data.error.message);
            set_text(this.copyItem, "");
        } else if (!('title' in this.data) || !('explanation' in this.data)) {
            set_text(this.titleItem, "");
            set_text(this.descItem, _("Here will be displayed an explanation of the current NASA's APOD wallpaper. Please press refresh to download a new wallpaper along with the explanation."));
            set_text(this.copyItem, "");
        } else {
            set_text(this.titleItem, this.data['title'] + ' (' + this.data['date'] + ')');
            set_text(this.descItem, this.data['explanation']);
            set_text(this.copyItem, this.data['copyright'] != undefined ? "Copyright © " + this.data['copyright'] : '');
        }
        this.wallpaperItem.setSensitive(!this._updatePending && 'filename' in this.data);
    },

    _setBackground: function() {
        if (!('filename' in this.data))
            return;
        Utils.setBackgroundBasedOnSettings(this.data['filename']);
    },

    _restartTimeout: function(seconds = TIMEOUT_SECONDS) {
        if (this._timeout)
            Mainloop.source_remove(this._timeout);
        if (seconds < 0) {
            this.refreshStatusItem.label.set_text(_('No refresh scheduled'));
            this._timeout = undefined;
            Utils.log('Timeout removed');
        } else {
            if (seconds < 10) {
                seconds = 10; // ensure the timeout is not fired too many times
                Utils.log('Less than 10 seconds timeout?');
            }
            this._timeout = Mainloop.timeout_add_seconds(seconds, Lang.bind(this, function() { this._refresh(false) }));
            if (seconds > 60) {
                let timezone = GLib.TimeZone.new_local();
                let localTime = GLib.DateTime.new_now(timezone).add_seconds(seconds).format('%R');
                this.refreshStatusItem.label.set_text(_("Next refresh: {0}").replace('{0}', localTime));
                Utils.log('Next check @ local time ' + localTime);
            } else {
                this.refreshStatusItem.label.set_text(_("Next refresh in less than a minute"));
                Utils.log('Next check in less than a minute');
            }
        }
    },

    _notify: function() {
        if (!this._settings.get_boolean('notify'))
            return;
        let title, message;
        if ('error' in this.data) {
            title = this.data['error'].title;
            message = this.data['error'].message;
        } else if ('title' in this.data && 'explanation' in this.data) {
            title = this.data['title'];
            message = this.data['explanation'];
            if ('copyright' in this.data)
                message += "\n**Copyright © " + this.data['copyright'] + "**";
        } else
            return;
        let transient = this._settings.get_boolean('transient');
        Notifications.notify(title, message, transient, this._descriptionActions);
    },

    _pinnedBackground: function(settings, key) {
        let pin = settings.get_string(key);
        if (pin != "") {
            this.data = {filename: Utils.getDownloadFolder() + pin};
            this._setBackground();
        }
        this._restartTimeout(10);
    },

    _populateKeys: function() {
        this._apiKeys = this._settings.get_strv('api-keys')
                .map(k => [k, Math.random()])
                .sort(([_, a], [__, b]) => a - b)
                .map(([k, _]) => k)
    },

    _refreshButton: function() {
        if (this._settings.get_string('pinned-background') != "")
            this._settings.reset('pinned-background');
        this._refresh(true);
    },

    _refresh: function(verbose = false) {
        if (this._updatePending) {
            Utils.log('refresh: a previous refresh is still pending');
            this._refreshDone();
            return;
        }
        if (this._secondsFromLastRefresh() < 10) {
            Utils.log('refresh: wait at least 10 seconds between each requests');
            this._refreshDone(10);
            return;
        }
        if (!this._network_monitor.get_network_available()) {
            Utils.log('refresh: network is not available');
            this._refreshDone(RETRY_NETWORK_UNAVAILABLE);
            return;
        }

        this._updatePending = true;
        this._populateKeys();
        this.refreshStatusItem.label.set_text(_('Pending refresh'));

        let makeRequest = Lang.bind(this, function () {
            if (this._apiKeys.length == 0) {
                if (verbose)
                    Notifications.notifyError(_("Over rate limit (error 429)"),
                        _("Get your API key at https://api.nasa.gov/ to have 1000 requests per hour just for you."),
                       this._apiKeyErrorActions
                    );
                this._populateKeys();
                this._refreshDone(RETRY_RATE_LIMIT_SECONDS);
                return;
            }

            let apiKey = this._apiKeys[0];
            let pinned = this._settings.get_string('pinned-background');
            let url = NasaApodURL + '?api_key=' + apiKey;
            if (pinned.length > 0)
                url += '&date=' + Utils.parse_path(pinned).date;
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
                        this._parseData(data);
                        this._prepareDownload(this.data['url']);
                    } catch(e) {
                        if (e instanceof MediaTypeError)
                            this._notify();
                        else
                            Notifications.notifyError(_("Error downloading image"), e);
                        this._refreshDone();
                    }
                } else if (message.status_code == 403) {
                    this._refreshDone(-1);
                    Notifications.notifyError(_("Invalid NASA API key (error 403)"),
                        _("Check that your key is correct or use the default key."),
                        this._apiKeyErrorActions
                    );
                } else if (message.status_code == 429) {
                    Utils.log("API key " + this._apiKeys[0] + "is rate limited.");
                    this._apiKeys.shift();
                    makeRequest();
                } else {
                    Notifications.notifyError(_("Network error"),
                        _("HTTP status code {0}").replace("{0}", message.status_code),
                        this._networkErrorActions
                    );
                    this._refreshDone();
                }
            }));
        });
        makeRequest();
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
            let get_filename = function() {
                let url_split = parsed['url'].split(".");
                let extension = url_split[url_split.length - 1];
                let NasaApodDir = Utils.getDownloadFolder();
                return NasaApodDir + parsed['date'] + '-' + parsed['title'] + '.' + extension;
            };

            this.data = {
                'title':  parsed['title'],
                'explanation': parsed['explanation'],
                'copyright': ('copyright' in parsed) ? parsed['copyright'].replace('\n', ' ') : undefined,
                'url': ('hdurl' in parsed) ? parsed['hdurl'] : parsed['url'],
                'filename': get_filename(),
                'date': parsed['date'],
            };

        } else {
            this.data = {'error': new MediaTypeError(parsed)};
            throw this.data['error'];
        }
    },

    _prepareDownload: function() {
        let url = this.data['url'];
        let file = Gio.file_new_for_path(this.data['filename']);
        let NasaApodDir = Utils.getDownloadFolder();
        if (!file.query_exists(null)) {
            let dir = Gio.file_new_for_path(NasaApodDir);
            if (!dir.query_exists(null)) {
                dir.make_directory_with_parents(null);
            }
            this._download_image(url, file);
        } else {
            Utils.log(this.data['filename'] + " already downloaded");
            this._setBackground();
            if (this._settings.get_string('pinned-background') == "")
                this._refreshDone();
            else
                this._refreshDone(-1);
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

            if (message.status_code == 200) {
                Utils.log('Download successful');
                this._setBackground();
                this._notify();
                if (this._settings.get_string('pinned-background') == "")
                    this._refreshDone();
                else
                    this._refreshDone(-1);
            } else {
                Notifications.notifyError(_("Couldn't fetch image from {0}").replace("{0}", url), 
                    _("HTTP status code {0}").replace("{0}", message.status_code),
                    this._networkErrorActions
                );
                file.delete(null);
                this._refreshDone();
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
