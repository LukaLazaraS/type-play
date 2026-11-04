// Pictures a player attaches to a message (2026-11-04): checked by their content (never by a name or a type a browser
// sends), decoded in full, and made into the three files we keep. Nothing of the original file survives but its pixels:
// every metadata block (EXIF with a phone's location, XMP, IPTC, comments, colour profiles, PNG text) is dropped by
// re-encoding, and the picture is turned upright by its EXIF orientation first. sharp (libvips) is the decoder.
import { availableParallelism } from "node:os";
import sharp, { type Metadata, type OutputInfo, type Sharp, type SharpOptions } from "sharp";
import type { ImageFormat } from "../generated/prisma/client.js";
import { FULL_EDGE, MAX_IMAGE_BYTES, MAX_PIXELS, PICTURE_PROBLEM, THUMB_EDGE, VIEW_EDGE, VIEW_PIXELS } from "./limits.js";

/** One picture's decoding and encoding may take this long at most. */
const TIMEOUT_SECONDS = 30;

/** A picture we don't take, with the sentence that says why. */
export class PictureProblem extends Error {}

/** The format the first bytes say, or null: PNG's 8-byte signature, JPEG's start-of-image marker, WebP's RIFF....WEBP. */
export function sniff(b: Buffer): ImageFormat | null {
  if (b.length >= 8 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

export interface CleanPicture {
  format: ImageFormat;
  /** The clean picture's size. */
  width: number;
  height: number;
  /** The clean picture, in its own format. */
  full: Buffer;
  /** What the AI sees (WebP). */
  view: Buffer;
  /** The chat's thumbnail (WebP). */
  thumb: Buffer;
}

// No operation cache (it would keep decoded pictures in memory between uploads) and at most two threads a picture: the
// live API container has one vCPU and 1 GB.
sharp.cache(false);
sharp.concurrency(Math.min(2, availableParallelism()));

/** At most this many pictures are decoded at once in this process; the rest wait their turn, in order. */
const AT_ONCE = 2;
let busy = 0;
const waiting: (() => void)[] = [];
async function inTurn<T>(work: () => Promise<T>): Promise<T> {
  if (busy >= AT_ONCE) await new Promise<void>((r) => waiting.push(r));
  busy++;
  try {
    return await work();
  } finally {
    busy--;
    waiting.shift()?.();
  }
}

/** The size that fits `w`×`h` within `edge` on its long side and `pixels` in all, never larger than it is. */
export function fitWithin(w: number, h: number, edge: number, pixels = Infinity): { width: number; height: number } {
  const scale = Math.min(1, edge / Math.max(w, h), Math.sqrt(pixels / (w * h)));
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) };
}

function encode(img: Sharp, format: ImageFormat): Sharp {
  if (format === "png") return img.png({ compressionLevel: 8, adaptiveFiltering: true });
  if (format === "jpeg") return img.jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" });
  return img.webp({ quality: 92, alphaQuality: 100, smartSubsample: true });
}

/**
 * Checks a picture and makes the three files we keep, or throws a PictureProblem. The checks, in order: not empty and at
 * most 10 MB; the first bytes are a PNG, JPEG or WebP; the header's size is at most 50 megapixels; the format the decoder
 * reads is the one the bytes said; and the whole picture decodes without a warning (a truncated or damaged file fails
 * here). Animated pictures keep their first frame.
 */
export async function cleanPicture(bytes: Buffer): Promise<CleanPicture> {
  if (!bytes.length) throw new PictureProblem(PICTURE_PROBLEM.empty);
  if (bytes.length > MAX_IMAGE_BYTES) throw new PictureProblem(PICTURE_PROBLEM.tooBig);
  const format = sniff(bytes);
  if (!format) throw new PictureProblem(PICTURE_PROBLEM.notPicture);
  return inTurn(async () => {
    const input: SharpOptions = { failOn: "warning", limitInputPixels: MAX_PIXELS, autoOrient: true, animated: false };
    let meta: Metadata;
    try {
      meta = await sharp(bytes, { ...input, limitInputPixels: false }).metadata();
    } catch {
      throw new PictureProblem(PICTURE_PROBLEM.unreadable);
    }
    if (meta.format !== format) throw new PictureProblem(PICTURE_PROBLEM.notPicture);
    if (!meta.width || !meta.height) throw new PictureProblem(PICTURE_PROBLEM.unreadable);
    if (meta.width * meta.height > MAX_PIXELS) throw new PictureProblem(PICTURE_PROBLEM.tooManyPixels);
    // One full decode, upright, at most FULL_EDGE, to plain sRGB pixels (alpha kept when there is some): the three files
    // are encoded from these, so none of them can carry anything of the original file but its pixels.
    let pixels: { data: Buffer; info: OutputInfo };
    try {
      pixels = await sharp(bytes, input)
        .timeout({ seconds: TIMEOUT_SECONDS })
        .resize({ width: FULL_EDGE, height: FULL_EDGE, fit: "inside", withoutEnlargement: true })
        .toColourspace("srgb")
        .raw({ depth: "uchar" })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new PictureProblem(PICTURE_PROBLEM.unreadable);
    }
    const { width, height, channels } = pixels.info;
    const from = () => sharp(pixels.data, { raw: { width, height, channels: channels as 1 | 2 | 3 | 4 } }).timeout({ seconds: TIMEOUT_SECONDS });
    const view = fitWithin(width, height, VIEW_EDGE, VIEW_PIXELS);
    const thumb = fitWithin(width, height, THUMB_EDGE);
    const [full, viewBytes, thumbBytes] = await Promise.all([
      encode(from(), format).toBuffer(),
      from().resize(view.width, view.height, { fit: "fill" }).webp({ quality: 88, alphaQuality: 100, smartSubsample: true }).toBuffer(),
      from().resize(thumb.width, thumb.height, { fit: "fill" }).webp({ quality: 78, alphaQuality: 90 }).toBuffer(),
    ]);
    return { format, width, height, full, view: viewBytes, thumb: thumbBytes };
  });
}
