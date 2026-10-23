#!/usr/bin/env bash
# The Android toolchain test (docs/android-export-design.md §13), run in WSL (Ubuntu) on Luka's PC:
# nothing system-wide, everything under ~/tp-android (deletable), through the CPU limiter.
#   node packages/agent/tools/cpu.mjs wsl -e bash apps/server/scripts/android-check.sh setup   # ~1.3 GB of downloads, once
#   node packages/agent/tools/cpu.mjs wsl -e bash apps/server/scripts/android-check.sh warm    # the Gradle seed (blank template, with internet)
#   node packages/agent/tools/cpu.mjs wsl -e bash apps/server/scripts/android-check.sh export [project] [commit]   # the runner's steps, offline
#   node packages/agent/tools/cpu.mjs wsl -e bash apps/server/scripts/android-check.sh all
# `export` needs the server built (npm run build -w @typeplay/server): it signs and inspects with
# dist/android/tools.js, the same code the API and the signer sidecar run. It prints minutes, MB and
# the peak RSS of each step (sampled from ps), the numbers the README and the design doc quote.
set -euo pipefail

REPO="${REPO:-/mnt/c/Users/lazar/Desktop/master-project/startups/type-play}"
TP="${TP_ANDROID:-$HOME/tp-android}"
GODOT_VERSION=4.7.2
GODOT_SHA512=9aa00f7a605200940bce3027a567b782f49bd8e940dd06ae9e987bd65aee1b1467edd56ed84fcdcbdd44354bf613bdbb4e5d2913e925850368e150c59ed54c65
CMDLINE_ZIP=commandlinetools-linux-15859902_latest.zip
CMDLINE_SHA256=4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583
JDK_TGZ=OpenJDK17U-jdk_x64_linux_hotspot_17.0.20.1_1.tar.gz
JDK_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/$JDK_TGZ"
JDK_SHA256=3808d1d15e3ec6bd5b84057fb5d84c33d8a1536a258146bcea2e603fc726e08e
BUNDLETOOL_VERSION=1.18.3
BUNDLETOOL_SHA256="${BUNDLETOOL_SHA256:-}"   # printed by `setup`; pinned in deploy/api/Dockerfile
WIN_TEMPLATES="/mnt/c/Users/lazar/AppData/Roaming/Godot/export_templates/$GODOT_VERSION.stable"

# --- the CPU rule: all but 4 cores, lower priority; children inherit both -------------------------
if command -v taskset >/dev/null; then
  N=$(nproc); if [ "$N" -gt 4 ]; then taskset -pc "4-$((N - 1))" $$ >/dev/null; fi
fi
renice -n 5 -p $$ >/dev/null 2>&1 || true

say() { printf '· %s\n' "$*"; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }
now_ms() { echo $(( $(date +%s%N) / 1000000 )); }
mb() { awk "BEGIN { printf \"%.1f\", $1 / 1048576 }"; }
sha256_is() { echo "$2  $1" | sha256sum -c - >/dev/null; }

export JAVA_HOME="$TP/jdk" ANDROID_HOME="$TP/sdk" BUNDLETOOL_JAR="$TP/bundletool.jar" GODOT_EXE="$TP/godot/godot"
export ANDROID_ICONS="$REPO/deploy/api/android/icons" GRADLE_SEED="$TP/gradle-home"
export PATH="$TP/node/bin:$JAVA_HOME/bin:$PATH"
export TP_HOME="$TP/home"   # the job's HOME: a fresh one each export, templates linked in (runner.mjs prepareHome)

