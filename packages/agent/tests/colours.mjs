// tools/colours.mjs: the PNG decoder and the colour verdicts the check uses, on pictures made here (no files, no browser).
import { deflateSync } from 'node:zlib';
import { decodePng, measure, verdict } from '../tools/colours.mjs';

// A PNG of w×h, every pixel from fn(x, y) → [r, g, b]; rows use the filters the decoder must undo (0-4 in turn).
function png(w, h, fn) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const raw = [];
  let prev = Buffer.alloc(w * 3);
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(w * 3);
    for (let x = 0; x < w; x++) row.set(fn(x, y), x * 3);
    const f = y % 5, out = Buffer.alloc(w * 3);
    for (let i = 0; i < row.length; i++) {
      const a = i >= 3 ? row[i - 3] : 0, b = prev[i], c = i >= 3 ? prev[i - 3] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      out[i] = (row[i] - pred) & 255;
    }
    raw.push(Buffer.from([f]), out);
    prev = row;
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(raw))), chunk('IEND', Buffer.alloc(0))]);
}

let failed = 0;
const ok = (cond, label) => { if (!cond) { failed++; console.log(`FAIL ${label}`); } };
const judge = (buf) => verdict(measure(decodePng(buf)));

// The decoder undoes every filter: a gradient comes back exactly.
const grad = decodePng(png(37, 23, (x, y) => [x * 6, y * 11, (x * y) & 255]));
ok(grad.width === 37 && grad.height === 23, 'size read');
ok([...Array(23).keys()].every((y) => [...Array(37).keys()].every((x) => { const o = (y * 37 + x) * 4; return grad.rgba[o] === x * 6 && grad.rgba[o + 1] === y * 11 && grad.rgba[o + 2] === ((x * y) & 255); })), 'every filter undone, every pixel exact');

// Washed out: a room lit past white, a pale (chalky) meadow, a bright flat screen.
ok(/pure white/.test(judge(png(80, 60, (x) => (x < 64 ? [255, 255, 255] : [120, 60, 40]))) ?? ''), '80% pure white: washed out');
ok(/pale/.test(judge(png(80, 60, (x) => (x < 40 ? [205, 245, 220] : [90, 120, 60]))) ?? ''), 'half pale mint: washed out (chalky)');
ok(/flat/.test(judge(png(80, 60, (x) => [200 + (x % 20), 190 + (x % 20), 160])) ?? ''), 'bright and flat: washed out');
// Too dark: a near-black screen; but a night scene with light things in it reads fine.
ok(/too dark/.test(judge(png(80, 60, () => [6, 8, 12])) ?? ''), 'all near black: too dark');
ok(judge(png(80, 60, (x, y) => (y < 30 ? [10, 14, 30] : x % 8 < 3 ? [240, 220, 120] : [40, 70, 50]))) === null, 'a night scene with light pieces: fine');
// A game that reads well: mid colours, dark outlines, a few white highlights.
ok(judge(png(80, 60, (x, y) => (x % 10 === 0 ? [20, 20, 30] : (x + y) % 17 === 0 ? [255, 255, 255] : [70 + x, 140, 90 + y]))) === null, 'mid colours with outlines and highlights: fine');
// Letterbox bars (Godot's black around a game kept to its shape) are left out; a flat blue sky across the top is not.
const boxed = measure(decodePng(png(100, 60, (x) => (x < 20 || x >= 80 ? [0, 0, 0] : [255, 255, 255]))));
ok(boxed.area[0] === 60 && boxed.clipped === 1, 'black bars left out: the game itself is all white');
const sky = measure(decodePng(png(100, 60, (x, y) => (y < 20 ? [127, 168, 216] : [80, 140, 60]))));
ok(sky.area[1] === 60, 'a flat sky across the top stays in');

console.log(failed ? `colours: ${failed} failed` : 'colours: all checks passed');
process.exit(failed ? 1 : 0);
