// Shared helpers: a static file server for Godot web exports, and a hidden browser that
// loads a page, collects its console output, clicks/presses keys and takes screenshots
// (Chrome DevTools Protocol over a pipe, no dependencies).
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir, setPriority, constants as osConstants } from 'node:os';
import { limitThisProcess } from './cpu.mjs';
import { join, extname, normalize, basename, resolve, sep } from 'node:path';

export const BROWSER_EXE =
  process.env.BROWSER_EXE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm',
  '.pck': 'application/octet-stream', '.png': 'image/png', '.json': 'application/json',
};

// Serves `dir` on 127.0.0.1 under a random path: `server.base` is http://127.0.0.1:<port>/<token>,
// and anything else is 404. On the live server every run's check shares the container's loopback,
// so a server another run could find by scanning ports must not hand out this run's game; the
// token lives only in this process and the browser it starts. Single-threaded Godot exports need
// no COOP/COEP headers.
export function serve(dir, port = 0) {
  const token = randomBytes(12).toString('base64url');
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://x').pathname;
      if (!pathname.startsWith(`/${token}/`)) throw new Error('not ours');
      const path = normalize(decodeURIComponent(pathname.slice(token.length + 2))).replace(/^([\\/])+/, '');
      // Only files inside the build folder: an encoded "../" must not reach the rest of the disk.
      const root = resolve(dir);
      const file = resolve(root, path || 'index.html');
      if (file !== root && !file.startsWith(root + sep)) throw new Error('outside the build');
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => {
    server.base = `http://127.0.0.1:${server.address().port}/${token}`;
    resolve(server);
  }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Opens `url` in a hidden browser. Returns { console, shot(path), click(x, y), key(code), close() }.
// `viewport` ({ width, height }) sets the page size exactly (a phone shape: the window itself
// can't be narrower than ~500 px). `touch: true` makes it a touch screen, as a phone or tablet
// is (a game's DisplayServer.is_touchscreen_available() is true there), with tap() and touch().
//
// A hidden browser renders the game in software (SwiftShader) and can take every CPU core. On
// 2026-10-17 several of them ran at once from parallel agents, froze the PC, and kept running
// after their parents died. So: one hidden browser at a time on this PC (a lock shared by every
// process), below-normal priority (its child processes inherit it on Windows), killed when its
// parent exits or after MAX_LIFE, and orphans older than that are swept before each start.
const MAX_LIFE_MS = 5 * 60_000;
// TYPEPLAY_BROWSER_LOCK=0 turns the lock off: the live server's runner does (its container caps
// the CPU of all runs together, and a lock folder a killed run's user left behind would be one no
// other run's user could remove). BROWSER_LOCK_DIR moves it (each run has its own TMPDIR there).
const LOCK_ON = process.env.TYPEPLAY_BROWSER_LOCK !== '0';
const LOCK = join(process.env.BROWSER_LOCK_DIR || tmpdir(), 'typeplay-hidden-browser.lock');
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

async function takeLock() {
  if (!LOCK_ON) return;
  for (let waited = 0; ; waited += 500) {
    try {
      mkdirSync(LOCK);
      writeFileSync(join(LOCK, 'owner'), JSON.stringify({ pid: process.pid, at: Date.now() }));
      return;
    } catch {
      let owner = null;
      try { owner = JSON.parse(readFileSync(join(LOCK, 'owner'), 'utf8')); } catch {}
      const stale = owner ? !alive(owner.pid) || Date.now() - owner.at > MAX_LIFE_MS : waited > 5000;
      if (stale) {
        try { rmSync(LOCK, { recursive: true, force: true }); continue; } catch {}
      }
      if (waited > 2 * MAX_LIFE_MS) throw new Error('another hidden browser has been running too long');
      await sleep(500);
    }
  }
}
const dropLock = () => {
  if (!LOCK_ON) return;
  try { if (JSON.parse(readFileSync(join(LOCK, 'owner'), 'utf8')).pid === process.pid) rmSync(LOCK, { recursive: true, force: true }); } catch {}
};

// Hidden browsers left by a killed parent (their profile folder is named gf-browser-*), and the
// profile folders themselves (cache and all, tens of MB each) once they are older than MAX_LIFE:
// a browser never lives longer than that, so an older profile is a dead one's.
function sweepOrphans() {
  const minutes = MAX_LIFE_MS / 60_000;
  if (process.platform === 'win32') {
    spawnSync('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -match 'gf-browser-' -and $_.CreationDate -lt (Get-Date).AddMinutes(-${minutes}) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ], { stdio: 'ignore', timeout: 20_000 });
  } else {
    let uptime = 0;
    try { uptime = parseFloat(readFileSync('/proc/uptime', 'utf8')); } catch {}
    if (uptime) for (const name of readdirSync('/proc')) {
      if (!/^\d+$/.test(name) || Number(name) === process.pid) continue;
      try {
        if (!readFileSync(`/proc/${name}/cmdline`, 'latin1').includes('gf-browser-')) continue;
        const started = Number(readFileSync(`/proc/${name}/stat`, 'utf8').split(') ')[1].split(' ')[19]) / 100; // field 22, in clock ticks
        if ((uptime - started) * 1000 > MAX_LIFE_MS) process.kill(Number(name), 'SIGKILL');
      } catch {}
    }
  }
  let names = [];
  try { names = readdirSync(tmpdir()); } catch { return; }
  for (const name of names) {
    if (!name.startsWith('gf-browser-')) continue;
    const dir = join(tmpdir(), name);
    try { if (Date.now() - statSync(dir).mtimeMs > MAX_LIFE_MS) rmSync(dir, { recursive: true, force: true }); } catch {}
  }
}

// Linux: the browser is started through this watchdog, which kills the browser's whole process
// group when this process dies, however it dies (a check.mjs killed with SIGKILL runs no exit
// handler and would leave the browser burning CPU until the job's user is killed). The group is
// also what kill() kills. The pipes (fds 3 and 4) are the browser's: the watchdog lets go of them.
const WATCHDOG = [
  'PARENT="$1"; shift',
  '"$@" &',
  'B=$!',
  'exec 3<&- 4>&-',
  'while kill -0 "$PARENT" 2>/dev/null && kill -0 "$B" 2>/dev/null; do sleep 1; done',
  'kill -9 -- -$$ 2>/dev/null',
].join('\n');

export async function openPage(url, { width = 1152, height = 648, viewport, touch = false } = {}) {
  limitThisProcess(); // the browser and its renderers inherit the core limit and low priority
  sweepOrphans();
  await takeLock();
  const profile = mkdtempSync(join(tmpdir(), 'gf-browser-'));
  const args = [
    // --in-process-gpu: the software renderer runs inside the browser process, which keeps the
    // core limit and low priority (a separate GPU process resets itself to all cores, above normal).
    // --remote-debugging-pipe: DevTools over fds 3 and 4 (messages end with NUL), not a localhost
    // port: a port is open to every process on the machine, and on the live server all runs share
    // the container's loopback, so another run could drive this browser and read this game.
    '--headless=new', '--in-process-gpu', '--remote-debugging-pipe', `--user-data-dir=${profile}`,
    '--no-first-run', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    `--window-size=${width},${height}`, '--autoplay-policy=no-user-gesture-required',
    // The games it checks make sounds: never out of this PC's speakers (10-27: heard at night during test builds).
    '--mute-audio',
    // BROWSER_ARGS: extra flags, e.g. --no-sandbox in the server's container (Chromium on Linux).
    ...(process.env.BROWSER_ARGS || '').split(' ').filter(Boolean), 'about:blank',
  ];
  const stdio = ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'];
  const proc = process.platform === 'win32'
    ? spawn(BROWSER_EXE, args, { stdio })
    : spawn('/bin/sh', ['-c', WATCHDOG, 'browser-watchdog', String(process.pid), BROWSER_EXE, ...args], { stdio, detached: true }); // own process group, killed as one
  proc.on('error', () => {}); // a missing browser is reported below ("did not start"), not as a crash
  try { setPriority(proc.pid, osConstants.priority.PRIORITY_BELOW_NORMAL); } catch {}
  const toBrowser = proc.stdio[3];
  const fromBrowser = proc.stdio[4];
  toBrowser.on('error', () => {});
  fromBrowser.on('error', () => {});
  // Killing only the main process leaves Edge's renderers and GPU process running, so kill the
  // whole tree, then anything still carrying this browser's profile folder. Synchronous: it also
  // runs from the 'exit' handler. The profile goes too (what is still locked, the next sweep gets).
  let killed = false;
  const kill = () => {
    if (killed) return;
    killed = true;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore', timeout: 15_000 });
      const name = basename(profile).replace(/[^\w-]/g, '');
      spawnSync('powershell', ['-NoProfile', '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -match '${name}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ], { stdio: 'ignore', timeout: 20_000 });
    } else {
      try { process.kill(-proc.pid, 'SIGKILL'); } catch { try { proc.kill('SIGKILL'); } catch {} }
    }
    dropLock();
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  const lifetime = setTimeout(kill, MAX_LIFE_MS);
  lifetime.unref();
  process.once('exit', kill);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(sig, () => { kill(); process.exit(130); });

  let id = 0;
  const pending = new Map();
  const lines = [];
  const onMessage = (msg) => {
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result ?? msg.error); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      lines.push({ type: msg.params.type, text });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      lines.push({ type: 'exception', text: d.exception?.description ?? d.text });
    }
  };
  let acc = '';
  fromBrowser.setEncoding('utf8');
  fromBrowser.on('data', (chunk) => {
    acc += chunk;
    for (let i; (i = acc.indexOf('\0')) >= 0; ) {
      const text = acc.slice(0, i);
      acc = acc.slice(i + 1);
      try { onMessage(JSON.parse(text)); } catch {}
    }
  });
  // The browser is gone (crashed, killed): every command still waiting ends like a time-out.
  fromBrowser.on('close', () => { for (const settle of pending.values()) settle({ timedOut: true }); pending.clear(); });
  // Every command answers within `timeoutMs`: a page stuck in an endless loop never acknowledges
  // input or screenshots, and waiting forever would hang the whole check. A late answer
  // resolves to { timedOut: true }.
  const send = (method, params = {}, timeoutMs = 15_000, sessionId = undefined) => new Promise((resolve) => {
    const msgId = ++id;
    const timer = setTimeout(() => { pending.delete(msgId); resolve({ timedOut: true }); }, timeoutMs);
    pending.set(msgId, (v) => { clearTimeout(timer); resolve(v); });
    try { toBrowser.write(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0'); } catch {}
  });

  // The pipe speaks for the browser as a whole: find its page (about:blank) and attach to it; page
  // commands then carry that session. Up to 15 s for a slow start, else the browser is killed.
  let sessionId = null;
  for (let i = 0; i < 75 && !sessionId; i++) {
    const targets = await send('Target.getTargets', {}, 2000);
    const target = targets?.targetInfos?.find((t) => t.type === 'page');
    if (target) sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, 5000))?.sessionId ?? null;
    if (!sessionId) await sleep(200);
  }
  if (!sessionId) { clearTimeout(lifetime); kill(); throw new Error('hidden browser did not start'); }
  const page = (method, params = {}, timeoutMs = 15_000) => send(method, params, timeoutMs, sessionId);

  await page('Runtime.enable');
  await page('Page.enable');
  // Without this the page can count as hidden (seen 2026-10-18 at night, display off): the
  // browser then pauses animation frames, so the game stops between screenshots ("10 s later"
  // showed the same frame for every game) and the frame count reads 0.
  await page('Emulation.setFocusEmulationEnabled', { enabled: true });
  // Before the page loads: pages (Godot's too) look for a touch screen once, at start.
  if (touch) await page('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const metrics = (v) => page('Emulation.setDeviceMetricsOverride', { ...v, deviceScaleFactor: 1, mobile: touch });
  if (viewport) await metrics(viewport);
  await page('Page.navigate', { url });

  return {
    console: lines,
    // false when the page is stuck and can't draw one (it would otherwise wait forever).
    async shot(path, timeoutMs = 10_000) {
      const r = await page('Page.captureScreenshot', { format: 'png' }, timeoutMs);
      if (!r?.data) return false;
      const { writeFile } = await import('node:fs/promises');
      await writeFile(path, Buffer.from(r.data, 'base64'));
      return true;
    },
    async click(x, y) {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await page('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, 5000);
      }
    },
    // Runs `expression` in the page. A page whose main thread is stuck (a game in an endless
    // loop) never answers: that returns { timedOut: true } after `timeoutMs`.
    async evaluate(expression, timeoutMs = 5000) {
      const r = await page('Runtime.evaluate', { expression, returnByValue: true }, timeoutMs);
      return r.timedOut ? r : { value: r?.result?.value };
    },
    async key(code = 'Space', key = ' ', keyCode = 32, holdMs = 80) {
      await this.keyDown(code, key, keyCode);
      await sleep(holdMs);
      await this.keyUp(code, key, keyCode);
    },
    async keyDown(code, key, keyCode) { await page('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: keyCode }, 5000); },
    async keyUp(code, key, keyCode) { await page('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: keyCode }, 5000); },
    // Fingers on a touch page: every finger still down, as [x, y, id] (id: its place in the list if left out).
    // A finger missing from the next call is lifted; none ends the touch.
    async touch(points) {
      const touchPoints = points.map(([x, y, id], i) => ({ x, y, id: id ?? i }));
      await page('Input.dispatchTouchEvent', { type: points.length ? (this.fingers ? 'touchMove' : 'touchStart') : 'touchEnd', touchPoints }, 5000);
      this.fingers = points.length;
    },
    fingers: 0,
    async tap(x, y, holdMs = 60) {
      await this.touch([[x, y]]);
      await sleep(holdMs);
      await this.touch([]);
    },
    // A new screen size for the same page (a phone turned, a tablet): the game fits itself to it.
    async resize(size) { await metrics(size); },
    async close() {
      clearTimeout(lifetime);
      process.off('exit', kill);
      if (killed) return; // closed already
      kill();
      await sleep(500);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}

export { sleep };
