// No game may crash when it closes (Black Hole Galaxy 1.3, 2026-11-17: Play's crash rate 3.90%, Google's line 1.09%).
// Godot 4.7 frees each script before the static vars of the others when a game shuts down, and a lambda (`func(…)`)
// freed after its own script crashes the shutdown: Back on Android, swipe-away on iPhone, a segfault or abort on a PC.
// Measured 2026-11-17 on Godot 4.7.2, Windows and Linux (apps/server/README.md "Android export"): a lambda kept in another
// script's static var (directly, in an Array or Dictionary, through a static function, inside an object one holds),
// connected to an engine singleton's signal (Input…) or put in its meta crashed at every close; a method (`_on_done`),
// a member var, the scene tree's signals and `await` never did.
//   lambdaProblems(dir)     the code half: each place a lambda goes where it can outlive its script (tools/check.mjs)
//   cleanExit(godot, dir)   the run: the game headless with --verbose, then quit: exit code 0 and no "orphaned lambdas"
//   node exit-check.mjs [--godot <exe>] [--frames 300] <game dir>
//                           both, before every store export (apps/server/runner: the Android job); exit 1 on a problem
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Engine singletons: they outlive every script, so a lambda connected to one of their signals or kept in their meta does too. */
const SINGLETONS = [
  'AudioServer', 'CameraServer', 'ClassDB', 'DisplayServer', 'Engine', 'EngineDebugger', 'GDExtensionManager', 'Geometry2D',
  'Geometry3D', 'Input', 'InputMap', 'IP', 'JavaClassWrapper', 'JavaScriptBridge', 'Marshalls', 'NativeMenu', 'NavigationServer2D',
  'NavigationServer3D', 'OS', 'Performance', 'PhysicsServer2D', 'PhysicsServer2DManager', 'PhysicsServer3D',
  'PhysicsServer3DManager', 'ProjectSettings', 'RenderingServer', 'ResourceLoader', 'ResourceSaver', 'ResourceUID',
  'TextServerManager', 'ThemeDB', 'Time', 'TranslationServer', 'WorkerThreadPool', 'XRServer',
];
/** Methods that take a function and keep nothing (a lambda handed to them is gone when they return). */
const PASSING = new Set([
  'filter', 'map', 'reduce', 'any', 'all', 'sort_custom', 'bsearch_custom', 'find_custom', 'rfind_custom', 'call', 'callv',
  'call_deferred', 'has', 'find', 'count', 'is_connected', 'disconnect', 'erase',
]);
const LAMBDA = /\bfunc\b\s*(?:[A-Za-z_]\w*\s*)?\(/;
const FIX_METHOD = 'pass a method of this script instead (`= _on_done` with `func _on_done()` below it), or keep the lambda in a member var';
const WHY = 'the game crashes when it closes (Back on Android, swipe-away on iPhone: Godot 4.7 frees the lambda after its script)';

/** The game's .gd files (res:// path → text), without the build output, the history, anything hidden, and folders Godot
 * skips (a .gdignore in them). */
function scripts(dir) {
  const out = new Map();
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    if (d !== dir && entries.some((e) => e.name === '.gdignore')) return;
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = join(d, e.name);
      if (d === dir && (e.name === 'export' || e.name === 'android')) continue;
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.gd')) {
        try { out.set(`res://${relative(dir, p).replaceAll('\\', '/')}`, readFileSync(p, 'utf8')); } catch {}
      }
    }
  };
  walk(dir);
  return out;
}

/** The code with every string's inside and every comment blanked (same length, same lines), so words in them never match. */
export function blankStringsAndComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '#') {
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '"' || c === "'") {
      const triple = src.startsWith(c.repeat(3), i);
      const end = triple ? c.repeat(3) : c;
      out += end;
      i += end.length;
      while (i < n && !src.startsWith(end, i)) {
        if (src[i] === '\\' && i + 1 < n) { out += src[i + 1] === '\n' ? ' \n' : '__'; i += 2; continue; }
        if (src[i] === '\n' && !triple) break; // an unclosed string ends at its line
        out += src[i] === '\n' ? '\n' : '_';
        i++;
      }
      if (src.startsWith(end, i)) { out += end; i += end.length; }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Statements: a line, joined with the lines after it while a bracket is open or the line ends in a backslash. */
function statements(code) {
  const lines = code.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const start = i;
    let text = lines[i];
    let depth = 0;
    const count = (s) => { for (const ch of s) { if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1); } };
    count(text);
    while ((depth > 0 || /\\\s*$/.test(text)) && i + 1 < lines.length) {
      i++;
      text = text.replace(/\\\s*$/, ' ') + '\n' + lines[i];
      count(lines[i]);
    }
    out.push({ line: start + 1, text });
  }
  return out;
}

