#!/bin/bash
# One-time setup for scripts/capacity/measure.mjs in this PC's WSL Ubuntu (no root needed):
#   ~/tp-measure/dl/cft     Chrome for Testing (stable, linux64): the check's hidden browser (the server has Debian's chromium)
#   ~/tp-measure/libs       the three libraries Ubuntu lacks for it, extracted from Ubuntu's own packages (apt-get download)
#   ~/tp-measure/home       the Godot 4.7.2 web templates, copied from this PC's Godot (jobs link to them, as runner.mjs does)
#   ~/tp-measure/games      the test games, copied from packages/agent/output without .git, .godot and export/
# Godot (Linux 4.7.2) and Node 22 come from ~/tp-android (the Android export tests). Downloads go into their own folders.
# Run: wsl -d Ubuntu -- bash /mnt/c/Users/lazar/Desktop/master-project/startups/type-play/scripts/capacity/setup-wsl.sh
set -euo pipefail
M=~/tp-measure
REPO=/mnt/c/Users/lazar/Desktop/master-project/startups/type-play
OUT=$REPO/packages/agent/output
mkdir -p $M/dl/cft $M/dl/debs $M/libs $M/home/.local/share/godot/export_templates/4.7.2.stable $M/results $M/games
WIN_TPL=/mnt/c/Users/lazar/AppData/Roaming/Godot/export_templates/4.7.2.stable
for f in web_nothreads_release.zip web_nothreads_debug.zip version.txt; do
  [ -f $M/home/.local/share/godot/export_templates/4.7.2.stable/$f ] || cp $WIN_TPL/$f $M/home/.local/share/godot/export_templates/4.7.2.stable/
done
cd $M/dl/cft
if [ ! -x chrome-linux64/chrome ]; then
  curl -fsSL https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json -o versions.json
  url=$(~/tp-android/node/bin/node -e 'const j=require("./versions.json");console.log(j.channels.Stable.downloads.chrome.find(x=>x.platform==="linux64").url)')
  curl -fsSL "$url" -o chrome.zip
  python3 -m zipfile -e chrome.zip .
  chmod +x chrome-linux64/chrome chrome-linux64/chrome_crashpad_handler
fi
cd $M/dl/debs
if [ -z "$(ls $M/libs 2>/dev/null)" ]; then
  apt-get download libnss3 libnspr4 libasound2t64
  for f in *.deb; do dpkg-deb -x "$f" $M/libs; done
fi
export LD_LIBRARY_PATH=$M/libs/usr/lib/x86_64-linux-gnu
ldd $M/dl/cft/chrome-linux64/chrome | grep "not found" && exit 1
$M/dl/cft/chrome-linux64/chrome --version

# The games: a new 2D and a new 3D game built under today's budgets (TEMPLATE 3, 11-07), and a heavy old one: the home
# page's Petal Pop before its 11-04 fix (1,322 draw calls on the title, 1,741 in play) with today's stress test from its fixed
# copy, so the check plays it at its busiest moment in the browser as it did the testers' old games on 11-06.
copy() { rm -rf "$M/games/$2"; cp -r "$OUT/$1" "$M/games/$2"; rm -rf "$M/games/$2/.git" "$M/games/$2/.godot" "$M/games/$2/export"; }
copy colour-2d-snow snow2d
copy colour-3d-house house3d
copy show-match3-polished match3heavy
cp $OUT/fix-show-match3/test/helpers.gd $OUT/fix-show-match3/test/stress_test.gd $OUT/fix-show-match3/test/stress_test.gd.uid \
   $OUT/fix-show-match3/test/stress_test.tscn $M/games/match3heavy/test/
copy show-3d-polished hop3dheavy
cp $OUT/fix-show-3d/test/helpers.gd $OUT/fix-show-3d/test/stress_test.gd $OUT/fix-show-3d/test/stress_test.gd.uid \
   $OUT/fix-show-3d/test/stress_test.tscn $M/games/hop3dheavy/test/
du -sh $M/games/*
