// The asset capture (2026-11-04, the game page's Assets tab), run from the game folder after a build passes:
//   node capture.mjs            (run.mjs runs it after the last good commit; by hand it works the same)
// What a game makes in code has no file to list, so it is captured once, at build time, here:
//   - each shared look (lib/looks.gd, rules/FAST.md) as a PNG; an animated one also as a sprite sheet (frames left to right)
//   - each sound made in code (an AudioStreamWAV the game holds, e.g. a sfx.gd's dictionary) as a WAV
//   - a still picture of each 3D model, as the game's own renderer draws it
// It plays a copy of the game (export/.capture: never the game's own files, never its build) with tools/capture.gd added
// as an autoload, in the hidden browser (tools/web.mjs: one at a time, capped): asked once the title has settled, and
// again 3 s after a tap and Space (what the start of play draws). The result is export/assets/captured.json and the files
// beside it, stamped with the commit they were made from; the server lists the game's files itself and adds these
// (apps/server/src/assets). It never fails a build: a problem is a note in the JSON, and the exit code is always 0.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { limitThisProcess } from './cpu.mjs';
import { openPage, serve, sleep } from './web.mjs';

limitThisProcess(); // Godot and the hidden browser: capped like the check's (tools/cpu.mjs)

const HERE = dirname(fileURLToPath(import.meta.url));
const GODOT = process.env.GODOT_EXE || 'C:/Users/lazar/Godot/4.7.2/Godot_v4.7.2-stable_win64.exe';
const project = resolve(process.cwd());
const OUT = join(project, 'export', 'assets');
const COPY = join(project, 'export', '.capture');
const LIMIT_MS = Number(process.env.CAPTURE_LIMIT_MS) || 150_000;
const MODEL_EXT = new Set(['.glb', '.gltf', '.fbx', '.obj', '.dae', '.blend']);
/** Not the game's own content: git, Godot's cache, builds, tests, editor add-ons. */
const SKIP = new Set(['.git', '.godot', 'export', 'test', 'addons']);
const PHONE = { width: 432, height: 936 };
const COMPUTER = { width: 1366, height: 768 };
const t0 = Date.now();
const notes = [];
const found = { looks: new Map(), sounds: [], stills: new Map() };

if (!existsSync(join(project, 'project.godot'))) {
  console.log('CAPTURE: skipped (not a Godot project folder)');
  process.exit(0);
}

/** The commit the capture is of: the server takes the files only when the folder is still at it. */
const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: project, encoding: 'utf8' }).stdout?.trim() || '';

/** The game's 3D model files, as res:// paths (regular files only; no symlinks followed). */
function modelPaths() {
  const list = [];
  const walk = (rel) => {
    let entries = [];
    try { entries = readdirSync(join(project, rel), { withFileTypes: true }); } catch { return; }
    for (const d of entries) {
      if (!rel && SKIP.has(d.name)) continue;
      const path = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) walk(path);
      else if (d.isFile() && MODEL_EXT.has(extname(d.name).toLowerCase())) list.push(`res://${path}`);
    }
  };
  walk('');
  return list.sort().slice(0, 200);
}

