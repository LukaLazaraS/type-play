// Tries exact inputs on a built game, for the cases devices.mjs's generic steps can't reach (a Play button
// somewhere else, two neighbouring pieces, a skill button): one device, a list of steps, a screenshot after each.
//   node tests/platform-eval/try.mjs <game folder> <device> <step> [<step> ...] [--out <dir>]
// device: iphone | iphone-sideways | ipad | ipad-sideways | laptop (as devices.mjs). Steps, positions in page pixels:
//   tap:x,y   hold:x,y,ms   drag:x1,y1,x2,y2   key:ArrowRight[,ms]   click:x,y   wait:ms   shot:name
//   down:x,y[,finger]  (a finger that stays: a thumb on a joystick; down again with the same finger moves it)
//   up[:finger]        (lifts that finger, or every finger)
import { mkdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { serve, openPage, sleep } from '../../tools/web.mjs';
import { limitThisProcess } from '../../tools/cpu.mjs';

limitThisProcess();
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const out = outAt >= 0 ? resolve(args.splice(outAt, 2)[1]) : null;
const [gameArg, device, ...steps] = args;
const game = resolve(gameArg);
const dir = out ?? join(game, '..', '_platform-eval', 'tries', basename(game));
mkdirSync(dir, { recursive: true });
const DEVICES = {
  iphone: { width: 393, height: 852, touch: true }, 'iphone-sideways': { width: 852, height: 393, touch: true },
  ipad: { width: 820, height: 1180, touch: true }, 'ipad-sideways': { width: 1180, height: 820, touch: true },
  laptop: { width: 1366, height: 768, touch: false },
};
const KEYS = { Space: [' ', 32], Enter: ['Enter', 13], ArrowRight: ['ArrowRight', 39], ArrowLeft: ['ArrowLeft', 37], ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40] };
const dev = DEVICES[device];
if (!dev) { console.error(`device: ${Object.keys(DEVICES).join(' | ')}`); process.exit(2); }
const server = await serve(join(game, 'export', 'web'));
const page = await openPage(`${server.base}/index.html`, { viewport: { width: dev.width, height: dev.height }, touch: dev.touch });
const shots = [];
const fingers = new Map(); // finger -> [x, y], for down/up
const sendFingers = () => page.touch([...fingers].map(([id, [x, y]]) => [x, y, id]));
try {
  await sleep(7000);
  for (const step of steps) {
    const [kind, rest = ''] = step.split(':');
    const n = rest.split(',').map((v) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v));
    if (kind === 'tap') await page.tap(n[0], n[1]);
    else if (kind === 'click') await page.click(n[0], n[1]);
    else if (kind === 'hold') { await page.touch([[n[0], n[1]]]); await sleep(n[2] ?? 600); await page.touch([]); }
    else if (kind === 'drag') {
      await page.touch([[n[0], n[1]]]);
      for (let i = 1; i <= 4; i++) { await sleep(40); await page.touch([[n[0] + ((n[2] - n[0]) * i) / 4, n[1] + ((n[3] - n[1]) * i) / 4]]); }
      await sleep(60); await page.touch([]);
    } else if (kind === 'key') {
      const code = String(n[0]);
      const [key, keyCode] = KEYS[code] ?? [code.replace(/^Key|^Digit/, '').toLowerCase(), code.replace(/^Key|^Digit/, '').toUpperCase().charCodeAt(0)];
      await page.key(code, key, keyCode, n[1] ?? 80);
    } else if (kind === 'down') { fingers.set(n[2] ?? 0, [n[0], n[1]]); await sendFingers(); }
    else if (kind === 'up') { if (rest) fingers.delete(n[0]); else fingers.clear(); await sendFingers(); }
    else if (kind === 'wait') await sleep(n[0]);
    else if (kind === 'shot') { const f = join(dir, `${device}-${String(shots.length + 1).padStart(2, '0')}-${String(n[0]).replace(/[^a-z0-9]+/gi, '-')}.png`); if (await page.shot(f)) shots.push(f); }
    else throw new Error(`unknown step ${step}`);
    await sleep(120);
  }
} finally {
  await page.close();
  server.close();
}
for (const s of shots) console.log(s);
const errors = page.console.filter((l) => l.type === 'error' || l.type === 'exception' || /SCRIPT ERROR|ERROR:/.test(l.text));
if (errors.length) console.log('errors:', [...new Set(errors.map((l) => l.text.split('\n')[0]))].slice(0, 5).join(' | '));
