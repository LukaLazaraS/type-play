// How a screenshot's colours read: washed out (most of it near white, little contrast), too dark, or fine.
// No dependencies and no AI: a PNG decoder (node:zlib) and a few counts over the pixels, milliseconds a picture.
// The check (tools/check.mjs) runs it on the screenshots it already takes; `node tools/colours.mjs <png>…` prints the
// numbers. Thresholds were set on the public games of 2026-11-07 (docs/research/game-colours-2026-11-07.md): the washed-out
// ones (Buzz Bite's white room) against the ones that read well, 2D and 3D.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** Decodes an 8-bit, non-interlaced PNG (what browsers' screenshots are) to { width, height, rgba }. */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const idat = [];
  let palette = null, trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('latin1', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; type = data[9]; interlace = data[12];
    } else if (kind === 'PLTE') palette = data;
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error(`PNG with bit depth ${depth}${interlace ? ', interlaced' : ''} is not read here`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error(`PNG colour type ${type} is not read here`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const at = y * (stride + 1), filter = raw[at];
    for (let x = 0; x < stride; x++) {
      const v = raw[at + 1 + x];
      const a = x >= channels ? cur[x - channels] : 0, b = prev[x], c = x >= channels ? prev[x - channels] : 0;
      let p = v;
      if (filter === 1) p = v + a;
      else if (filter === 2) p = v + b;
      else if (filter === 3) p = v + ((a + b) >> 1);
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        p = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      cur[x] = p & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4, i = x * channels;
      if (type === 6) { out[o] = cur[i]; out[o + 1] = cur[i + 1]; out[o + 2] = cur[i + 2]; out[o + 3] = cur[i + 3]; }
      else if (type === 2) { out[o] = cur[i]; out[o + 1] = cur[i + 1]; out[o + 2] = cur[i + 2]; out[o + 3] = 255; }
      else if (type === 0) { out[o] = out[o + 1] = out[o + 2] = cur[i]; out[o + 3] = 255; }
      else if (type === 4) { out[o] = out[o + 1] = out[o + 2] = cur[i]; out[o + 3] = cur[i + 1]; }
      else { const k = cur[i] * 3; out[o] = palette[k]; out[o + 1] = palette[k + 1]; out[o + 2] = palette[k + 2]; out[o + 3] = trns && cur[i] < trns.length ? trns[cur[i]] : 255; }
    }
    [prev, cur] = [cur, prev];
  }
  return { width, height, rgba: out };
}

/**
 * The numbers for one picture. The game's own area only: rows and columns that are one flat colour from edge to edge
 * (the bars around a game kept to its shape) are left out, and so is nothing else (a HUD is part of what players see).
 * - light: mean lightness (Rec. 709 luma of the sRGB values), 0-255
 * - white: share of pixels that are near white (every channel ≥ 235): a blown-out or chalky picture
 * - clipped: share at full white (every channel ≥ 250): light that ran past what the screen can show
 * - dark: share that is near black (luma ≤ 20)
 * - contrast: the spread between the darkest and lightest tenths (p95 - p5 of luma), 0-255
 * - sat: mean saturation (HSV), 0-1
 */
