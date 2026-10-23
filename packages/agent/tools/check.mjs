// Self-check for a Godot project, run from the project folder:
//   node check.mjs [--wait 6]
// 1. imports the project, 2. runs it headless for ~5 s of game time, 3. exports it to web,
// 4. opens the web build in a hidden browser: screenshot after loading, then a click + Space
//    and a screenshot 3 s later, then one more 10 s later with no input (usually game over).
//    Portrait games (project.godot) get a phone-shaped page, landscape ones a wide one.
// Prints every error found and the screenshot paths. Exit code 1 if there were errors.
// Every error is also appended to agent/learn/errors.jsonl, so repeated mistakes can be
// turned into rules (rules/GOTCHAS.md).
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync, appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, openPage, sleep } from './web.mjs';
import { limitThisProcess } from './cpu.mjs';

limitThisProcess(); // Godot and the hidden browser: 4 cores always stay free, low priority (tools/cpu.mjs)

const GODOT = process.env.GODOT_EXE || 'C:/Users/lazar/Godot/4.7.2/Godot_v4.7.2-stable_win64.exe';
const project = resolve(process.cwd());
const waitIdx = process.argv.indexOf('--wait');
const waitSec = waitIdx > 0 ? Number(process.argv[waitIdx + 1]) : 6;

// The main exe, not the _console wrapper: the wrapper re-enables Windows' crash dialog for its
// child, so a game that crashes in a headless test would pop up a window on Luka's screen.
if (!existsSync(join(project, 'project.godot'))) {
  console.log('CHECK: FAIL (1 error)\n  [setup] this folder is not a Godot project (no project.godot): run the check from the game folder');
  process.exit(1);
}

// Which way the game is played (the agent decides when it builds): the handheld orientation if
// set, else the viewport's shape. Portrait games get phone-shaped screenshots.
const display = readFileSync(join(project, 'project.godot'), 'utf8').split(/^\[display\]\s*$/m)[1]?.split(/^\[/m)[0] ?? '';
const setting = (key) => display.match(new RegExp(`^window/${key}\\s*=\\s*"?([^"\\r\\n]*)"?`, 'm'))?.[1];
const viewW = Number(setting('size/viewport_width') ?? 1152), viewH = Number(setting('size/viewport_height') ?? 648);
const handheld = setting('handheld/orientation');
const portrait = handheld !== undefined ? [1, 3, 5].includes(Number(handheld)) : viewH > viewW;
const PHONE = { width: 432, height: 936 }; // 9:19.5: taller than 9:16, like most phones

const ANSI = /\x1b\[[0-9;]*m/g;
const errors = [];

// Keeps Godot error lines plus the "at:" line that follows each one.
function collectErrors(stage, output) {
  const lines = output.replace(ANSI, '').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (/^\s*(SCRIPT ERROR|USER SCRIPT ERROR|ERROR:|Parse Error)/.test(line) || /Parse Error:/.test(line)) {
      const at = lines[i + 1] && /^\s*at:/.test(lines[i + 1]) ? ` (${lines[i + 1].trim()})` : '';
      errors.push(`[${stage}] ${line.trim()}${at}`);
    }
  });
}

function godot(stage, args, timeoutMs) {
  const r = spawnSync(GODOT, ['--headless', '--path', project, ...args], { encoding: 'utf8', timeout: timeoutMs });
  if (r.error) errors.push(`[${stage}] could not run Godot: ${r.error.message}`);
  collectErrors(stage, (r.stdout || '') + '\n' + (r.stderr || ''));
}

godot('import', ['--import'], 120_000);
godot('run', ['--fixed-fps', '60', '--quit-after', '300'], 60_000);

// Feature tests the agent wrote (test/*_test.tscn). All of them run after every change, so
// what earlier changes added keeps working. A test prints "PASS: …" / "FAIL: …" and quits.
const testDir = join(project, 'test');
const tests = existsSync(testDir) ? readdirSync(testDir).filter((f) => f.endsWith('_test.tscn')) : [];
const testSummary = [];
for (const t of tests) {
  const r = spawnSync(GODOT, ['--headless', '--path', project, '--fixed-fps', '60', '--quit-after', '3600', `res://test/${t}`], { encoding: 'utf8', timeout: 120_000 });
  const out = ((r.stdout || '') + '\n' + (r.stderr || '')).replace(ANSI, '');
  collectErrors(`test ${t}`, out);
  const passed = (out.match(/^\s*PASS:.*$/gm) || []).length;
  const failed = out.match(/^\s*FAIL:.*$/gm) || [];
  for (const f of failed) errors.push(`[test ${t}] ${f.trim()}`);
  if (!passed && !failed.length) errors.push(`[test ${t}] printed no PASS:/FAIL: lines`);
  testSummary.push(`${t}: ${passed} passed, ${failed.length} failed`);
}

