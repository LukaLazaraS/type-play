// Average brightness of PNG screenshots (decoded in Node, no browser, no CPU load).
//   node bright.mjs <png> [<png> ...]      -> one JSON line per file
// mean = average of 0.2126 R + 0.7152 G + 0.0722 B on the 0-255 sRGB values (not linearised);
// top/mid/bot = the same for the three horizontal thirds.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decode(file) {
  const b = readFileSync(file);
  let o = 8, w = 0, h = 0, ct = 0, depth = 8, interlace = 0; const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ct = d[9]; interlace = d[12]; }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`unsupported PNG (depth ${depth}, interlace ${interlace})`);
  const bpp = { 6: 4, 2: 3, 4: 2, 0: 1 }[ct];
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp, out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, u = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      cur[x] = v & 255;
    }
    prev = cur;
  }
  const rgb = (x, y) => { const i = y * stride + x * bpp; return bpp >= 3 ? [out[i], out[i + 1], out[i + 2]] : [out[i], out[i], out[i]]; };
  return { w, h, rgb };
}

export function stats(file, region) {
  const { w, h, rgb } = decode(file);
  const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const part = (y0, y1, x0 = 0, x1 = w) => {
    let s = 0, n = 0, R = 0, G = 0, B = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = rgb(x, y); s += lum(p); R += p[0]; G += p[1]; B += p[2]; n++; }
    return { mean: +(s / n).toFixed(1), rgb: [R / n, G / n, B / n].map((v) => Math.round(v)) };
  };
  const t = Math.floor(h / 3);
  const whole = part(0, h);
  const r = { file: file.replaceAll('\\', '/').split('/').slice(-2).join('/'), w, h, mean: whole.mean, rgb: whole.rgb, top: part(0, t).mean, mid: part(t, 2 * t).mean, bot: part(2 * t, h).mean };
  if (region) { const [x0, y0, x1, y1] = region; r.region = part(y0, y1, x0, x1); }
  return r;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  for (const f of process.argv.slice(2)) {
    try { console.log(JSON.stringify(stats(f))); } catch (e) { console.log(JSON.stringify({ file: f, error: String(e.message) })); }
  }
}
