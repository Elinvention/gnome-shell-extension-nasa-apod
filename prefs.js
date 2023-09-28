import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import GdkPixbuf from 'gi://GdkPixbuf';

import * as Utils from './utils.js';

const NasaApodURL = 'https://api.nasa.gov/planetary/apod';


export default class NasaApodExtensionPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.search_enabled = true;

        let settings = this.getSettings();
        
        let provider = new Gtk.CssProvider();
        provider.load_from_path(`${this.path}/prefs.css`);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

        let builder = Gtk.Builder.new();
        builder.add_from_file(`${this.path}/prefs.ui`);
        let settings_page = builder.get_object('settings_page');
        let history_page = builder.get_object('history_page');
        let about_page = builder.get_object('about_page');

        window.add(settings_page);
        window.add(history_page);
        window.add(about_page);
    }
    
    /**
     * @returns {Object} This extension's preference widget
     */
    buildPrefsWidget() {
        let settings = this.getSettings();

        let provider = new Gtk.CssProvider();
        provider.load_from_path(`${this.path}/prefs.css`);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

        // Prepare labels and controls
        let buildable = new Gtk.Builder();
        buildable.add_objects_from_file(`${this.path}/prefs.ui`, ['prefs_widget']);
        let prefsWidget = buildable.get_object('prefs_widget');

        Utils.ext_log(this.metadata);
        buildable.get_object('extension_version').set_text(this.metadata.version.toString());

        let hideSwitch = buildable.get_object('hide');
        let notifySwitch = buildable.get_object('notifications');
        let transientSwitch = buildable.get_object('transient_notifications');
        let bgSwitch = buildable.get_object('background_switch');
        let bgCombo = buildable.get_object('background_combo');
        let downloadButton = buildable.get_object('download_folder');
        let imageResCombo = buildable.get_object('image_resolution_combo');
        let imageResMeteredCombo = buildable.get_object('image_resolution_metered_combo');
        let refreshSwitch = buildable.get_object('autorefresh_metered_network_switch');
        let apiKeysListBox = buildable.get_object('api_keys_listbox');
        let apiKeysAdd = buildable.get_object('api_keys_add');
        let apiKeysReset = buildable.get_object('api_keys_reset');
        let historyFlowBox = buildable.get_object('history_flowbox');
        let historyScroll = buildable.get_object('history_scroll');

        // Work around: GTK4 seems to require absolute file paths in builder files
        let logo = buildable.get_object('logo');
        logo.set_from_file(`${this.path}/icons/nasa.svg`);

        let downloadFolder = Utils.getDownloadFolder(settings);

        // Indicator
        settings.bind('hide', hideSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Notifications
        settings.bind('notify', notifySwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('transient', transientSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        transientSwitch.set_sensitive(settings.get_boolean('notify'));
        settings.connect('changed::notify', function () {
            transientSwitch.set_sensitive(settings.get_boolean('notify'));
        });

        // Wallpaper
        settings.bind('set-background', bgSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('background-options', bgCombo, 'active_id', Gio.SettingsBindFlags.DEFAULT);
        settings.connect('changed::background-options', function () {
            Utils.setBackgroundBasedOnSettings(settings);
        });

        // Download folder
        downloadButton.label = downloadFolder;
        downloadButton.connect('clicked', function () {
            let fileChooser = new Gtk.FileChooserDialog({
                title: _('Choose download folder'),
                action: Gtk.FileChooserAction.SELECT_FOLDER,
                transient_for: prefsWidget.get_root(),
                modal: true,
            });
            fileChooser.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
            fileChooser.add_button(_('Select'), Gtk.ResponseType.ACCEPT);
            fileChooser.add_shortcut_folder(Gio.File.new_for_path(`${GLib.get_user_cache_dir()}/apod`));
            fileChooser.connect('response', function (dialog, response) {
                Utils.ext_log(`FileChooser response: ${response}`);
                if (response === Gtk.ResponseType.ACCEPT) {
                    downloadFolder = `${fileChooser.get_file().get_path()}/`;
                    settings.set_string('download-folder', downloadFolder);
                    downloadButton.label = downloadFolder;
                    // Empty history page
                    let child = historyFlowBox.get_first_child();
                    while (child !== null) {
                        let ex_child = child;
                        child = child.get_next_sibling();
                        historyFlowBox.remove(ex_child);
                    }
                }
                fileChooser.destroy();
            });
            fileChooser.show();
        });

        // Network page
        // - Network usage frame
        settings.bind('image-resolution', imageResCombo, 'active_id', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('image-resolution-metered', imageResMeteredCombo, 'active_id', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('refresh-metered', refreshSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        // - API key frame
        /**
         *
         */
        let populateApiKeysListBox = () => {
            let keys = settings.get_strv('api-keys');
            Utils.ext_log(`keys: ${keys}`);
            let child = apiKeysListBox.get_first_child();
            while (child !== null) {
                let ex_child = child;
                child = child.get_next_sibling();
                Utils.ext_log(`Removing row for ${ex_child.get_child().get_first_child().get_text()}`);
                apiKeysListBox.remove(ex_child);
            }
            keys.forEach((key, index) => {
                let [item, button] = this.buildApiKeyItem(key);
                button.connect('clicked', function () {
                    // array.pop has no argument and always pops the last element of the array
                    // since I don't care about order, copy the last element to the index to be deleted
                    //  and then pop the copied last element
                    Utils.ext_log(`Remove key ${keys[index]}`);
                    keys[index] = keys[keys.length - 1];
                    keys.pop();
                    settings.set_strv('api-keys', keys);
                });
                Utils.ext_log(`Adding row for ${key} at position ${index}`);
                apiKeysListBox.insert(item, index);
            });
        }

        populateApiKeysListBox();
        settings.connect('changed::api-keys', populateApiKeysListBox);

        apiKeysAdd.connect('clicked', () => {
            let [dialog, entry, invalid_lb, checking_lb] = this.buildNewApiKeyDialog();
            dialog.set_transient_for(prefsWidget.get_root());
            entry.connect('changed', async () => {
                let apiKey = entry.get_text();
                let length = apiKey.length;
                entry.set_progress_fraction(length / 40);
                let valid = false;
                if (length === 40) {
                    checking_lb.show();
                    valid = await testApiKey(apiKey);
                    checking_lb.hide();
                }
                invalid_lb.set_visible(length === 40 && valid !== true);
                let ok_btn = dialog.get_widget_for_response(Gtk.ResponseType.OK);
                ok_btn.set_sensitive(length === 40 && valid === true);
            });
            dialog.show();
            dialog.connect('response', function (__, response) {
                if (response === Gtk.ResponseType.OK) {
                    let key = entry.get_text();
                    if (key.length !== 40)
                        return;
                    let keys = settings.get_strv('api-keys');
                    keys.push(key);
                    settings.set_strv('api-keys', keys);
                }
                dialog.destroy();
            });
        });

        apiKeysReset.connect('clicked', function () {
            settings.reset('api-keys');
        });

        // History page
        let file_names = [];
        let pinned = settings.get_string('pinned-background');

        /**
         * @param {number} [limit=6] the number of thumbnails to load at a time
         */
        function load_files_thumbnails(limit = 6) {
            Utils.ext_log('load_files_thumbnails');
            let file_name, i = 0;
            while ((file_name = file_names.pop()) !== undefined && i < limit) {
                try {
                    let path = downloadFolder + file_name;
                    let file = Gio.file_new_for_path(path);
                    let info = Utils.parse_path(path);
                    let child = this.buildHistoryFlowBoxChild(file, info);
                    child.set_name(info.filename);
                    historyFlowBox.insert(child, -1);
                    if (pinned === info.filename)
                        historyFlowBox.select_child(child);
                } catch (err) {
                    Utils.ext_log(err);
                } finally {
                    i++;
                }
            }
        }

        let previous_selection = null;
        historyFlowBox.connect('selected_children_changed', function () {
            let selected = historyFlowBox.get_selected_children();
            if (selected.length > 0) {
                if (selected[0] === previous_selection) {
                    historyFlowBox.unselect_child(previous_selection);
                } else {
                    Utils.ext_log(`Background ${selected[0].get_name()} pinned`);
                    settings.set_string('pinned-background', selected[0].get_name());
                    previous_selection = selected[0];
                }
            } else {
                Utils.ext_log('Background unpinned');
                settings.reset('pinned-background');
                previous_selection = null;
            }
        });
        settings.connect('changed::pinned-background', function (s, key, value) {
            if (value === undefined && previous_selection !== null) {
                historyFlowBox.unselect_child(previous_selection);
                previous_selection = null;
            }
        });


        historyScroll.connect('edge-reached', function (__, pos) {
            if (pos === 3) {  // if user reached the bottom of the SrolledWindow
                Utils.ext_log('Reached bottom of SrolledWindow');
                load_files_thumbnails();
            }
        });

        prefsWidget.connect('switch-page', function (widget, page, page_index) {
            Utils.ext_log(`Switched to page ${page_index}`);
            if (page_index === 2 && historyFlowBox.get_first_child() === null) {
                file_names = Utils.list_files(downloadFolder);
                load_files_thumbnails();
            }
        });

        return prefsWidget;
    }
    
    /**
     * @param {Object} file an open wallpaper file
     * @param {Object} info parsed information from filename
     */
    buildHistoryFlowBoxChild(file, info) {
        if (['jpg', 'png', 'gif'].indexOf(info.extension) < 0)
            throw new Error(`${info.path} is not an image`);

        let buildable = new Gtk.Builder();
        buildable.add_objects_from_file(`${this.path}/prefs.ui`, ['history_flowboxchild']);

        let row = buildable.get_object('history_flowboxchild');
        let title_label = buildable.get_object('title');
        let date_label = buildable.get_object('date');
        let image = buildable.get_object('image');

        let stream = file.read(null);
        GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(stream, 200, 200, true, null, function (source, res) {
            let pix = GdkPixbuf.Pixbuf.new_from_stream_finish(res);
            image.set_from_pixbuf(pix);
        });

        title_label.set_text(info.title);
        date_label.set_text(info.date);

        return row;
    }

    /**
     * Builds a GTK widgeet containing a label with the API key written on it
     *
     * @param {string} apiKey the API key string
     * @returns {Array} First element is the whole item, the second just the button inside the item
     */
    buildApiKeyItem(apiKey) {
        let buildable = new Gtk.Builder();
        buildable.add_objects_from_file(`${this.path}/prefs.ui`, ['api_key_item']);

        let item = buildable.get_object('api_key_item');
        let label = buildable.get_object('api_key_label');
        let button = buildable.get_object('api_key_remove');
        label.set_text(apiKey);
        return [item, button];
    }

    /**
     * @returns {Array} Elements are: dialog widget, entry text, invalid label and checking label
     */
    buildNewApiKeyDialog() {
        let buildable = new Gtk.Builder();
        buildable.add_objects_from_file(`${this.path}/prefs.ui`, ['new_api_key_dialog']);

        let dialog = buildable.get_object('new_api_key_dialog');
        let entry = buildable.get_object('new_api_key_entry');
        let invalid_lb = buildable.get_object('new_api_key_invalid_label');
        let checking_lb = buildable.get_object('new_api_key_checking_label');

        return [dialog, entry, invalid_lb, checking_lb];
    }

}


/**
 * @param {string} apiKey the API key string
 * @returns {Object} a Promise that resolves to true if the api key is valid, false otherwise
 */
function testApiKey(apiKey) {
    Utils.ext_log(`Checking if ${apiKey} is valid...`);
    let httpSession = new Soup.Session();
    let message = Soup.Message.new('GET', `${NasaApodURL}?api_key=${apiKey}`);
    return new Promise(resolve => {
        httpSession.send_async(message, GLib.PRIORITY_DEFAULT, null, (__, ___) => {
            resolve(message.get_status() === Soup.Status.OK);
        });
    });
}

