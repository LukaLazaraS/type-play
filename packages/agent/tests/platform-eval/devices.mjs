// Tries a built game the way players meet it (the platform measurement, 10-25): on an iPhone and an iPad (touch
// screens, held the game's way up; a game that fills every screen also on the iPhone held sideways) and on a laptop
// (keys and mouse). On each: the title, a start (a tap, or a click + Space), then the controls, by touch on the
// phone and tablet and by keys and mouse on the laptop, with a screenshot after every step, and one contact sheet
// per device with each step named.
//   node tests/platform-eval/devices.mjs <game folder> [--out <dir>]   (the folder's export/web, from its last check)
// Prints a JSON summary: per device the steps, how much each changed the picture (mean pixel difference to the step
// before, 0-255: a hint that the game answered, not proof), and the page's errors.
// One hidden browser at a time (tools/web.mjs): don't run it while builds are measured.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve, openPage, sleep } from '../../tools/web.mjs';
import { limitThisProcess } from '../../tools/cpu.mjs';
import { decode } from '../edit-eval/bright.mjs';

limitThisProcess();
const args = process.argv.slice(2);
const game = resolve(args[0] ?? '');
const outArg = args.indexOf('--out');
const out = resolve(outArg >= 0 ? args[outArg + 1] : join(game, '..', '_platform-eval', 'devices', basename(game)));
const web = join(game, 'export', 'web');
if (!existsSync(join(web, 'index.pck'))) { console.error(`no web build in ${web}`); process.exit(2); }
mkdirSync(out, { recursive: true });

