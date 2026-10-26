#!/bin/sh
# Reuse the same verified, atomic installer for upgrades or pinned rollback.
set -eu
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
exec sh "$here/install.sh" "$@"
