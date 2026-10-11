/* exported init */
/* exported buildPrefsWidget */


const {Gtk, Gdk, Gio, GLib, GdkPixbuf} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

// https://wiki.gnome.org/Projects/GnomeShell/Extensions/Writing#Extension_Translations
const Gettext = imports.gettext;
Gettext.textdomain('nasa-apod');
Gettext.bindtextdomain('nasa-apod', Me.dir.get_child('locale').get_path());
const _ = Gettext.gettext;


/**
 * https://gjs.guide/extensions/review-guidelines/review-guidelines.html#only-use-init-for-initialization
 */
function init() {
    ExtensionUtils.initTranslations();
}

/**
 * @param {Object} file an open wallpaper file
 * @param {Object} info parsed information from filename
 */
function buildHistoryFlowBoxChild(file, info) {
    if (['jpg', 'png', 'gif'].indexOf(info.extension) < 0)
        throw new Error(`${info.path} is not an image`);

    let buildable = new Gtk.Builder();
    buildable.add_objects_from_file(`${Me.dir.get_path()}/prefs.ui`, ['history_flowboxchild']);

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
 * @returns {Object} This extension's preference widget
 */
function buildPrefsWidget() {
    let settings = ExtensionUtils.getSettings();

    let provider = new Gtk.CssProvider();
    provider.load_from_path(`${Me.dir.get_path()}/prefs.css`);
    Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default(),
        provider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

    // Prepare labels and controls
    let buildable = new Gtk.Builder();
    buildable.add_objects_from_file(`${Me.dir.get_path()}/prefs.ui`, ['prefs_widget']);
    let prefsWidget = buildable.get_object('prefs_widget');

    buildable.get_object('extension_version').set_text(Me.metadata.version.toString());

    let hideSwitch = buildable.get_object('hide');
    let notifySwitch = buildable.get_object('notifications');
    let transientSwitch = buildable.get_object('transient_notifications');
    let bgSwitch = buildable.get_object('background_switch');
    let tnSwitch = buildable.get_object('thumbnail_switch');
    let bgCombo = buildable.get_object('background_combo');
    let downloadButton = buildable.get_object('download_folder');
    let imageResCombo = buildable.get_object('image_resolution_combo');
    let imageResMeteredCombo = buildable.get_object('image_resolution_metered_combo');
    let refreshSwitch = buildable.get_object('autorefresh_metered_network_switch');
    let historyFlowBox = buildable.get_object('history_flowbox');
    let historyScroll = buildable.get_object('history_scroll');

    // Work around: GTK4 seems to require absolute file paths in builder files
    let logo = buildable.get_object('logo');
    logo.set_from_file(`${Me.dir.get_path()}/icons/nasa.svg`);

    let downloadFolder = Utils.getDownloadFolder();

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
    settings.bind('use-thumbnail', tnSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('background-options', bgCombo, 'active_id', Gio.SettingsBindFlags.DEFAULT);
    settings.connect('changed::background-options', function () {
        Utils.setBackgroundBasedOnSettings();
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

    prefsWidget.connect('switch-page', function (widget, page, page_index) {
        Utils.ext_log(`Switched to page ${page_index}`);
        if (page_index === 2 && historyFlowBox.get_first_child() === null) {
            file_names = Utils.list_files(downloadFolder);
            load_files_thumbnails();
        }
    });

    return prefsWidget;
}
