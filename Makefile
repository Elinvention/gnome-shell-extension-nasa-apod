INSTALL_PATH = ~/.local/share/gnome-shell/extensions
INSTALL_NAME = nasa_apod@elinvention.ovh
FILES = extension.js notifications.js utils.js prefs.js timer.js prefs.ui prefs.css metadata.json icons schemas locale LICENSE README.md

MSGSRC = $(wildcard po/*.po)
TOLOCALIZE = extension.js prefs.js

.PHONY: install uninstall enable disable zip build clean locale potfile mergepo release eslint

install: build
	-mkdir -p $(INSTALL_PATH)/$(INSTALL_NAME)
	cp -r $(FILES) $(INSTALL_PATH)/$(INSTALL_NAME)
	@echo "Installed to $(INSTALL_PATH)/$(INSTALL_NAME)"

uninstall: disable
	rm -rI $(INSTALL_PATH)/$(INSTALL_NAME)

enable: install
	gnome-extensions enable nasa_apod@elinvention.ovh

disable:
	gnome-extensions disable nasa_apod@elinvention.ovh	

zip: nasa_apod.zip

build: schemas/gschemas.compiled locale

clean:
	-rm nasa_apod.zip
	-rm schemas/gschemas.compiled
	-rm locale -r
	-rm po/nasa-apod.pot
	-rm prefs.ui.h

locale: mergepo $(MSGSRC:.po=.mo)
	for l in $(MSGSRC:.po=.mo) ; do \
		lf=locale/`basename $$l .mo`; \
		mkdir -p $$lf/LC_MESSAGES; \
		mv $$l $$lf/LC_MESSAGES/nasa-apod.mo; \
	done;

potfile: po/nasa-apod.pot

mergepo: po/nasa-apod.pot
	for l in $(MSGSRC); do \
		msgmerge -U $$l po/nasa-apod.pot; \
	done;

release: eslint clean zip

nasa_apod.zip: schemas/gschemas.compiled locale
	zip -r nasa_apod.zip $(FILES)

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.nasa-apod.gschema.xml
	glib-compile-schemas schemas

prefs.ui.h:
	intltool-extract --type=gettext/glade prefs.ui

po/nasa-apod.pot: $(TOLOCALIZE) prefs.ui.h
	xgettext -L JavaScript -k_ -kN_ --from-code=UTF-8 --package-name "NASA APOD Wallpaper Changer" -o po/nasa-apod.pot $(TOLOCALIZE)
	xgettext -L C -k_ -kN_ --join-existing --from-code=UTF-8 -o po/nasa-apod.pot prefs.ui.h

po/%.mo: po/%.po
	msgfmt -c $< -o $@

eslint:
	eslint -c eslintrc-gjs.yml extension.js notifications.js utils.js prefs.js
