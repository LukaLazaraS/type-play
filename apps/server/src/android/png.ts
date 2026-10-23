// Reads a PNG's size from its header (magic + IHDR), no image library: enough to refuse an icon
// that is not a PNG or is too small before it reaches Godot (docs/android-export-design.md §5).
const MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface PngInfo {
  width: number;
  height: number;
}

/** The size, or null when the bytes are not a PNG with an IHDR chunk first. */
export function pngInfo(data: Buffer): PngInfo | null {
  if (data.length < 33 || !data.subarray(0, 8).equals(MAGIC)) return null;
  if (data.readUInt32BE(8) !== 13 || data.subarray(12, 16).toString("latin1") !== "IHDR") return null;
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (!width || !height || width > 16384 || height > 16384) return null;
  return { width, height };
}

/** Icon upload limits: a square PNG of at least 512×512, at most 1 MB (Play's store icon is 512×512). */
export const ICON_MIN = 512;
export const ICON_MAX_BYTES = 1 << 20;

/** Why an uploaded icon is refused, or null. */
export function iconProblem(data: Buffer): string | null {
  if (data.length > ICON_MAX_BYTES) return "The icon must be under 1 MB.";
  const info = pngInfo(data);
  if (!info) return "The icon must be a PNG file.";
  if (info.width < ICON_MIN || info.height < ICON_MIN) return `The icon must be at least ${ICON_MIN}×${ICON_MIN} pixels.`;
  if (info.width !== info.height) return "The icon must be square.";
  return null;
}
