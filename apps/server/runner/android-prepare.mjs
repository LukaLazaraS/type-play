// Gets a scratch copy of a game ready for an Android export (docs/android-export-design.md §3-5).
// Runs inside the runner's `android` job as the job's throwaway user (or in WSL / on Luka's PC
// for tests), in the copy that `git archive` made, never in the agent's own folder:
//   node android-prepare.mjs --game <copy> --format apk|aab --package <name> --version-code <n>
//        --version-name <s> --app-name <s> --orientation portrait|landscape --out <dir>
//        [--icon <png>] --icons <placeholder set> --godot <exe> [--gradle-seed <dir> --gradle-home <dir>]
// What it does, in order: deletes an `android/` folder the commit carried (a planted buildSrc/ would
// run inside Gradle); strips every Android preset the agent may have written and appends the
// server's own; turns on ETC2/ASTC import (a command-line Android export needs it on a Linux host)
// and sets the handheld orientation when the project has none; writes export/.gdignore; makes the
// launcher icons from the picture the API passed (android-icons.gd), or copies the placeholder
// set; for AAB copies the Gradle seed to the job's Gradle home. Prints `@@icon poster|own|placeholder`.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRESET_NAME = 'Android';
/** Package names: reverse-DNS, lowercase, each segment starting with a letter (Android's rule), 3-80 chars. */
export const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
export const PACKAGE_MAX = 80;
/** Play refuses com.example; the rest are Android's and Google's own. */
export const RESERVED_PREFIXES = ['com.example.', 'com.android.', 'android.', 'com.google.'];
export const APP_NAME_MAX = 30;

/** Why a package name is refused, in plain words, or null when it is fine. */
export function packageNameProblem(name) {
  if (typeof name !== 'string' || !name) return 'Type a package name.';
  if (name.length < 3 || name.length > PACKAGE_MAX) return `A package name is 3 to ${PACKAGE_MAX} characters.`;
  if (!PACKAGE_RE.test(name)) return 'A package name looks like com.yourname.game: lowercase letters, digits and underscores, dots between parts, each part starting with a letter.';
  if (RESERVED_PREFIXES.some((p) => name.startsWith(p))) return `Google Play doesn't allow names starting with ${RESERVED_PREFIXES.map((p) => p.slice(0, -1)).join(', ')}.`;
  return null;
}

/** The default package name: app.typeplay.<slug>_<projectId> (the id keeps it unique across TypePlay). */
export function defaultPackageName(gameName, projectId) {
  let slug = String(gameName ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)
    .replace(/_+$/, '');
  if (!slug || /^[0-9]/.test(slug)) slug = `g${slug}`;
  return `app.typeplay.${slug}_${projectId}`;
}

/** The version name users see: <game version>.<build number>, e.g. "7.3". */
export const versionNameOf = (versionN, versionCode) => `${versionN}.${versionCode}`;

const quote = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** The Android preset, filled per game (§4 of the design). Only `name`, `platform`, `runnable` and
 * the keys below: no permissions, no keystore, no debug build. */
