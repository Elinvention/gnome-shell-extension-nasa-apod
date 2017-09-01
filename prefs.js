
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const GdkPixbuf = imports.gi.GdkPixbuf;


let settings;
let css;

function init() {
    settings = Utils.getSettings(Me);
    css = Gtk.CssProvider.get_default();
    css.load_from_path(Me.dir.get_path() + "/theme.css");
}

function buildCacheFlowBoxChild(folder, file) {
    let path = folder + file;
    let split = file.split('-');
    let date = split.splice(0, 3).join('-');
    split = split.join('-').split('.');
    let extension = split.pop();
    let title = split.join('-');

    if (['jpg', 'png', 'gif'].indexOf(extension) < 0)
        throw path + " is not an image";

    Utils.log("Loading: " + path);

    let buildable = new Gtk.Builder();
    buildable.add_objects_from_file(Me.dir.get_path() + '/Settings.ui', ["cache_flowchild"]);

    let row = buildable.get_object("cache_flowchild");
    let event = buildable.get_object("event");
    let title_label = buildable.get_object("title");
    let date_label = buildable.get_object("date");
    let image = buildable.get_object("image");
    event.connect('button-press-event', function(widget, event) {
        Utils.setBackgroundBasedOnSettings(path, settings);
    });

    let stream = Gio.file_new_for_path(path).read(null);
    GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(stream, 200, 200, true, null, function(source, res) {
        let pix = GdkPixbuf.Pixbuf.new_from_stream_finish(res);
        image.set_from_pixbuf(pix);
    });

    title_label.set_text(title);
    date_label.set_text(date);
    row.get_style_context().add_provider(css, 0);
    return row;
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
    let bgSwitch = buildable.get_object('background');
    let lsSwitch = buildable.get_object('lock_screen');
    let fileChooser = buildable.get_object('download_folder');
    let apiEntry = buildable.get_object('api_key');
    let cacheFlowBox = buildable.get_object('cache_flowbox');
    let cacheScroll = buildable.get_object('cache_scroll');

    let downloadFolder = Utils.getDownloadFolder(settings);

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

    // Download folder
    fileChooser.set_filename(downloadFolder);
    fileChooser.add_shortcut_folder_uri("file://" + GLib.get_user_cache_dir() + "/apod");
    fileChooser.connect('file-set', function(widget) {
        settings.set_string('download-folder', widget.get_filename());
    });

    //API key
    settings.bind('api-key', apiEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
    settings.connect('changed::api-key', function() {
        if (settings.get_string('api-key') == "")
            settings.reset('api-key');
    });

    // Cache page
    function loadCachePage() {
        let dir = Gio.file_new_for_path(downloadFolder);
        let files_iter = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let file_names = [], file;
        while ((file = files_iter.next_file(null)) != null) {
            file_names.push(file.get_name());
        }
        file_names.sort();

        function load_files_thumbnails() {
            let file, i = 0;
            while ((file = file_names.pop()) != null && i < 10) {
                try {
                    let child = buildCacheFlowBoxChild(downloadFolder, file);
                    cacheFlowBox.add(child);
                } catch (err) {
                    Utils.log(err);
                } finally {
                    i++;
                }
            };
        };

        load_files_thumbnails();

        cacheScroll.connect('edge-reached', function(window, pos) {
            if (pos == 3) {  // if user reached the bottom of the SrolledWindow
                load_files_thumbnails();
            }
        });
    };

    notebook.connect('switch-page', function(widget, page, page_index) {
        if (page_index == 1)
            loadCachePage();
    });

    notebook.show_all();

    return notebook;
};

