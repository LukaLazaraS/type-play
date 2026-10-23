// Side-by-side picture of PNG screenshots (decoded in Node): node compose.mjs <out.png> <scale 0.5-1> <in1.png> <in2.png> ...
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { decode } from './bright.mjs';

const [out, scaleArg, ...files] = process.argv.slice(2);
const scale = Number(scaleArg);
const T = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };

const imgs = files.map((f) => decode(f));
const GAP = 6;
const tiles = imgs.map((im) => ({ im, w: Math.round(im.w * scale), h: Math.round(im.h * scale) }));
const W = tiles.reduce((s, t) => s + t.w, 0) + GAP * (tiles.length - 1);
const H = Math.max(...tiles.map((t) => t.h));
const px = Buffer.alloc(W * H * 3, 255);
let x0 = 0;
for (const t of tiles) {
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
    // box-filter downscale
    const sx0 = Math.floor(x / scale), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) / scale)), sy0 = Math.floor(y / scale), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) / scale));
    let r = 0, g = 0, b = 0, n = 0;
    for (let sy = sy0; sy < Math.min(sy1, t.im.h); sy++) for (let sx = sx0; sx < Math.min(sx1, t.im.w); sx++) { const p = t.im.rgb(sx, sy); r += p[0]; g += p[1]; b += p[2]; n++; }
    const i = (y * W + x0 + x) * 3; px[i] = r / n; px[i + 1] = g / n; px[i + 2] = b / n;
  }
  x0 += t.w + GAP;
}
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`${out} ${W}x${H}`);
