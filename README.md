# GNOME shell extension NASA APOD

Let this simple GNOME shell extension change your wallpaper every day to the
NASA's Astronomy Picture Of the Day. It will also show a notification
containing the title and the explanation of the image.

Tested and developed on NixOS, GNOME 47 (please, always refer to `metadata.json`
to check if the main branch actually works on your older GNOME shell).

*Disclaimer*: this extension is unofficial and not affiliated with NASA in any way.
Also note that some images might be protected by copyright.

## Install

You can install the latest release from [extensions.gnome.org] or download it
from [Github releases][releases].

## Testing

You can help with development by contributing code, testing and reporting issues.

To proceed you need to install dependencies. The method to install them depends
depends on the distribution you are using. The dependencies are:

1. glib
2. intltool
3. npm

In case you are using *nix*, just run `nix-shell` to bring all required
dependencies in your environment.

The commands below download and install the current development version:

```
git clone https://github.com/Elinvention/gnome-shell-extension-nasa-apod.git
cd gnome-shell-extension-nasa-apod
make enable
```

You can uninstall by running `make uninstall`.

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
