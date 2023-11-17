/* exported HistoryPage */
'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GdkPixbuf from 'gi://GdkPixbuf';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Utils from '../utils/utils.js';

const PREVIEW_SIZE = 150;


/**
 * @param {Object} file an open wallpaper file
 * @param {Object} info parsed information from filename
 */
function buildHistoryFlowBoxChild(file, info) {
    if (['jpg', 'png', 'gif'].indexOf(info.extension) < 0)
        throw new Error(`${info.path} is not an image`);

    const row = new Gtk.FlowBoxChild();
    const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
    });
    const title_label = new Gtk.Label({
        label: info.title,
        wrap: true,
    });
    const date_label = new Gtk.Label({
        label: info.date,
        wrap: true,
    });
    const image = new Gtk.Image({
        valign: 'start',
        width_request: PREVIEW_SIZE,
        height_request: PREVIEW_SIZE,
    });

    box.append(title_label);
    box.append(image);
    box.append(date_label);
    row.set_child(box);

    let stream = file.read(null);
    GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(stream, PREVIEW_SIZE, PREVIEW_SIZE, true, null, function (source, res) {
        let pix = GdkPixbuf.Pixbuf.new_from_stream_finish(res);
        image.set_from_pixbuf(pix);
    });

    return row;
}


export var HistoryPage = GObject.registerClass(
class NasaApodHistoryPage extends Adw.PreferencesPage {
    _init(settings) {
        super._init({
            title: _('History'),
            icon_name: 'document-open-recent-symbolic',
            name: 'HistoryPage',
        });
        this._settings = settings;

        // Description label
        const descriptionLabel = new Gtk.Label({
            label: _("You can pin a background by selecting it.\nA pinned background won't be replaced by newer ones."),
            justify: Gtk.Justification.CENTER,
            wrap: true,
        });

        // History page
        let file_names = [];
        const pinned = settings.get_string('pinned-background');
        const downloadFolder = Utils.getDownloadFolder(settings);

        const historyScroll = new Gtk.ScrolledWindow({
            vexpand: true,
        });
        const viewport = new Gtk.Viewport();
        const historyFlowBox = new Gtk.FlowBox({
            column_spacing: 6,
            row_spacing: 6,
            homogeneous: true,
            min_children_per_line: 2,
            max_children_per_line: 5,
            activate_on_single_click: false,
            can_focus: false,
        });

        historyScroll.set_child(viewport);
        viewport.set_child(historyFlowBox);

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
                    let child = buildHistoryFlowBoxChild(file, info);
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

        // FIXME: load images only when opening the page for the first time
        // this.connect('shown', function () {
        if (historyFlowBox.get_first_child() === null) {
            file_names = Utils.list_files(downloadFolder);
            load_files_thumbnails();
        }
        // });

        const historyGroup = new Adw.PreferencesGroup({
            title: _('History'),
        });

        historyGroup.add(descriptionLabel);
        historyGroup.add(historyScroll);

        this.add(historyGroup);
    }
});