/** The text between the bracket at `open` and its match (or to the end). */
function inside(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if ('([{'.includes(text[i])) depth++;
    else if (')]}'.includes(text[i]) && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Each place in the game's code where a lambda goes somewhere it can outlive its script: a static var (directly, or an
 * Array, Dictionary or object one holds), an engine singleton's signal or meta, a plugin's object or class (a class_name
 * under addons/). Returns check lines, `[close] res://file.gd:12: …`. The game's tests (test/, never exported) and the
 * plugins' own code are not reported. What only runs can show (a lambda made in one function and kept by another) is
 * cleanExit's.
 */
export function lambdaProblems(dir) {
  dir = resolve(dir);
  const files = scripts(dir);
  const code = new Map([...files].map(([path, src]) => [path, blankStringsAndComments(src)]));
  // Who is who: class names, static vars, plugin classes, preload aliases, autoloads.
  const classOf = new Map(); // res path → class_name
  const staticVars = new Map(); // res path → Set of static var names
  const pluginClasses = new Set();
  for (const [path, text] of code) {
    const cls = text.match(/^\s*class_name\s+([A-Za-z_]\w*)/m)?.[1];
    if (cls) {
      classOf.set(path, cls);
      if (path.startsWith('res://addons/')) pluginClasses.add(cls);
    }
    const names = new Set([...text.matchAll(/^\s*static\s+var\s+([A-Za-z_]\w*)/gm)].map((m) => m[1]));
    if (names.size) staticVars.set(path, names);
  }
  const autoloads = new Map(); // name → res path
  try {
    const project = readFileSync(join(dir, 'project.godot'), 'utf8');
    const section = project.split(/^\[autoload\]\s*$/m)[1]?.split(/^\[/m)[0] ?? '';
    for (const m of section.matchAll(/^([A-Za-z_]\w*)\s*=\s*"\*?(res:\/\/[^"]+\.gd)"/gm)) autoloads.set(m[1], m[2]);
  } catch {}

  const problems = [];
  const seen = new Set();
  const report = (path, line, what, fix) => {
    const key = `${path}:${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    problems.push(`[close] ${path}:${line}: ${what}: ${WHY}. Instead, ${fix} ("A lambda that outlives its script")`);
  };

  for (const [path, text] of code) {
    if (path.startsWith('res://test/') || path.startsWith('res://addons/')) continue;
    const raw = files.get(path);
    // This file's names for other scripts: class_name everywhere, its own preload/load consts and vars, the autoloads.
    const qualifiers = new Map(); // name → res path
    for (const [p, cls] of classOf) qualifiers.set(cls, p);
    for (const m of raw.matchAll(/^\s*(?:const|var|static\s+var)\s+([A-Za-z_]\w*)\s*(?::\s*\w*\s*)?:?=\s*(?:pre)?load\(\s*["'](res:\/\/[^"']+\.gd)["']\s*\)/gm)) qualifiers.set(m[1], m[2]);
    for (const [name, p] of autoloads) qualifiers.set(name, p);
    const own = staticVars.get(path) ?? new Set();
    // Names in this file that hold a plugin's object or a native singleton (Engine.get_singleton).
    const pluginVars = new Map(); // var name → plugin class
    const nativeVars = new Set();
    for (const m of text.matchAll(/\b(?:var\s+)?([A-Za-z_]\w*)\s*(?::\s*([A-Za-z_]\w*)\s*)?:?=\s*([A-Za-z_]\w*)\.new\s*\(/g)) {
      if (pluginClasses.has(m[3])) pluginVars.set(m[1], m[3]);
    }
    for (const m of text.matchAll(/\bvar\s+([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)/g)) if (pluginClasses.has(m[2])) pluginVars.set(m[1], m[2]);
    for (const m of text.matchAll(/\b(?:var\s+)?([A-Za-z_]\w*)\s*(?::\s*\w+\s*)?:?=\s*Engine\.get_singleton\s*\(/g)) nativeVars.add(m[1]);

    let fn = null; // the function being read: its indent and the names that shadow a static var in it
    for (const st of statements(text)) {
      const first = st.text.split('\n')[0];
      if (!first.trim()) continue;
      const indent = first.match(/^\s*/)[0].length;
      const decl = first.match(/^(\s*)(?:static\s+)?func\s+[A-Za-z_]\w*\s*\(([^)]*)\)/);
      if (decl) {
        fn = { indent, names: new Set([...decl[2].matchAll(/([A-Za-z_]\w*)\s*(?::|=|,|$)/g)].map((m) => m[1])) };
      } else if (fn && indent <= fn.indent) fn = null;
      if (fn) {
        for (const m of st.text.matchAll(/^\s*(?:var|const)\s+([A-Za-z_]\w*)/gm)) fn.names.add(m[1]);
        for (const m of st.text.matchAll(/\bfor\s+([A-Za-z_]\w*)\s+in\b/g)) fn.names.add(m[1]);
        for (const m of st.text.matchAll(/\bfunc\s*\(([^)]*)\)/g)) for (const p of m[1].matchAll(/([A-Za-z_]\w*)\s*(?::|=|,|$)/g)) fn.names.add(p[1]);
      }
      if (!LAMBDA.test(st.text.replace(/^\s*(?:static\s+)?func\s+[A-Za-z_]\w*\s*\(/, ''))) continue;
      const t = st.text;

      // A static var made with a lambda.
      const sv = t.match(/^\s*static\s+var\s+([A-Za-z_]\w*)[^=]*?=([\s\S]*)$/);
      if (sv && LAMBDA.test(sv[2])) { report(path, st.line, `a lambda (func …) is kept in the static var ${sv[1]}`, FIX_METHOD); continue; }

      // Targets: an expression that starts at a static var, a plugin's object or class, or an engine singleton.
      const targets = [];
      for (const name of own) if (!fn?.names.has(name)) targets.push({ re: `(?<![.\\w])${esc(name)}`, what: `the static var ${name}`, fix: FIX_METHOD });
      for (const [q, p] of qualifiers) {
        for (const name of staticVars.get(p) ?? []) targets.push({ re: `(?<![.\\w])${esc(q)}\\.${esc(name)}`, what: `${q}.${name}, a static var`, fix: FIX_METHOD });
      }
      for (const [v, cls] of pluginVars) targets.push({ re: `(?<![.\\w])${esc(v)}(?=\\.)`, what: `${v}, a plugin's ${cls} (the plugin keeps it)`, fix: 'give it a method of this script (`l.on_done = _on_done`)', member: true });
      for (const cls of pluginClasses) targets.push({ re: `(?<![.\\w])${esc(cls)}(?=\\.)`, what: `${cls} (a plugin's class, kept by the plugin)`, fix: 'give it a method of this script (`_on_done`)', member: true, calls: true });
      for (const s of SINGLETONS) targets.push({ re: `(?<![.\\w])${s}(?=\\.)`, what: `${s} (an engine singleton, alive until after every script is gone)`, fix: 'connect a method of this script (`.connect(_on_done)`)', singleton: true });
      targets.push({ re: '(?<![.\\w])Engine\\.get_singleton\\s*\\([^)]*\\)', what: 'a native plugin (Engine.get_singleton)', fix: 'connect a method of this script (`.connect(_on_done)`)', singleton: true });
      for (const v of nativeVars) targets.push({ re: `(?<![.\\w])${esc(v)}(?=\\.)`, what: `${v}, a native plugin (Engine.get_singleton)`, fix: 'connect a method of this script (`.connect(_on_done)`)', singleton: true });

      for (const tg of targets) {
        // The target, then any .member / [index], then an assignment or a call.
        const re = new RegExp(`${tg.re}((?:\\s*\\.\\s*[A-Za-z_]\\w*|\\s*\\[[^\\]]*\\])*)\\s*(\\+?=(?!=)|\\(|\\.\\s*([A-Za-z_]\\w*)\\s*\\()`, 'g');
        let hit = null;
        for (const m of t.matchAll(re)) {
          const chain = m[1] ?? '';
          if (m[2].endsWith('=')) {
            // Singletons' own properties are not theirs to keep a lambda in through `=`; plugins' and static vars' are.
            if (tg.singleton) continue;
            if ((tg.member || tg.calls) && !chain) continue; // `l = Plugin.new()` itself, not a member of it
            if (LAMBDA.test(t.slice(m.index + m[0].length))) { hit = m; break; }
            continue;
          }
          // A call: the last member is the method (`list.append(`), or the chain ends in `.method(`.
          const method = m[3] ?? chain.match(/\.\s*([A-Za-z_]\w*)\s*$/)?.[1] ?? '';
          if (!m[3] && !chain && !tg.calls) continue; // `Input(` is not a thing; a static var called as a function
          if (PASSING.has(method)) continue;
          if (tg.singleton && !/^(connect|set_meta|add_user_signal)$/.test(method)) continue;
          const open = t.indexOf('(', m.index + m[0].length - 1);
          if (open >= 0 && LAMBDA.test(inside(t, open))) { hit = m; break; }
        }
        if (hit) {
          const how = tg.singleton ? 'is connected to' : tg.member || tg.calls ? 'is handed to' : 'is kept in';
          report(path, st.line, `a lambda (func …) ${how} ${tg.what}`, tg.fix);
          break;
        }
      }
    }
  }
  return problems;
}

/** What a non-zero exit was, in words. */
function exitWords(r) {
  if (r.signal) return `signal ${r.signal}`;
  const hex = r.status > 0xffff ? ` (0x${(r.status >>> 0).toString(16).toUpperCase()}${r.status === 3221225477 ? ', an access violation' : ''})` : '';
  return `exit code ${r.status}${hex}`;
}

/**
 * A crash on the way out of a Godot run that finished (spawnSync's result and its output): the check line, or null.
 * `codes`: the exit codes the game quits with itself (a feature test quits with 1 when it failed). `after`: what ran
 * ("test x_test.tscn"), for the message.
 */
export function crashAtClose(r, output, { codes = [0], after = '' } = {}) {
  if (r.error || (!r.signal && codes.includes(r.status))) return null;
  const sign = output.split(/\r?\n/).map((l) => l.trim()).find((l) => /double free|corruption|destroyed mutex|Segmentation fault|crashed with signal|CrashHandlerException|FORTIFY/i.test(l));
  return `[close] the game crashes when it closes${after ? ` after ${after}` : ''} (${exitWords(r)}${sign ? `: "${sign}"` : ''}): on a phone that is a crash at Back (Android) or swipe-away (iPhone), every time. `
    + 'Usually a lambda (func …) that outlives its script: kept in a static var (directly, or in an Array, Dictionary or object one holds), '
    + 'connected to an engine singleton\'s signal (Input…), or handed to a plugin. Pass a method instead ("A lambda that outlives its script")';
}

/**
 * Runs the game headless for `frames` frames with --verbose, lets it quit, and reports a crash on the way out (an exit
 * code other than 0, or a signal) or a script freed while its lambdas were still kept ("orphaned lambdas": Godot's own
 * line; on 4.7.2 the crash comes first, so the exit code is what shows). Returns { problems, output, status, signal }.
 */
export function cleanExit(godot, dir, { frames = 300, timeoutMs = 120_000 } = {}) {
  const r = spawnSync(godot, ['--headless', '--verbose', '--path', resolve(dir), '--fixed-fps', '60', '--quit-after', String(frames)], {
    encoding: 'utf8', timeout: timeoutMs, windowsHide: true, maxBuffer: 256 << 20,
  });
  const output = `${r.stdout || ''}\n${r.stderr || ''}`;
  const problems = [];
  if (r.error) {
    problems.push(r.error.code === 'ETIMEDOUT'
      ? `[close] the game did not run its ${frames} frames and close within ${Math.round(timeoutMs / 1000)} s (look for a loop that never ends)`
      : `[close] could not start Godot: ${r.error.message}`);
    return { problems, output, status: r.status, signal: r.signal };
  }
  const crash = crashAtClose(r, output);
  if (crash) problems.push(crash);
  for (const o of output.split(/\r?\n/).filter((l) => /orphaned lambdas/i.test(l)).map((l) => l.trim())) {
    problems.push(`[close] the game crashes when it closes: Godot freed a script while its lambdas were still kept somewhere ("${o}"). Pass a method instead of a lambda where it is kept ("A lambda that outlives its script")`);
  }
  return { problems, output, status: r.status, signal: r.signal };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(name);
    if (i < 0 || i + 1 >= args.length) return fallback;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const godot = flag('--godot', process.env.GODOT_EXE || 'C:/Users/lazar/Godot/4.7.2/Godot_v4.7.2-stable_win64.exe');
  const frames = Number(flag('--frames', '300'));
  const dir = args[0];
  if (!dir || !existsSync(join(dir, 'project.godot')) || !statSync(dir).isDirectory()) {
    console.log('EXIT-CHECK: FAIL\nERROR: [close] no game here (no project.godot): node exit-check.mjs [--godot <exe>] [--frames 300] <game dir>');
    process.exit(2);
  }
  const { limitThisProcess } = await import('./cpu.mjs');
  limitThisProcess(); // Godot runs below normal priority; on a PC 4 cores stay free (tools/cpu.mjs)
  const problems = [...lambdaProblems(dir), ...cleanExit(godot, dir, { frames }).problems];
  console.log(problems.length ? `EXIT-CHECK: FAIL (${problems.length} problem${problems.length > 1 ? 's' : ''})` : 'EXIT-CHECK: OK (the game closes cleanly)');
  // ERROR: lines are what the Android export's failure reading picks up (apps/server/src/android/android.service.ts).
  for (const p of problems) console.log(`ERROR: ${p}`);
  process.exit(problems.length ? 1 : 0);
}