/** project.godot with the capture added as an autoload (after any of the game's own). */
function withAutoload(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const line = 'TPCapture="*res://tp_capture.gd"';
  if (/^\[autoload\]\s*$/m.test(text)) {
    // At the end of the section: the game's own singletons exist by the time the capture looks.
    const parts = text.split(/^(?=\[)/m);
    return parts.map((p) => (/^\[autoload\]/.test(p) ? `${p.replace(/\s*$/, '')}${eol}${line}${eol}${eol}` : p)).join('');
  }
  return `${text.replace(/\s*$/, '')}${eol}${eol}[autoload]${eol}${eol}${line}${eol}`;
}

/** Makes the copy and its web build; returns the build folder, or null (with a note). */
function buildCopy(models) {
  const src = join(COPY, 'project');
  const web = join(COPY, 'web');
  rmSync(COPY, { recursive: true, force: true });
  mkdirSync(web, { recursive: true });
  mkdirSync(src, { recursive: true });
  // The import cache comes along, so nothing is imported again; export/ and the history don't.
  for (const entry of readdirSync(project)) {
    if (entry === 'export' || entry === '.git') continue;
    cpSync(join(project, entry), join(src, entry), { recursive: true });
  }
  const pg = join(src, 'project.godot');
  writeFileSync(pg, withAutoload(readFileSync(pg, 'utf8')));
  const script = readFileSync(join(HERE, 'capture.gd'), 'utf8').replace('const MODELS: Array = []', `const MODELS: Array = ${JSON.stringify(models)}`);
  writeFileSync(join(src, 'tp_capture.gd'), script);
  const r = spawnSync(GODOT, ['--headless', '--path', src, '--export-release', 'Web', join(web, 'index.html')], { encoding: 'utf8', timeout: 180_000 });
  if (!existsSync(join(web, 'index.pck'))) {
    const why = ((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).find((l) => /ERROR/.test(l)) ?? (r.error?.message || 'no pack');
    notes.push(`the copy could not be exported for the browser: ${why.trim().slice(0, 200)}`);
    return null;
  }
  return web;
}

/** Waits until `expr` is truthy in the page (polled every 250 ms), at most `ms`. */
async function until(page, expr, ms) {
  for (let waited = 0; waited < ms; waited += 250) {
    const r = await page.evaluate(`!!(${expr})`);
    if (r && !r.timedOut && r.value) return true;
    await sleep(250);
  }
  return false;
}

/** One ask: the capture answers with every new item. */
async function ask(page, n) {
  await page.evaluate(`window.__tpAsk = ${n}`);
  if (!(await until(page, `window.__tpDone >= ${n}`, 60_000))) notes.push(`ask ${n} was not answered within 60 s`);
}

/** Reads the items the page holds, from `from` on. */
async function take(page, from) {
  const n = await page.evaluate('(window.__tpOut || []).length');
  const count = n && !n.timedOut ? Number(n.value) || 0 : 0;
  for (let i = from; i < count; i++) {
    const r = await page.evaluate(`window.__tpOut[${i}]`, 20_000);
    if (!r || r.timedOut || !r.value) continue;
    const item = r.value;
    if (item.kind === 'look' && typeof item.key === 'string' && !found.looks.has(item.key)) found.looks.set(item.key, item);
    else if (item.kind === 'sound' && typeof item.name === 'string') found.sounds.push(item);
    else if (item.kind === 'still' && typeof item.path === 'string') found.stills.set(item.path, item);
    else if (item.kind === 'note' && typeof item.text === 'string') notes.push(item.text.slice(0, 200));
  }
  return count;
}

async function capture() {
  const models = modelPaths();
  const web = buildCopy(models);
  if (!web) return;
  const text = readFileSync(join(project, 'project.godot'), 'utf8');
  const display = text.split(/^\[display\]\s*$/m)[1]?.split(/^\[/m)[0] ?? '';
  const setting = (key) => display.match(new RegExp(`^window/${key}\\s*=\\s*"?([^"\\r\\n]*)"?`, 'm'))?.[1];
  const handheld = setting('handheld/orientation');
  const w = Number(setting('size/viewport_width') ?? 1152), h = Number(setting('size/viewport_height') ?? 648);
  const portrait = handheld !== undefined ? [1, 3, 5, 6].includes(Number(handheld)) : h >= w;
  const viewport = portrait ? PHONE : COMPUTER;
  const server = await serve(web);
  let page = null;
  try {
    page = await openPage(`${server.base}/index.html`, { viewport, touch: portrait });
    if (!(await until(page, 'window.__tpReady', 45_000))) {
      notes.push('the game did not start in the browser within 45 s');
      return;
    }
    await sleep(2500); // the title's looks: baked in _ready, sometimes after a frame or two
    await ask(page, 1);
    let read = await take(page, 0);
    // The start of play: a game that bakes its level's looks (a map, its enemies) as play begins.
    const x = viewport.width / 2, y = viewport.height / 2;
    if (portrait) await page.tap(x, y);
    else await page.click(x, y);
    await page.key('Space');
    await sleep(3500);
    await ask(page, 2);
    read = await take(page, read);
    for (const l of page.console) {
      const line = String(l.text || '').split('\n')[0];
      if (/tp_capture\.gd/.test(line) && (l.type === 'error' || /ERROR/.test(line))) notes.push(`capture: ${line.trim().slice(0, 200)}`);
    }
  } finally {
    if (page) await page.close();
    server.close();
  }
}

/** Writes a base64 payload; returns its path under export/assets/, or null. */
function save(rel, base64) {
  if (typeof base64 !== 'string' || !base64) return null;
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(base64, 'base64'));
  return rel;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(project, 'export', '.gdignore'), ''); // Godot never imports export/ back into the game
const stop = setTimeout(() => {
  notes.push(`stopped after ${Math.round(LIMIT_MS / 1000)} s`);
  finish();
  process.exit(0);
}, LIMIT_MS);
try {
  await capture();
} catch (e) {
  notes.push(`capture failed: ${String(e?.message || e).split('\n')[0].slice(0, 200)}`);
}
clearTimeout(stop);
finish();

function finish() {
  const looks = [...found.looks.values()].map((l, i) => ({
    key: l.key,
    ...(typeof l.label === 'string' && l.label.trim() ? { label: l.label.trim().slice(0, 80) } : {}),
    w: l.w, h: l.h, frames: l.frames,
    file: save(`looks/${i + 1}.png`, l.png),
    ...(l.strip ? { strip: save(`looks/${i + 1}.strip.png`, l.strip) } : {}),
  })).filter((l) => l.file);
  const sounds = found.sounds.map((s, i) => ({ name: s.name, seconds: s.seconds, file: save(`sounds/${i + 1}.wav`, s.wav) })).filter((s) => s.file);
  const stills = [...found.stills.values()].map((s, i) => ({ path: s.path, file: save(`stills/${i + 1}.png`, s.png) })).filter((s) => s.file);
  const ms = Date.now() - t0;
  writeFileSync(join(OUT, 'captured.json'), JSON.stringify({ v: 1, commit, made: new Date().toISOString(), ms, looks, sounds, stills, notes }, null, 1) + '\n');
  try { if (lstatSync(COPY).isDirectory()) rmSync(COPY, { recursive: true, force: true }); } catch {}
  console.log(`CAPTURE: ${looks.length} look${looks.length === 1 ? '' : 's'}, ${sounds.length} sound${sounds.length === 1 ? '' : 's'} made in code, ${stills.length} model still${stills.length === 1 ? '' : 's'} in ${(ms / 1000).toFixed(1)} s${notes.length ? `; notes: ${notes.join(' | ')}` : ''}`);
}
