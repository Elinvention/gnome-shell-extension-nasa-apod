INSTALL_PATH = ~/.local/share/gnome-shell/extensions
INSTALL_NAME = nasa_apod@elinvention.ovh
FILES = extension.js icons LICENSE metadata.json prefs.js README.md schemas prefs.ui utils.js theme.css notifications.js locale

MSGSRC = $(wildcard po/*.po)
TOLOCALIZE = extension.js prefs.js

.PHONY: install uninstall zip clean potfile mergepo release

install: schemas/gschemas.compiled locale
	-mkdir -p $(INSTALL_PATH)/$(INSTALL_NAME)
	cp -r $(FILES) $(INSTALL_PATH)/$(INSTALL_NAME)
	@echo "Installed to $(INSTALL_PATH)/$(INSTALL_NAME)"

uninstall:
	rm -rI $(INSTALL_PATH)/$(INSTALL_NAME)

zip: nasa_apod.zip

nasa_apod.zip: schemas/gschemas.compiled locale
	zip -r nasa_apod.zip $(FILES)

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.nasa-apod.gschema.xml
	glib-compile-schemas schemas

clean:
	-rm nasa_apod.zip
	-rm schemas/gschemas.compiled
	-rm locale -r
	-rm po/nasa-apod.pot
	-rm prefs.ui.h

prefs.ui.h:
	intltool-extract --type=gettext/glade prefs.ui

po/nasa-apod.pot: $(TOLOCALIZE) prefs.ui.h
	xgettext -L Perl -k_ -kN_ --from-code=UTF-8 --package-name "NASA APOD Wallpaper Changer" -o po/nasa-apod.pot $(TOLOCALIZE)
	xgettext -L C -k_ -kN_ --join-existing --from-code=UTF-8 -o po/nasa-apod.pot prefs.ui.h

potfile: po/nasa-apod.pot

mergepo: po/nasa-apod.pot
	for l in $(MSGSRC); do \
		msgmerge -U $$l po/nasa-apod.pot; \
	done;

po/%.mo: po/%.po
	msgfmt -c $< -o $@

locale: mergepo $(MSGSRC:.po=.mo)
	for l in $(MSGSRC:.po=.mo) ; do \
		lf=locale/`basename $$l .mo`; \
		mkdir -p $$lf/LC_MESSAGES; \
		mv $$l $$lf/LC_MESSAGES/nasa-apod.mo; \
	done;

release: clean locale zip