const webDir = join(project, 'export', 'web');
mkdirSync(webDir, { recursive: true });
// Keep Godot from importing the exported files back into the project.
writeFileSync(join(project, 'export', '.gdignore'), '');
godot('export', ['--export-release', 'Web', 'export/web/index.html'], 180_000);

let built = false;
try { built = statSync(join(webDir, 'index.pck')).size > 0; } catch {}
if (!built) errors.push('[export] no web build was produced');

const shots = [];
const frameRates = [];
if (built) {
  const server = await serve(webDir);
  // server.base carries a random path token (web.mjs): another process can't fetch this game.
  const page = await openPage(`${server.base ?? `http://127.0.0.1:${server.address().port}`}/index.html`, portrait ? { viewport: PHONE } : {});
  try {
    await sleep(waitSec * 1000);
    const start = join(project, 'export', 'screenshot-start.png');
    if (await page.shot(start)) shots.push(`after loading: ${start}`);
    if (portrait) await page.click(PHONE.width / 2, PHONE.height / 2);
    else await page.click(576, 324);
    await page.key('Space');
    // Is the game still running? Godot runs on the page's animation frames: a game stuck in a
    // loop that never ends blocks the page, which then stops answering. The headless run and
    // the feature tests can't see that (they stop after a fixed time). The frame count itself is
    // only reported: still screens legitimately show 0 in the hidden browser (2026-10-17).
    await page.evaluate('window.__tpFrames = 0; (function f() { window.__tpFrames++; requestAnimationFrame(f); })(); 1');
    const fpsOver = async (ms) => {
      const a = await page.evaluate('window.__tpFrames');
      await sleep(ms);
      const b = await page.evaluate('window.__tpFrames');
      if (a.timedOut || b.timedOut) return null;
      return Math.round(((b.value - a.value) * 1000) / ms);
    };
    const fpsPlay = await fpsOver(3000);
    const play = join(project, 'export', 'screenshot-play.png');
    if (await page.shot(play)) shots.push(`3 s after a click + Space: ${play}`);
    const fpsLater = await fpsOver(10000);
    const later = join(project, 'export', 'screenshot-later.png');
    if (await page.shot(later)) shots.push(`10 s later, no input: ${later}`);
    frameRates.push(fpsPlay, fpsLater);
    // Only a page that stops answering counts as an error: a still screen (game over, between
    // waves) legitimately shows 0 frames a second in the hidden browser, so the rate is info.
    if (fpsPlay === null || fpsLater === null) {
      errors.push('[browser] the game froze: the page stopped responding while it played (look for a loop that never ends, e.g. a while loop in _process or _draw)');
    }
  } finally {
    await page.close();
    server.close();
  }
  for (const l of page.console) {
    const text = l.text.split('\n')[0];
    if (/^\s*at:/.test(text)) continue;
    if (l.type === 'error' || l.type === 'exception' || /SCRIPT ERROR|ERROR:/.test(text)) {
      errors.push(`[browser] ${text.trim()}`);
    }
  }
}

// The same error shows up in several stages; report each once, at the first stage it appeared.
const seen = new Set();
const unique = errors.filter((e) => {
  const msg = e.replace(/^\[\w+\] /, '').replace(/ \(at: .*\)$/, '');
  if (seen.has(msg)) return false;
  seen.add(msg);
  return true;
});

// AGENT_LOG_DIR: on the live server this package is read-only; the runner collects the file.
const LEARN = process.env.AGENT_LOG_DIR
  ? join(process.env.AGENT_LOG_DIR, 'errors.jsonl')
  : join(dirname(fileURLToPath(import.meta.url)), '..', 'learn', 'errors.jsonl');
for (const e of unique) {
  appendFileSync(LEARN, JSON.stringify({ date: new Date().toISOString(), game: basename(project), error: e }) + '\n');
}

console.log(unique.length ? `CHECK: FAIL (${unique.length} error${unique.length > 1 ? 's' : ''})` : 'CHECK: OK');
for (const e of unique) console.log('  ' + e);
console.log(`orientation: ${portrait ? 'portrait' : 'landscape'} (${viewW}×${viewH} viewport${portrait ? `; screenshots are ${PHONE.width}×${PHONE.height}, a phone held upright` : ''})`);
if (frameRates.length) console.log(`frames a second while playing (hidden browser, software rendering; 0 is normal on a still screen): ${frameRates.map((f) => f ?? 'froze').join(', then ')}`);
if (testSummary.length) console.log(`tests: ${testSummary.join('; ')}`);
for (const s of shots) console.log(`screenshot ${s}`);
if (shots.length) console.log('Open the screenshots with the Read tool to see the game.');
process.exit(errors.length ? 1 : 0);
