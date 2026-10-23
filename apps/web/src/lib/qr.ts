// A QR code for the phone link, made here instead of by a library: byte mode, error level M,
// versions 1 to 10 (up to 213 letters, the link is about 80). ISO/IEC 18004 in ~200 lines: the
// data bits, Reed-Solomon error correction over GF(256), the function patterns, the zigzag
// placement, the eight masks scored by the standard penalties, the format and version words.
// Checked against an independent decoder (jsQR) on 2026-10-18.

/** Level M per version 1-10: error codewords per block, then the blocks of group 1 and group 2 (count × data codewords). */
const EC_M: [ec: number, g1: number, d1: number, g2: number, d2: number][] = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
];
/** Alignment pattern centres per version (none for version 1). */
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const MAX_VERSION = EC_M.length;

// GF(256) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x = x << 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** The error-correction codewords of one block. */
function ecOf(data: number[], ec: number): number[] {
  let gen = [1];
  for (let i = 0; i < ec; i++) {
    const next = new Array<number>(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= mul(gen[j], EXP[i]);
    }
    gen = next;
  }
  const rem = new Array<number>(ec).fill(0);
  for (const d of data) {
    const factor = d ^ rem.shift()!;
    rem.push(0);
    for (let j = 0; j < ec; j++) rem[j] ^= mul(gen[j + 1], factor);
  }
  return rem;
}

/** The data codewords: mode, count, the bytes, the terminator and the pad bytes. */
function codewordsOf(bytes: Uint8Array, version: number, capacity: number): number[] {
  const bits: number[] = [];
  const push = (value: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) words.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; words.length < capacity; pad ^= 0xec ^ 0x11) words.push(pad);
  return words;
}

/** The blocks' data and error words, interleaved as the code reads them. */
function interleave(words: number[], version: number): number[] {
  const [ec, g1, d1, g2, d2] = EC_M[version - 1];
  const blocks: number[][] = [];
  let at = 0;
  for (const [count, size] of [
    [g1, d1],
    [g2, d2],
  ]) {
    for (let i = 0; i < count; i++) {
      blocks.push(words.slice(at, at + size));
      at += size;
    }
  }
  const out: number[] = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  const ecs = blocks.map((b) => ecOf(b, ec));
  for (let i = 0; i < ec; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

const MASKS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** The standard penalty score of a masked code: runs, 2×2 blocks, finder-like runs, the dark share. */
function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  const line = (at: (i: number) => boolean) => {
    let run = 0;
    let last: boolean | null = null;
    const cells: boolean[] = [];
    for (let i = 0; i < n; i++) {
      const v = at(i);
      cells.push(v);
      if (v === last) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
        last = v;
      }
    }
    // 1011101 with four light modules on either side.
    const s = cells.map((v) => (v ? "1" : "0")).join("");
    for (let i = 0; (i = s.indexOf("1011101", i)) >= 0; i++) if (s.startsWith("0000", i - 4) || s.startsWith("0000", i + 7)) score += 40;
  };
  for (let i = 0; i < n; i++) {
    line((j) => m[i][j]);
    line((j) => m[j][i]);
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3;
  let dark = 0;
  for (const row of m) for (const v of row) if (v) dark++;
  score += (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
  return score;
}

/** The code's modules (true = dark), without the quiet zone. Throws when the text is over 213 bytes. */
export function qrModules(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  while (version <= MAX_VERSION && EC_M[version - 1][1] * EC_M[version - 1][2] + EC_M[version - 1][3] * EC_M[version - 1][4] < bytes.length + (version < 10 ? 2 : 3)) version++;
  if (version > MAX_VERSION) throw new Error("Too long for a QR code here.");
  const [, g1, d1, g2, d2] = EC_M[version - 1];
  const words = interleave(codewordsOf(bytes, version, g1 * d1 + g2 * d2), version);

  const n = version * 4 + 17;
  const m: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const fixed: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const set = (col: number, row: number, dark: boolean) => {
    if (row < 0 || col < 0 || row >= n || col >= n) return;
    m[row][col] = dark;
    fixed[row][col] = true;
  };
  // Timing, finders with their separators, alignment patterns, the dark module.
  for (let i = 0; i < n; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [n - 4, 3],
    [3, n - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy)); // 0-1 dark, 2 light, 3 dark, 4 the light separator
        set(cx + dx, cy + dy, ring !== 2 && ring !== 4);
      }
    }
  }
  const centres = ALIGN[version - 1];
  const last = centres.length - 1;
  for (let i = 0; i < centres.length; i++) {
    for (let j = 0; j < centres.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue; // on a finder
      const [cx, cy] = [centres[i], centres[j]];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  set(8, n - 8, true);
  // The format word's places (filled after the mask is picked) and the version word (7 and up).
  const format = (bits: number) => {
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(i));
    set(8, n - 8, true);
  };
  format(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, ((bits >>> i) & 1) === 1);
      set(b, a, ((bits >>> i) & 1) === 1);
    }
  }
  // The data, zigzagging up and down in two-column strips from the right, skipping the timing column.
  let at = 0;
  let up = true;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < n; v++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const row = up ? n - 1 - v : v;
        if (fixed[row][col]) continue;
        m[row][col] = at < words.length * 8 && ((words[at >> 3] >>> (7 - (at & 7))) & 1) === 1;
        at++;
      }
    }
    up = !up;
  }
  // The mask with the lowest penalty, then its format word (level M is 00): BCH-coded and XORed.
  let best = 0;
  let bestScore = Infinity;
  const masked = (k: number) => m.map((row, r) => row.map((v, c) => (fixed[r][c] ? v : v !== MASKS[k](r, c))));
  for (let k = 0; k < MASKS.length; k++) {
    let rem = k;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    format(((k << 10) | rem) ^ 0x5412);
    const score = penalty(masked(k));
    if (score < bestScore) {
      bestScore = score;
      best = k;
    }
  }
  let rem = best;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  format(((best << 10) | rem) ^ 0x5412);
  return masked(best);
}

/** The dark modules as one SVG path, with a quiet zone of four modules on every side. */
export function qrPath(modules: boolean[][]): { d: string; size: number } {
  const n = modules.length;
  const parts: string[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (modules[r][c]) parts.push(`M${c + 4} ${r + 4}h1v1h-1z`);
  return { d: parts.join(""), size: n + 8 };
}
