/* exported init */
/* exported enable */
/* exported disable */

const St = imports.gi.St;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Timer = Me.imports.timer.Timer;
const Utils = Me.imports.utils;
const Notifications = Me.imports.notifications;

const Gettext = imports.gettext.domain('nasa-apod');
const _ = Gettext.gettext;

const NasaApodURL = 'https://api.nasa.gov/planetary/apod';
const NasaApodWebsiteURL = 'https://apod.nasa.gov/apod/';
const NasaApodGetYourAPIURL = 'https://api.nasa.gov/';

const IndicatorName = 'NasaApodIndicator';
const TIMEOUT_SECONDS = 6 * 3600;
const RETRY_RATE_LIMIT_SECONDS = 60 * 30;
const RETRY_NETWORK_UNAVAILABLE = 60;
const RETRY_NETWORK_ERROR = 600;

let httpSession;
let nasaApodIndicator;


/**
 * @param {string} url An URL to open on the default browser
 */
function xdg_open(url) {
    Utils.ext_log(`xdg-open ${url}`);
    Util.spawn(['xdg-open', url]);
}

/**
 *
 */
function open_website() {
    xdg_open(NasaApodWebsiteURL);
}

/**
 *
 */
function open_getapi() {
    xdg_open(NasaApodGetYourAPIURL);
}

/**
 *
 */
function open_wallpapers_folder() {
    xdg_open(Utils.getDownloadFolder());
}

/**
 * @param {Object} parsed Parsed background image informations
 * @param {string} parsed.media_type Media type of today's APOD
 */
function MediaTypeError(parsed) {
    this.title = _('Media type {0} not supported.').replace('{0}', parsed['media_type']);
    this.message = _('No picture for today 😞. Please visit NASA APOD website.');
    this.parsed = parsed;
}
MediaTypeError.prototype = Object.create(Error.prototype);
MediaTypeError.prototype.name = 'MediaTypeError';
MediaTypeError.prototype.constructor = MediaTypeError;

/**
 * @param {Object} item A label object
 * @param {string} text Text to set on the label
 */
function set_text(item, text) {
    item.visible = Boolean(text);
    item.label.set_text(text);
}


