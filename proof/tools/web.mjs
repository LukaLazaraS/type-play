// Shared helpers: a static file server for Godot web exports, and a hidden browser that
// loads a page, collects its console output, clicks/presses keys and takes screenshots
// (Chrome DevTools Protocol, no dependencies).
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname, normalize } from 'node:path';

export const BROWSER_EXE =
  process.env.BROWSER_EXE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm',
  '.pck': 'application/octet-stream', '.png': 'image/png', '.json': 'application/json',
};

// Serves `dir` on 127.0.0.1. Single-threaded Godot exports need no COOP/COEP headers.
export function serve(dir, port = 0) {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\/])+/, '');
    try {
      const body = await readFile(join(dir, path || 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Opens `url` in a hidden browser. Returns { console, shot(path), click(x, y), key(code), close() }.
export async function openPage(url, { width = 1152, height = 648 } = {}) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = mkdtempSync(join(tmpdir(), 'gf-browser-'));
  const proc = spawn(BROWSER_EXE, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--enable-unsafe-swiftshader', '--use-angle=swiftshader',
    `--window-size=${width},${height}`, '--autoplay-policy=no-user-gesture-required', 'about:blank',
  ], { stdio: 'ignore' });

  let target;
  for (let i = 0; i < 75 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {}
  }
  if (!target) { proc.kill(); throw new Error('hidden browser did not start'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const lines = [];
  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result ?? msg.error); pending.delete(msg.id); return; }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      lines.push({ type: msg.params.type, text });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      lines.push({ type: 'exception', text: d.exception?.description ?? d.text });
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url });

  return {
    console: lines,
    async shot(path) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      const { writeFile } = await import('node:fs/promises');
      await writeFile(path, Buffer.from(r.data, 'base64'));
    },
    async click(x, y) {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      }
    },
    async key(code = 'Space', key = ' ', keyCode = 32) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: keyCode });
      await sleep(80);
      await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: keyCode });
    },
    async close() {
      ws.close();
      proc.kill();
      await sleep(500);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}

export { sleep };
