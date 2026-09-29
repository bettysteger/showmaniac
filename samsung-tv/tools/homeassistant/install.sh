#!/bin/sh
#
# Copies the stream proxy as a local add-on to Home Assistant OS:
#   samsung-tv/tools/homeassistant/install.sh [addons folder]
#
# The addons folder is the "addons" share of the Samba share add-on, on a Mac mounted at
# /Volumes/addons (Finder: Go > Connect to Server > smb://<ip of home assistant>).

set -e

TARGET="${1:-/Volumes/addons}"
DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$TARGET" ]; then
  echo "$TARGET not found. Mount the addons share of Home Assistant first (smb://<ip of home assistant>/addons)."
  exit 1
fi

cp "$DIR/../proxy.mjs" "$DIR/showmaniac_proxy/proxy.mjs"
mkdir -p "$TARGET/showmaniac_proxy"
cp "$DIR/showmaniac_proxy/config.yaml" "$DIR/showmaniac_proxy/Dockerfile" "$DIR/showmaniac_proxy/build.yaml" "$DIR/showmaniac_proxy/proxy.mjs" "$TARGET/showmaniac_proxy/"

echo "Copied to $TARGET/showmaniac_proxy"
echo "In Home Assistant: Settings > Add-ons > Add-on store > ... > Check for updates,"
echo "then install and start \"showmaniac stream proxy\" under Local add-ons."
