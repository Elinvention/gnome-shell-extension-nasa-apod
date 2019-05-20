const Gettext = imports.gettext;
const Config = imports.misc.config;
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

function getDownloadFolder() {
    let settings = getSettings();
    let NasaApodDir = settings.get_string('download-folder');
    if (NasaApodDir == "")
        NasaApodDir = GLib.get_home_dir() + "/.cache/apod/";
    else if (!NasaApodDir.endsWith('/'))
        NasaApodDir += '/';
    return NasaApodDir;
}

function setBackgroundBasedOnSettings(filename=null) {
    let settings = getSettings();
    let backgroundSettings = getBackgroundSettings();
    let screensaverSettings = getScreenSaverSettings();

    if ((typeof filename === 'string' || filename instanceof String) && !filename.startsWith('file://'))
        filename = 'file://' + filename;

    if (settings.get_boolean('set-background')) {
        if (filename !== null)
            backgroundSettings.set_string('picture-uri', filename);
        let option = settings.get_string('background-options');
        if (option != "default")
            backgroundSettings.set_string('picture-options', option);
    }
    if (settings.get_boolean('set-lock-screen')) {
        if (filename !== null)
            screensaverSettings.set_string('picture-uri', filename);
        let option = settings.get_string('screensaver-options');
        if (option != "default")
            screensaverSettings.set_string('picture-options', option);
    }
    Gio.Settings.sync();
    backgroundSettings.apply();
    screensaverSettings.apply();
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

function parse_path(path) {
    let info = {path: path};
    let splitSlash = path.split('/');
    info.filename = splitSlash.pop();
    info.directory = splitSlash.join('/') + '/';
    let splitDot = info.filename.split('.');
    info.extension = splitDot.pop();
    let splitDash = splitDot.join('.').split('-');
    info.date = splitDash.splice(0, 3).join('-');
    info.title = splitDash.join('-');
    return info;
}

function parse_uri(uri) {
    let splitSlash = uri.split('/');
    let schema = splitSlash.splice(0, 2).join('/') + '/';
    let info = parse_path(splitSlash.join('/'));
    info.schema = schema;
    return info;
}

function getBackgroundSettings() {
    if (getBackgroundSettings._instance)
        return getBackgroundSettings._instance;
    getBackgroundSettings._instance = new Gio.Settings({schema: 'org.gnome.desktop.background'});
    return getBackgroundSettings._instance;
}

function getScreenSaverSettings() {
    if (getScreenSaverSettings._instance)
        return getScreenSaverSettings._instance;
    getScreenSaverSettings._instance = new Gio.Settings({schema: 'org.gnome.desktop.screensaver'});
    return getScreenSaverSettings._instance;
}

function getSettings() {
    if (getSettings._instance)
        return getSettings._instance;

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

    getSettings._instance = new Gio.Settings({settings_schema: schemaObj});
    return getSettings._instance;
}

function initTranslations(domain) {
    let extension = ExtensionUtils.getCurrentExtension();

    domain = domain || extension.metadata['gettext-domain'];

    // check if this extension was built with "make zip", and thus
    // has the locale files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell
    let localeDir = extension.dir.get_child('locale');
    if (localeDir.query_exists(null))
        Gettext.bindtextdomain(domain, localeDir.get_path());
    else
        Gettext.bindtextdomain(domain, Config.LOCALEDIR);
}

