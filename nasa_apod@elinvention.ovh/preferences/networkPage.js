/* exported NetworkPage */
'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Utils from '../utils/utils.js';


const NasaApodURL = 'https://api.nasa.gov/planetary/apod';


const Resolutions = [
    'hd',
    'low-res',
];


/**
 * Builds a GTK widget containing a label with the API key written on it
 *
 * @param {string} apiKey the API key string
 * @returns {Array} First element is the whole item, the second just the button inside the item
 */
function buildApiKeyItem(apiKey) {
    const item = new Gtk.ListBoxRow();
    const box = new Gtk.Box({

    });
    const label = new Gtk.Label({
        label: apiKey,
        hexpand: true,
    });
    const button = new Gtk.Button({
        label: _('Remove'),
    });

    box.append(label);
    box.append(button);

    item.set_child(box);

    return [item, button];
}

/**
 * @returns {Array} Elements are: dialog widget, entry text, invalid label and checking label
 */
function buildNewApiKeyDialog() {
    const dialog = new Gtk.Dialog({
        width_request: 400,
        height_request: 150,
        title: _('Add NASA APOD API key'),
        modal: true,
        destroy_with_parent: true,
        icon_name: 'list-add',
    });
    const entry = new Gtk.Entry({
        max_length: 40,
        truncate_multiline: true,
        input_hints: Gtk.InputHints.NO_EMOJI | Gtk.InputHints.NO_SPELLCHECK,
    });
    const invalid_lb = new Gtk.Label({
        visible: false,
        label: _('The entered API key is not valid.'),
    });
    const checking_lb = new Gtk.Label({
        visible: false,
        label: 'Checking...',
    });
    const descriptionLabel = new Gtk.Label({
        label: _('The API key has to be 40 characters long.'),
    });

    const content_area = dialog.get_content_area();
    content_area.append(descriptionLabel);
    content_area.append(entry);
    content_area.append(invalid_lb);
    content_area.append(checking_lb);

    dialog.add_button(_('Add'), Gtk.ResponseType.OK);
    dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);

    return [dialog, entry, invalid_lb, checking_lb];
}

/**
 * @param {string} apiKey the API key string
 * @returns {Object} a Promise that resolves to true if the api key is valid, false otherwise
 */
function testApiKey(apiKey) {
    Utils.ext_log(`Checking if ${apiKey} is valid...`);
    const httpSession = new Soup.Session();
    const message = Soup.Message.new('GET', `${NasaApodURL}?api_key=${apiKey}`);
    return new Promise(resolve => {
        httpSession.send_async(message, GLib.PRIORITY_DEFAULT, null, (__, ___) => {
            resolve(message.get_status() === Soup.Status.OK);
        });
    });
}


export var NetworkPage = GObject.registerClass(
class NasaApodNetworkPage extends Adw.PreferencesPage {
    _init(settings) {
        super._init({
            title: _('Network'),
            icon_name: 'network-wireless-symbolic',
            name: 'NetworkPage',
        });
        this._settings = settings;

        // Usage group
        // ---------------
        const usageGroup = new Adw.PreferencesGroup({
            title: _('Network Usage'),
        });

        // Resolution
        const resolutionModel = new Gtk.StringList();
        resolutionModel.append(_('HD version'));
        resolutionModel.append(_('Low resolution version'));

        const resolutionRow = new Adw.ComboRow({
            title: _('Image resolution:'),
            subtitle: _('Image resolution for non metered connections'),
            model: resolutionModel,
            selected: Resolutions.indexOf(this._settings.get_string('image-resolution')),
        });

        // Resolution metered
        const resolutionMeteredRow = new Adw.ComboRow({
            title: _('Image resolution on metered networks:'),
            subtitle: _('Image resolution for metered connections'),
            model: resolutionModel,
            selected: Resolutions.indexOf(this._settings.get_string('image-resolution-metered')),
        });

        // Automatic update on metered connections
        const autoRefreshMeteredSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('refresh-metered'),
        });
        const autoRefreshMeteredRow = new Adw.ActionRow({
            title: _('Automatic refresh on metered networks:'),
            subtitle: '',
            activatable_widget: autoRefreshMeteredSwitch,
        });
        autoRefreshMeteredRow.add_suffix(autoRefreshMeteredSwitch);

        usageGroup.add(resolutionRow);
        usageGroup.add(resolutionMeteredRow);
        usageGroup.add(autoRefreshMeteredRow);
        this.add(usageGroup);

        // API keys group
        // --------------
        const apiKeysGroup = new Adw.PreferencesGroup({
            title: _('API keys'),
        });

        // label
        const apiKeysLabel = new Gtk.Label({
            label: _('API keys can be obtained from the <a href="https://api.nasa.gov/index.html#apply-for-an-api-key">NASA APOD website</a>.\n' +
                     'Each key is limited to 1000 requests per hour, and hence you may not be able ' +
                     'to refresh with the default keys.'),
            use_markup: true,
            justify: Gtk.Justification.CENTER,
            wrap: true,
        });

        // list box
        const apiKeysListBox = new Gtk.ListBox();

        const addRemoveBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.CENTER,
        });
        addRemoveBox.add_css_class('linked');

        const apiKeysAdd = new Gtk.Button({
            label: _('Add'),
        });

        const apiKeysReset = new Gtk.Button({
            label: _('Default'),
        });

        const populateApiKeysListBox = () => {
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
                let [item, button] = buildApiKeyItem(key);
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
        };

        populateApiKeysListBox();
        settings.connect('changed::api-keys', populateApiKeysListBox);

        apiKeysAdd.connect('clicked', () => {
            let [dialog, entry, invalid_lb, checking_lb] = buildNewApiKeyDialog();
            dialog.set_transient_for(this.get_root());
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

        addRemoveBox.append(apiKeysAdd);
        addRemoveBox.append(apiKeysReset);

        apiKeysGroup.add(apiKeysLabel);
        apiKeysGroup.add(apiKeysListBox);
        apiKeysGroup.add(addRemoveBox);
        this.add(apiKeysGroup);

        // Bind signals
        // -------------
        settings.connect('changed::image-resolution', (_settings, key) => {
            resolutionRow.set_selected(Resolutions.indexOf(_settings.get_string(key)));
        });
        settings.connect('changed::image-resolution-metered', (_settings, key) => {
            resolutionMeteredRow.set_selected(Resolutions.indexOf(_settings.get_string(key)));
        });
        resolutionRow.connect('notify::selected', (widget, _spec) => {
            settings.set_string('image-resolution', Resolutions[widget.selected]);
        });
        resolutionMeteredRow.connect('notify::selected', (widget, _spec) => {
            settings.set_string('image-resolution-metered', Resolutions[widget.selected]);
        });

        settings.bind('refresh-metered', autoRefreshMeteredSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    }
});

