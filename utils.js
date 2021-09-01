const {Gio, GLib} = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;


/**
 * @param {string} msg Message to log
 */
function log(msg) {
    print(`NASA APOD extension: ${msg}`);
}

/**
 * @param {Object} object Object to dump in the log
 */
function dump(object) {
    let output = '';
    for (let property in object)
        output += `${property}: ${object[property]}; `;

    log(output);
}

/**
 * @returns {string} Path to the download folder taken from settings
 */
function getDownloadFolder() {
    let settings = ExtensionUtils.getSettings();
    let NasaApodDir = settings.get_string('download-folder');
    if (NasaApodDir === '')
        NasaApodDir = `${GLib.get_home_dir()}/.cache/apod/`;
    else if (!NasaApodDir.endsWith('/'))
        NasaApodDir += '/';
    return NasaApodDir;
}

/**
 * @param {string} [filename=null] Full path to the background (either uri or absolute path)
 */
function setBackgroundBasedOnSettings(filename = null) {
    let settings = ExtensionUtils.getSettings();
    let backgroundSettings = getBackgroundSettings();
    let screensaverSettings = getScreenSaverSettings();

    if ((typeof filename === 'string' || filename instanceof String) && !filename.startsWith('file://'))
        filename = `file://${filename}`;

    if (settings.get_boolean('set-background')) {
        if (filename !== null)
            backgroundSettings.set_string('picture-uri', filename);
        let option = settings.get_string('background-options');
        if (option !== 'default')
            backgroundSettings.set_string('picture-options', option);
    }
    if (settings.get_boolean('set-lock-screen')) {
        if (filename !== null)
            screensaverSettings.set_string('picture-uri', filename);
        let option = settings.get_string('screensaver-options');
        if (option !== 'default')
            screensaverSettings.set_string('picture-options', option);
    }
    Gio.Settings.sync();
    backgroundSettings.apply();
    screensaverSettings.apply();
}

/**
 * @param {string} path The path to list
 */
function list_files(path) {
    let dir = Gio.file_new_for_path(path);
    let files_iter = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let file_names = [];
    let file;
    while ((file = files_iter.next_file(null)) !== null)
        file_names.push(file.get_name());

    file_names.sort();
    return file_names;
}

/**
 * @param {string} path Path to an image created by this extension.
 * @returns {Object} Contains information parsed from the file name of the image.
 */
function parse_path(path) {
    if (typeof path !== 'string')
        throw new TypeError('Expected a string path.');
    let info = {path};
    let splitSlash = path.split('/');
    info.filename = splitSlash.pop();
    info.directory = `${splitSlash.join('/')}/`;
    let splitDot = info.filename.split('.');
    info.extension = splitDot.pop();
    let splitDash = splitDot.join('.').split('-');
    info.date = splitDash.splice(0, 3).join('-');
    info.title = splitDash.join('-');
    return info;
}

/**
 * @param {string} uri Uri to an image created by this extension.
 * @returns {Object} Contains information parsed from the file name of the image.
 */
function parse_uri(uri) {
    let splitSlash = uri.split('/');
    let schema = `${splitSlash.splice(0, 2).join('/')}/`;
    let info = parse_path(splitSlash.join('/'));
    info.schema = schema;
    return info;
}

/**
 * @returns {Object} gsettings singleton with schema 'org.gnome.desktop.background'
 */
function getBackgroundSettings() {
    if (getBackgroundSettings._instance)
        return getBackgroundSettings._instance;
    getBackgroundSettings._instance = new Gio.Settings({schema: 'org.gnome.desktop.background'});
    return getBackgroundSettings._instance;
}

/**
 * @returns {Object} gsettings singleton with schema 'org.gnome.desktop.screensaver'
 */
function getScreenSaverSettings() {
    if (getScreenSaverSettings._instance)
        return getScreenSaverSettings._instance;
    getScreenSaverSettings._instance = new Gio.Settings({schema: 'org.gnome.desktop.screensaver'});
    return getScreenSaverSettings._instance;
}
