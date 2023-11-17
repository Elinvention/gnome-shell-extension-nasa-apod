UUID = nasa_apod@elinvention.ovh
BUNDLE_PATH = $(UUID).zip
POT_PATH = $(UUID).pot

.PHONY: install uninstall enable disable build clean potfile mergepo release eslint

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
	-rm $(UUID)/schemas/gschemas.compiled
	-rm $(UUID)/locale/nasa-apod.pot

potfile: $(POT_PATH)

mergepo: $(POT_PATH)
	for l in $(MSGSRC); do \
		msgmerge -U $$l $(POT_PATH); \
	done;

release: eslint clean build

$(POT_PATH):
	xgettext -L JavaScript -k_ -kN_ --package-name "NASA APOD Wallpaper Changer" --from-code UTF-8 --no-wrap -o $(POT_PATH) $(UUID)/*.js
	xgettext -L JavaScript -j -o $(POT_PATH) --from-code UTF-8 --no-wrap $(UUID)/preferences/*.js 
	xgettext -j -o $(POT_PATH) --from-code UTF-8 --no-wrap $(UUID)/schemas/*.xml

eslint:
	npx eslint -c eslintrc-gjs.yml $(UUID)

