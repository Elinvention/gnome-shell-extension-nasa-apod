'use strict';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import * as GeneralPrefs from './preferences/generalPage.js';
import * as NetworkPrefs from './preferences/networkPage.js';
import * as HistoryPrefs from './preferences/historyPage.js';
import * as AboutPrefs from './preferences/aboutPage.js';


export default class NasaApodExtensionPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.search_enabled = true;

        let settings = this.getSettings();

        let provider = new Gtk.CssProvider();
        provider.load_from_path(`${this.path}/preferences/prefs.css`);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

        let settings_page = new GeneralPrefs.GeneralPage(settings);
        let network_page = new NetworkPrefs.NetworkPage(settings);
        let history_page = new HistoryPrefs.HistoryPage(settings);
        let about_page = new AboutPrefs.AboutPage(settings, `${this.path}/icons/nasa.svg`, this.metadata.version.toString());

        window.add(settings_page);
        window.add(network_page);
        window.add(history_page);
        window.add(about_page);
    }
}

