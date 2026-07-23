#!/bin/bash

# Default Installation Directory
installDir=~/.local/share/gnome-shell/extensions

# Extension Name and directory
extensionName=notification-center-reborn
extensionDir=$extensionName@firo1919.github.com
uuid=$extensionDir

echo "Starting installation for $uuid..."

# Remove the old legacy extension if it exists to prevent conflicts
oldExtensionDir=~/.local/share/gnome-shell/extensions/notification-center@Selenium-H
if [ -d "$oldExtensionDir" ]; then
  echo "Found legacy extension. Removing to prevent conflicts..."
  rm -rf "$oldExtensionDir"
  gnome-extensions disable "notification-center@Selenium-H" 2>/dev/null || true
fi

# Ensure we are in the script's directory
cd "$(dirname "$0")"

echo "Copying schemas and locale into the extension directory..."
# GNOME extensions pack expects these folders inside the extension folder
cp -rf schemas "$extensionDir/"
cp -rf locale "$extensionDir/"

echo "Packing Extension..."
cd "$extensionDir"
# Use the official gnome-extensions CLI to pack the extension
# This automatically compiles glib schemas and gettext locales if present
gnome-extensions pack --force --podir=locale --extra-source=schemas

if [ $? -ne 0 ]; then
  echo "Error: Failed to pack the extension. Make sure 'gnome-extensions' and 'glib-compile-schemas' are installed."
  exit 1
fi

echo "Installing Extension..."
# install --force handles extracting to the right directory and DBus signaling to GNOME Shell
# to reload the extension, making it Wayland-compatible without requiring a logout in most cases.
gnome-extensions install --force "${uuid}.shell-extension.zip"

if [ $? -ne 0 ]; then
  echo "Error: Failed to install the extension."
  exit 1
fi

echo "Cleaning up temporary build files..."
rm -rf schemas
rm -rf locale
rm -f "${uuid}.shell-extension.zip"
cd ..

echo "Enabling Extension..."
gnome-extensions enable "${uuid}"

echo ""
echo "======================================"
echo "Installation Successful!"
echo "======================================"
echo "The extension has been installed and enabled via the gnome-extensions CLI."
echo "On Wayland (and GNOME 40+), the extension should be loaded immediately."
echo "If it does not appear or behaves unexpectedly, try logging out and logging back in."
echo ""
