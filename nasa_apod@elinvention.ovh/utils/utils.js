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

    if ((typeof filename === 'string' || filename instanceof String) && !filename.startsWith('file://'))
        filename = `file://${filename}`;

    if (settings.get_boolean('set-background')) {
        if (filename !== null) {
            // force gnome to reload the background
            backgroundSettings.reset('picture-uri');
            backgroundSettings.reset('picture-uri-dark');
            backgroundSettings.set_string('picture-uri', filename);
            backgroundSettings.set_string('picture-uri-dark', filename);
        }
        let option = settings.get_string('background-options');
        if (option !== 'default')
            backgroundSettings.set_string('picture-options', option);
    }

    Gio.Settings.sync();
    backgroundSettings.apply();
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
 * Returns the current background URI.
 *
 * @returns {string} The path to the image used as the current background.
 */
export function getCurrentBackgroundUri() {
    return getBackgroundSettings().get_string('picture-uri');
}

/**
 * @param {Object} httpSession Soup.Session
 * @param {Object} message Soup.message
 * @returns a Promise that resolves with the response body
 */
export function make_request(httpSession, message) {
    return new Promise((resolve, reject) => {
        httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
            if (message.get_status() === Soup.Status.OK) {
                // Successful request
                // log remaining requests
                let limit = message.get_response_headers().get_one('X-RateLimit-Limit');
                let remaining = message.get_response_headers().get_one('X-RateLimit-Remaining');
                ext_log(`${remaining}/${limit} requests per hour remaining`);

                let bytes = httpSession.send_and_read_finish(result);
                let decoder = new TextDecoder('utf-8');
                let response = decoder.decode(bytes.get_data());

                resolve(response);
            } else {
                reject(message.get_status());
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
            if (message.get_status() === Soup.Status.OK) {
                const total_size = message.get_response_headers().get_content_length();
                ext_log(`Download size: ${total_size}B`);

                const input_bytes = session.send_and_read_finish(response_task);
                ext_log(`Downloaded ${input_bytes.get_size()}B`);

                resolve(input_bytes);
            } else {
                reject(message.get_status());
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


