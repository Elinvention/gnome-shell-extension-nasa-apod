
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const GdkPixbuf = imports.gi.GdkPixbuf;


let settings;
let css;

function init() {
    settings = Utils.getSettings();
    css = Gtk.CssProvider.get_default();
    css.load_from_path(Me.dir.get_path() + "/theme.css");
    Utils.initTranslations("nasa_apod");
}

function buildHistoryFlowBoxChild(file, info) {

    if (['jpg', 'png', 'gif'].indexOf(info.extension) < 0)
        throw info.path + " is not an image";

    let buildable = new Gtk.Builder();
    buildable.add_objects_from_file(Me.dir.get_path() + '/Settings.ui', ["history_flowboxchild"]);

    let row = buildable.get_object("history_flowboxchild");
    let title_label = buildable.get_object("title");
    let date_label = buildable.get_object("date");
    let image = buildable.get_object("image");

    let stream = file.read(null);
    GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(stream, 200, 200, true, null, function(source, res) {
        let pix = GdkPixbuf.Pixbuf.new_from_stream_finish(res);
        image.set_from_pixbuf(pix);
    });

    title_label.set_text(info.title);
    date_label.set_text(info.date);
    row.get_style_context().add_provider(css, 0);
    return row;
}

function buildApiKeyItem(apiKey) {
    let buildable = new Gtk.Builder();
    buildable.add_objects_from_file(Me.dir.get_path() + '/Settings.ui', ['api_key_item']);

    let item = buildable.get_object('api_key_item');
    let label = buildable.get_object('api_key_label');
    let button = buildable.get_object('api_key_remove');
    label.set_text(apiKey);
    return [item, button];
}

function buildNewApiKeyDialog() {
    let buildable = new Gtk.Builder();
    buildable.add_objects_from_file(Me.dir.get_path() + '/Settings.ui', ['new_api_key_dialog']);

    let dialog = buildable.get_object('new_api_key_dialog');
    let entry = buildable.get_object('new_api_key_entry');

    return [dialog, entry];
}

function buildPrefsWidget(){

    // Prepare labels and controls
    let buildable = new Gtk.Builder();
    buildable.add_objects_from_file(Me.dir.get_path() + '/Settings.ui', ['prefs_widget']);
    let notebook = buildable.get_object('prefs_widget');

    buildable.get_object('extension_version').set_text(Me.metadata.version.toString());

    let hideSwitch = buildable.get_object('hide');
    let notifySwitch = buildable.get_object('notifications');
    let transientSwitch = buildable.get_object('transient_notifications');
    let bgSwitch = buildable.get_object('background_switch');
    let lsSwitch = buildable.get_object('lock_screen_switch');
    let bgCombo = buildable.get_object('background_combo');
    let lsCombo = buildable.get_object('lock_screen_combo');
    let fileChooser = buildable.get_object('download_folder');
    let apiKeysListBox = buildable.get_object('api_keys_listbox');
    let apiKeysAdd = buildable.get_object('api_keys_add');
    let apiKeysReset = buildable.get_object('api_keys_reset');
    let historyFlowBox = buildable.get_object('history_flowbox');
    let historyScroll = buildable.get_object('history_scroll');

    let downloadFolder = Utils.getDownloadFolder();

    // Indicator
    settings.bind('hide', hideSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

    // Notifications
    settings.bind('notify', notifySwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('transient', transientSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

    transientSwitch.set_sensitive(settings.get_boolean('notify'));
    settings.connect('changed::notify', function() {
        transientSwitch.set_sensitive(settings.get_boolean('notify'));
    });

    // Wallpaper and lock screen
    settings.bind('set-background', bgSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('set-lock-screen', lsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('background-options', bgCombo, 'active_id', Gio.SettingsBindFlags.DEFAULT);
    settings.bind('screensaver-options', lsCombo, 'active_id', Gio.SettingsBindFlags.DEFAULT);
    settings.connect('changed::background-options', function() { Utils.setBackgroundBasedOnSettings() });
    settings.connect('changed::screensaver-options', function() { Utils.setBackgroundBasedOnSettings() });


    // Download folder
    fileChooser.set_filename(downloadFolder);
    fileChooser.add_shortcut_folder_uri("file://" + GLib.get_user_cache_dir() + "/apod");
    fileChooser.connect('file-set', function(widget) {
        downloadFolder = widget.get_filename() + '/';
        settings.set_string('download-folder', downloadFolder);
        // Empty history page
        historyFlowBox.get_children().forEach(function(child) {
            child.destroy();
        });
    });

    //API key
    function populateApiKeysListBox() {
        let keys = settings.get_strv('api-keys');
        apiKeysListBox.get_children().forEach(function(child) {
            child.destroy();
        });
        keys.forEach(function(key, index) {
            let [item, button] = buildApiKeyItem(key);
            button.connect('clicked', function () {
                keys.pop(index);
                settings.set_strv('api-keys', keys);
            });
            apiKeysListBox.add(item);
        });
    }

    populateApiKeysListBox();
    settings.connect('changed::api-keys', populateApiKeysListBox);

    apiKeysAdd.connect('clicked', function () {
        let [dialog, entry] = buildNewApiKeyDialog();
        dialog.show();
        dialog.connect('response', function(_, response) {
            if (response == Gtk.ResponseType.OK) {
                let key = entry.get_text();
                if (key.length != 40)
                    return;
                let keys = settings.get_strv('api-keys');
                keys.push(key);
                settings.set_strv('api-keys', keys);
            }
            dialog.destroy();
        });
    });

    apiKeysReset.connect('clicked', function() {
        settings.reset('api-keys');
    });

    // History page
    let file_names = [];
    let pinned = settings.get_string('pinned-background');

    function load_files_thumbnails(limit = 6) {
        let file_name, i = 0;
        while ((file_name = file_names.pop()) != null && i < limit) {
            try {
                let path = downloadFolder + file_name;
                let file = Gio.file_new_for_path(path);
                let info = Utils.parse_path(path);
                let child = buildHistoryFlowBoxChild(file, info);
                child.set_name(info.filename);
                historyFlowBox.add(child);
                if (pinned == info.filename)
                    historyFlowBox.select_child(child);
                i++;
            } catch (err) {
                Utils.log(err);
            }
        };
    };

    let previous_selection = null;
    historyFlowBox.connect('selected_children_changed', function () {
        let selected = historyFlowBox.get_selected_children();
        if (selected.length > 0) {
            if (selected[0] == previous_selection) {
                historyFlowBox.unselect_child(previous_selection);
            } else {
                Utils.log('Background ' + selected[0].get_name() + ' pinned');
                settings.set_string('pinned-background', selected[0].get_name());
                previous_selection = selected[0];
            }
        } else {
            Utils.log('Background unpinned');
            settings.reset('pinned-background');
            previous_selection = null;
        }
    });
    settings.connect('changed::pinned-background', function(s, key, value) {
        if (value === undefined && previous_selection != null) {
            historyFlowBox.unselect_child(previous_selection);
            previous_selection = null;
        }
    });


    historyScroll.connect('edge-reached', function(window, pos) {
        if (pos == 3) {  // if user reached the bottom of the SrolledWindow
            load_files_thumbnails();
        }
    });

    notebook.connect('switch-page', function(widget, page, page_index) {
        if (page_index == 1 && historyFlowBox.get_children().length == 0) {
            file_names = Utils.list_files(downloadFolder);
            load_files_thumbnails();
        }
    });

    notebook.show_all();

    return notebook;
};

