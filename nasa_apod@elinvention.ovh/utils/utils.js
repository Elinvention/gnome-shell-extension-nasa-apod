'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';


/**
 * @param {string} msg Message to log
 */
export function ext_log(msg) {
    print(`NASA APOD extension: ${msg}`);
}

/**
 * @param {Object} object Object to dump in the log
 */
export function dump(object) {
    let output = '';
    for (let property in object)
        output += `${property}: ${object[property]};\n`;

    console.log(output);
}

/**
 * @param {Object} settings Gio.Settings object
 * @returns {string} Path to the download folder taken from settings
 */
export function getDownloadFolder(settings) {
    let NasaApodDir = settings.get_string('download-folder');
    if (NasaApodDir === '')
        NasaApodDir = `${GLib.get_home_dir()}/.cache/apod/`;
    else if (!NasaApodDir.endsWith('/'))
        NasaApodDir += '/';
    return NasaApodDir;
}

/**
 * @param {Object} settings Gio.Settings object
 * @param {string} [filename=null] Full path to the background (either uri or absolute path)
 */
export function setBackgroundBasedOnSettings(settings, filename = null) {
    let backgroundSettings = getBackgroundSettings();
    let screensaverSettings = getScreensaverSettings();

    if (typeof filename === 'string' || filename instanceof String)
        filename = Gio.File.new_for_commandline_arg(filename).get_uri();

    let option = settings.get_string('background-options');

    if (settings.get_boolean('set-background')) {
        if (filename !== null) {
            // force gnome to reload the background
            backgroundSettings.reset('picture-uri');
            backgroundSettings.reset('picture-uri-dark');
            backgroundSettings.set_string('picture-uri', filename);
            backgroundSettings.set_string('picture-uri-dark', filename);
        }
        if (option !== 'default')
            backgroundSettings.set_string('picture-options', option);

        Gio.Settings.sync();
        backgroundSettings.apply();
    }

    if (settings.get_boolean('set-lockscreen-background')) {
        if (filename !== null) {
            // force gnome to reload the lockscreen background
            screensaverSettings.reset('picture-uri');
            screensaverSettings.set_string('picture-uri', filename);
            if (screensaverSettings.settings_schema.has_key('picture-uri-dark')) {
                screensaverSettings.reset('picture-uri-dark');
                screensaverSettings.set_string('picture-uri-dark', filename);
            }
        }
        if (option !== 'default' && screensaverSettings.settings_schema.has_key('picture-options'))
            screensaverSettings.set_string('picture-options', option);

        Gio.Settings.sync();
        screensaverSettings.apply();

        // Support modern GNOME Shell lockscreen via Lockscreen Extension if installed
        if (filename !== null) {
            try {
                let lockscreenExtSettings = getLockscreenExtensionSettings();
                if (lockscreenExtSettings) {
                    const shouldBlur = settings.get_boolean('lockscreen-blur');
                    const blurRadius = shouldBlur ? settings.get_int('lockscreen-blur-radius') : 0;
                    for (let i = 1; i <= 4; i++) {
                        if (lockscreenExtSettings.settings_schema.has_key(`background-image-path-${i}`))
                            lockscreenExtSettings.set_string(`background-image-path-${i}`, filename);
                        if (lockscreenExtSettings.settings_schema.has_key(`blur-radius-${i}`))
                            lockscreenExtSettings.set_int(`blur-radius-${i}`, blurRadius);
                        if (lockscreenExtSettings.settings_schema.has_key(`blur-brightness-${i}`))
                            lockscreenExtSettings.set_double(`blur-brightness-${i}`, 0.85);
                    }
                    Gio.Settings.sync();
                    lockscreenExtSettings.apply();
                }
            } catch (e) {
                ext_log(`Could not update lockscreen-extension: ${e}`);
            }
        }
    }
}

/**
 * @param {string} path The path to list
 */
