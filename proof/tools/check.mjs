// Self-check for a Godot project, run from the project folder:
//   node check.mjs [--wait 6]
// 1. imports the project, 2. runs it headless for ~5 s of game time, 3. exports it to web,
// 4. opens the web build in a hidden browser: screenshot after loading, then a click + Space
//    press and a second screenshot a few seconds later.
// Prints every error found and the screenshot paths. Exit code 1 if there were errors.
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serve, openPage, sleep } from './web.mjs';

const GODOT = process.env.GODOT_EXE || 'C:/Users/lazar/Godot/4.7.2/Godot_v4.7.2-stable_win64_console.exe';
const project = resolve(process.cwd());
const waitIdx = process.argv.indexOf('--wait');
const waitSec = waitIdx > 0 ? Number(process.argv[waitIdx + 1]) : 6;

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

const webDir = join(project, 'export', 'web');
mkdirSync(webDir, { recursive: true });
// Keep Godot from importing the exported files back into the project.
writeFileSync(join(project, 'export', '.gdignore'), '');
godot('export', ['--export-release', 'Web', 'export/web/index.html'], 180_000);

let built = false;
try { built = statSync(join(webDir, 'index.pck')).size > 0; } catch {}
if (!built) errors.push('[export] no web build was produced');

const shots = [];
if (built) {
  const server = await serve(webDir);
  const page = await openPage(`http://127.0.0.1:${server.address().port}/index.html`);
  try {
    await sleep(waitSec * 1000);
    const start = join(project, 'export', 'screenshot-start.png');
    await page.shot(start);
    shots.push(`after loading: ${start}`);
    await page.click(576, 324);
    await page.key('Space');
    await sleep(3000);
    const play = join(project, 'export', 'screenshot-play.png');
    await page.shot(play);
    shots.push(`3 s after a click + Space: ${play}`);
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

console.log(unique.length ? `CHECK: FAIL (${unique.length} error${unique.length > 1 ? 's' : ''})` : 'CHECK: OK');
for (const e of unique) console.log('  ' + e);
for (const s of shots) console.log(`screenshot ${s}`);
if (shots.length) console.log('Open the screenshots with the Read tool to see the game.');
process.exit(errors.length ? 1 : 0);
