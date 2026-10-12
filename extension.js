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

const NasaApodURL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const NasaApodWebsiteURL = 'https://science.nasa.gov/apod/';

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
function open_wallpapers_folder() {
    xdg_open(Utils.getDownloadFolder());
}

/**
 * @param {string} html HTML fragment
 * @returns {string} Plain text
 */
function strip_html(html) {
    if (!html)
        return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&#(x[0-9a-f]+|\d+);/gi, (__, code) => {
            const val = code.toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : parseInt(code, 10);
            return String.fromCodePoint(val);
        })
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#039;/g, "'")
        .replace(/&#8211;/g, '–')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

/**
 * Converts a response of the apod-basic endpoint to the shape of the old
 * api.nasa.gov response, which is what _parseData expects.
 *
 * @param {string|object} response Response body of the apod-basic endpoint
 * @returns {object} date, title, explanation, copyright, media_type, url, hdurl
 */
function normalize_apod(response) {
    let entry = typeof response === 'string' ? JSON.parse(response) : response;
    if (Array.isArray(entry))
        entry = entry[0];

    const normalized = {
        'date': entry['date'],
        'title': strip_html(entry['title']),
        'explanation': strip_html(entry['explanation']).replace(/^Explanation:\s*/, ''),
        'media_type': entry['media_type'],
        'url': entry['url'],
        'hdurl': entry['hdurl'],
    };

    const copyright = strip_html(entry['copyright'] ?? entry['credit'] ?? '');
    if (copyright)
        normalized['copyright'] = copyright;

    if (entry['media_type'] === 'image' && entry['hdurl']) {
        const baseImageUrl = entry['hdurl'].split('?')[0];
        normalized['hdurl'] = baseImageUrl;
        normalized['url'] = `${baseImageUrl}?w=960`;
    } else if (entry['media_type'] === 'video') {
        const embed = (entry['basic_html'] ?? '').match(/https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\/[a-zA-Z0-9_-]+/);
        if (embed)
            normalized['url'] = embed[0];
    }

    return normalized;
}

/**
 * @param {Object} parsed Parsed background image informations
 * @param {string} parsed.media_type Media type of today's APOD
 */
function MediaTypeError(parsed) {
    this.title = _('Media type {0} not supported.').replace('{0}', parsed['media_type']);
    this.message = _('No picture for today 😞. Please visit NASA APOD website.');
    if (parsed['media_type'] === 'video') {
        this.message += ' ';
        this.message += _('You can enable YouTube thumbnail download in the settings.');
    }
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

    _refreshButton() {
        if (this._settings.get_string('pinned-background') !== '')
            this._settings.reset('pinned-background');
        this._refresh(true);
    }

    async _refresh(user_initiated = false) {
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
        this.refreshStatusItem.label.set_text(_('Pending refresh'));

        let pinned = this._settings.get_string('pinned-background');
        let url = `${NasaApodURL}?per_page=1`;
        if (pinned.length > 0)
            url = `${NasaApodURL}/${Utils.parse_path(pinned).date.replace(/-/g, '').slice(2)}`;
        Utils.ext_log(url);

        // create an http message
        let message = Soup.Message.new('GET', url);

        try {
            // download response
            const response = JSON.stringify(normalize_apod(await Utils.make_request(httpSession, message)));

            this._settings.set_string('last-json', response);
            this._settings.set_uint64('last-refresh', Date.now());

            this._parseData(response);
            await this._downloadImage();
            this._updatePending = false; // make sure not to repeat while
        } catch (e) {
            Utils.ext_log(e);
            if (e instanceof MediaTypeError) {
                this._notifyAPIResults();
                this._refreshDone();
            } else if (Number.isInteger(e)) {
                if (e === 429) {
                    Notifications.notifyError(
                        _('Over rate limit (error 429)'),
                        _('Too many requests. Please try again later.'),
                        this._networkErrorActions,
                        user_initiated
                    );
                    this._refreshDone(RETRY_RATE_LIMIT_SECONDS);
                } else {
                    Notifications.notifyError(_('Network error'),
                        _('HTTP status code {0}.').replace('{0}', message.get_status()),
                        this._networkErrorActions,
                        user_initiated
                    );
                    this._refreshDone(RETRY_NETWORK_ERROR);
                }
            } else {
                Notifications.notifyError(
                    _('Generic error'),
                    e.toString(),
                    this._networkErrorActions,
                    user_initiated
                );
                this._refreshDone(-1);
            }
        }
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
            : 'image-resolution';
        const use_hd = this._settings.get_string(resolution_setting) === 'hd';

        Utils.ext_log(`Use thumbnail: ${this._settings.get_boolean('use-thumbnail')}`);

        if (parsed['media_type'] === 'video' && this._settings.get_boolean('use-thumbnail')) {
            const match = parsed['url'].match(/\/embed\/([a-zA-Z0-9_-]+)/);
            if (match) {
                const video_id = match[1];
                parsed['hdurl'] = `https://i.ytimg.com/vi/${video_id}/maxresdefault.jpg`;
                parsed['url'] = `https://i.ytimg.com/vi/${video_id}/hqdefault.jpg`;
                parsed['media_type'] = 'image';
                Utils.ext_log(`Replaced video (id=${video_id}) with thumbnail: ${parsed['url']}, hires: ${parsed['hdurl']}`);
            } else if (parsed['hdurl']) {
                const baseImageUrl = parsed['hdurl'].split('?')[0];
                parsed['hdurl'] = baseImageUrl;
                parsed['url'] = `${baseImageUrl}?w=960`;
                parsed['media_type'] = 'image';
                Utils.ext_log(`Replaced video with still image: ${parsed['url']}, hires: ${parsed['hdurl']}`);
            }
        }

        if (parsed['media_type'] === 'image') {
            let url = parsed['url'];
            if (use_hd && 'hdurl' in parsed)
                url = parsed['hdurl'];

            let url_split = url.split('?')[0].split('.');
            let extension = url_split[url_split.length - 1];
            let NasaApodDir = Utils.getDownloadFolder();

            let date = parsed['date'];
            let title = parsed['title'].replace(/[/\\:*?"<>|]/g, '_').trim();
            let filename = GLib.build_filenamev([NasaApodDir, `${date}-${title}.${extension}`]);

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

    async _downloadImage() {
        const url = this.data['url'];
        const file = Gio.file_new_for_path(this.data['filename']);

        if (file.query_exists(null)) {
            const file_size = file.query_info(Gio.FILE_ATTRIBUTE_STANDARD_SIZE, Gio.FileQueryInfoFlags.NONE, null).get_size();
            Utils.ext_log(`${this.data['filename']} file size is ${file_size}B`);
            if (file_size > 0) {
                Utils.ext_log(`${this.data['filename']} already downloaded`);
                try {
                    this._setBackground();
                } catch (e) {
                    Utils.ext_log(`Error applying background: ${e}`);
                } finally {
                    if (this._settings.get_string('pinned-background') === '')
                        this._refreshDone();
                    else
                        this._refreshDone(-1);
                }
                return;
            }
        }

        const NasaApodDir = Utils.getDownloadFolder();
        const dir = Gio.file_new_for_path(NasaApodDir);
        if (!dir.query_exists(null))
            dir.make_directory_with_parents(null);

        Utils.ext_log(`Downloading ${url} to ${file.get_uri()}`);

        // variables for the progress bar
        let total_size = 0;
        let bytes_so_far = 0;

        // create an http message
        const message = Soup.Message.new('GET', url);

        // got-headers event
        message.connect('got-headers', () => {
            total_size = message.get_response_headers().get_content_length();
            if (total_size > 0)
                Utils.ext_log(`Download size: ${Utils.formatSize(total_size)}`);
        });

        this.refreshStatusItem.label.set_text(_('Downloading...'));

        // The per-chunk 'got-body-data' signal was added in libsoup 3.4 (GNOME 44).
        // GNOME 43 ships libsoup 3.2, where only the final download size is available.
        if (GObject.signal_lookup('got-body-data', Soup.Message) !== 0) {
            message.connect('got-body-data', (__, size) => {
                bytes_so_far += size;

                if (total_size > 0) {
                    let fraction = bytes_so_far / total_size;
                    let percent = Math.floor(fraction * 100);
                    this.refreshStatusItem.label.set_text(_('Download {0} done').replace('{0}', `${percent}%`));
                }
            });
        }

        try {
            const downloaded_bytes = await Utils.download_bytes(httpSession, message);
            await Utils.replace_contents(file, downloaded_bytes);

            if (!bytes_so_far)
                bytes_so_far = downloaded_bytes.get_size();
            Utils.ext_log(`Download successful (${Utils.formatSize(bytes_so_far)})`);
            try {
                this._setBackground();
                this._notifyAPIResults();
            } catch (e) {
                Utils.ext_log(`Error applying background/notification: ${e}`);
            } finally {
                if (this._settings.get_string('pinned-background') === '')
                    this._refreshDone();
                else
                    this._refreshDone(-1);
            }
        } catch (e) {
            Utils.ext_log(`Error: ${e}`);
            Notifications.notifyError(_("Couldn't fetch image from {0}").replace('{0}', url),
                _('HTTP status code {0}.').replace('{0}', message.get_status()),
                this._networkErrorActions);
            file.delete(null);
            this._refreshDone();
        }
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
    httpSession = new Soup.Session();
    nasaApodIndicator = new NasaApodIndicator();
    Main.panel.addToStatusArea(IndicatorName, nasaApodIndicator);
}

/**
 *
 */
function disable() {
    nasaApodIndicator.stop();
    nasaApodIndicator.destroy();
    httpSession.abort();
    httpSession = null;
    nasaApodIndicator = null;
}
