// Self-check for a Godot project, run from the project folder:
//   node check.mjs [--wait 6]
// 1. imports the project, 2. runs it headless for ~5 s of game time, 3. exports it to web,
// 4. opens the web build in a hidden browser: screenshot after loading, then a click + Space
//    and a screenshot 3 s later, then one more 10 s later with no input (usually game over).
//    Games made since 10-25 (a PLATFORM file, run.mjs) get a phone with a touch screen held the game's way up,
//    then a computer (fill games: an upright phone, a tablet, a phone held sideways, then a computer). Older
//    games: portrait ones a phone-shaped page, landscape ones a wide one, no touch screen.
// Prints every error found and the screenshot paths. Exit code 1 if there were errors.
// Every error is also appended to agent/learn/errors.jsonl, so repeated mistakes can be
// turned into rules (rules/GOTCHAS.md).
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync, appendFileSync, existsSync, readdirSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, openPage, sleep } from './web.mjs';
import { analyse as colourOf } from './colours.mjs';
import { limitThisProcess } from './cpu.mjs';

limitThisProcess(); // Godot and the hidden browser: 4 cores stay free on a PC (on the server its container caps them), low priority (tools/cpu.mjs)

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
const PHONE_SIDEWAYS = { width: 936, height: 432 };
const TABLET = { width: 820, height: 1180 }; // an iPad held upright
const COMPUTER = { width: 1366, height: 768 }; // the most common laptop screen

// The screens the game is made for (run.mjs writes PLATFORM: auto, phone, computer or fill; none before 10-25).
const platformFile = join(project, 'PLATFORM');
const platform = existsSync(platformFile) ? readFileSync(platformFile, 'utf8').trim() : '';
const fill = platform === 'fill';
const aspect = setting('stretch/aspect');
// Games made since 2026-11-04 (run.mjs writes TEMPLATE 2) are held to rules/FAST.md: their stress test and the
// start-freeze check can fail them. Older games get the same measurements as notes once they have a stress test.
const templateFile = join(project, 'TEMPLATE');
const template = existsSync(templateFile) ? Number(readFileSync(templateFile, 'utf8').trim()) || 0 : 0;
const fast = template >= 2;
// Games made since 2026-11-07 (TEMPLATE 3) are also held to their colours (rules/BASE.md "Colours that read"): a washed-out
// or too-dark screen fails them. Older games get it as a note.
const colourStrict = template >= 3;
const stressTest = existsSync(join(project, 'test', 'stress_test.tscn'));
const notes = []; // measurements that don't fail this game (older games), shown after the errors