export function androidPreset(n, o) {
  const aab = o.format === 'aab';
  return [
    `[preset.${n}]`,
    '',
    `name=${quote(PRESET_NAME)}`,
    'platform="Android"',
    'runnable=false',
    'advanced_options=false',
    'dedicated_server=false',
    'custom_features=""',
    'export_filter="all_resources"',
    'include_filter=""',
    'exclude_filter="export/*,test/*,NOTES.md"',
    `export_path=${quote(`export/android/game.${o.format}`)}`,
    'patches=PackedStringArray()',
    'encryption_include_filters=""',
    'encryption_exclude_filters=""',
    'seed=0',
    'encrypt_pck=false',
    'encrypt_directory=false',
    'script_export_mode=2',
    '',
    `[preset.${n}.options]`,
    '',
    `gradle_build/use_gradle_build=${aab}`,
    'gradle_build/gradle_build_directory=""',
    'gradle_build/android_source_template=""',
    'gradle_build/compress_native_libraries=false',
    `gradle_build/export_format=${aab ? 1 : 0}`,
    'gradle_build/min_sdk=""',
    'gradle_build/target_sdk=""',
    'architectures/armeabi-v7a=false',
    'architectures/arm64-v8a=true',
    'architectures/x86=false',
    'architectures/x86_64=false',
    `version/code=${o.versionCode}`,
    `version/name=${quote(o.versionName)}`,
    `package/unique_name=${quote(o.packageName)}`,
    `package/name=${quote(o.appName)}`,
    'package/signed=false',
    'package/app_category=2',
    'package/retain_data_on_uninstall=false',
    'package/exclude_from_recents=false',
    'package/show_in_android_tv=false',
    'package/show_in_app_library=true',
    'package/show_as_launcher_app=false',
    'launcher_icons/main_192x192="res://export/icons/icon-192.png"',
    'launcher_icons/adaptive_foreground_432x432="res://export/icons/fg-432.png"',
    'launcher_icons/adaptive_background_432x432="res://export/icons/bg-432.png"',
    'launcher_icons/adaptive_monochrome_432x432=""',
    'graphics/opengl_debug=false',
    'shader_baker/enabled=false',
    'xr_features/xr_mode=0',
    'gesture/swipe_to_dismiss=false',
    'screen/immersive_mode=true',
    'screen/edge_to_edge=false',
    'screen/support_small=true',
    'screen/support_normal=true',
    'screen/support_large=true',
    'screen/support_xlarge=true',
    'user_data_backup/allow=false',
    'command_line/extra_args=""',
    'permissions/custom_permissions=PackedStringArray()',
    '',
  ].join('\n');
}

/** export_presets.cfg without any Android preset (whatever the agent wrote), renumbered, plus ours. */
export function withAndroidPreset(cfg, o) {
  const blocks = [];
  let current = null;
  for (const line of String(cfg ?? '').split(/\r?\n/)) {
    const m = /^\[preset\.(\d+)(\.options)?\]\s*$/.exec(line);
    if (m) {
      if (!m[2]) blocks.push((current = { head: [], options: [] }));
      else if (current) current.inOptions = true;
      continue;
    }
    if (!current) continue; // text before the first preset: Godot writes none
    (current.inOptions ? current.options : current.head).push(line);
  }
  const kept = blocks.filter((b) => !b.head.some((l) => /^platform\s*=\s*"Android"\s*$/.test(l)));
  const trim = (lines) => lines.join('\n').replace(/^\n+|\n+$/g, '');
  const out = kept.map((b, i) => `[preset.${i}]\n\n${trim(b.head)}\n\n[preset.${i}.options]\n\n${trim(b.options)}\n`);
  out.push(androidPreset(kept.length, o));
  return out.join('\n');
}