const NasaApodIndicator = GObject.registerClass({
    GTypeName: IndicatorName,
}, class NasaApodIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, IndicatorName);

        this._descriptionActions  = [{'name': _('NASA APOD website'), 'fun': open_website}];
        this._apiKeyErrorActions  = [{'name': _('Get an API key'), 'fun': open_getapi},
            {'name': _('Settings'), 'fun': () => ExtensionUtils.openPrefs()}];
        this._networkErrorActions = [{'name': _('Retry'), 'fun': () => this._refresh(true)},
            {'name': _('Settings'), 'fun': () => ExtensionUtils.openPrefs()}];

        this.indicatorIcon = new St.Icon({style_class: 'system-status-icon'});
        this.indicatorIcon.gicon = Gio.icon_new_for_string(`${Me.path}/icons/saturn.svg`);
        this.add_child(this.indicatorIcon);

        // This object holds title, explanation, copyright and filename
        this.data = {};

        this._network_monitor = Gio.network_monitor_get_default();

        this._updatePending = false;
        this._settings = ExtensionUtils.getSettings();

        // Indicator visibility
        this.visible = !this._settings.get_boolean('hide'); // set initial state
        this._settings.connect('changed::hide', () => {
            this.visible = !this._settings.get_boolean('hide');
        });

        // Build the menu
        this.titleItem = new PopupMenu.PopupMenuItem(_('No title available'));
        this.titleItem.setSensitive(false);
        this.titleItem.remove_style_pseudo_class('insensitive');

        this.descItem = new PopupMenu.PopupMenuItem(_('No description available'));
        this.descItem.label.get_clutter_text().set_line_wrap(true);
        this.descItem.label.set_style('max-width: 400px;');
        this.descItem.setSensitive(false);
        this.descItem.remove_style_pseudo_class('insensitive');

        this.copyItem = new PopupMenu.PopupMenuItem(_('No copyright information available'));
        this.copyItem.setSensitive(false);
        this.copyItem.remove_style_pseudo_class('insensitive');

        this.webItem = new PopupMenu.PopupMenuItem(_('NASA APOD website'));
        this.webItem.connect('activate', open_website);

        this.refreshStatusItem = new PopupMenu.PopupMenuItem(_('No refresh scheduled'));
        this.refreshStatusItem.setSensitive(false);

        this.openWallpaperFolderItem = new PopupMenu.PopupMenuItem(_('Open Wallpaper Folder'));
        this.openWallpaperFolderItem.connect('activate', open_wallpapers_folder);

        this.wallpaperItem = new PopupMenu.PopupMenuItem(_('Set Wallpaper'));
        this.wallpaperItem.connect('activate', this._setBackground.bind(this));

        this.refreshItem = new PopupMenu.PopupMenuItem(_('Refresh'));
        this.refreshItem.connect('activate', this._refreshButton.bind(this));

        this.settingsItem = new PopupMenu.PopupMenuItem(_('Settings'));
        this.settingsItem.connect('activate', () => ExtensionUtils.openPrefs());

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

        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen)
                this._updateMenuItems();
        });

        // Try to parse stored JSON
        let json = this._settings.get_string('last-json');
        try {
            this._parseData(json);
        } catch (e) {
            if (e instanceof MediaTypeError) {
                Utils.ext_log(e.title);
            } else {
                Utils.ext_log('Error parsing stored JSON.');
                Utils.dump(e);
                this._settings.reset('last-json');
                this._settings.reset('last-refresh');
                this._restartTimeout(60);
                return;
            }
        }

        this._settings.connect('changed::api-keys', this._populateKeys.bind(this));
        this._settings.connect('changed::pinned-background', this._pinnedBackground.bind(this));

        if (this._settings.get_string('pinned-background') === '') {
            // Schedule a refresh only if user did not pin a background.
            let seconds = Math.floor(TIMEOUT_SECONDS - this._secondsFromLastRefresh());
            // Wait at least 60 seconds and up to 119 to prevent startup slowness
            if (seconds < 60)
                this._restartTimeout(60 + Math.floor(Math.random() * 60));
            else
                this._restartTimeout(seconds);
        }
    }

    _secondsFromLastRefresh() {
        let last_refresh = this._settings.get_uint64('last-refresh');
        return (Date.now() - last_refresh) / 1000;
    }

    _canRefresh() {
        return !this._updatePending &&
            this._network_monitor.get_network_available() &&
            this._secondsFromLastRefresh() > 10;
    }

    _updateMenuItems() {
        // refreshItem
        if (this._updatePending) {
            this.refreshItem.setSensitive(false);
            set_text(this.refreshItem, _('Refreshing...'));
        } else if (!this._network_monitor.get_network_available()) {
            this.refreshItem.setSensitive(false);
            set_text(this.refreshItem, _('Network unavailable'));
        } else if (this._secondsFromLastRefresh() < 10) {
            this.refreshItem.setSensitive(false);
            set_text(this.refreshItem, _('Wait 10 seconds...'));
            new Timer(10, 'refresh label', this._updateMenuItems.bind(this));
        } else {
            this.refreshItem.setSensitive(true);
            let text = '';
            if (this._settings.get_string('pinned-background') !== '')
                text = _('Unpin and Refresh');
            else
                text = _('Refresh');
            if (this._network_monitor.get_network_metered())
                text += _(' (metered network)');
            set_text(this.refreshItem, text);
        }

        if (this._updatePending) {
            set_text(this.titleItem, '');
            set_text(this.descItem, '');
            set_text(this.copyItem, '');
        } else if ('error' in this.data) {
            set_text(this.titleItem, this.data.error.title);
            set_text(this.descItem, this.data.error.message);
            set_text(this.copyItem, '');
        } else if (!('title' in this.data) || !('explanation' in this.data)) {
            set_text(this.titleItem, '');
            set_text(this.descItem, _("Here will be displayed an explanation of the current NASA's APOD wallpaper. Please press refresh to download a new wallpaper along with the explanation."));
            set_text(this.copyItem, '');
        } else {
            set_text(this.titleItem, `${this.data['title']} (${this.data['date']})`);
            set_text(this.descItem, this.data['explanation']);
            set_text(this.copyItem, this.data['copyright'] !== undefined ? `Copyright © ${this.data['copyright']}` : '');
        }
        this.wallpaperItem.setSensitive(!this._updatePending && 'filename' in this.data);
    }

    _setBackground() {
        if (!('filename' in this.data))
            return;
        Utils.setBackgroundBasedOnSettings(this.data['filename']);
    }

    _restartTimeout(seconds = TIMEOUT_SECONDS) {
        Timer.remove('update');
        if (seconds < 0) {
            this.refreshStatusItem.label.set_text(_('No refresh scheduled'));
            Utils.ext_log('Timeout removed');
        } else {
            if (seconds < 10) {
                seconds = 10; // ensure the timeout is not fired too many times
                Utils.ext_log('Less than 10 seconds timeout?');
            }
            new Timer(seconds, 'update', () => this._refresh(false));
            if (seconds > 60) {
                let timezone = GLib.TimeZone.new_local();
                let localTime = GLib.DateTime.new_now(timezone).add_seconds(seconds).format('%R');
                this.refreshStatusItem.label.set_text(_('Next refresh: {0}').replace('{0}', localTime));
                Utils.ext_log(`Next check @ local time ${localTime}`);
            } else {
                this.refreshStatusItem.label.set_text(_('Next refresh in less than a minute'));
                Utils.ext_log('Next check in less than a minute');
            }
        }
    }

    _notifyAPIResults() {
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
                message += `\n**Copyright © ${this.data['copyright']}**`;
        } else {
            return;
        }
        let transient = this._settings.get_boolean('transient');
        Notifications.notify(title, message, transient, this._descriptionActions);
    }

    _pinnedBackground(settings, key) {
        let pin = settings.get_string(key);
        if (pin !== '') {
            this.data = {filename: Utils.getDownloadFolder() + pin};
            this._setBackground();
        }
        this._restartTimeout(10);
    }

    _populateKeys() {
        this._apiKeys = this._settings.get_strv('api-keys')
                .map(k => [k, Math.random()])
                .sort(([__, a], [___, b]) => a - b)
                .map(([k, __]) => k);
    }

    _refreshButton() {
        if (this._settings.get_string('pinned-background') !== '')
            this._settings.reset('pinned-background');
        this._refresh(true);
    }

    _refresh(user_initiated = false) {
        if (this._updatePending) {
            Utils.ext_log('refresh: a previous refresh is still pending');
            this._refreshDone();
            return;
        }
        if (this._secondsFromLastRefresh() < 10) {
            Utils.ext_log('refresh: wait at least 10 seconds between each requests');
            this._refreshDone(10);
            return;
        }
        if (!this._network_monitor.get_network_available()) {
            Utils.ext_log('refresh: network is not available');
            this._refreshDone(RETRY_NETWORK_UNAVAILABLE);
            return;
        }
        if (!user_initiated && this._network_monitor.get_network_metered() &&
                !this._settings.get_boolean('refresh-metered')) {
            Utils.ext_log('refresh: metered connection detected! Aborting refresh.');
            this._refreshDone(-1);
            return;
        }

        this._updatePending = true;
        this._populateKeys();
        this.refreshStatusItem.label.set_text(_('Pending refresh'));

        let makeRequest = function () {
            if (this._apiKeys.length === 0) {
                Notifications.notifyError(_('Over rate limit (error 429)'),
                    _('Get your API key at https://api.nasa.gov/ to have 1000 requests per hour just for you.'),
                    this._apiKeyErrorActions,
                    user_initiated
                );
                this._populateKeys();
                this._refreshDone(RETRY_RATE_LIMIT_SECONDS);
                return;
            }

            let apiKey = this._apiKeys[0];
            let pinned = this._settings.get_string('pinned-background');
            let url = `${NasaApodURL}?api_key=${apiKey}`;
            if (pinned.length > 0)
                url += `&date=${Utils.parse_path(pinned).date}`;
            Utils.ext_log(url);

            // create an http message
            let request = Soup.Message.new('GET', url);

            // queue the http request
            httpSession.queue_message(request, (session, message) => {
                if (message.status_code === 200) {
                    // Successful request
                    // log remaining requests
                    let limit = message.response_headers.get('X-RateLimit-Limit');
                    let remaining = message.response_headers.get('X-RateLimit-Remaining');
                    Utils.ext_log(`${remaining}/${limit} requests per hour remaining`);

                    let data = message.response_body.data;
                    this._settings.set_string('last-json', data);
                    this._settings.set_uint64('last-refresh', Date.now());
                    try {
                        this._parseData(data);
                        this._prepareDownload(this.data['url']);
                    } catch (e) {
                        if (e instanceof MediaTypeError)
                            this._notifyAPIResults();
                        else
                            Notifications.notifyError(_('Error downloading image'), e);
                        this._refreshDone();
                    }
                } else if (message.status_code === 403) {
                    this._refreshDone(-1);
                    Notifications.notifyError(_('Invalid NASA API key (error 403)'),
                        _('Check that your key is correct or use the default key.'),
                        this._apiKeyErrorActions
                    );
                } else if (message.status_code === 429) {
                    Utils.ext_log(`API key ${this._apiKeys[0]} is rate limited.`);
                    this._apiKeys.shift();
                    makeRequest();
                } else {
                    Notifications.notifyError(_('Network error'),
                        _('HTTP status code {0}.').replace('{0}', message.status_code),
                        this._networkErrorActions,
                        user_initiated
                    );
                    this._refreshDone(RETRY_NETWORK_ERROR);
                }
            });
        }.bind(this);
        makeRequest();
    }

    _refreshDone(seconds = TIMEOUT_SECONDS) {
        this._updatePending = false;
        this._restartTimeout(seconds);
        this._updateMenuItems();
        Utils.ext_log('Refresh done.');
    }

    _parseData(json) {
        let parsed = JSON.parse(json);

        const resolution_setting = this._network_monitor.get_network_metered()
            ? 'image-resolution-metered'
            : 'image-resolution'
        ;
        const use_hd = this._settings.get_string(resolution_setting) === 'hd';

        if (parsed['media_type'] === 'video' && this._settings.get_boolean('use-thumbnail') ) {
            const match = parsed['url'].match(/\/embed\/([a-zA-Z0-9_-]+)/);
            if (match) {
                const video_id = match[1];
                const thumbnail_resolution = use_hd ? 'maxres' : 'hq';
                parsed['url'] = `https://i.ytimg.com/vi/${video_id}/${thumbnail_resolution}default.jpg`;
                parsed['media_type'] = 'image';
                Utils.ext_log(`Replaced video (id=${video_id}) with thumbnail: ${parsed['url']}`);
            }
        }

        if (parsed['media_type'] === 'image') {
            let url_split = parsed['url'].split('.');
            let extension = url_split[url_split.length - 1];
            let NasaApodDir = Utils.getDownloadFolder();

            let date = parsed['date'];
            let title = parsed['title'].replace(/[/\\:]/, '_');
            let filename = GLib.build_filenamev([NasaApodDir, `${date}-${title}.${extension}`]);

            let url = parsed['url'];
            if (use_hd && 'hdurl' in parsed) {
                url = parsed['hdurl'];
            }
            this.data = {
                'title': parsed['title'],
                'explanation': parsed['explanation'],
                'copyright': 'copyright' in parsed ? parsed['copyright'].replace('\n', ' ') : undefined,
                url,
                filename,
                'date': parsed['date'],
            };
        } else {
            this.data = {'error': new MediaTypeError(parsed)};
            throw this.data['error'];
        }
    }

    _prepareDownload() {
        let url = this.data['url'];
        let file = Gio.file_new_for_path(this.data['filename']);
        let NasaApodDir = Utils.getDownloadFolder();
        if (!file.query_exists(null)) {
            let dir = Gio.file_new_for_path(NasaApodDir);
            if (!dir.query_exists(null))
                dir.make_directory_with_parents(null);

            this._download_image(url, file);
        } else {
            Utils.ext_log(`${this.data['filename']} already downloaded`);
            this._setBackground();
            if (this._settings.get_string('pinned-background') === '')
                this._refreshDone();
            else
                this._refreshDone(-1);
        }
    }

    _download_image(url, file) {
        Utils.ext_log(`Downloading ${url} to ${file.get_uri()}`);

        // open the Gfile
        let fstream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

        // variables for the progress bar
        let total_size;
        let bytes_so_far = 0;

        // create an http message
        let request = Soup.Message.new('GET', url);

        // got_headers event
        request.connect('got_headers', message => {
            total_size = message.response_headers.get_content_length();
            Utils.ext_log(`Download size: ${total_size}B`);
        });

        // got_chunk event
        request.connect('got_chunk', (message, chunk) => {
            bytes_so_far += chunk.length;

            if (total_size) {
                let fraction = bytes_so_far / total_size;
                let percent = Math.floor(fraction * 100);
                this.refreshStatusItem.label.set_text(_('Download {0} done').replace('{0}', `${percent}%`));
            }
            let written = fstream.write(chunk.get_data(), null);
            if (written !== chunk.length)
                Utils.ext_log(`Write error: fstream.write returned ${written}, but ${chunk.length} expected`);
        });

        // queue the http request
        httpSession.queue_message(request, (session, message) => {
            // request completed
            fstream.close(null);

            if (message.status_code === 200) {
                Utils.ext_log('Download successful');
                this._setBackground();
                this._notifyAPIResults();
                if (this._settings.get_string('pinned-background') === '')
                    this._refreshDone();
                else
                    this._refreshDone(-1);
            } else {
                Notifications.notifyError(_("Couldn't fetch image from {0}").replace('{0}', url),
                    _('HTTP status code {0}.').replace('{0}', message.status_code),
                    this._networkErrorActions
                );
                file.delete(null);
                this._refreshDone();
            }
        });
    }

    stop() {
        Timer.remove_all();
        this.menu.removeAll();
    }
});

/**
 *
 */
function init() {
    ExtensionUtils.initTranslations('nasa-apod');
}

/**
 *
 */
function enable() {
    httpSession = new Soup.SessionAsync();
    Soup.Session.prototype.add_feature.call(httpSession, new Soup.ProxyResolverDefault());
    nasaApodIndicator = new NasaApodIndicator();
    Main.panel.addToStatusArea(IndicatorName, nasaApodIndicator);
}

/**
 *
 */
function disable() {
    nasaApodIndicator.stop();
    nasaApodIndicator.destroy();
    httpSession = null;
    nasaApodIndicator = null;
}