# --- setup: the toolchain into $TP ----------------------------------------------------------------
setup() {
  mkdir -p "$TP/dl" "$TP/godot" "$TP/templates/$GODOT_VERSION.stable"
  cd "$TP/dl"
  if [ ! -x "$TP/node/bin/node" ]; then
    say "node 22 for Linux"
    curl -fsSLo SHASUMS256.txt https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
    tgz=$(grep -o 'node-v22[0-9.]*-linux-x64.tar.xz' SHASUMS256.txt | head -1)
    curl -fsSLo "$tgz" "https://nodejs.org/dist/latest-v22.x/$tgz"
    grep " $tgz\$" SHASUMS256.txt | sha256sum -c - >/dev/null || die "node checksum"
    rm -rf "$TP/node"; mkdir -p "$TP/node"; tar -xJf "$tgz" -C "$TP/node" --strip-components=1
  fi
  if [ ! -x "$JAVA_HOME/bin/java" ]; then
    say "Temurin JDK 17 (193 MB)"
    [ -f "$JDK_TGZ" ] || curl -fsSLo "$JDK_TGZ" "$JDK_URL"
    sha256_is "$JDK_TGZ" "$JDK_SHA256" || die "JDK checksum"
    rm -rf "$JAVA_HOME"; mkdir -p "$JAVA_HOME"; tar -xzf "$JDK_TGZ" -C "$JAVA_HOME" --strip-components=1
  fi
  if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
    say "Android command-line tools (182 MB)"
    [ -f "$CMDLINE_ZIP" ] || curl -fsSLo "$CMDLINE_ZIP" "https://dl.google.com/android/repository/$CMDLINE_ZIP"
    sha256_is "$CMDLINE_ZIP" "$CMDLINE_SHA256" || die "command-line tools checksum"
    rm -rf "$ANDROID_HOME/cmdline-tools"; mkdir -p "$ANDROID_HOME/cmdline-tools"
    python3 -I -m zipfile -e "$CMDLINE_ZIP" "$ANDROID_HOME/cmdline-tools/"
    mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
    chmod +x "$ANDROID_HOME/cmdline-tools/latest/bin/"*
  fi
  if [ ! -f "$TP/godot/godot" ]; then
    say "Godot $GODOT_VERSION for Linux"
    zip="Godot_v${GODOT_VERSION}-stable_linux.x86_64.zip"
    [ -f "$zip" ] || curl -fsSLo "$zip" "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}-stable/$zip"
    echo "$GODOT_SHA512  $zip" | sha512sum -c - >/dev/null || die "Godot checksum"
    python3 -I -m zipfile -e "$zip" "$TP/godot/"
    mv "$TP/godot/Godot_v${GODOT_VERSION}-stable_linux.x86_64" "$TP/godot/godot"; chmod 755 "$TP/godot/godot"
  fi
  for f in android_release.apk android_source.zip version.txt; do
    [ -f "$TP/templates/$GODOT_VERSION.stable/$f" ] || { say "template $f from the Windows Godot"; cp "$WIN_TEMPLATES/$f" "$TP/templates/$GODOT_VERSION.stable/$f"; }
  done
  if [ ! -f "$BUNDLETOOL_JAR" ]; then
    say "bundletool $BUNDLETOOL_VERSION"
    curl -fsSLo "$BUNDLETOOL_JAR" "https://github.com/google/bundletool/releases/download/$BUNDLETOOL_VERSION/bundletool-all-$BUNDLETOOL_VERSION.jar"
  fi
  if [ -n "$BUNDLETOOL_SHA256" ]; then sha256_is "$BUNDLETOOL_JAR" "$BUNDLETOOL_SHA256" || die "bundletool checksum"; fi
  say "bundletool sha256: $(sha256sum "$BUNDLETOOL_JAR" | cut -d' ' -f1)"
  # The SDK versions the template was built for (config.gradle inside android_source.zip).
  read -r BT SDK < <(sdk_versions)
  say "template wants build-tools $BT, platform android-$SDK"
  if [ ! -x "$ANDROID_HOME/build-tools/$BT/apksigner" ] || [ ! -d "$ANDROID_HOME/platforms/android-$SDK" ]; then
    say "sdkmanager: licences, platform-tools, build-tools;$BT, platforms;android-$SDK (~140 MB)"
    # `yes` dies of SIGPIPE when sdkmanager stops reading (exit 141 under pipefail): not a failure.
    (yes 2>/dev/null || true) | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" --licenses >/dev/null 2>&1 || true
    "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" "platform-tools" "build-tools;$BT" "platforms;android-$SDK" >/dev/null 2>&1
    [ -x "$ANDROID_HOME/build-tools/$BT/apksigner" ] || die "sdkmanager did not install build-tools $BT"
  fi
  mkdir -p "$GRADLE_SEED"
  cp "$REPO/deploy/api/android/gradle.properties" "$GRADLE_SEED/gradle.properties"
  say "setup done in $TP ($(du -sm "$TP" | cut -f1) MB)"
}

sdk_versions() {
  python3 -I - "$TP/templates/$GODOT_VERSION.stable/android_source.zip" <<'PY'
import re, sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
name = next(n for n in z.namelist() if n.endswith("config.gradle"))
t = z.read(name).decode()
bt = re.search(r"buildTools\s*:\s*['\"]([\d.]+)['\"]", t).group(1)
sdk = re.search(r"compileSdk\s*:\s*(\d+)", t).group(1)
print(bt, sdk)
PY
}

