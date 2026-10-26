#!/bin/sh
# Install a verified Atlas release into user-owned directories. No sudo or npm.
set -eu
umask 077
version=latest
skills=none
while [ "$#" -gt 0 ]; do
  case "$1" in
    --version) [ "$#" -ge 2 ] || exit 2; version=$2; shift 2 ;;
    --skills) [ "$#" -ge 2 ] || exit 2; skills=$2; shift 2 ;;
    --help) echo 'Usage: install.sh [--version vX.Y.Z[-rc.N]] [--skills codex|claude|both|none]'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
case "$skills" in none|codex|claude|both) ;; *) echo 'Invalid skill target' >&2; exit 2 ;; esac
if [ "$version" != latest ]; then
  version=v${version#v}
  echo "$version" | LC_ALL=C grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+(-rc\.[0-9]+)?$' || { echo 'Invalid version' >&2; exit 2; }
fi
case "$(uname -s)" in Darwin) os=darwin ;; Linux) os=linux ;; *) echo 'Supported: macOS and Linux (including WSL).' >&2; exit 1 ;; esac
case "$(uname -m)" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; *) echo 'Unsupported CPU architecture' >&2; exit 1 ;; esac
root=${ATLAS_INSTALL_DIR:-"$HOME/.local/share/atlas"}
bin=${ATLAS_BIN_DIR:-"$HOME/.local/bin"}
case "$root" in /*) ;; *) echo 'ATLAS_INSTALL_DIR must be absolute' >&2; exit 1 ;; esac
case "$bin" in /*) ;; *) echo 'ATLAS_BIN_DIR must be absolute' >&2; exit 1 ;; esac
mkdir -p "$root" "$bin"
[ "$(cd "$root" && pwd -P)" = "$root" ] && [ "$(cd "$bin" && pwd -P)" = "$bin" ] || { echo 'Install directories must not traverse symlinks' >&2; exit 1; }
if [ -e "$bin/atlas" ] || [ -L "$bin/atlas" ]; then
  [ -L "$bin/atlas" ] && [ "$(readlink "$bin/atlas")" = "$root/current/atlas" ] || { echo "Existing $bin/atlas is not managed by this installer; choose ATLAS_BIN_DIR." >&2; exit 1; }
fi
mkdir "$root/.install-lock" 2>/dev/null || { echo 'Another install is active (or a previous install left a lock).' >&2; exit 1; }
stage=
cleanup() { [ -z "$stage" ] || rm -rf "$stage"; rmdir "$root/.install-lock"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
stage=$(mktemp -d "$root/.download.XXXXXX")
base=https://github.com/zrodivision/atlas-clients/releases
if [ "$version" = latest ]; then base=$base/latest/download; else base=$base/download/$version; fi
asset=atlas-$os-$arch.tar.gz
fetch() { curl --proto '=https' --proto-redir '=https' --tlsv1.2 --connect-timeout 20 --max-time 300 -fsSL "$1" -o "$2"; }
fetch "$base/SHASUMS256.txt" "$stage/checksums" || { echo 'Release not found. For a preview, pass --version v0.6.0-rc.2.' >&2; exit 1; }
fetch "$base/$asset" "$stage/archive.tar.gz"
expected=$(awk -v name="$asset" '$2 == name { print $1 }' "$stage/checksums")
echo "$expected" | LC_ALL=C grep -Eq '^[0-9a-f]{64}$' || { echo 'Missing or ambiguous checksum' >&2; exit 1; }
if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$stage/archive.tar.gz" | awk '{print $1}'); else actual=$(shasum -a 256 "$stage/archive.tar.gz" | awk '{print $1}'); fi
[ "$actual" = "$expected" ] || { echo 'Release checksum mismatch; installation unchanged.' >&2; exit 1; }
mkdir "$stage/package"
tar -xzf "$stage/archive.tar.gz" -C "$stage/package"
# Use the verified bundled runtime for validation and atomic filesystem operations.
node=$stage/package/bin/node
"$node" "$stage/package/dist/atlas.mjs" --version
"$node" "$stage/package/install-release.cjs" "$stage/package" "$root" "$bin" "$actual" "$version"
if [ "$skills" != none ]; then "$root/current/atlas" skill install "$skills"; fi
printf '\nAtlas installed: %s/atlas\n' "$bin"
case ":$PATH:" in *":$bin:"*) ;; *) printf 'Add this directory to PATH: %s\n' "$bin" ;; esac
printf 'Next: atlas auth login\n'