export function list_files(path) {
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
 * @param {string} path The path to the directory
 * @returns {number} The total size of the directory in bytes
 */
export function getDirectorySize(path) {
    let dir = Gio.file_new_for_path(path);
    if (!dir.query_exists(null)) return 0;

    let files_iter = dir.enumerate_children('standard::size', Gio.FileQueryInfoFlags.NONE, null);
    let total_size = 0;
    let file;
    while ((file = files_iter.next_file(null)) !== null)
        total_size += file.get_size();

    return total_size;
}

/**
 * @param {number} bytes Number of bytes
 * @returns {string} Formatted string with units
 */
export function formatSize(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * @param {string} path Path to an image created by this extension.
 * @returns {Object} Contains information parsed from the file name of the image.
 */
export function parse_path(path) {
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
export function parse_uri(uri) {
    let splitSlash = uri.split('/');
    let schema = `${splitSlash.splice(0, 2).join('/')}/`;
    let info = parse_path(splitSlash.join('/'));
    info.schema = schema;
    return info;
}

/**
 * @returns {Object} gsettings singleton with schema 'org.gnome.desktop.background'
 */
export function getBackgroundSettings() {
    if (getBackgroundSettings._instance)
        return getBackgroundSettings._instance;
    getBackgroundSettings._instance = new Gio.Settings({schema: 'org.gnome.desktop.background'});
    return getBackgroundSettings._instance;
}

/**
 * @returns {Object} gsettings singleton with schema 'org.gnome.desktop.screensaver'
 */
export function getScreensaverSettings() {
    if (getScreensaverSettings._instance)
        return getScreensaverSettings._instance;
    getScreensaverSettings._instance = new Gio.Settings({schema: 'org.gnome.desktop.screensaver'});
    return getScreensaverSettings._instance;
}

/**
 * Returns the current background URI.
 *
 * @returns {string} The path to the image used as the current background.
 */
export function getCurrentBackgroundUri() {
    return getBackgroundSettings().get_string('picture-uri');
}

/**
 * Returns the current screensaver background URI.
 *
 * @returns {string} The path to the image used as the current screensaver background.
 */
export function getCurrentScreensaverUri() {
    let extSettings = getLockscreenExtensionSettings();
    if (extSettings && extSettings.settings_schema.has_key('background-image-path-1'))
        return extSettings.get_string('background-image-path-1');
    return getScreensaverSettings().get_string('picture-uri');
}

/**
 * @returns {Object|null} gsettings singleton for 'org.gnome.shell.extensions.lockscreen-extension' if installed
 */
export function getLockscreenExtensionSettings() {
    if (getLockscreenExtensionSettings._instance !== undefined)
        return getLockscreenExtensionSettings._instance;

    try {
        const schemaId = 'org.gnome.shell.extensions.lockscreen-extension';
        const defaultSource = Gio.SettingsSchemaSource.get_default();
        if (defaultSource && defaultSource.lookup(schemaId, true)) {
            getLockscreenExtensionSettings._instance = new Gio.Settings({schema_id: schemaId});
            return getLockscreenExtensionSettings._instance;
        }

        const userSchemaPath = `${GLib.get_home_dir()}/.local/share/gnome-shell/extensions/lockscreen-extension@pratap.fastmail.fm/schemas`;
        const userDir = Gio.File.new_for_path(userSchemaPath);
        if (userDir.query_exists(null)) {
            const schemaSource = Gio.SettingsSchemaSource.new_from_directory(userSchemaPath, defaultSource, false);
            const schema = schemaSource.lookup(schemaId, false);
            if (schema) {
                getLockscreenExtensionSettings._instance = new Gio.Settings({settings_schema: schema});
                return getLockscreenExtensionSettings._instance;
            }
        }
    } catch {
        // Ignored if extension is not installed
    }

    getLockscreenExtensionSettings._instance = null;
    return null;
}

/**
 * @param {Object} httpSession Soup.Session
 * @param {Object} message Soup.message
 * @returns a Promise that resolves with the response body
 */
export function make_request(httpSession, message) {
    return new Promise((resolve, reject) => {
        httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
            try {
                const bytes = session.send_and_read_finish(result);
                if (message.get_status() === Soup.Status.OK) {
                    // Successful request
                    let limit = message.get_response_headers().get_one('X-RateLimit-Limit');
                    let remaining = message.get_response_headers().get_one('X-RateLimit-Remaining');
                    if (limit && remaining)
                        ext_log(`${remaining}/${limit} requests per hour remaining`);

                    let decoder = new TextDecoder('utf-8');
                    let response = decoder.decode(bytes.get_data());

                    resolve(response);
                } else {
                    reject(message.get_status());
                }
            } catch (error) {
                reject(error);
            }
        });
    });
}

/**
 * @param {Object} httpSession Soup.Session
 * @param {Object} message Soup.message
 * @returns a Promise that resolves with the downloaded bytes
 */
export function download_bytes(httpSession, message) {
    return new Promise((resolve, reject) => {
        httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, response_task) => {
            try {
                if (message.get_status() === Soup.Status.OK) {
                    const total_size = message.get_response_headers().get_content_length();
                    ext_log(`Download size: ${total_size}B`);

                    const input_bytes = session.send_and_read_finish(response_task);
                    ext_log(`Downloaded ${input_bytes.get_size()}B`);

                    resolve(input_bytes);
                } else {
                    reject(message.get_status());
                }
            } catch (error) {
                reject(error);
            }
        });
    });
}

/**
 * @param {Object} file a GFile
 * @param {Object} input_bytes GBytes to replace the file contents with
 * @returns a Promise that resolves with etag string
 */
export function replace_contents(file, input_bytes) {
    return new Promise((resolve, reject) => {
        file.replace_contents_async(
            input_bytes,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null,
            (_file, task) => {
                try {
                    const [, etag] = _file.replace_contents_finish(task);
                    ext_log(`etag ${etag}`);
                    resolve(etag);
                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}

/**
 * @param {string} path The path to the directory
 * @returns {number} The mean size of the files in the directory in bytes
 */
export function getMeanImageSize(path) {
    let dir;
    try {
        dir = Gio.file_new_for_path(path);
    } catch {
        return 0;
    }
    
    if (!dir.query_exists(null)) return 0;

    let files_iter = dir.enumerate_children('standard::size', Gio.FileQueryInfoFlags.NONE, null);
    let total_size = 0;
    let count = 0;
    let file;
    while ((file = files_iter.next_file(null)) !== null) {
        total_size += file.get_size();
        count++;
    }

    if (count === 0) return 0;
    return total_size / count;
}

/**
 * @param {Object} settings Gio.Settings object
 */
export function deleteOldImages(settings) {
    const keepDays = settings.get_int('keep-days');
    if (keepDays <= 0) return;

    const downloadFolder = getDownloadFolder(settings);
    const pinned = settings.get_string('pinned-background');
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const fileNames = list_files(downloadFolder);
    for (const fileName of fileNames) {
        if (fileName === pinned) continue;
        
        try {
            const info = parse_path(downloadFolder + fileName);
            if (info.date) {
                const fileDate = new Date(info.date);
                if (!isNaN(fileDate.getTime())) {
                    fileDate.setHours(0, 0, 0, 0);
                    const diffTime = now - fileDate;
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

                    if (diffDays >= keepDays) {
                        const file = Gio.file_new_for_path(downloadFolder + fileName);
                        file.delete(null);
                        ext_log(`Deleted old image: ${fileName}`);
                    }
                }
            }
        } catch (e) {
            ext_log(`Error processing file for deletion: ${fileName} - ${e}`);
        }
    }
}