export function measure(img) {
  const { width, height, rgba } = img;
  // Letterbox bars: whole rows or columns of one near-black colour (Godot's clear colour around a game kept to its shape).
  const barPx = (p) => rgba[p] <= 24 && rgba[p + 1] <= 24 && rgba[p + 2] <= 24;
  const flatRow = (y) => { const o = y * width * 4; if (!barPx(o)) return false; for (let x = 1; x < width; x++) { const p = o + x * 4; if (Math.abs(rgba[p] - rgba[o]) + Math.abs(rgba[p + 1] - rgba[o + 1]) + Math.abs(rgba[p + 2] - rgba[o + 2]) > 6) return false; } return true; };
  const flatCol = (x, y0, y1) => { const o = (y0 * width + x) * 4; if (!barPx(o)) return false; for (let y = y0 + 1; y < y1; y++) { const p = (y * width + x) * 4; if (Math.abs(rgba[p] - rgba[o]) + Math.abs(rgba[p + 1] - rgba[o + 1]) + Math.abs(rgba[p + 2] - rgba[o + 2]) > 6) return false; } return true; };
  let top = 0, bottom = height;
  while (top < bottom - 1 && flatRow(top)) top++;
  while (bottom - 1 > top && flatRow(bottom - 1)) bottom--;
  let left = 0, right = width;
  while (left < right - 1 && flatCol(left, top, bottom)) left++;
  while (right - 1 > left && flatCol(right - 1, top, bottom)) right--;
  const hist = new Uint32Array(256);
  let n = 0, pale = 0, white = 0, clipped = 0, dark = 0, satSum = 0, lumSum = 0;
  // Every second pixel each way: the same numbers to a fraction of a percent, a quarter of the work.
  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const o = (y * width + x) * 4, r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
      const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      hist[lum]++; lumSum += lum; n++;
      if (mn >= 200) pale++;
      if (mn >= 235) white++;
      if (mn >= 250) clipped++;
      if (lum <= 20) dark++;
      satSum += mx ? (mx - mn) / mx : 0;
    }
  }
  const pct = (q) => { let acc = 0; const want = q * n; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= want) return i; } return 255; };
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return {
    area: [right - left, bottom - top],
    light: Math.round(lumSum / n), pale: r3(pale / n), white: r3(white / n), clipped: r3(clipped / n), dark: r3(dark / n),
    contrast: pct(0.95) - pct(0.05), sat: r3(satSum / n), p5: pct(0.05), p50: pct(0.5), p95: pct(0.95),
  };
}

// The limits (docs/research/game-colours-2026-11-07.md), set on the public games' screenshots: the good ones (2D and 3D)
// have at most 1.8% pure white, 2.7% near white and 13.5% pale; the washed-out ones (Buzz Bite's room 79% pure white,
// Mosquito Night's 9.6%, a meadow lit twice 45% pale) and the pale, flat 2D ones (lightness 183-195, contrast 69-71) are
// over them. Too dark: a near-black screen, not a night scene (the night games run 20-50% near black and read well).
export const LIMITS = { clipped: 0.08, white: 0.2, pale: 0.4, lightFlat: 180, contrastFlat: 80, dark: 0.7, lightDark: 30, contrastDark: 60 };

/** null when the picture reads fine, else what is wrong with it, as a short phrase. */
export function verdict(m) {
  const p = (v) => `${Math.round(v * 100)}%`;
  if (m.clipped > LIMITS.clipped) return `washed out: ${p(m.clipped)} of the screen is pure white (lit past what a screen can show)`;
  if (m.white > LIMITS.white) return `washed out: ${p(m.white)} of the screen is near white`;
  if (m.pale > LIMITS.pale) return `washed out: ${p(m.pale)} of the screen is pale (every colour very light, so it looks chalky)`;
  if (m.light > LIMITS.lightFlat && m.contrast < LIMITS.contrastFlat) return `washed out: bright (lightness ${m.light} of 255) and flat (only ${m.contrast} of 255 between its dark and light parts)`;
  if (m.dark > LIMITS.dark) return `too dark: ${p(m.dark)} of the screen is near black`;
  if (m.light < LIMITS.lightDark && m.contrast < LIMITS.contrastDark) return `too dark: lightness ${m.light} of 255 with little contrast (${m.contrast} of 255)`;
  return null;
}

export function analyse(file) {
  const m = measure(decodePng(readFileSync(file)));
  return { ...m, verdict: verdict(m) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  for (const f of process.argv.slice(2)) {
    try { console.log(f, JSON.stringify(analyse(f))); } catch (e) { console.log(f, 'ERROR', e.message); }
  }
}
