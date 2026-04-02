# GEMINI.md - NASA APOD Wallpaper Changer

## Project Overview
This project is a GNOME Shell extension that automatically updates the desktop wallpaper to NASA's Astronomy Picture of the Day (APOD). It also provides notifications with the image's title and explanation.

### Key Technologies
- **GNOME Shell & GJS**: Built for modern GNOME environments (tested on GNOME 47-50).
- **GTK4 & Libadwaita**: Used for the preferences window.
- **Soup 3.0**: For network requests and image downloads.
- **Gio/GLib**: For file system operations and settings management.

### Architecture
- `extension.js`: Main entry point for the extension's lifecycle (`enable`/`disable`).
- `prefs.js`: Entry point for the preferences window.
- `preferences/`: Contains individual pages for the Libadwaita preferences window (`generalPage.js`, `networkPage.js`, `historyPage.js`, `aboutPage.js`).
- `utils/`: Core logic for notifications, timers, and general utility functions (`utils.js`).
- `schemas/`: GSettings schema definition.
- `icons/`: Custom SVG icons for the extension.
- `locale/`: Translation files.

## Building and Running
The project uses a `Makefile` for common tasks.

### Key Commands
- **Install & Enable**: `make enable` (Packs the extension and enables it in GNOME).
- **Uninstall**: `make uninstall`.
- **Build (Pack)**: `make build` (Creates a `.zip` bundle using `gnome-extensions pack`).
- **Lint**: `make eslint` (Runs ESLint on the source code).
- **Clean**: `make clean` (Removes build artifacts).
- **Translations**: `make potfile` (Updates the `.pot` template for translations).
- **Debug in Nested Shell**: `make nested-shell` (Runs a nested GNOME Shell instance for testing).

## Development Conventions
- **ES6 Modules**: The project uses modern JavaScript (ESM) as required by newer GNOME Shell versions.
- **Linting**: ESLint is used with a configuration tailored for GJS (`eslint.config.js`). Always run `make eslint` before submitting changes.
- **GTK4/Libadwaita**: Preference pages should use `Adw.PreferencesPage` and associated widgets.
- **Image Scaling**: Use `Gtk.Picture` instead of `Gtk.Image` for scalable content like the NASA logo or thumbnails to ensure correct rendering on HiDPI displays and newer GNOME versions.
- **Internationalization (i18n)**: All user-facing strings must be wrapped in `gettext` calls (usually aliased as `_`).

### Coding Style
- Follow the existing style: 4-space indentation, `camelCase` for variables and functions, `PascalCase` for GObject classes.
- Use `GObject.registerClass` for defining GObject-derived classes.
- Prefer `async/await` for asynchronous operations (e.g., `Soup` requests).

## Releasing
- Increase the version value in `nasa_apod@elinvention.ovh/metadata.json` by 1
- Make a commit with message "Release version X"
- Tag the commit with "Version X" as first line then add a changelog formatted following https://keepachangelog.com/en/1.1.0/