// The game's screen setup, as the check reads it.
const godot = readFileSync(join(game, 'project.godot'), 'utf8');
const display = godot.split(/^\[display\]\s*$/m)[1]?.split(/^\[/m)[0] ?? '';
const setting = (key) => display.match(new RegExp(`^window/${key}\\s*=\\s*"?([^"\\r\\n]*)"?`, 'm'))?.[1];
const vw = Number(setting('size/viewport_width') ?? 1152), vh = Number(setting('size/viewport_height') ?? 648);
const handheld = setting('handheld/orientation');
const portrait = handheld !== undefined ? [1, 3, 5].includes(Number(handheld)) : vh > vw;
const keep = setting('stretch/aspect') === 'keep';
const platform = existsSync(join(game, 'PLATFORM')) ? readFileSync(join(game, 'PLATFORM'), 'utf8').trim() : 'legacy';
const fill = platform === 'fill';

const DEVICES = {
  iphone: { width: 393, height: 852, touch: true, name: 'iPhone (393×852)' },
  'iphone-sideways': { width: 852, height: 393, touch: true, name: 'iPhone held sideways (852×393)' },
  ipad: { width: 820, height: 1180, touch: true, name: 'iPad (820×1180)' },
  'ipad-sideways': { width: 1180, height: 820, touch: true, name: 'iPad held sideways (1180×820)' },
  laptop: { width: 1366, height: 768, touch: false, name: 'Laptop (1366×768)' },
};
// A wide game is played with the phone and tablet turned (the site asks for it); upright games and fill games upright.
const devices = fill ? ['iphone', 'ipad', 'laptop', 'iphone-sideways'] : portrait ? ['iphone', 'ipad', 'laptop'] : ['iphone-sideways', 'ipad-sideways', 'laptop'];

const K = {
  space: ['Space', ' ', 32], right: ['ArrowRight', 'ArrowRight', 39], left: ['ArrowLeft', 'ArrowLeft', 37], up: ['ArrowUp', 'ArrowUp', 38],
  down: ['ArrowDown', 'ArrowDown', 40], d: ['KeyD', 'd', 68], w: ['KeyW', 'w', 87], a: ['KeyA', 'a', 65], j: ['KeyJ', 'j', 74],
  k: ['KeyK', 'k', 75], l: ['KeyL', 'l', 76], 1: ['Digit1', '1', 49], 2: ['Digit2', '2', 50], 3: ['Digit3', '3', 51], q: ['KeyQ', 'q', 81],
  e: ['KeyE', 'e', 69], shift: ['ShiftLeft', 'Shift', 16],
};

const server = await serve(web);
const summary = { game: basename(game), platform, viewport: `${vw}×${vh}`, keep, portrait, devices: {} };
for (const id of devices) {
  const dev = DEVICES[id];
  // Where the game is on the page: a one-shape game sits in the middle with bars, the others fill it.
  const s = keep ? Math.min(dev.width / vw, dev.height / vh) : 1;
  const gw = keep ? vw * s : dev.width, gh = keep ? vh * s : dev.height;
  const gx = (dev.width - gw) / 2, gy = (dev.height - gh) / 2;
  const at = (fx, fy) => [Math.round(gx + fx * gw), Math.round(gy + fy * gh)];
  const page = await openPage(`${server.base}/index.html`, { viewport: { width: dev.width, height: dev.height }, touch: dev.touch });
  const steps = [];
  const shot = async (name) => {
    const file = join(out, `${id}-${String(steps.length + 1).padStart(2, '0')}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}.png`);
    if (await page.shot(file)) steps.push({ name, file });
  };
  try {
    await sleep(7000);
    await shot('title');
    if (dev.touch) {
      await page.tap(...at(0.5, 0.5));
      await sleep(1500);
      await shot('tap to start');
      await page.tap(...at(0.5, 0.45)); await sleep(350); await page.tap(...at(0.5, 0.45)); await sleep(250);
      await shot('two taps');
      for (const [name, fx] of [['hold left half', 0.25], ['hold right half', 0.75]]) {
        await page.touch([at(fx, 0.6)]); await sleep(500); await shot(name); await page.touch([]); await sleep(200);
      }
      await page.touch([at(0.2, 0.82)]); await sleep(120);
      await page.touch([at(0.26, 0.82)]); await sleep(80); await page.touch([at(0.32, 0.82)]); await sleep(600);
      await shot('joystick right (left thumb)');
      await page.touch([at(0.2, 0.74)]); await sleep(500);
      await shot('joystick up');
      await page.touch([at(0.32, 0.82, 0), [...at(0.85, 0.85), 1]]); await sleep(150); await page.touch([at(0.32, 0.82)]); await sleep(300);
      await shot('two thumbs: move + bottom-right button');
      await page.touch([]); await sleep(200);
      for (const [name, fx, fy] of [['button bottom-right', 0.85, 0.85], ['button bottom, right of middle', 0.68, 0.9], ['button right, above', 0.9, 0.68]]) {
        await page.tap(...at(fx, fy)); await sleep(400); await shot(name);
      }
      await page.touch([at(0.5, 0.55)]); await sleep(60); await page.touch([at(0.56, 0.55)]); await sleep(60); await page.touch([at(0.62, 0.55)]); await sleep(60); await page.touch([]);
      await sleep(600);
      await shot('swipe right in the middle');
    } else {
      await page.click(...at(0.5, 0.5)); await page.key(...K.space);
      await sleep(1500);
      await shot('click + Space to start');
      await page.key(...K.space); await sleep(350); await page.key(...K.space); await sleep(250);
      await shot('Space twice');
      await page.keyDown(...K.right); await sleep(700); await shot('holding Right'); await page.keyUp(...K.right);
      await page.keyDown(...K.left); await sleep(500); await page.key(...K.up); await shot('holding Left, Up'); await page.keyUp(...K.left);
      await page.keyDown(...K.d); await sleep(500); await page.key(...K.w); await shot('holding D, W'); await page.keyUp(...K.d);
      for (const k of ['j', 'k', 'l', 1, 2, 3, 'q', 'e', 'shift']) { await page.key(...K[k]); await sleep(150); }
      await sleep(200);
      await shot('J K L 1 2 3 Q E Shift');
      await page.click(...at(0.62, 0.45)); await sleep(500);
      await shot('a click right of the middle');
    }
    await sleep(2500);
    await shot('2.5 s later');
  } finally {
    await page.close();
  }
  // How much each step changed the picture (inside the game's area).
  let prev = null;
  for (const st of steps) {
    const img = decode(st.file);
    if (prev) {
      let sum = 0, n = 0;
      for (let y = Math.floor(gy); y < gy + gh - 1; y += 3) for (let x = Math.floor(gx); x < gx + gw - 1; x += 3) {
        const a = img.rgb(x, y), b = prev.rgb(x, y);
        sum += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); n += 3;
      }
      st.change = +(sum / n).toFixed(1);
    }
    prev = img;
  }
  const errors = page.console.filter((l) => l.type === 'error' || l.type === 'exception' || /SCRIPT ERROR|ERROR:/.test(l.text)).map((l) => l.text.split('\n')[0]);
  summary.devices[id] = { name: dev.name, steps: steps.map(({ name, change, file }) => ({ name, change, file: basename(file) })), errors: [...new Set(errors)].slice(0, 8) };

  // The contact sheet: every step, named, in one picture.
  const tile = dev.width > dev.height ? { w: 360, h: Math.round((360 * dev.height) / dev.width) } : { h: 380, w: Math.round((380 * dev.width) / dev.height) };
  const cols = dev.width > dev.height ? 4 : 6;
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#fff;font:600 14px/1.3 system-ui,sans-serif;color:#111}
    h1{font-size:16px;margin:0 0 10px}div{display:grid;grid-template-columns:repeat(${cols},${tile.w}px);gap:10px}
    figure{margin:0}img{display:block;width:${tile.w}px;height:${tile.h}px;outline:1px solid #999}figcaption{margin-top:3px}</style>
    <h1>${summary.game}: ${dev.name}</h1><div>${steps.map((st, i) => `<figure><img src="${pathToFileURL(st.file).href}"><figcaption>${i + 1}. ${st.name}${st.change !== undefined ? ` (Δ${st.change})` : ''}</figcaption></figure>`).join('')}</div>`;
  const sheetHtml = join(out, `${id}-sheet.html`);
  writeFileSync(sheetHtml, html);
  const rows = Math.ceil(steps.length / cols);
  const sheet = await openPage(pathToFileURL(sheetHtml).href, { viewport: { width: 24 + cols * tile.w + (cols - 1) * 10, height: 50 + rows * (tile.h + 34) } });
  await sleep(1200);
  await sheet.shot(join(out, `${id}-sheet.png`));
  await sheet.close();
  summary.devices[id].sheet = join(out, `${id}-sheet.png`);
}
server.close();
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 1));
