# AGENTS.md - NASA APOD Wallpaper Changer

## Project Overview
This project is a GNOME Shell extension that automatically updates the desktop wallpaper to NASA's Astronomy Picture of the Day (APOD). It also provides notifications with the image's title and explanation.

### Key Technologies
- **GNOME Shell & GJS**:
  - `main` branch: Modern GNOME environments (tested on GNOME 45–51, modern ES Modules).
  - `gnome-43-44` branch: Legacy GNOME environments (GNOME 43–44, GJS legacy imports, Soup 3.0, GTK4).
  - `gnome-40-42` branch: Legacy GNOME environments (GNOME 40–42, GJS legacy imports, Soup 2.4, GTK3).
- **GTK4 & Libadwaita**: Used for the preferences window on `main` (GTK4 with `prefs.ui` on `gnome-43-44`).
- **Soup 3.0**: For network requests and image downloads on `main` and `gnome-43-44` (Soup 2.4 on `gnome-40-42`).
- **Gio/GLib**: For file system operations and settings management.

### Branch Architecture & Structure
The repository maintains three active branches:

1. **`main` (GNOME 45+)**:
   - Extension source files reside in the subfolder `nasa_apod@elinvention.ovh/`:
     - `extension.js`: Main entry point for extension lifecycle (`enable`/`disable`).
     - `prefs.js`: Entry point for preferences window.
     - `preferences/`: Libadwaita preferences pages (`generalPage.js`, `networkPage.js`, `historyPage.js`, `aboutPage.js`).
     - `utils/`: Utility modules (`utils.js`, `notifications.js`, `timer.js`).
     - `schemas/`: GSettings schema definition (`org.gnome.shell.extensions.nasa-apod.gschema.xml`).
     - `icons/`: Custom SVG and symbolic icons.
     - `locale/`: Translations.
     - `metadata.json`: Extension metadata.

2. **`gnome-43-44` (GNOME 43–44 Legacy)**:
   - Extension source files reside directly in the root directory.
   - GJS legacy imports (`imports.gi.*`, `imports.ui.*`).
   - Uses GTK4 with `prefs.ui` + `buildPrefsWidget` (no Libadwaita pages).
   - Uses Soup 3.0 async/await APIs, like `main`.

3. **`gnome-40-42` (GNOME 40–42 Legacy)**:
   - Extension source files reside directly in the root directory.
   - Uses GTK3 with `prefs.ui` (GtkBuilder) instead of Libadwaita pages.
   - Uses Soup 2.4 APIs instead of Soup 3.0.

## Building and Running
The project uses a `Makefile` for common tasks. When on NixOS, use `nix-shell` to bring all required dependencies (`glib`, `gettext`, `intltool`, `zip`, `gnome-shell`, `nodejs`) into your environment.

### Key Commands
- **Install & Enable**: `make enable` (Packs the extension and enables it in GNOME).
- **Uninstall**: `make uninstall`.
- **Build (Pack)**: `make build` (Creates a `.zip` bundle using `gnome-extensions pack`).
- **Lint**: `make eslint` (Runs ESLint on the source code).
- **Clean**: `make clean` (Removes build artifacts).
- **Translations**: `make potfile` (Updates the `.pot` template for translations).
- **Debug in Nested Shell**: `make nested-shell` (Runs a nested GNOME Shell instance for testing).

### Testing with Distrobox
To test the extension against specific GNOME Shell versions (especially legacy versions like GNOME 40, 42, 43 or 44):
- Create a container: `distrobox create -i registry.fedoraproject.org/fedora:37 -n gnome43-test` (Fedora 38 for GNOME 44, Fedora 34 for GNOME 40)
- Enter and install dependencies: `sudo dnf install gnome-shell gnome-extensions-app make gettext intltool glib2-devel`
- Launch nested shell: `dbus-run-session -- gnome-shell --nested --wayland --no-x11 &`
- Enable extension: `gnome-extensions enable nasa_apod@elinvention.ovh`

## Development Conventions
- **ES6 Modules**: On `main`, use modern JavaScript (`import`/`export`).
- **Linting**: ESLint is used with a configuration tailored for GJS (`eslint.config.js`). Always run `make eslint` before submitting changes.
- **GTK4/Libadwaita**: Preference pages on `main` should use `Adw.PreferencesPage` and associated widgets.
- **Image Scaling**: Use `Gtk.Picture` instead of `Gtk.Image` for scalable content like the NASA logo or thumbnails to ensure correct rendering on HiDPI displays and newer GNOME versions.
- **Internationalization (i18n)**: All user-facing strings must be wrapped in `gettext` calls (usually aliased as `_`).

### Coding Style
- Follow the existing style: 4-space indentation, `camelCase` for variables and functions, `PascalCase` for GObject classes.
- Use `GObject.registerClass` for defining GObject-derived classes.
- Prefer `async/await` for asynchronous operations (e.g., `Soup` requests).

## Releasing & Versioning
The project follows a GNOME-major SemVer scheme: `v<GNOME_BASE>.<RELEASE>.<PATCH>` (e.g. `45.1.0` on `main`, `43.1.0` on `gnome-43-44`, `40.1.0` on `gnome-40-42`).

- Set `"version-name"` in `metadata.json` (e.g., `"version-name": "45.1.0"`). Omit the integer `"version"` field in the repository so extensions.gnome.org (EGO) manages its upload counter independently.
- Make a commit with message `"Release version X.Y.Z"`.
- Tag the commit as an annotated tag `vX.Y.Z` using `--cleanup=verbatim` to preserve Markdown headers:
  ```bash
  git tag -a vX.Y.Z --cleanup=verbatim -m "Version X.Y.Z

  ### Added
  ...
  ### Changed
  ...
  ### Fixed
  ...
  ### Removed
  ..."
  ```
  The changelog must adhere to https://keepachangelog.com/en/1.1.0/
- Push branch and tag (`git push origin <branch> && git push origin vX.Y.Z`) to trigger the GitHub Actions release workflow.
