# GNOME shell extension NASA APOD

Let this simple GNOME shell extension change your wallpaper every day to the
NASA's Astronomy Picture Of the Day. It will also show a notification
containing the title and the explanation of the image.

Tested and developed on Manjaro, GNOME 3.36.

*Disclaimer*: this extension is unofficial and not affiliated with NASA in any way.
Also note that some images might be protected by copyright.

## Install

You can install the latest release from [extensions.gnome.org][].

## Testing

You can help with development by testing and reporting issues.  
The command below downloads and install the current development version:

```
git clone https://github.com/Elinvention/gnome-shell-extension-nasa-apod.git
cd gnome-shell-extension-nasa-apod
make install
gnome-extensions enable nasa_apod@elinvention.ovh
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
