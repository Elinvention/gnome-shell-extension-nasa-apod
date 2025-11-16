/* exported GeneralPage */
'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Utils from '../utils/utils.js';


/**
 * @param {Object} transient_for the returned dialog must be transient for a window
 * @param {Object} settings Gio.Settings object
 * @param {Object} downloadFolderButton Gtk.Button to update label
 */
function openDownloadFolderDialog(transient_for, settings, downloadFolderButton) {
    const fileChooser = new Gtk.FileChooserDialog({
        title: _('Choose download folder'),
        action: Gtk.FileChooserAction.SELECT_FOLDER,
        transient_for,
        modal: true,
    });
    fileChooser.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
    fileChooser.add_button(_('Select'), Gtk.ResponseType.ACCEPT);
    fileChooser.add_shortcut_folder(Gio.File.new_for_path(`${GLib.get_user_cache_dir()}/apod`));
    fileChooser.connect('response', function (dialog, response) {
        Utils.ext_log(`FileChooser response: ${response}`);
        if (response === Gtk.ResponseType.ACCEPT) {
            let downloadFolder = `${fileChooser.get_file().get_path()}/`;
            settings.set_string('download-folder', downloadFolder);
            downloadFolderButton.label = downloadFolder;
            // FIXME: history page should be refreshed
        }
        fileChooser.destroy();
    });
    fileChooser.show();
}


export var GeneralPage = GObject.registerClass(
class NasaApodGeneralPage extends Adw.PreferencesPage {
    _init(settings) {
        super._init({
            title: _('General'),
            icon_name: 'applications-system-symbolic',
            name: 'GeneralPage',
        });
        this._settings = settings;

        // Indicator group
        // ---------------
        let indicatorGroup = new Adw.PreferencesGroup({
            title: _('Indicator'),
        });

        // Show / Hide indicator
        let hideIndicatorSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('hide'),
        });
        let hideIndicatorRow = new Adw.ActionRow({
            title: _('Hide extension indicator'),
            subtitle: _('Simply hides that Saturn thing'),
            activatable_widget: hideIndicatorSwitch,
        });
        hideIndicatorRow.add_suffix(hideIndicatorSwitch);

        indicatorGroup.add(hideIndicatorRow);

        // Indicator position
        let indicatorPositionAdjustment = new Gtk.Adjustment({
            step_increment: 1,
            page_increment: 5,
            page_size: 0,
            lower: -100,
            upper: 100,
            value: this._settings.get_int('indicator-position'),
        });
        let indicatorPositionSpinButton = new Gtk.SpinButton({
            valign: Gtk.Align.CENTER,
            adjustment: indicatorPositionAdjustment,
            climb_rate: 1,
            digits: 0,
        });
        let indicatorPositionRow = new Adw.ActionRow({
            title: _('Indicator position'),
            subtitle: _('Moves the indicator in the status area'),
            activatable_widget: indicatorPositionSpinButton,
        });
        indicatorPositionRow.add_suffix(indicatorPositionSpinButton);

        indicatorGroup.add(indicatorPositionRow);

        this.add(indicatorGroup);

        // Notifications group
        // --------------------
        let notificationsGroup = new Adw.PreferencesGroup({
            title: _('Notifications'),
        });

        let notificationsSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('notify'),
        });
        let notificationsRow = new Adw.ActionRow({
            title: _('Notify when a new image is downloaded'),
            subtitle: _('A notification will appear with the explanation of the day'),
            activatable_widget: notificationsSwitch,
        });
        notificationsRow.add_suffix(notificationsSwitch);

        let transientCheckButton = new Gtk.CheckButton({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('transient'),
        });
        let transientRow = new Adw.ActionRow({
            title: _('Use transient notifications'),
            subtitle: _('Just hover with your mouse to dismiss it'),
            activatable_widget: transientCheckButton,
        });
        transientRow.add_suffix(transientCheckButton);

        notificationsGroup.add(notificationsRow);
        notificationsGroup.add(transientRow);
        this.add(notificationsGroup);

        // Background group
        // --------------------
        let backgroundGroup = new Adw.PreferencesGroup({
            title: _('Background'),
        });

        // Set background
        const backgroundModel = new Gtk.StringList();
        backgroundModel.append('none');
        backgroundModel.append('centered');
        backgroundModel.append('scaled');
        backgroundModel.append('spanned');
        backgroundModel.append('stretched');
        backgroundModel.append('wallpaper');
        backgroundModel.append('zoom');
        backgroundModel.append('default');

        const backgroundComboRow = new Adw.ComboRow({
            title: _('Set background image:'),
            subtitle: _('Set how the image is adapted to the monitor resolution'),
            model: backgroundModel,
            selected: this._settings.get_string('background-options') === 'hd' ? 0 : 1,
        });

        // Download folder
        const downloadFolderRow = new Adw.ActionRow({
            title: _('Download folder'),
        });
        const downloadFolderButton = new Gtk.Button({
            label: Utils.getDownloadFolder(settings),
        });
        downloadFolderButton.connect('clicked', () => openDownloadFolderDialog(this.get_root(), settings, downloadFolderButton));
        downloadFolderRow.add_suffix(downloadFolderButton);
        downloadFolderRow.set_activatable_widget(downloadFolderButton);

        // YouTube API for thumbnails retrieval
        const thumbnailSwitch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
            active: this._settings.get_boolean('use-thumbnail'),
        });
        let thumbnailRow = new Adw.ActionRow({
            title: _('Download thumbnail from YouTube for videos'),
            subtitle: _('If the APOD is a YouTube video, download and use its thumbnail as wallpaper'),
            activatable_widget: thumbnailSwitch,
        });
        thumbnailRow.add_suffix(thumbnailSwitch);

        backgroundGroup.add(downloadFolderRow);
        backgroundGroup.add(thumbnailRow);
        backgroundGroup.add(backgroundComboRow);
        this.add(backgroundGroup);

        // Bind signals
        // --------------
        hideIndicatorSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('hide', widget.get_active());
        });
        indicatorPositionSpinButton.connect('notify::value', widget => {
            Utils.ext_log(`set indicator-position: ${widget.get_value_as_int()}`);
            this._settings.set_int('indicator-position', widget.get_value_as_int());
        });
        notificationsSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('notify', widget.get_active());
        });
        transientCheckButton.connect('notify::active', widget => {
            this._settings.set_boolean('transient', widget.selected);
        });

        backgroundComboRow.connect('notify::selected', widget => {
            this._settings.set_string('background-options', widget.selected_item.get_string());
        });
        settings.connect('changed::background-options', (_settings, _key) => {
            Utils.setBackgroundBasedOnSettings(_settings);
        });
        thumbnailSwitch.connect('notify::active', widget => {
            this._settings.set_boolean('use-thumbnail', widget.get_active());
        });
    }
});

