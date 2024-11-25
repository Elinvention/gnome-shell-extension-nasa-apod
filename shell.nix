{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    gettext
    intltool
    zip
    glib
    gnome-shell
    nodejs
    poedit
  ];
}

