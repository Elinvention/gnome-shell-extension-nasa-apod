INSTALL_PATH = ~/.local/share/gnome-shell/extensions
INSTALL_NAME = nasa_apod@elinvention.ovh
FILES = extension.js icons LICENSE metadata.json prefs.js README.md schemas Settings.ui utils.js theme.css notifications.js

.PHONY: install uninstall zip clean

install: schemas/gschemas.compiled
	-mkdir -p $(INSTALL_PATH)/$(INSTALL_NAME)
	cp -r $(FILES) $(INSTALL_PATH)/$(INSTALL_NAME)
	@echo "Installed to $(INSTALL_PATH)/$(INSTALL_NAME)"

uninstall:
	rm -ri $(INSTALL_PATH)/$(INSTALL_NAME)

zip: nasa_apod.zip

nasa_apod.zip: schemas/gschemas.compiled
	zip -r nasa_apod.zip $(FILES)

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.nasa-apod.gschema.xml
	glib-compile-schemas schemas

clean:
	-rm nasa_apod.zip
	-rm schemas/gschemas.compiled