# --- one export, the runner's steps exactly (runner.mjs `android`, android-prepare.mjs) ------------
# export_one <project> <commit> <format> <outfile> [offline]
export_one() {
  local project="$1" commit="$2" fmt="$3" out="$4" offline="${5:-}"
  local build="$TP/build"
  rm -rf "$build" "$TP_HOME"; mkdir -p "$build/game" "$build/out" "$TP_HOME/.local/share/godot" "$TP_HOME/tmp"
  ln -s "$TP/templates" "$TP_HOME/.local/share/godot/export_templates"
  local name; name=$(grep -o 'config/name="[^"]*"' "$project/project.godot" | head -1 | sed 's/config\/name="//; s/"$//')
  local pkg; pkg=$(node -e 'import("'"$REPO"'/apps/server/runner/android-prepare.mjs").then(m => console.log(m.defaultPackageName(process.argv[1], "wsltest1")))' "$name")
  local t0 t1
  t0=$(now_ms)
  git -c safe.directory='*' -C "$project" archive --format=tar "$commit" | tar -x -C "$build/game"
  local icon="$project/export/screenshot-start.png"; [ -f "$icon" ] || icon=""
  local prep=(node "$REPO/apps/server/runner/android-prepare.mjs" --game "$build/game" --format "$fmt" --package "$pkg"
    --version-code 1 --version-name "1.1" --app-name "${name:-Game}" --orientation portrait --out "$build/out"
    --icons "$ANDROID_ICONS" --godot "$GODOT_EXE")
  [ -n "$icon" ] && prep+=(--icon "$icon")
  [ "$fmt" = aab ] && prep+=(--gradle-seed "$GRADLE_SEED" --gradle-home "$build/gradle-home")
  env HOME="$TP_HOME" "${prep[@]}"
  t1=$(now_ms); say "  prepare (archive, preset, icons$([ "$fmt" = aab ] && echo ', seed copy')): $(( (t1 - t0) / 1000 )) s"
  local jobenv=(env HOME="$TP_HOME" TMPDIR="$TP_HOME/tmp" JAVA_HOME="$JAVA_HOME" ANDROID_HOME="$ANDROID_HOME"
    GRADLE_USER_HOME="$build/gradle-home" GRADLE_OPTS="-Dorg.gradle.daemon=false" PATH="$JAVA_HOME/bin:/usr/bin:/bin")
  if [ "$fmt" = aab ] && [ "$offline" = offline ]; then
    # No network at all for the offline run (a user namespace with only an unconfigured loopback):
    # the seed must hold everything. Without unshare, Gradle's own --offline (the init script) is the check.
    # Loopback stays up (Gradle's single-use daemon binds 127.0.0.1; the runner container has it too).
    if unshare -rn sh -c "ip link set lo up" 2>/dev/null; then jobenv=(unshare -rn sh -c "ip link set lo up && exec \"\$@\"" -- "${jobenv[@]}"); say "  (network namespace: loopback only)"; else say "  (unshare not allowed here: offline relies on the init script alone)"; fi
  fi
  t0=$(now_ms)
  sample_rss_start
  "${jobenv[@]}" "$GODOT_EXE" --headless --path "$build/game" --import >"$build/import.log" 2>&1 || { tail -20 "$build/import.log"; die "import failed"; }
  t1=$(now_ms); say "  import: $(( (t1 - t0) / 1000 )) s"
  t0=$(now_ms)
  local flags=(); [ "$fmt" = aab ] && flags=(--install-android-build-template)
  "${jobenv[@]}" "$GODOT_EXE" --headless --path "$build/game" "${flags[@]}" --export-release Android "$build/out/game.$fmt" >"$build/export.log" 2>&1 \
    || { tail -40 "$build/export.log"; die "export failed"; }
  t1=$(now_ms)
  local peak; peak=$(sample_rss_stop)
  [ -s "$build/out/game.$fmt" ] || { tail -40 "$build/export.log"; die "no $fmt written"; }
  cp "$build/out/game.$fmt" "$out"
  say "  export $fmt: $(( (t1 - t0) / 1000 )) s, $(mb "$(stat -c %s "$out")") MB, peak RSS of the step's processes $peak MB"
  grep -i -E "warning|unable to strip|download" "$build/export.log" | grep -v "^WARNING: .*deprecat" | head -8 | sed 's/^/    log: /' || true
  if [ "$fmt" = aab ]; then
    grep -c -i "Download" "$build/export.log" | sed 's/^/  gradle download lines: /' || true
  fi
}

