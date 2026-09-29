#!/bin/sh
#
# Builds, signs and installs the app on the TV, then starts it:
#   samsung-tv/tools/install.sh <ip of the tv> [certificate profile]
#
# Needs Tizen Studio with TV Extensions, a Samsung certificate profile and developer mode on the TV.

set -e

TV_IP="$1"
PROFILE="${2:-Showmaniac}"
APP_ID="ShowManiac.tv"
STUDIO="${TIZEN_STUDIO:-$HOME/tizen-studio}"
TIZEN="$STUDIO/tools/ide/bin/tizen"
SDB="$STUDIO/tools/sdb"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$TV_IP" ]; then
  echo "Usage: $0 <ip of the tv> [certificate profile]"
  exit 1
fi

node "$ROOT/tools/config.mjs"

# the TV only accepts one connection, a second try helps after the connection was lost
"$SDB" connect "$TV_IP" | grep -q -E 'connected|already' || { sleep 5; "$SDB" connect "$TV_IP"; }
TV_NAME="$("$SDB" devices | grep "^$TV_IP" | awk '{ print $3 }')"

if [ -z "$TV_NAME" ]; then
  echo "Could not connect to $TV_IP. Is the TV on and developer mode enabled for this computer?"
  exit 1
fi

rm -rf "$ROOT/.buildResult"
"$TIZEN" build-web -e ".*" -e "tools/*" -e "README.md" -e "js/config.example.js" -e "*.wgt" -- "$ROOT"
"$TIZEN" package -t wgt -s "$PROFILE" -- "$ROOT/.buildResult"
"$TIZEN" install -n showmaniac.wgt -t "$TV_NAME" -- "$ROOT/.buildResult"
"$TIZEN" run -p "$APP_ID" -t "$TV_NAME"