const ANSI = /\x1b\[[0-9;]*m/g;
const errors = [];

// The platform's screen setup is part of the game's promise: one shape with bars, or every shape.
if (platform && fill && aspect !== 'expand') errors.push('[setup] this game fills every screen: project.godot must keep window/stretch/aspect="expand"');
if (platform && !fill && aspect !== 'keep') errors.push('[setup] this game has one shape, scaled to fit with bars: project.godot must keep window/stretch/aspect="keep"');
if (platform === 'phone' && !portrait) errors.push('[setup] this game is made for phones held upright: keep it portrait (720×1280, window/handheld/orientation=1)');
if (platform === 'computer' && portrait) errors.push('[setup] this game is made for computers: keep it landscape (1152×648, window/handheld/orientation=0)');
if (fast) {
  const physics = readFileSync(join(project, 'project.godot'), 'utf8').match(/^common\/max_physics_steps_per_frame\s*=\s*(\d+)/m);
  if (!physics || Number(physics[1]) > 3) errors.push('[setup] project.godot must keep physics/common/max_physics_steps_per_frame=3 under [physics] ("Fast games")');
  if (!stressTest) errors.push('[setup] no test/stress_test.tscn: every game has a stress test that puts it straight into its busiest moment and calls measure() ("Fast games")');
}

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
const perf = []; // the stress test's measure() lines (test/helpers.gd)
for (const t of tests) {
  // The stress test measures up to ~30 s of real time after its own setup: it gets longer than the others.
  const long = t === 'stress_test.tscn';
  const r = spawnSync(GODOT, ['--headless', '--path', project, '--fixed-fps', '60', '--quit-after', long ? '9000' : '3600', `res://test/${t}`], { encoding: 'utf8', timeout: long ? 180_000 : 120_000 });
  const out = ((r.stdout || '') + '\n' + (r.stderr || '')).replace(ANSI, '');
  collectErrors(`test ${t}`, out);
  const passed = (out.match(/^\s*PASS:.*$/gm) || []).length;
  const failed = out.match(/^\s*FAIL:.*$/gm) || [];
  for (const f of failed) errors.push(`[test ${t}] ${f.trim()}`);
  for (const line of out.match(/^\s*PERF: .*$/gm) || []) {
    try { perf.push(JSON.parse(line.trim().slice(6))); } catch {}
  }
  if (long && !(out.match(/^\s*PERF: /m))) errors.push(`[test ${t}] never called measure(): the stress test must end with await measure("…") before finish() ("Fast games")`);
  if (!passed && !failed.length && !(long && perf.length)) errors.push(`[test ${t}] printed no PASS:/FAIL: lines`);
  testSummary.push(`${t}: ${passed} passed, ${failed.length} failed`);
}

// The busiest moment's budget (rules/FAST.md). Measured headless (no drawing on screen): the game's own code per
// frame, on this machine. REF_BENCH_MS is helpers.gd's fixed piece of work on the PC the budgets were set on (Luka's,
// 2026-11-04); a slower machine (the live server, a busy PC) gets proportionally more time.
const REF_BENCH_MS = 4.0;
const SPEED = { frameMs: 4.0, customRedraws: 30, nodesGrowth: 500 };
const perfLines = [];
for (const p of perf) {
  const scale = Math.max(0.5, Math.min(4, (p.bench_ms || REF_BENCH_MS) / REF_BENCH_MS));
  const budget = +(SPEED.frameMs * scale).toFixed(1);
  const where = `at the busiest moment ("${p.label}")`;
  const top = Object.entries(p.redrawn || {}).map(([k, v]) => `${k} ${v}`).join(', ');
  const nodes = p.nodes || [];
  const growing = nodes.length >= 4 && nodes.every((n, i) => i === 0 || n >= nodes[i - 1]) && nodes.at(-1) - nodes[0] > SPEED.nodesGrowth;
  const found = [];
  if (p.median_ms > budget) {
    found.push(`[speed] ${where} a frame takes ${p.median_ms} ms of game code on this machine, over the budget of ${budget} ms: on a cheap phone that is a slide show. `
      + (p.custom_redraws_per_frame > SPEED.customRedraws ? 'Most of it is drawing: see the redraws below.' : 'Look for work that grows with the number of things: searches per frame, every pair checked, targets picked every frame, nodes made per hit ("Fast games").'));
  }
  if (p.custom_redraws_per_frame > SPEED.customRedraws) {
    found.push(`[speed] ${where} ${p.custom_redraws_per_frame} things redraw themselves every frame (${top}; at most ${SPEED.customRedraws}): draw each look once with lib/looks.gd and show it as a sprite, and redraw only when a look changes ("Fast games")`);
  }
  if (growing) found.push(`[speed] ${where} the number of nodes keeps growing (${nodes.join(' → ')}): something is never freed (bullets, effects, labels, marks, world pieces behind the player)`);
  if (p.second_half_ms > p.first_half_ms * 1.5 + 1) found.push(`[speed] ${where} frames get slower the longer it runs (${p.first_half_ms} → ${p.second_half_ms} ms): something grows with play time`);
  if (fast) errors.push(...found);
  else notes.push(...found.map((f) => f.replace('[speed]', '[speed, not failed: an older game]')));
  perfLines.push(`busiest moment ("${p.label}"): ${p.median_ms} ms a frame of game code (budget ${budget} ms on this machine), slowest frames ${p.p95_ms} ms, ${p.custom_redraws_per_frame} things redrawn a frame${top ? ` (${top})` : ''}, ${nodes.at(-1) ?? '?'} nodes, ${p.nodes_added_per_s} new nodes a second`);
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
let freeze = null; // the start-freeze check's numbers (below)
let browserPerf = null; // the stress test's measure() in the hidden browser (draw calls a frame)
// A frame's draw calls, at most (docs/research/game-performance-2-2026-11-04.md: the two fixed testers' games drew
// 170-280, the slow originals 420-3,610): the title and the first seconds of play 300; the busiest moment (every cell
// built, the most enemies) 400 (the night's new tower defence: 308 there, mostly hp bars between sprites).
const DRAW_CALLS = 300;
const DRAW_CALLS_BUSIEST = 400;

// Exports a copy of the project with the stress test as its main scene and the tests included, plays it in the
// hidden browser (one at a time, like every page here) until its measure() prints, and returns that measurement.
async function stressInBrowser(viewport) {
  const copy = join(project, 'export', '.stress');
  const src = join(copy, 'project');
  const out = join(copy, 'web');
  try {
    rmSync(copy, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    // The import cache comes along, so nothing is imported again; export/ (this copy's own home) and the history don't.
    mkdirSync(src, { recursive: true });
    for (const entry of readdirSync(project)) {
      if (entry === 'export' || entry === '.git') continue;
      cpSync(join(project, entry), join(src, entry), { recursive: true });
    }
    const pg = join(src, 'project.godot');
    writeFileSync(pg, readFileSync(pg, 'utf8').replace(/^run\/main_scene\s*=.*$/m, 'run/main_scene="res://test/stress_test.tscn"'));
    const presets = join(src, 'export_presets.cfg');
    writeFileSync(presets, readFileSync(presets, 'utf8').replace(/^exclude_filter="([^"]*)"/m, (_, f) => `exclude_filter="${f.split(',').filter((x) => x && !/^test\//.test(x)).join(',')}"`));
    const r = spawnSync(GODOT, ['--headless', '--path', src, '--export-release', 'Web', join(out, 'index.html')], { encoding: 'utf8', timeout: 180_000 });
    if (!existsSync(join(out, 'index.pck'))) {
      notes.push(`[speed] the stress test could not be exported for the browser (${((r.stdout || '') + (r.stderr || '')).split(/\r?\n/).find((l) => /ERROR/.test(l)) ?? 'no pack'}): its draw calls were not counted`);
      return null;
    }
    const server = await serve(out);
    const page = await openPage(`${server.base}/index.html`, { viewport });
    try {
      let shot = false;
      for (let waited = 0; waited < 90_000; waited += 1000) {
        await sleep(1000);
        // A picture of the busiest moment once it is measuring (helpers.gd prints MEASURING): the colour check and the
        // agent see the game deep into play, not only its first seconds.
        if (!shot && page.console.some((l) => /^MEASURING/.test(l.text))) {
          shot = true;
          const file = join(project, 'export', 'screenshot-busiest.png');
          if (await page.shot(file)) shots.push(`the busiest moment (your stress test, in the browser): ${file}`);
        }
        if (page.console.some((l) => /^PERF: /.test(l.text))) break;
      }
    } finally {
      await page.close();
      server.close();
    }
    const line = page.console.find((l) => /^PERF: /.test(l.text));
    if (!line) {
      notes.push('[speed] the stress test did not finish in the browser within 90 s: its draw calls were not counted');
      return null;
    }
    return JSON.parse(line.text.slice(6));
  } catch (e) {
    notes.push(`[speed] the stress test's browser run failed (${String(e?.message || e).split('\n')[0]}): its draw calls were not counted`);
    return null;
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}
// The first page gets the three screenshots over time; `more` resizes that same page (fill games); a game with a
// platform then opens once more on a computer, with no touch screen (keys and mouse: its touch controls hide).
const first = !platform
  ? { viewport: portrait ? PHONE : undefined, touch: false, screen: '' }
  : { viewport: fill || portrait ? PHONE : PHONE_SIDEWAYS, touch: true, screen: `a phone held ${fill || portrait ? 'upright' : 'sideways'}, touch screen` };
const more = fill ? [[TABLET, 'tablet', 'a tablet held upright, touch screen'], [PHONE_SIDEWAYS, 'sideways', 'a phone held sideways, touch screen']] : [];
const on = (screen) => (screen ? ` (${screen})` : '');
if (built) {
  const server = await serve(webDir);
  // server.base carries a random path token (web.mjs): another process can't fetch this game.
  const url = `${server.base ?? `http://127.0.0.1:${server.address().port}`}/index.html`;
  const pages = [];
  try {
    const page = await openPage(url, first);
    pages.push(page);
    await sleep(waitSec * 1000);
    const start = join(project, 'export', 'screenshot-start.png');
    if (await page.shot(start)) shots.push(`after loading${on(first.screen)}: ${start}`);
    const [x, y] = first.viewport ? [first.viewport.width / 2, first.viewport.height / 2] : [576, 324];
    if (first.touch) await page.tap(x, y);
    else await page.click(x, y);
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
    if (await page.shot(play)) shots.push(`3 s after a ${first.touch ? 'tap' : 'click'} + Space${on(first.screen)}: ${play}`);
    const fpsLater = await fpsOver(10000);
    const later = join(project, 'export', 'screenshot-later.png');
    if (await page.shot(later)) shots.push(`10 s later, no input${on(first.screen)}: ${later}`);
    frameRates.push(fpsPlay, fpsLater);
    // Only a page that stops answering counts as an error: a still screen (game over, between
    // waves) legitimately shows 0 frames a second in the hidden browser, so the rate is info.
    if (fpsPlay === null || fpsLater === null) {
      errors.push('[browser] the game froze: the page stopped responding while it played (look for a loop that never ends, e.g. a while loop in _process or _draw)');
    }
    for (const [size, name, screen] of more) {
      await page.resize(size);
      await sleep(1500);
      const file = join(project, 'export', `screenshot-${name}.png`);
      if (await page.shot(file)) shots.push(`then the same game on ${screen}: ${file}`);
    }
    await page.close(); // one hidden browser at a time (web.mjs)
    if (platform) {
      const computer = await openPage(url, { viewport: COMPUTER });
      pages.push(computer);
      await sleep(waitSec * 1000);
      await computer.click(COMPUTER.width / 2, COMPUTER.height / 2);
      await computer.key('Space');
      await sleep(3000);
      const file = join(project, 'export', 'screenshot-computer.png');
      if (await computer.shot(file)) shots.push(`on a computer (keys and mouse, no touch screen), 3 s after a click + Space: ${file}`);
      await computer.close();
    }
    // The start-freeze check (rules/FAST.md, docs/research/game-performance-2026-11-01.md): a browser that has never
    // run the game (a fresh profile: nothing compiled yet) on a CPU 4x slower, as a tester's first visit. It waits
    // for the title to settle (no shader compiled for 3 s), then taps and presses Space as above and watches 8 s of
    // play: every shader program the browser compiles from the tap on froze a real device for up to seconds. Frame
    // times are only reported: the hidden browser draws in software, slowly and unevenly, unlike a real GPU.
    if (fast || stressTest) {
      const fz = await openPage(url, { viewport: first.viewport, touch: first.touch, freeze: true, cpuSlowdown: 4 });
      pages.push(fz);
      const t0 = Date.now();
      let seen = -1, still = Date.now(), r = null;
      while (Date.now() - t0 < 45_000) {
        await sleep(500);
        r = await fz.freezeReport(0);
        if (!r) continue;
        if (r.links !== seen) { seen = r.links; still = Date.now(); }
        if (r.frames > 30 && Date.now() - still > 3000) break;
      }
      const mark = await fz.pageNow();
      if (mark !== null) {
        const title = await fz.freezeReport(mark - 3000, mark); // the title's last 3 s: its draw calls
        const [fx, fy] = first.viewport ? [first.viewport.width / 2, first.viewport.height / 2] : [576, 324];
        if (first.touch) await fz.tap(fx, fy);
        else await fz.click(fx, fy);
        await fz.key('Space');
        await sleep(8000);
        freeze = await fz.freezeReport(mark);
        if (freeze) {
          freeze.settleSec = +((Date.now() - t0 - 8000) / 1000).toFixed(1);
          freeze.titleCalls = title?.drawCalls ?? 0;
        }
      }
      await fz.close();
    }
    // The busiest moment drawn for real: headless Godot draws nothing, so the stress test also runs in the hidden
    // browser, from a copy of the project whose main scene is the stress test (export/.stress, never the game's own
    // files), and its measure() counts the draw calls a frame there. A screen drawn as thousands of shapes (a board,
    // scenery, a crowd) costs the browser every frame even when nothing is redrawn.
    if (stressTest && perf.length) {
      const drawn = await stressInBrowser(first.viewport);
      if (drawn) browserPerf = drawn;
    }
  } finally {
    for (const p of pages) await p.close();
    server.close();
  }
  for (const l of pages.flatMap((p) => p.console)) {
    const text = l.text.split('\n')[0];
    if (/^\s*at:/.test(text)) continue;
    if (l.type === 'error' || l.type === 'exception' || /SCRIPT ERROR|ERROR:/.test(text)) {
      errors.push(`[browser] ${text.trim()}`);
    }
  }
}

// The start-freeze check's verdict: a shader compiled after the first tap is a freeze of up to seconds on a tester's
// laptop or phone the first time they play (renderer-independent, so it is counted, not timed).
let freezeLine = '';
if (freeze) {
  // Frame times are left out on purpose: the hidden browser draws in software and, on this PC, every game (fixed or
  // not) showed runs of ~1 s frames a few seconds after the tap with no compile or read-back behind them (11-04).
  freezeLine = `first visit on a 4x slower CPU: title settled in ${freeze.settleSec} s (${freeze.linksBefore} shaders compiled before play), then 8 s of play: ${freeze.links} shader${freeze.links === 1 ? '' : 's'} compiled${freeze.reads ? `, ${freeze.reads} picture${freeze.reads === 1 ? '' : 's'} read back from the GPU (${freeze.readMs} ms)` : ''}`;
  if (freeze.links > 0) {
    const msg = `[freeze] ${freeze.links} shader${freeze.links === 1 ? ' was' : 's were'} compiled after play started (${freeze.linkTimes.slice(0, 6).map((t) => `${(t / 1000).toFixed(1)} s`).join(', ')} after the first tap): on a laptop or phone each is a freeze of up to seconds the first time someone plays. Something was drawn for the first time during play (a particle effect, a new material or look, a polygon, a text size): build it once in the warm-up behind the title (lib/warmup.gd, "Fast games")`;
    if (fast) errors.push(msg);
    else notes.push(msg.replace('[freeze]', '[freeze, not failed: an older game]'));
  }
  // Draw calls: a count, so the software browser measures it exactly. Each costs the browser CPU every frame.
  freezeLine += `; draw calls a frame: title ${freeze.titleCalls}, play ${freeze.drawCalls} (budget ${DRAW_CALLS})`;
  for (const [where, calls] of [['the title screen', freeze.titleCalls], ['the first seconds of play', freeze.drawCalls]]) {
    if (calls > DRAW_CALLS) {
      const msg = `[speed] ${where} takes ${calls} draw calls a frame (budget ${DRAW_CALLS}): every circle, polygon, line and outline on screen is a separate job for the browser in every frame, even when drawn once. Show repeated looks as sprites of one shared picture (lib/looks.gd) and bake scenery or boards with many shapes into one picture (Looks.bake_one) ("Fast games")`;
      if (fast) errors.push(msg);
      else notes.push(msg.replace('[speed]', '[speed, not failed: an older game]'));
    }
  }
  // Reading a picture back from the GPU in play stalls the frame (45-80 ms on a real GPU, far more on a phone).
  if (freeze.reads > 0) {
    const msg = `[freeze] ${freeze.reads} picture${freeze.reads === 1 ? ' was' : 's were'} read back from the GPU after play started (get_image() on a viewport or texture): each stops the game while the GPU catches up. Bake looks before play with lib/looks.gd (it never reads back) and never call get_image() during play ("Fast games")`;
    if (fast) errors.push(msg);
    else notes.push(msg.replace('[freeze]', '[freeze, not failed: an older game]'));
  }
}

if (browserPerf && typeof browserPerf.draw_calls !== 'number') {
  notes.push('[speed] the stress test ran in the browser with an older test/helpers.gd, so its draw calls were not counted (the next run gets the current one)');
} else if (browserPerf) {
  perfLines.push(`busiest moment drawn in a browser ("${browserPerf.label}"): ${browserPerf.draw_calls} draw calls a frame (most ${browserPerf.draw_calls_max}; budget ${DRAW_CALLS_BUSIEST})`);
  if (browserPerf.draw_calls > DRAW_CALLS_BUSIEST) {
    const msg = `[speed] at the busiest moment ("${browserPerf.label}") the screen takes ${browserPerf.draw_calls} draw calls a frame (budget ${DRAW_CALLS_BUSIEST}): every circle, polygon, line and outline on screen is a separate job for the browser in every frame, even when drawn once, and so is every switch between a sprite and a drawn shape. Show repeated looks (enemies, towers, bullets, props) and bars as sprites of one shared picture (lib/looks.gd: sprite(), rect()) and bake scenery or a board with many shapes into one picture (Looks.bake_one) ("Fast games")`;
    if (fast) errors.push(msg);
    else notes.push(msg.replace('[speed]', '[speed, not failed: an older game]'));
  }
}

// Colours (rules/BASE.md "Colours that read"; docs/research/game-colours-2026-11-07.md): the play, computer and busiest
// moment's pictures, measured in milliseconds without AI. Washed out (much of the screen pure white, near white or
// pale, or bright and flat) or too dark fails a game made since 11-07; older games get a note.
const colourLines = [];
for (const name of ['play', 'computer', 'busiest']) {
  const file = join(project, 'export', `screenshot-${name}.png`);
  if (!existsSync(file) || !shots.some((s) => s.endsWith(file))) continue;
  let c;
  try { c = colourOf(file); } catch { continue; }
  colourLines.push(`${name} ${c.light} light, ${Math.round(c.white * 100)}% near white, ${Math.round(c.dark * 100)}% near black, contrast ${c.contrast}`);
  if (!c.verdict) continue;
  const where = { play: '3 s into play', computer: 'on a computer', busiest: 'at the busiest moment' }[name];
  const msg = `[colours] the screen ${where} is ${c.verdict} (screenshot-${name}.png). `
    + (c.verdict.startsWith('washed')
      ? 'In 3D take the sky and light from lib/lighting.gd (Lighting.setup) and add no light to brighten it (the web renderer draws a sun with shadows about twice as bright as its number); make floors, walls and ground mid colours, never near white. In 2D give big areas mid or deep colours and keep white for small highlights, with dark outlines ("Colours that read")'
      : 'Light the play area: in 3D Lighting.setup with the "night" mood still shows the scene; in 2D lift the background and give pieces light colours with dark outlines ("Colours that read")');
  if (colourStrict) errors.push(msg);
  else notes.push(msg.replace('[colours]', '[colours, not failed: an older game]'));
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
if (!platform) console.log(`orientation: ${portrait ? 'portrait' : 'landscape'} (${viewW}×${viewH} viewport${portrait ? `; screenshots are ${PHONE.width}×${PHONE.height}, a phone held upright` : ''})`);
else if (fill) console.log(`screen: fills every screen (stretch aspect expand, base ${viewW}×${viewH}: the short side is 720, the long side grows)`);
else console.log(`screen: one shape, ${portrait ? 'portrait' : 'landscape'} ${viewW}×${viewH}, scaled to fit any screen with bars (stretch aspect keep)`);
if (frameRates.length) console.log(`frames a second while playing (hidden browser, software rendering; 0 is normal on a still screen): ${frameRates.map((f) => f ?? 'froze').join(', then ')}`);
if (testSummary.length) console.log(`tests: ${testSummary.join('; ')}`);
for (const l of perfLines) console.log(`speed at the ${l}`);
if (freezeLine) console.log(`start freezes: ${freezeLine}`);
if (colourLines.length) console.log(`colours (0-255): ${colourLines.join('; ')}`);
for (const n of notes) console.log(`note ${n}`);
for (const s of shots) console.log(`screenshot ${s}`);
if (shots.length) console.log('Open the screenshots with the Read tool to see the game.');
process.exit(errors.length ? 1 : 0);
