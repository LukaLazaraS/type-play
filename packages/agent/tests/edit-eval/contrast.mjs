// Contrast of light text on its background inside a region of a PNG (decoded in Node, no browser, no CPU load).
//   node contrast.mjs <png> <x0> <y0> <x1> <y1> [dark]
// Background = the region's median colour; text = the 97th percentile by luminance (the 3rd with "dark" for dark text).
// Prints both colours and the WCAG contrast ratio (4.5 is the usual minimum for small text, 3 for large).
import { decode } from './bright.mjs';

const [file, x0, y0, x1, y1, mode] = process.argv.slice(2);
const { w, h, rgb } = decode(file);
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const px = [];
for (let y = Number(y0); y < Math.min(Number(y1), h); y++) for (let x = Number(x0); x < Math.min(Number(x1), w); x++) px.push(rgb(x, y));
px.sort((a, b) => L(a) - L(b));
const bg = px[Math.floor(px.length / 2)];
const text = mode === 'dark' ? px[Math.floor(px.length * 0.03)] : px[Math.floor(px.length * 0.97)];
const [hi, lo] = [Math.max(L(bg), L(text)), Math.min(L(bg), L(text))];
console.log(JSON.stringify({ file: file.replaceAll('\\', '/').split('/').slice(-2).join('/'), region: [x0, y0, x1, y1].map(Number), background: bg, text, ratio: +((hi + 0.05) / (lo + 0.05)).toFixed(2) }));
