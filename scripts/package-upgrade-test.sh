#!/usr/bin/env bash
# Upgrades the 0.1.x Linux package, named velocity-download-manager-v2, to this one in a clean
# container, and checks the new package replaced it and the data stayed (#347,
# docs/PACKAGING.md). Run as root inside the container, from the Linux packages workflow:
#
#   bash scripts/package-upgrade-test.sh <old package.deb|.rpm> <new package.deb|.rpm>
#
# Each step prints PASS or stops the script with FAIL.
set -euo pipefail

old=$1
new=$2
old_name=velocity-download-manager-v2
new_name=apollo-download-manager
# The data folder, by the identifier, which the rename keeps (ADR-0003).
data="$HOME/.local/share/com.velocity.downloadmanager.v2"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

installed() {
  case "$new" in
    *.deb) dpkg-query -W -f='${Status}' "$1" 2>/dev/null | grep -q 'install ok installed' ;;
    *.rpm) rpm -q "$1" >/dev/null 2>&1 ;;
  esac
}

install() {
  case "$1" in
    *.deb)
      export DEBIAN_FRONTEND=noninteractive
      apt-get install -y -q "./$1"
      ;;
    *.rpm) dnf install -y -q "./$1" ;;
    *) fail "not a deb or an rpm: $1" ;;
  esac
}

echo "== Install the old package $(basename "$old") on $(. /etc/os-release && echo "$PRETTY_NAME")"
case "$old" in *.deb) apt-get update -q ;; esac
install "$old"
installed "$old_name" || fail "$old_name isn't installed"
mkdir -p "$data"
echo kept >"$data/upgrade-marker"
echo "PASS: $old_name installed, with data"

echo "== Install the new package $(basename "$new") over it"
install "$new"
installed "$new_name" || fail "$new_name isn't installed"
! installed "$old_name" || fail "$old_name is still installed beside $new_name"
echo "PASS: $new_name replaced $old_name"

for program in velocity-desktop-v2 velocity-transfer velocity-torrent velocity-native-host-v2; do
  [ -x "/usr/bin/$program" ] || fail "/usr/bin/$program is missing"
done
[ ! -e "/usr/lib/Velocity Download Manager V2" ] || fail "the old notices folder is still there"
[ ! -e "/usr/share/applications/Velocity Download Manager V2.desktop" ] || fail "the old menu entry is still there"
[ -f "/usr/share/applications/Apollo Download Manager.desktop" ] || fail "the new menu entry is missing"
echo "PASS: the programs keep their paths, and only the new menu entry is there"

[ "$(cat "$data/upgrade-marker")" = kept ] || fail "the data folder changed"
echo "PASS: the data stayed"
