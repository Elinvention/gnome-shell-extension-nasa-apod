/* exported AboutPage */
'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


export var AboutPage = GObject.registerClass(
class NasaApodAboutPage extends Adw.PreferencesPage {
    _init(settings, image_path, version) {
        super._init({
            title: _('About'),
            icon_name: 'help-about-symbolic',
            name: 'AboutPage',
        });
        this._settings = settings;

        // About group
        // ---------------
        const aboutGroup = new Adw.PreferencesGroup({
            title: _('About'),
        });

        // NASA image
        const nasaImage = new Gtk.Image({
            file: image_path,
            height_request: 290,
        });

        // Title
        const titleLabel = new Gtk.Label({
            label: '<b>NASA APOD Wallpaper Changer extension</b>',
            justify: Gtk.Justification.CENTER,
            wrap: true,
            halign: Gtk.Align.CENTER,
            use_markup: true,
        });

        // version
        const versionLabel = new Gtk.Label({
            label: `${_('version:')} ${version}`,
            justify: Gtk.Justification.CENTER,
            wrap: true,
            halign: Gtk.Align.CENTER,
        });

        // slogan
        const sloganLabel = new Gtk.Label({
            label: _("Change your wallpaper daily to the NASA's astronomy picture of the day"),
            justify: Gtk.Justification.CENTER,
            wrap: true,
            halign: Gtk.Align.CENTER,
        });

        // Links
        const gitHubLinkButton = new Gtk.LinkButton({
            label: _("Extension's GitHub Webpage"),
            receives_default: true,
            halign: Gtk.Align.CENTER,
            uri: 'https://github.com/Elinvention/gnome-shell-extension-nasa-apod',
        });

        const issuesLinkButton = new Gtk.LinkButton({
            label: _('Issue Tracker'),
            receives_default: true,
            halign: Gtk.Align.CENTER,
            uri: 'https://github.com/Elinvention/gnome-shell-extension-nasa-apod/issues',
        });

        const releasesLinkButton = new Gtk.LinkButton({
            label: _('Changelog'),
            receives_default: true,
            halign: Gtk.Align.CENTER,
            uri: 'https://github.com/Elinvention/gnome-shell-extension-nasa-apod/releases',
        });

        // Credits
        const creditsLabel = new Gtk.Label({
            label: `${_('Brought to you by:')}\nElia Argentieri`,
            halign: Gtk.Align.CENTER,
            justify: Gtk.Justify.CENTER,
            vexpand: true,
            valign: Gtk.Align.END,
        });

        const licenseLabel = new Gtk.Label({
            label: _('<span size="small">This program comes with ABSOLUTELY NO WARRANTY.\n' +
                   'See the <a href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GNU General Public License, version 3 or later</a> for details</span>'),
            use_markup: true,
            justify: Gtk.Justification.CENTER,
            wrap: true,
            halign: Gtk.Align.CENTER,
        });

        aboutGroup.add(nasaImage);
        aboutGroup.add(titleLabel);
        aboutGroup.add(versionLabel);
        aboutGroup.add(sloganLabel);
        aboutGroup.add(gitHubLinkButton);
        aboutGroup.add(issuesLinkButton);
        aboutGroup.add(releasesLinkButton);
        aboutGroup.add(creditsLabel);
        aboutGroup.add(licenseLabel);

        this.add(aboutGroup);
    }
});

