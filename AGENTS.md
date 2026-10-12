# AGENTS.md - NASA APOD Wallpaper Changer

## Project Overview
This project is a GNOME Shell extension that automatically updates the desktop wallpaper to NASA's Astronomy Picture of the Day (APOD). It also provides notifications with the image's title and explanation.

### Key Technologies
- **GNOME Shell & GJS**: This branch (`gnome-43-44`) targets **GNOME 43 and 44** using GJS legacy imports (`imports.gi.*`, `imports.ui.*`). ES Modules are only used on `main` (GNOME 45+).
- **GTK4**: Used for the preferences window (`prefs.ui`, `buildPrefsWidget`). Libadwaita/`fillPreferencesWindow` is only used on `main`.
- **Soup 3.0**: For network requests and image downloads (`new Soup.Session()`, `send_and_read_async`). Soup 2.4 is only used on `gnome-40-42`.
- **Gio/GLib**: For file system operations and settings management.

### Branch Architecture & Structure
The repository maintains multiple active branches:

1. **`main` (GNOME 45+)**:
   - ES Modules, Soup 3.0, GTK4 & Libadwaita, sources in the `nasa_apod@elinvention.ovh/` subfolder.

2. **`gnome-43-44` (this branch, GNOME 43–44)**:
   - Sources reside directly in the root directory.
   - GJS legacy imports (`imports.*`).
   - Soup 3.0 async/await networking.
   - GTK4 monolithic preferences via `prefs.ui` + `buildPrefsWidget`.

3. **`gnome-40-42` (GNOME 40–42)**:
   - GJS legacy imports, Soup 2.4, GTK3.

## Building and Running
The project uses a `Makefile`. On NixOS use `nix-shell` to bring all dependencies (`glib`, `gettext`, `intltool`, `zip`, `gnome-shell`, `nodejs`).

### Key Commands
- **Install & Enable**: `make enable`
- **Uninstall**: `make uninstall`
- **Build (Pack)**: `make build`
- **Lint**: `make eslint` (ESLint flat config in `eslint.config.js`)
- **Clean**: `make clean`
- **Translations**: `make potfile`
- **Debug in Nested Shell**: `make nested-shell`

### Testing with Distrobox
- GNOME 43: `distrobox create -i registry.fedoraproject.org/fedora:37 -n gnome43-test`
- GNOME 44: `distrobox create -i registry.fedoraproject.org/fedora:38 -n gnome44-test`
- Inside the container: `sudo dnf install gnome-shell gnome-extensions-app make gettext intltool glib2-devel`
- Install and launch a nested shell:
  ```bash
  make install
  dbus-run-session -- gnome-shell --nested --wayland --no-x11 &
  gnome-extensions enable nasa_apod@elinvention.ovh
  ```

## Development Conventions
- **Legacy imports**: On this branch use `const X = imports.gi.X;` and `imports.ui.*`/`imports.misc.*`. Do **not** use `import`/`export`.
- **Linting**: Always run `make eslint` before submitting changes.
- **Networking**: Use the Soup 3 async helpers in `utils.js` (`make_request`, `download_bytes`, `replace_contents`).
- **Internationalization (i18n)**: Wrap all user-facing strings in `_()`.
- **Coding Style**: 4-space indentation, `camelCase` for variables/functions, `PascalCase` for GObject classes, `GObject.registerClass` for GObject classes, `async/await` for asynchronous operations.

## Releasing & Versioning
This project follows a GNOME-major SemVer scheme: `v<GNOME_BASE>.<RELEASE>.<PATCH>` (e.g. `43.1.0` on this branch).

- Set `"version-name"` in `metadata.json` (e.g., `"version-name": "43.1.0"`) and omit the integer `"version"` field so extensions.gnome.org manages its upload counter.
- Commit with message `"Release version X.Y.Z"`.
- Tag with `git tag -a vX.Y.Z --cleanup=verbatim -m "Version X.Y.Z ..."`, changelog following https://keepachangelog.com/en/1.1.0/.
- Push branch and tag to trigger the GitHub Actions release workflow.
