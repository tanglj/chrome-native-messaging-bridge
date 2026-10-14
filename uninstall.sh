#!/bin/sh
set -eu
"$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/scripts/unregister-chrome.sh" "$@"
