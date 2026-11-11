/* exported AboutPage */
'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';


export const AboutPage = GObject.registerClass(
class NasaApodAboutPage extends Adw.PreferencesPage {
    constructor(settings, image_path, version) {
        super({
            title: _('About'),
            icon_name: 'help-about-symbolic',
            name: 'AboutPage',
        });

        this._settings = settings;

        // NASA image
        const nasaImage = new Gtk.Image({
            file: image_path,
        });

        const statusPage = new Adw.StatusPage({
            title: _('NASA APOD Wallpaper Changer extension'),
            description: _("Change your wallpaper daily to the NASA's astronomy picture of the day"),
            paintable: nasaImage.get_paintable(),
        });

        // version
        const versionLabel = new Gtk.Label({
            label: `${_('version:')} ${version}`,
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
            justify: Gtk.Justification.CENTER,
        });

        const licenseLabel = new Gtk.Label({
            label: _('<span size="small">This program comes with ABSOLUTELY NO WARRANTY.\n' +
                   'See the <a href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html">GNU General Public License, version 3 or later</a> for details</span>'),
            use_markup: true,
            justify: Gtk.Justification.CENTER,
            wrap: true,
            halign: Gtk.Align.CENTER,
        });

        const child = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            halign: Gtk.Align.CENTER,
        });
        child.append(versionLabel);
        child.append(gitHubLinkButton);
        child.append(issuesLinkButton);
        child.append(releasesLinkButton);
        child.append(creditsLabel);
        child.append(licenseLabel);

        statusPage.set_child(child);

        const aboutGroup = new Adw.PreferencesGroup();
        aboutGroup.add(statusPage);

        this.add(aboutGroup);
    }
});
