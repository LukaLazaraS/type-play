// Sounds and fonts for the Assets tab (2026-11-04): what a file is by its first bytes (never by its name), and how long
// a sound plays. The files are the agent's, so every read stays inside the buffer and a strange header gives null.

export type SoundFormat = "wav" | "ogg" | "mp3";
export type FontFormat = "ttf" | "otf" | "woff" | "woff2";

export function soundFormat(b: Buffer): SoundFormat | null {
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WAVE") return "wav";
  if (b.length >= 4 && b.toString("latin1", 0, 4) === "OggS") return "ogg";
  if (b.length >= 3 && b.toString("latin1", 0, 3) === "ID3") return "mp3";
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mp3";
  return null;
}

export function fontFormat(b: Buffer): FontFormat | null {
  if (b.length < 4) return null;
  const tag = b.toString("latin1", 0, 4);
  if (tag === "wOFF") return "woff";
  if (tag === "wOF2") return "woff2";
  if (tag === "OTTO") return "otf";
  if (b.readUInt32BE(0) === 0x00010000 || tag === "true" || tag === "ttcf") return "ttf";
  return null;
}

const round = (s: number) => (Number.isFinite(s) && s > 0 && s < 86_400 ? Math.round(s * 100) / 100 : null);

/** A WAV's length: its data chunk's size over its byte rate (fmt chunk). */
function wavSeconds(b: Buffer): number | null {
  let rate = 0;
  for (let at = 12; at + 8 <= b.length; ) {
    const id = b.toString("latin1", at, at + 4);
    const len = b.readUInt32LE(at + 4);
    if (id === "fmt " && at + 20 <= b.length) rate = b.readUInt32LE(at + 16); // byte rate: 8 bytes into the chunk body
    if (id === "data") return rate ? round(Math.min(len, b.length - at - 8) / rate) : null;
    at += 8 + len + (len % 2);
  }
  return null;
}

/** An Ogg file's length: the last page's granule position over the sample rate (Vorbis' header, or Opus' 48 kHz). */
function oggSeconds(b: Buffer): number | null {
  let rate = 0;
  const vorbis = b.indexOf("\x01vorbis", 0, "latin1");
  if (vorbis >= 0 && vorbis + 16 <= b.length) rate = b.readUInt32LE(vorbis + 12);
  else if (b.indexOf("OpusHead", 0, "latin1") >= 0) rate = 48_000;
  if (!rate) return null;
  const last = b.lastIndexOf("OggS", b.length - 1, "latin1");
  if (last < 0 || last + 14 > b.length) return null;
  const granule = Number(b.readBigUInt64LE(last + 6));
  return round(granule / rate);
}

const MP3_RATES = [44_100, 48_000, 32_000];
const MP3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];

/** An MP3's length: its Xing/Info frame count when it has one, else its size at the first frame's bitrate (MPEG-1 Layer III). */
function mp3Seconds(b: Buffer): number | null {
  let at = 0;
  if (b.toString("latin1", 0, 3) === "ID3" && b.length >= 10) at = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);
  for (; at + 4 <= b.length; at++) if (b[at] === 0xff && (b[at + 1] & 0xfe) === 0xfa) break; // MPEG-1 Layer III frame sync
  if (at + 4 > b.length) return null;
  const kbps = MP3_KBPS[b[at + 2] >> 4];
  const rate = MP3_RATES[(b[at + 2] >> 2) & 3];
  if (!kbps || !rate) return null;
  const xing = b.subarray(at, at + 200);
  const tag = Math.max(xing.indexOf("Xing", 0, "latin1"), xing.indexOf("Info", 0, "latin1"));
  if (tag >= 0 && tag + 12 <= xing.length && xing.readUInt32BE(tag + 4) & 1) return round((xing.readUInt32BE(tag + 8) * 1152) / rate);
  return round(((b.length - at) * 8) / (kbps * 1000));
}

export function soundSeconds(b: Buffer, format: SoundFormat): number | null {
  try {
    return format === "wav" ? wavSeconds(b) : format === "ogg" ? oggSeconds(b) : mp3Seconds(b);
  } catch {
    return null;
  }
}
