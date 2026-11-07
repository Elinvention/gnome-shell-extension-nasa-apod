# NASA APOD Extension: Lock Screen Wallpaper Support

## Summary
Add an option to set the Astronomy Picture of the Day (APOD) as the GNOME Shell lock screen wallpaper in addition to or independently from the desktop background wallpaper.

## Problem Statement
Currently, the extension only updates the desktop background wallpaper (`org.gnome.desktop.background`) through `picture-uri` and `picture-uri-dark`. Users wanting their lock screen wallpaper (`org.gnome.desktop.screensaver`) to match or independently receive NASA's APOD wallpaper have no native option in the extension.

## Proposed Architecture & Design

### 1. Schema Configuration (`schemas/org.gnome.shell.extensions.nasa-apod.gschema.xml`)
Add a new boolean key:
```xml
<key name="set-lockscreen-background" type="b">
  <default>true</default>
  <summary>Set lock screen background</summary>
  <description>Set lock screen background to NASA's APOD</description>
</key>
```
Existing `set-background` (default `true`) continues to govern the desktop wallpaper.

### 2. Core Wallpaper Manager (`utils/utils.js`)
Introduce a singleton helper for screensaver settings:
```javascript
export function getScreensaverSettings() {
    if (getScreensaverSettings._instance)
        return getScreensaverSettings._instance;
    getScreensaverSettings._instance = new Gio.Settings({schema: 'org.gnome.desktop.screensaver'});
    return getScreensaverSettings._instance;
}
```

Update `setBackgroundBasedOnSettings(settings, filename = null)`:
- If `settings.get_boolean('set-background')`:
  - Reset and set `picture-uri` and `picture-uri-dark` on `getBackgroundSettings()`.
  - Apply `picture-options` if not `'default'`.
  - Call `Gio.Settings.sync()` and `.apply()`.
- If `settings.get_boolean('set-lockscreen-background')`:
  - Reset and set `picture-uri` on `getScreensaverSettings()`.
  - Check if `screensaverSettings.settings_schema.has_key('picture-uri-dark')` before setting dark variant to ensure compatibility across GNOME Shell versions.
  - Apply `picture-options` if not `'default'`.
  - Call `Gio.Settings.sync()` and `.apply()`.

### 3. Preferences UI (`preferences/generalPage.js`)
Inside `GeneralPage`, in the `Background` preferences group (`Adw.PreferencesGroup`):
- Add a switch for **"Set desktop background"** (`set-background`).
- Add a switch for **"Set lock screen background"** (`set-lockscreen-background`).
- Retain the existing image sizing mode combo (`background-options`), YouTube thumbnail switch, and download folder picker.

### 4. Extension Indicator Menu (`extension.js`)
- In `_updateMenuItems()`, update the **"Set Wallpaper"** item sensitivity to be enabled when:
  - An image is downloaded and valid,
  - An update is not currently pending,
  - At least one wallpaper target (`set-background` or `set-lockscreen-background`) is enabled.

## Verification & Testing
1. **ESLint**: Run `make eslint` to ensure code meets all linting standards.
2. **Schema Compilation**: Run `glib-compile-schemas` to verify XML validity.
3. **Functional Testing**:
   - Verify `gsettings get org.gnome.desktop.background picture-uri` matches APOD.
   - Verify `gsettings get org.gnome.desktop.screensaver picture-uri` matches APOD.
   - Toggle desktop off, lockscreen on: verify only lockscreen updates on refresh.
   - Toggle lockscreen off, desktop on: verify only desktop updates on refresh.
