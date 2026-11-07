// Plays a public game from typeplay.dev in the check's hidden browser, the way any visitor's browser would, for
// scripts/capacity/measure.mjs (`--games url:<build id>`): how much memory the browser takes on a heavy published build
// that has no project on this PC. Taps the middle and presses Space every 2 s for the given seconds, then a screenshot.
//   node play-public.mjs <tools dir> <build id> [seconds=45]
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [tools, id, secArg] = process.argv.slice(2);
const { openPage, sleep } = await import(pathToFileURL(join(tools, 'web.mjs')).href);
const seconds = Number(secArg || 45);
const info = await (await fetch(`https://typeplay.dev/builds/${id}/game.json`)).json().catch(() => ({}));
const portrait = info.orientation === 'portrait';
const viewport = portrait ? { width: 432, height: 936 } : { width: 1366, height: 768 };
const page = await openPage(`https://typeplay.dev/play.html?g=${encodeURIComponent(id)}`, { viewport, touch: portrait, freeze: true });
await sleep(15_000); // the engine (~36 MB) downloads and compiles
const t0 = Date.now();
while (Date.now() - t0 < seconds * 1000) {
  if (portrait) await page.tap(viewport.width / 2, viewport.height / 2);
  else await page.click(viewport.width / 2, viewport.height / 2);
  await page.key('Space');
  await sleep(2000);
}
const shot = join(process.env.TPM_SHOTS || process.cwd(), `played-${id}.png`);
const mark = await page.pageNow();
const drawn = mark === null ? null : await page.freezeReport(mark - 10_000, mark);
const ok = await page.shot(shot);
const errors = page.console.filter((l) => l.type === 'error' || l.type === 'exception').length;
await page.close();
console.log(`CHECK: PLAYED ${id} (${info.name ?? '?'}, ${portrait ? 'portrait' : 'landscape'}) ${seconds} s; ${drawn ? `${drawn.frames} frames in the last 10 s, ${drawn.drawCalls} draw calls a frame (most ${drawn.drawCallsMax})` : 'page stuck'}; ${errors} console errors; screenshot ${ok ? shot : 'none'}`);
