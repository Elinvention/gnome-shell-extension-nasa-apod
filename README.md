# GNOME shell extension NASA APOD

Let this simple GNOME shell extension change your wallpaper every day to the
NASA's Astronomy Picture Of the Day. It will also show a notification
containing the title and the explanation of the image.

*Disclaimer*: this extension is unofficial and not affiliated with NASA in any way.
Also note that some images might be protected by copyright.

## Supported GNOME Versions

The extension is maintained across several active branches depending on your GNOME Shell version:

- **`main` branch**: Supports **GNOME 45 through 51+** (modern ES Modules, GTK4 & Libadwaita, Soup 3.0).
- **[`gnome-43-44`](https://github.com/Elinvention/gnome-shell-extension-nasa-apod/tree/gnome-43-44) branch**: Supports legacy **GNOME 43 and 44** (GJS legacy imports, GTK4, Soup 3.0).
- **[`gnome-40-42`](https://github.com/Elinvention/gnome-shell-extension-nasa-apod/tree/gnome-40-42) branch**: Supports legacy **GNOME 40, 41, and 42** (GJS legacy imports, GTK3, Soup 2.4).

When installing from [extensions.gnome.org], the website automatically selects the compatible package for your GNOME Shell version.

## Install

You can install the latest release from [extensions.gnome.org] or download it
from [Github releases][releases].

## Testing

You can help with development by contributing code, testing and reporting issues.

To proceed you need to install dependencies. The method to install them
depends on the distribution you are using. The dependencies are:

1. glib
2. intltool
3. npm

In case you are using *nix*, just run `nix-shell` to bring all required
dependencies in your environment.

The commands below download and install the current development version:

```bash
git clone https://github.com/Elinvention/gnome-shell-extension-nasa-apod.git
cd gnome-shell-extension-nasa-apod

# If on GNOME 43 or 44, switch to the matching branch:
# git checkout gnome-43-44
# If on GNOME 40–42, switch to the legacy branch:
# git checkout gnome-40-42

make enable
```

You can uninstall by running `make uninstall`.

### Testing with Distrobox

You can test the extension on different GNOME Shell versions without setting up full virtual machines by running a nested GNOME Shell instance inside a [Distrobox](https://distrobox.it) container.

1. **Create and enter a container** matching your target GNOME version (e.g. Fedora 34 for GNOME 40, Fedora 36 for GNOME 42, etc.):
   ```bash
   distrobox create -i registry.fedoraproject.org/fedora:34 -n gnome40-test
   distrobox enter gnome40-test
   ```

2. **Install dependencies and GNOME Shell** inside the container:
   ```bash
   sudo dnf install gnome-shell gnome-extensions-app make gettext intltool glib2-devel
   ```
   *(Note: if Mutter cannot find the system D-Bus socket, link it with: `sudo ln -sf /run/host/run/dbus/system_bus_socket /run/dbus/system_bus_socket`)*

3. **Install the extension** inside the container:
   ```bash
   cd gnome-shell-extension-nasa-apod
   # Switch branch if testing GNOME 43-44:
   # git checkout gnome-43-44
   # Switch branch if testing GNOME 40-42:
   # git checkout gnome-40-42
   make install
   ```

4. **Launch the nested GNOME Shell**:
   Start a clean D-Bus session and launch the nested shell in the background, then enable the extension:
   ```bash
   dbus-run-session bash
   gnome-shell --nested --wayland --no-x11 &
   gnome-extensions enable nasa_apod@elinvention.ovh
   ```
   * The `--no-x11` flag avoids Xwayland permission issues in rootless containers.
   * If running from NixOS or a system where host environment variables leak into the container, sanitize them before launching:
     ```bash
     env -u GIO_EXTRA_MODULES -u GI_TYPELIB_PATH -u GDK_PIXBUF_MODULE_FILE -u GTK_PATH -u NIX_GSETTINGS_OVERRIDES_DIR \
         XDG_DATA_DIRS=/usr/local/share:/usr/share XDG_CONFIG_DIRS=/etc/xdg \
         dbus-run-session bash
     ```

## Versioning

This project follows a GNOME-major SemVer scheme:

`v<GNOME_BASE>.<RELEASE>.<PATCH>`

- **`<GNOME_BASE>`**: The baseline GNOME version supported by the branch:
  - `45` on `main` for modern GNOME environments (GNOME 45+ with ESM).
  - `43` on `gnome-43-44` for legacy GNOME environments (GNOME 43–44 with Soup 3.0).
  - `40` on `gnome-40-42` for legacy GNOME environments (GNOME 40–42 with Soup 2.4).
- **`<RELEASE>`**: Minor/feature releases for that specific branch.
- **`<PATCH>`**: Bugfix and maintenance releases.

In `metadata.json`, the user-visible version is specified using `"version-name"` (e.g. `"45.1.0"`). The legacy integer `"version"` field is managed directly by [extensions.gnome.org] to prevent conflicting upload counters across branches.

Release tags use the format `v<GNOME_BASE>.<RELEASE>.<PATCH>` and include changelogs following [Keep a Changelog](https://keepachangelog.com/).

## Translations

You can contribute translations using a software like [Poedit].

1. Download the latest template file (.pot) from [releases].
2. Open the .pot file with Poedit.
2. Choose the language you want to translate to.
3. Translate each string.
4. Save the translation .po file in `nasa_apod@elinvention.ovh/locale/`.
5. You can either make a pull request or make an issue and attach the file or even
send it to me by email (see my profile).

## Screenshots

![NASA APOD extension][screenshot1]  
![Settings][screenshot2]  
![Settings About][screenshot3]  

## Stargazers over time

[![Stargazers over time](https://starchart.cc/Elinvention/gnome-shell-extension-nasa-apod.svg?variant=adaptive)](https://starchart.cc/Elinvention/gnome-shell-extension-nasa-apod)

[screenshot1]: https://github.com/Elinvention/gnome-shell-extension-nasa-apod/blob/main/screenshots/4.png
[screenshot2]: https://github.com/Elinvention/gnome-shell-extension-nasa-apod/blob/main/screenshots/5.png
[screenshot3]: https://github.com/Elinvention/gnome-shell-extension-nasa-apod/blob/main/screenshots/6.png
[extensions.gnome.org]: https://extensions.gnome.org/extension/1202/nasa-apod/
[Poedit]: https://poedit.net/
[releases]: https://github.com/Elinvention/gnome-shell-extension-nasa-apod/releases
