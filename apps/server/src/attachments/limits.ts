// The limits on attached pictures and the sentences that refuse one (2026-11-04). Apart from images.ts so that what
// only needs a number or a sentence (main.ts's body limit, the error filter) doesn't load the image library.

/** At most this many bytes a picture (the site says so before it uploads; the API's body limit says it again). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** A message carries at most this many pictures. */
export const MAX_IMAGES = 10;
/** Past this many pixels a picture is refused before it is decoded: a decompression bomb is a few KB that unpack to GBs.
 * 50 megapixels lets in a 48 MP phone photo (8000×6000). */
export const MAX_PIXELS = 50_000_000;
/** The clean picture's long edge at most: a background or a character never needs more in a game, and it keeps the
 * build small when the player asks for the picture to be used as the game's art. */
export const FULL_EDGE = 2048;
/** What the AI sees: at most 1568 px on the long edge and 1.15 megapixels, about 1,500 image tokens (⌈w/28⌉·⌈h/28⌉). The
 * 5.5 models take up to 2576 px (4,784 tokens) a picture, but a reference needs no more, and ten of them at full size
 * would push a Fast build past Haiku's 100K-token price step. */
export const VIEW_EDGE = 1568;
export const VIEW_PIXELS = 1_150_000;
/** The chat's thumbnail: its long edge (the site shows it at up to ~100 px, so 320 is sharp on a 3x screen). */
export const THUMB_EDGE = 320;

/** Said to the player as it is (one plain sentence each). */
export const PICTURE_PROBLEM = {
  empty: "That file is empty.",
  tooBig: "That picture is over 10 MB. Make it smaller and attach it again.",
  notPicture: "That file isn't a PNG, JPG or WebP picture.",
  tooManyPixels: "That picture is too big to use (over 50 megapixels). Make it smaller and attach it again.",
  unreadable: "That picture couldn't be opened: it may be damaged. Save it again as a PNG or JPG and attach it again.",
} as const;