# Peak RSS over all processes of this session, sampled every 0.5 s (GNU time is not in WSL by default).
sample_rss_start() {
  rm -f "$TP/rss.max"; echo 0 >"$TP/rss.max"
  ( local sid; sid=$(ps -o sess= -p $$ | tr -d ' ')
    while :; do
      local sum; sum=$(ps -o rss= --sid "$sid" 2>/dev/null | awk '{ s += $1 } END { print s + 0 }')
      local max; max=$(cat "$TP/rss.max")
      [ "$sum" -gt "$max" ] && echo "$sum" >"$TP/rss.max"
      sleep 0.5
    done ) &
  RSS_PID=$!
}
sample_rss_stop() {
  kill "$RSS_PID" 2>/dev/null || true; wait "$RSS_PID" 2>/dev/null || true
  awk '{ printf "%.0f", $1 / 1024 }' "$TP/rss.max"
}

# --- warm: the Gradle seed from the blank template, with internet (Dockerfile "gradle-seed") -------
warm() {
  [ -x "$GODOT_EXE" ] || die "run setup first"
  rm -f "$GRADLE_SEED/init.d/offline.init.gradle"
  cp "$REPO/deploy/api/android/gradle.properties" "$GRADLE_SEED/gradle.properties"
  local blank="$TP/blank"; rm -rf "$blank"; cp -r "$REPO/packages/agent/templates/blank" "$blank"
  ( cd "$blank" && rm -rf .git && git init -q && git -c user.name=t -c user.email=t@t add -A && git -c user.name=t -c user.email=t@t commit -qm seed )
  say "warming the Gradle seed: blank template → AAB with internet (first time: Gradle 8.11.1 + AGP + Kotlin, several hundred MB)"
  # The seed is written in place: GRADLE_SEED is the job's home for this one run.
  local t0; t0=$(now_ms)
  SEED_WARM=1 export_one "$blank" HEAD aab "$TP/seed-blank.aab"
  say "warm run: $(( ($(now_ms) - t0) / 1000 )) s"
  # What the run wrote into the copy's home becomes the seed; then the throwaway parts go.
  rm -rf "$GRADLE_SEED"; mv "$TP/build/gradle-home" "$GRADLE_SEED"
  rm -rf "$GRADLE_SEED/daemon" "$GRADLE_SEED/native" "$GRADLE_SEED/.tmp" "$GRADLE_SEED/caches/journal-1" "$GRADLE_SEED/caches/"*/{fileHashes,executionHistory,md-rule,md-supplier,"*.lock"} 2>/dev/null || true
  find "$GRADLE_SEED" -name '*.lock' -delete
  mkdir -p "$GRADLE_SEED/init.d"; cp "$REPO/deploy/api/android/init.d/offline.init.gradle" "$GRADLE_SEED/init.d/"
  chmod -R a+rX "$GRADLE_SEED"
  say "seed: $(du -sm "$GRADLE_SEED" | cut -f1) MB in $GRADLE_SEED (offline init script in place)"
}

# --- export: a real game, APK (prebuilt) and AAB (Gradle, offline), then sign + inspect -----------
export_game() {
  local project="${1:-$REPO/packages/agent/output/td2-haiku}" commit="${2:-HEAD}"
  [ -f "$GRADLE_SEED/init.d/offline.init.gradle" ] || die "run warm first"
  [ -f "$REPO/apps/server/dist/android/tools.js" ] || die "build the server first (npm run build -w @typeplay/server)"
  commit=$(git -c safe.directory='*' -C "$project" rev-parse "$commit")
  mkdir -p "$TP/out"
  say "APK of $(basename "$project") @ ${commit:0:7} (prebuilt template)"
  export_one "$project" "$commit" apk "$TP/out/unsigned.apk"
  say "AAB of $(basename "$project") @ ${commit:0:7} (Gradle, offline, seed copied)"
  export_one "$project" "$commit" aab "$TP/out/unsigned.aab" offline
  say "sign + inspect with dist/android/tools.js (keytool, apksigner, jarsigner, aapt2, zipalign, bundletool)"
  local t0; t0=$(now_ms)
  env JAVA_HOME="$JAVA_HOME" ANDROID_HOME="$ANDROID_HOME" BUNDLETOOL_JAR="$BUNDLETOOL_JAR" TMPDIR="$TP/tmp" \
    node "$REPO/apps/server/scripts/android-sign-check.mjs" "$TP/out" "wsltest1"
  say "sign + inspect: $(( ($(now_ms) - t0) / 1000 )) s"
  say "outputs in $TP/out; toolchain $(du -sm "$TP" | cut -f1) MB in $TP (delete the folder to free it)"
}

case "${1:-}" in
  setup) setup ;;
  warm) warm ;;
  export) export_game "${2:-}" "${3:-}" ;;
  all) setup; warm; export_game "${2:-}" "${3:-}" ;;
  *) echo "usage: android-check.sh setup | warm | export [project] [commit] | all"; exit 2 ;;
esac
