// Unit test of the picture checks (src/attachments/images.ts), no database: what a player may attach, and what is kept.
//   npm run build -w @typeplay/server && npm run test:pictures -w @typeplay/server
import sharp from "sharp";
import { cleanPicture, fitWithin, PictureProblem, sniff } from "../dist/attachments/images.js";
import { MAX_IMAGE_BYTES, PICTURE_PROBLEM } from "../dist/attachments/limits.js";

let failures = 0;
function ok(cond, what) {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
}

/** The sentence a picture is refused with, or "" when it is taken. */
async function refusal(bytes) {
  try {
    await cleanPicture(bytes);
    return "";
  } catch (e) {
    if (e instanceof PictureProblem) return e.message;
    throw e;
  }
}

/** A PNG's chunk types, in order. */
function pngChunks(buf) {
  const types = [];
  for (let at = 8; at + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(at);
    types.push(buf.toString("latin1", at + 4, at + 8));
    at += 12 + len;
  }
  return types;
}

/** A PNG chunk (length, type, data, CRC). */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  let c = 0xffffffff;
  for (const b of body) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, crc]);
}

/** A picture with a hard left/right split, so its orientation can be read back. */
const split = (width, height, left, right, channels = 3) =>
  sharp({ create: { width, height, channels, background: right } })
    .composite([{ input: { create: { width: Math.floor(width / 2), height, channels, background: left } }, left: 0, top: 0 }]);

