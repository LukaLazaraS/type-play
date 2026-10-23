// Reads a zip's central directory (an APK and an AAB are zips) and extracts single entries: the
// native libraries' ABI folders, the signature block of a signed bundle, an ELF header's alignment.
// Stored and deflated entries only; a zip64 archive (over 4 GB) is refused: no build is that big.
import { inflateRawSync } from "node:zlib";

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localHeader: number;
}

const END = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

export function zipEntries(buf: Buffer): ZipEntry[] {
  // The end record is in the last 64 KB (its comment can be that long); scan back for it.
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_558); i--) {
    if (buf.readUInt32LE(i) === END) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("not a zip: no end record");
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  if (count === 0xffff || at === 0xffffffff) throw new Error("zip64 archives are not supported");
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== CENTRAL) throw new Error("bad zip central directory");
    const method = buf.readUInt16LE(at + 10);
    const compressedSize = buf.readUInt32LE(at + 20);
    const size = buf.readUInt32LE(at + 24);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const localHeader = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLen).toString("utf8");
    entries.push({ name, method, compressedSize, size, localHeader });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** One entry's bytes (stored or deflated). */
export function zipRead(buf: Buffer, e: ZipEntry): Buffer {
  const h = e.localHeader;
  if (h + 30 > buf.length || buf.readUInt32LE(h) !== LOCAL) throw new Error(`bad local header for ${e.name}`);
  const start = h + 30 + buf.readUInt16LE(h + 26) + buf.readUInt16LE(h + 28);
  const body = buf.subarray(start, start + e.compressedSize);
  if (e.method === 0) return body;
  if (e.method === 8) return inflateRawSync(body);
  throw new Error(`unsupported compression ${e.method} for ${e.name}`);
}

/** The ABIs a build ships native libraries for: lib/<abi>/ in an APK, <module>/lib/<abi>/ in an AAB. */
export function abisOf(entries: ZipEntry[]): string[] {
  const abis = new Set<string>();
  for (const e of entries) {
    const m = /^(?:[^/]+\/)?lib\/([^/]+)\/[^/]+\.so$/.exec(e.name);
    if (m) abis.add(m[1]);
  }
  return [...abis].sort();
}

/** Whether every PT_LOAD segment of a 64-bit ELF is aligned to 16 KB (Android's page-size rule). */
export function elfLoadAlign16k(so: Buffer): boolean {
  if (so.length < 64 || so.readUInt32BE(0) !== 0x7f454c46 || so[4] !== 2) return false; // ELF64 only
  const phoff = Number(so.readBigUInt64LE(0x20));
  const phentsize = so.readUInt16LE(0x36);
  const phnum = so.readUInt16LE(0x38);
  let loads = 0;
  for (let i = 0; i < phnum; i++) {
    const p = phoff + i * phentsize;
    if (p + 56 > so.length) return false;
    if (so.readUInt32LE(p) !== 1) continue; // PT_LOAD
    loads++;
    if (Number(so.readBigUInt64LE(p + 48)) < 16384) return false;
  }
  return loads > 0;
}
