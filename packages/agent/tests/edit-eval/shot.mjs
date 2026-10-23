// Scripted clicks/keys in the hidden browser, then screenshots of an exported game (export/web must exist).
//   node shot.mjs <gameDir> <portrait|landscape> <step> [<step> ...]
// steps:  wait:<ms>   click:<x>,<y>   key:<Escape|Space|Enter|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|KeyD|...>
//         shot:<file.png>   eval:<js expression>  (prints its value)   fps:<ms>  (frames a second over that time)
// Uses tools/web.mjs (one hidden browser at a time, low priority, killed when done).
import { join, resolve } from 'node:path';
import { serve, openPage, sleep } from '../../tools/web.mjs';

const [gameDir, shape, ...steps] = process.argv.slice(2);
const KEYS = { Escape: ['Escape', 'Escape', 27], Space: ['Space', ' ', 32], Enter: ['Enter', 'Enter', 13], ArrowLeft: ['ArrowLeft', 'ArrowLeft', 37], ArrowUp: ['ArrowUp', 'ArrowUp', 38], ArrowRight: ['ArrowRight', 'ArrowRight', 39], ArrowDown: ['ArrowDown', 'ArrowDown', 40], KeyD: ['KeyD', 'd', 68], KeyA: ['KeyA', 'a', 65], KeyW: ['KeyW', 'w', 87], Digit1: ['Digit1', '1', 49], Digit6: ['Digit6', '6', 54] };
const PHONE = { width: 432, height: 936 };
const webDir = join(resolve(gameDir), 'export', 'web');
const server = await serve(webDir);
const page = await openPage(`${server.base}/index.html`, shape === 'portrait' ? { viewport: PHONE } : {});
try {
  await sleep(7000);
  for (const s of steps) {
    const i = s.indexOf(':'); const op = s.slice(0, i), arg = s.slice(i + 1);
    if (op === 'wait') await sleep(Number(arg));
    else if (op === 'click') { const [x, y] = arg.split(',').map(Number); await page.click(x, y); }
    else if (op === 'key') { const k = KEYS[arg]; if (!k) throw new Error('unknown key ' + arg); await page.key(...k); }
    else if (op === 'shot') { console.log((await page.shot(arg)) ? `saved ${arg}` : `FAILED ${arg}`); }
    else if (op === 'eval') { console.log(JSON.stringify(await page.evaluate(arg))); }
    else if (op === 'fps') { // frames the page answers in <ms>, with the check's own counter (prints "fps N")
      await page.evaluate('if (window.__tpFrames === undefined) { window.__tpFrames = 0; (function f() { window.__tpFrames++; requestAnimationFrame(f); })(); } 1');
      const a = await page.evaluate('window.__tpFrames'); await sleep(Number(arg)); const b = await page.evaluate('window.__tpFrames');
      console.log('fps', a.timedOut || b.timedOut ? 'froze' : Math.round(((b.value - a.value) * 1000) / Number(arg)));
    }
  }
} finally {
  await page.close();
  server.close();
}