const GPS = { IFD0: { Copyright: "TypePlay test" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 42/1 54/1", GPSLongitudeRef: "E", GPSLongitude: "44/1 47/1 37/1" } };

console.log("what the first bytes say");
ok(sniff(Buffer.from("89504e470d0a1a0a0000000d49484452", "hex")) === "png", "PNG signature: png");
ok(sniff(Buffer.from("ffd8ffe000104a464946", "hex")) === "jpeg", "JPEG start-of-image: jpeg");
ok(sniff(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")])) === "webp", "RIFF....WEBP: webp");
ok(sniff(Buffer.from("GIF89a")) === null, "GIF: not one of ours");
ok(sniff(Buffer.from("4d5a90000300000004000000ffff0000", "hex")) === null, "a Windows program (MZ): not a picture");
ok(sniff(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")) === null, "SVG (a document that can run script): not taken");

console.log("refused, each in one plain sentence");
ok((await refusal(Buffer.alloc(0))) === PICTURE_PROBLEM.empty, "an empty file");
const exe = Buffer.concat([Buffer.from("4d5a90000300000004000000ffff0000b800000000000000", "hex"), Buffer.alloc(4096, 0x90)]);
ok((await refusal(exe)) === PICTURE_PROBLEM.notPicture, `a program renamed cat.png: "${PICTURE_PROBLEM.notPicture}"`);
const gif = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#f00" } }).gif().toBuffer();
ok((await refusal(gif)) === PICTURE_PROBLEM.notPicture, "a GIF");
const big = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(MAX_IMAGE_BYTES - 7)]);
ok((await refusal(big)) === PICTURE_PROBLEM.tooBig, "10 MB and a byte");
const jpeg = await split(800, 600, "#e01e1e", "#1e3ce6").jpeg({ quality: 90 }).toBuffer();
ok((await refusal(jpeg.subarray(0, Math.floor(jpeg.length / 2)))) === PICTURE_PROBLEM.unreadable, "a JPEG cut in half: can't be opened");
ok((await refusal(Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.from("not really a png at all")]))) === PICTURE_PROBLEM.unreadable, "PNG's first bytes, then nothing a decoder reads");
{
  // A decompression bomb: a header that says 20000×20000 (400 megapixels) on a few bytes.
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(20000, 0);
  ihdr.writeUInt32BE(20000, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const bomb = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", Buffer.from("789c0300000000 01", "hex")), chunk("IEND", Buffer.alloc(0))]);
  ok((await refusal(bomb)) === PICTURE_PROBLEM.tooManyPixels, "a 400-megapixel header on a few bytes: refused before decoding");
}
{
  // A JPEG's start, then a PNG: the bytes say one thing, the decoder reads another.
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#0f0" } }).png().toBuffer();
  ok((await refusal(Buffer.concat([Buffer.from("ffd8ff", "hex"), png]))) !== "", "JPEG bytes in front of a PNG: refused");
}

console.log("a photo with its location: upright, and nothing but its pixels kept");
{
  const photo = await split(800, 600, "#e01e1e", "#1e3ce6").withMetadata({ orientation: 6 }).withExif(GPS).jpeg({ quality: 90 }).toBuffer();
  const m0 = await sharp(photo).metadata();
  ok(!!m0.exif && m0.orientation === 6 && photo.includes(Buffer.from("TypePlay test")), "the test photo carries EXIF (GPS, orientation 6, a copyright line)");
  const c = await cleanPicture(photo);
  const meta = await sharp(c.full).metadata();
  ok(c.format === "jpeg" && meta.format === "jpeg", "still a JPEG");
  ok(c.width === 600 && c.height === 800 && meta.width === 600 && meta.height === 800, "turned upright by its orientation (800×600 → 600×800)");
  ok(!meta.exif && !meta.xmp && !meta.iptc && !meta.icc, "no EXIF, XMP, IPTC or colour profile left");
  ok(!c.full.includes(Buffer.from("TypePlay test")) && !c.full.includes(Buffer.from("Exif")), "the EXIF block's bytes are gone");
  // Orientation 6 turns it clockwise: the left half (red) is at the top now.
  const { data } = await sharp(c.full).raw().toBuffer({ resolveWithObject: true });
  ok(data[0] > 150 && data[2] < 100, "the red half is at the top: really turned, not just relabelled");
  for (const [name, b] of [["view", c.view], ["thumb", c.thumb]]) {
    const m = await sharp(b).metadata();
    ok(m.format === "webp" && !m.exif && !m.xmp, `its ${name} is a WebP without metadata`);
  }
}

console.log("a PNG with a location in eXIf and tEXt chunks");
{
  const tagged = await split(400, 300, "#ffb347", "#170d33", 4).withExif(GPS).png().toBuffer();
  const iend = tagged.length - 12;
  const withText = Buffer.concat([tagged.subarray(0, iend), chunk("tEXt", Buffer.from("Comment\0GPS 41.7151N 44.8271E")), chunk("iTXt", Buffer.from("XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta/>")), tagged.subarray(iend)]);
  const before = pngChunks(withText);
  ok(before.includes("eXIf") && before.includes("tEXt") && before.includes("iTXt"), `the test PNG carries ${before.filter((t) => !["IHDR", "IDAT", "IEND"].includes(t)).join(", ")}`);
  const c = await cleanPicture(withText);
  const after = pngChunks(c.full);
  ok(c.format === "png" && !after.some((t) => ["eXIf", "tEXt", "iTXt", "zTXt", "iCCP", "tIME"].includes(t)), `none of them left (${after.join(" ")})`);
  ok(!c.full.includes(Buffer.from("GPS")) && !c.full.includes(Buffer.from("41.7151")), "no GPS bytes anywhere in the file");
  ok((await sharp(c.full).metadata()).channels === 4, "its transparency kept");
}

console.log("sizes: the clean picture, what the AI sees, the thumbnail");
{
  const wide = await split(3000, 1000, "#2f9e44", "#ffffff").png().toBuffer();
  const c = await cleanPicture(wide);
  ok(c.width === 2048 && c.height === 683, `3000×1000 → ${c.width}×${c.height} (at most 2048 on the long edge)`);
  const v = await sharp(c.view).metadata();
  ok(v.width <= 1568 && v.width * v.height <= 1_150_000, `the AI's view ${v.width}×${v.height}: within 1568 px and 1.15 megapixels`);
  const t = await sharp(c.thumb).metadata();
  ok(Math.max(t.width, t.height) === 320, `the thumbnail ${t.width}×${t.height}`);
  const small = await cleanPicture(await sharp({ create: { width: 64, height: 48, channels: 3, background: "#8fd3ff" } }).png().toBuffer());
  const sv = await sharp(small.view).metadata();
  ok(small.width === 64 && small.height === 48 && sv.width === 64, "a small picture is never made bigger");
  const webp = await cleanPicture(await split(500, 500, "#ff5a36", "#3d206b").webp({ quality: 80 }).toBuffer());
  ok(webp.format === "webp" && (await sharp(webp.full).metadata()).format === "webp", "a WebP stays a WebP");
  const cmyk = await cleanPicture(await split(300, 200, "#ff0000", "#0000ff").toColourspace("cmyk").jpeg().toBuffer());
  ok(cmyk.format === "jpeg" && (await sharp(cmyk.full).metadata()).space === "srgb", "a CMYK JPEG comes out in sRGB");
  const sixteen = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } } }).toColourspace("rgb16").png().toBuffer();
  const deep = await cleanPicture(sixteen);
  ok((await sharp(sixteen).metadata()).depth === "ushort" && deep.format === "png" && (await sharp(deep.full).metadata()).depth === "uchar", "a 16-bit PNG comes out 8-bit");
}

console.log("fitting within a size");
ok(JSON.stringify(fitWithin(4000, 3000, 2048)) === JSON.stringify({ width: 2048, height: 1536 }), "4000×3000 in 2048: 2048×1536");
ok(JSON.stringify(fitWithin(100, 50, 2048)) === JSON.stringify({ width: 100, height: 50 }), "never larger");
{
  const v = fitWithin(1920, 1080, 1568, 1_150_000);
  ok(v.width * v.height <= 1_150_000 && v.width <= 1568 && Math.abs(v.width / v.height - 16 / 9) < 0.01, `1920×1080 for the AI: ${v.width}×${v.height}, ~${Math.ceil(v.width / 28) * Math.ceil(v.height / 28)} tokens`);
}

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
