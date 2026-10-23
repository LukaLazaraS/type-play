#!/bin/sh
# The Android steps the image build runs (deploy/api/Dockerfile): `seed` warms the Gradle seed from
# the blank template with internet (stage gradle-seed); `selftest` exports the blank template to APK
# and AAB with no network from a copy of the seed, exactly as the runner will, and checks the results
# (stage self-test). Any failure fails the image build, so a broken toolchain fails the deploy, never
# a user's export. Paths: /opt/android (jdk, sdk, gradle-home, bundletool.jar), /opt/godot,
# /opt/typeplay/{android,runner,blank}.
set -eu

export JAVA_HOME=/opt/android/jdk ANDROID_HOME=/opt/android/sdk BUNDLETOOL_JAR=/opt/android/bundletool.jar
export PATH="$JAVA_HOME/bin:$PATH" GRADLE_OPTS=-Dorg.gradle.daemon=false
GODOT=/opt/godot/godot
PREPARE=/opt/typeplay/runner/android-prepare.mjs
ICONS=/opt/typeplay/android/icons
SEED=/opt/android/gradle-home
BT=$(cat /opt/android/BUILD_TOOLS)

# A fresh job home with the templates linked in, like runner.mjs prepareHome.
home() {
  rm -rf "$1"; mkdir -p "$1/.local/share/godot" "$1/tmp"
  ln -s /opt/godot/export_templates "$1/.local/share/godot/export_templates"
}

# export_blank <workdir> <format> <gradle home>: prepare + import + export of the blank template.
export_blank() {
  work="$1"; fmt="$2"; gh="$3"
  rm -rf "$work"; mkdir -p "$work/out"; cp -r /opt/typeplay/blank "$work/game"
  home "$work/home"
  node "$PREPARE" --game "$work/game" --format "$fmt" --package app.typeplay.selftest --version-code 1 --version-name 1.1 \
    --app-name "Self test" --orientation portrait --out "$work/out" --icons "$ICONS" --godot "$GODOT"
  flags=""; [ "$fmt" = aab ] && flags="--install-android-build-template"
  env HOME="$work/home" TMPDIR="$work/home/tmp" GRADLE_USER_HOME="$gh" "$GODOT" --headless --path "$work/game" --import >"$work/import.log" 2>&1
  # shellcheck disable=SC2086
  env HOME="$work/home" TMPDIR="$work/home/tmp" GRADLE_USER_HOME="$gh" "$GODOT" --headless --path "$work/game" $flags --export-release Android "$work/out/game.$fmt" >"$work/export.log" 2>&1 \
    || { tail -60 "$work/export.log"; echo "android $fmt export of the blank template failed" >&2; exit 1; }
  [ -s "$work/out/game.$fmt" ] || { tail -60 "$work/export.log"; echo "no $fmt written" >&2; exit 1; }
}

seed() {
  mkdir -p "$SEED"; cp /opt/typeplay/android/gradle.properties "$SEED/gradle.properties"
  rm -f "$SEED/init.d/offline.init.gradle"
  export_blank /tmp/seed aab "$SEED"
  ls -la /tmp/seed/out
  # What one run leaves that no other run needs: daemon logs, native libs, locks, temp.
  rm -rf "$SEED/daemon" "$SEED/native" "$SEED/.tmp" "$SEED/notifications" "$SEED/kotlin-profile"
  find "$SEED" -name '*.lock' -delete
  mkdir -p "$SEED/init.d"; cp /opt/typeplay/android/init.d/offline.init.gradle "$SEED/init.d/"
  chmod -R a+rX "$SEED"
  rm -rf /tmp/seed
  echo "gradle seed: $(du -sm "$SEED" | cut -f1) MB"
}

selftest() {
  # From a copy of the seed, as a job would (its own writable Gradle home).
  cp -a "$SEED" /tmp/st-gradle-home
  export_blank /tmp/st-apk apk /tmp/st-gradle-home
  export_blank /tmp/st-aab aab /tmp/st-gradle-home
  apk=/tmp/st-apk/out/game.apk; aab=/tmp/st-aab/out/game.aab
  badging=$("$ANDROID_HOME/build-tools/$BT/aapt2" dump badging "$apk")
  echo "$badging" | grep -q "^package: name='app.typeplay.selftest' versionCode='1' versionName='1.1'" || { echo "$badging" | head -5; echo "apk: wrong package line" >&2; exit 1; }
  target=$(echo "$badging" | sed -n "s/^targetSdkVersion:'\([0-9]*\)'.*/\1/p")
  [ "${target:-0}" -ge 36 ] || { echo "apk targets SDK $target, needs 36+" >&2; exit 1; }
  echo "$badging" | grep -q "^application-debuggable" && { echo "apk is debuggable" >&2; exit 1; }
  echo "$badging" | grep -q "^uses-permission" && { echo "$badging" | grep "^uses-permission"; echo "apk asks for permissions" >&2; exit 1; }
  "$ANDROID_HOME/build-tools/$BT/zipalign" -c -P 16 4 "$apk" >/dev/null || { echo "apk is not 16 KB aligned" >&2; exit 1; }
  manifest=$(java -jar "$BUNDLETOOL_JAR" dump manifest --bundle="$aab")
  echo "$manifest" | grep -q 'package="app.typeplay.selftest"' || { echo "$manifest" | head -5; echo "aab: wrong package" >&2; exit 1; }
  echo "$manifest" | grep -q 'android:targetSdkVersion="3[6-9]"' || { echo "aab: target SDK below 36" >&2; exit 1; }
  echo "$manifest" | grep -q 'android:debuggable="true"' && { echo "aab is debuggable" >&2; exit 1; }
  java -jar "$BUNDLETOOL_JAR" dump config --bundle="$aab" | grep -q PAGE_ALIGNMENT_16K || { echo "aab config has no PAGE_ALIGNMENT_16K" >&2; exit 1; }
  echo "self-test: apk $(stat -c %s "$apk") bytes, aab $(stat -c %s "$aab") bytes, target SDK $target, 16 KB aligned, not debuggable, no permissions"
  rm -rf /tmp/st-apk /tmp/st-aab /tmp/st-gradle-home
}

case "${1:-}" in
  seed) seed ;;
  selftest) selftest ;;
  *) echo "usage: steps.sh seed | selftest" >&2; exit 2 ;;
esac
