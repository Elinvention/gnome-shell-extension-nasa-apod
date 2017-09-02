
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;

function log(msg) {
    print("NASA APOD extension: " + msg);
}

function dump(object) {
    let output = '';
    for (let property in object) {
        output += property + ': ' + object[property]+'; ';
    }
    log(output);
}

function getDownloadFolder(settings) {
    let NasaApodDir = settings.get_string('download-folder');
    if (NasaApodDir == "")
        NasaApodDir = GLib.get_home_dir() + "/.cache/apod/";
    else if (!NasaApodDir.endsWith('/'))
        NasaApodDir += '/';
    return NasaApodDir;
}

function doSetBackground(uri, schema) {
    let gsettings = new Gio.Settings({schema: schema});
    if (!uri.startsWith('file://'))
        uri = 'file://' + uri
    gsettings.set_string('picture-uri', uri);
    Gio.Settings.sync();
    gsettings.apply();
}

function setBackgroundBasedOnSettings(filename, settings) {
    if (settings.get_boolean('set-background'))
        doSetBackground(filename, 'org.gnome.desktop.background');
    if (settings.get_boolean('set-lock-screen'))
        doSetBackground(filename, 'org.gnome.desktop.screensaver');
}

function list_files(path) {
    let dir = Gio.file_new_for_path(path);
    let files_iter = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let file_names = [];
    let file;
    while ((file = files_iter.next_file(null)) != null) {
        file_names.push(file.get_name());
    }
    file_names.sort();
    return file_names;
}

function getSettings() {
	let extension = ExtensionUtils.getCurrentExtension();
	let schema = 'org.gnome.shell.extensions.nasa-apod';

	const GioSSS = Gio.SettingsSchemaSource;

	// check if this extension was built with "make zip", and thus
	// has the schema files in a subfolder
	// otherwise assume that extension has been installed in the
	// same prefix as gnome-shell (and therefore schemas are available
	// in the standard folders)
	let schemaDir = extension.dir.get_child('schemas');
	let schemaSource;
	if (schemaDir.query_exists(null)) {
		schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),
				GioSSS.get_default(),
				false);
	} else {
		schemaSource = GioSSS.get_default();
	}

	let schemaObj = schemaSource.lookup(schema, true);
	if (!schemaObj) {
		throw new Error('Schema ' + schema + ' could not be found for extension ' +
				extension.metadata.uuid + '. Please check your installation.');
	}

	return new Gio.Settings({settings_schema: schemaObj});
}

