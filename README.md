# GNOME shell extension NASA APOD

Let this simple GNOME shell extension change your wallpaper every day to the
NASA's Astronomy Picture Of the Day. It will also show a notification
containing the title and the explanation of the image.

*Disclaimer*: this extension is unofficial and not affiliated with NASA in any way.
Also note that some images might be protected by copyright.

## Supported GNOME Versions

The extension is maintained across several branches depending on your GNOME Shell version:

- **`main` branch**: Supports **GNOME 45 through 51+** (modern ES Modules, GTK4 & Libadwaita, Soup 3.0).
- **`gnome-43-44` branch**: Supports legacy **GNOME 43 and 44** (GJS legacy imports, GTK4, Soup 3.0).
- **[`gnome-40-42`](https://github.com/Elinvention/gnome-shell-extension-nasa-apod/tree/gnome-40-42) branch**: Supports legacy **GNOME 40, 41, and 42** (GJS legacy imports, GTK3, Soup 2.4).

When installing from [extensions.gnome.org], the website automatically selects the compatible package for your GNOME Shell version.

## Install

You can install the latest release from [extensions.gnome.org][].

## Testing

You can help with development by contributing code, testing and reporting issues.

To proceed you need to install dependencies. The method to install them depends
depends on the distribution you are using. The dependencies are:

1. glib
2. intltool
3. npm

The commands below download and install the current development version:

```bash
git clone https://github.com/Elinvention/gnome-shell-extension-nasa-apod.git
cd gnome-shell-extension-nasa-apod

# If on GNOME 43 or 44, switch to the matching branch:
# git checkout gnome-43-44
# If on GNOME 40-42, switch to the legacy branch:
# git checkout gnome-40-42

make enable
```

You can uninstall by running `make uninstall`.

## Translations

You can contribute translations if you can use [Poedit].

1. Open the template file [po/nasa-apod.pot] with Poedit.
2. Choose the language you want to translate to.
3. Translate each string.
4. Save the translation .po file.
5. You can either make a pull request or make an issue and attach the file or even
send it to me by email (see my profile).

## Screenshots

![NASA APOD extension][screenshot1]  
![Settings][screenshot2]  
![Settings About][screenshot3]  

[screenshot1]: https://github.com/Elinvention/gnome-shell-extension-nasa-apod/blob/main/screenshots/4.png
[screenshot2]: https://github.com/Elinvention/gnome-shell-extension-nasa-apod/blob/main/screenshots/5.png
[screenshot3]: https://github.com/Elinvention/gnome-shell-extension-nasa-apod/blob/main/screenshots/6.png
[extensions.gnome.org]: https://extensions.gnome.org/extension/1202/nasa-apod/
[Poedit]: https://poedit.net/
[po/nasa-apod.pot]: https://github.com/Elinvention/gnome-shell-extension-nasa-apod/tree/main/po/nasa-apod.pot
