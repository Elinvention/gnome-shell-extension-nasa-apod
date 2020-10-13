---
name: Bug report
about: Create a report to help us improve
title: ''
labels: ''
assignees: ''

---

**Describe the bug**

A clear and concise description of what the bug is.

**To Reproduce**

Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**

A clear and concise description of what you expected to happen.

**Screenshots**

If applicable, add screenshots to help explain your problem.

**Operating system with version**
For example:
- Debian 10
- Ubuntu 18.04 LTS
- Fedora Silverblue 31
- Arch Linux
- Manjaro
- Gentoo

**GNOME Shell version**

You can see your GNOME shell version from Settings->Details or `gnome-shell --version`.
- 3.38
- 3.36
- 3.34
- 3.32

**Installation method**
- https://extensions.gnome.org/extension/1202/nasa-apod/
- git
- zip file
- [AUR](https://aur.archlinux.org/packages/gnome-shell-extension-nasa-apod/)
- disto package

**Logs <- VERY IMPORTANT**

Please paste below the relevant parts of `journalctl -f -o cat /usr/bin/gnome-shell`.
If you don't use systemd, you have to find where the logs are stored and paste them here.

```

```

**Extension's settings**

Some errors might be triggered by a spefic set of settings. The command below outputs all of the extension settigs that were changed from the default value.

If you installed the extension system-wide (e.g. from AUR or distro packages) the command is:  
`gsettings --schemadir /usr/share/gnome-shell/extensions/nasa_apod@elinvention.ovh/schemas/schemas/ list-recursively org.gnome.shell.extensions.nasa-apod`.

Otherwise it is:  
`gsettings --schemadir ~/.local/share/gnome-shell/extensions/nasa_apod@elinvention.ovh/schemas/ list-recursively org.gnome.shell.extensions.nasa-apod`.

```

```