/** project.godot with ETC2/ASTC import on and an orientation when there is none; idempotent. */
export function patchProjectGodot(text, orientation) {
  let t = String(text).replace(/\r\n/g, '\n');
  const hasSection = (name) => new RegExp(`^\\[${name}\\]\\s*$`, 'm').test(t);
  const addToSection = (name, line) => {
    if (!hasSection(name)) t = t.replace(/\n*$/, `\n\n[${name}]\n\n${line}\n`);
    else t = t.replace(new RegExp(`^\\[${name}\\]\\s*\\n`, 'm'), (m) => `${m}\n${line}\n`);
  };
  if (!/^textures\/vram_compression\/import_etc2_astc\s*=/m.test(t)) addToSection('rendering', 'textures/vram_compression/import_etc2_astc=true');
  else t = t.replace(/^textures\/vram_compression\/import_etc2_astc\s*=.*$/m, 'textures/vram_compression/import_etc2_astc=true');
  if (!/^window\/handheld\/orientation\s*=/m.test(t)) addToSection('display', `window/handheld/orientation=${orientation === 'landscape' ? 0 : 1}`);
  return t.replace(/\n{3,}/g, '\n\n');
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ICON_FILES = ['icon-192.png', 'fg-432.png', 'bg-432.png'];

/** The launcher icons into <game>/export/icons: from the picture through Godot, else the placeholders. */
function makeIcons(o, iconsDir) {
  mkdirSync(iconsDir, { recursive: true });
  const placeholders = () => {
    for (const f of ICON_FILES) cpSync(join(o.icons, f), join(iconsDir, f));
    return 'placeholder';
  };
  if (!o.icon || !existsSync(o.icon)) return placeholders();
  const head = Buffer.alloc(8);
  try {
    head.set(readFileSync(o.icon).subarray(0, 8));
  } catch {
    return placeholders();
  }
  if (!head.equals(PNG_MAGIC)) return placeholders();
  const script = join(dirname(fileURLToPath(import.meta.url)), 'android-icons.gd');
  const r = spawnSync(o.godot, ['--headless', '--path', o.game, '--script', script, '--', o.icon, iconsDir], {
    encoding: 'utf8', timeout: 120_000, windowsHide: true,
  });
  const made = r.status === 0 && ICON_FILES.every((f) => existsSync(join(iconsDir, f)));
  if (!made) {
    process.stdout.write(`icons: Godot could not make them (exit ${r.status}): ${(r.stderr || r.stdout || '').trim().slice(-400)}\n`);
    return placeholders();
  }
  return o.iconKind || 'poster';
}

export function prepare(o) {
  const game = resolve(o.game);
  if (!existsSync(join(game, 'project.godot'))) throw new Error(`no project.godot in ${game}`);
  // A build template or buildSrc the commit carried would run inside Gradle: never from the game.
  rmSync(join(game, 'android'), { recursive: true, force: true });
  const presets = join(game, 'export_presets.cfg');
  writeFileSync(presets, withAndroidPreset(existsSync(presets) ? readFileSync(presets, 'utf8') : '', o));
  writeFileSync(join(game, 'project.godot'), patchProjectGodot(readFileSync(join(game, 'project.godot'), 'utf8'), o.orientation));
  mkdirSync(join(game, 'export', 'android'), { recursive: true });
  writeFileSync(join(game, 'export', '.gdignore'), '');
  const icon = makeIcons({ ...o, game }, join(game, 'export', 'icons'));
  mkdirSync(resolve(o.out), { recursive: true });
  if (o.format === 'aab' && o.gradleSeed) {
    // The warmed seed, as this job's own writable Gradle home (Gradle writes locks and caches).
    rmSync(o.gradleHome, { recursive: true, force: true });
    cpSync(o.gradleSeed, o.gradleHome, { recursive: true });
  }
  return icon;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
  };
  const o = {
    game: flag('--game'),
    format: flag('--format'),
    packageName: flag('--package'),
    versionCode: Number(flag('--version-code')),
    versionName: flag('--version-name'),
    appName: flag('--app-name'),
    orientation: flag('--orientation', 'portrait'),
    out: flag('--out'),
    icon: flag('--icon', ''),
    iconKind: flag('--icon-kind', 'poster'),
    icons: flag('--icons'),
    godot: flag('--godot', process.env.GODOT_EXE || 'godot'),
    gradleSeed: flag('--gradle-seed', ''),
    gradleHome: flag('--gradle-home', ''),
  };
  const problem = !o.game ? 'no --game' : !['apk', 'aab'].includes(o.format) ? '--format is apk or aab' : packageNameProblem(o.packageName)
    ?? (!Number.isInteger(o.versionCode) || o.versionCode < 1 ? 'bad --version-code' : !o.versionName ? 'no --version-name'
      : !o.appName || o.appName.length > APP_NAME_MAX ? 'bad --app-name' : !o.out ? 'no --out' : !o.icons ? 'no --icons'
        : o.format === 'aab' && o.gradleSeed && !o.gradleHome ? 'no --gradle-home' : null);
  if (problem) {
    console.error(`android-prepare: ${problem}`);
    process.exit(2);
  }
  try {
    const icon = prepare(o);
    console.log(`@@icon ${icon}`);
  } catch (e) {
    console.error(`android-prepare: ${e.message}`);
    process.exit(1);
  }
}
