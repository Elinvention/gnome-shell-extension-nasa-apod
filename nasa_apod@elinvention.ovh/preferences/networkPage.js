/* exported NetworkPage */
'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


const Resolutions = [
    'hd',
    'low-res',
];


export const NetworkPage = GObject.registerClass(
class NasaApodNetworkPage extends Adw.PreferencesPage {
    constructor(settings) {
        super({
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


