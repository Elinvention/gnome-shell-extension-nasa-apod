UUID = nasa_apod@elinvention.ovh
BUNDLE_PATH = $(UUID).zip
POT_PATH = $(UUID).pot

.PHONY: install uninstall enable disable build clean potfile mergepo release eslint nested-shell

install: build
	gnome-extensions install $(BUNDLE_PATH) --force

uninstall: disable
	gnome-extensions uninstall $(UUID)

enable: install
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

build:
	rm -f $(BUNDLE_PATH)
	cd $(UUID); \
	gnome-extensions pack --force --podir=locale \
	                      --extra-source=preferences/ \
	                      --extra-source=icons/ \
	                      --extra-source=utils/; \
	mv $(UUID).shell-extension.zip ../$(BUNDLE_PATH)

clean:
	-rm $(BUNDLE_PATH)
	-rm $(POT_PATH)

potfile: $(POT_PATH)

release: eslint clean build potfile

$(POT_PATH):
	xgettext -L JavaScript -k_ -kN_ --package-name "NASA APOD Wallpaper Changer" --from-code UTF-8 --no-wrap -o $(POT_PATH) $(UUID)/*.js
	xgettext -L JavaScript -j -o $(POT_PATH) --from-code UTF-8 --no-wrap $(UUID)/preferences/*.js 
	xgettext -j -o $(POT_PATH) --from-code UTF-8 --no-wrap $(UUID)/schemas/*.xml

eslint:
	npx eslint -c eslintrc-gjs.yml $(UUID)

nested-shell:
	dbus-run-session -- gnome-shell --nested --wayland

