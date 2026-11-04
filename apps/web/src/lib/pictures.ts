"use client";

// The player's pictures as the page shows them (2026-11-04): fetched once with the sign-in header (an <img> can't send
// it), kept as object URLs for as long as the page lives. A picture uploaded from this device shows from its own file.
import { useEffect, useState } from "react";
import { api } from "./api";

export type PictureSize = "thumb" | "full";

const cache = new Map<string, Promise<string>>();

/** The picture's address for an <img>; a fetch that failed is tried again the next time it is asked for. */
export function pictureUrl(id: string, size: PictureSize): Promise<string> {
  const key = `${size}:${id}`;
  let url = cache.get(key);
  if (!url) {
    url = (size === "thumb" ? api.pictures.thumb(id) : api.pictures.full(id)).then((blob) => URL.createObjectURL(blob));
    url.catch(() => cache.delete(key));
    cache.set(key, url);
  }
  return url;
}

/** A picture this device just uploaded: shown from its own file from now on, with no fetch. */
export function knownPicture(id: string, file: Blob) {
  const url = Promise.resolve(URL.createObjectURL(file));
  cache.set(`thumb:${id}`, url);
  cache.set(`full:${id}`, url);
}

/** The picture's address once it is here (null until then, and when it can't be had). */
export function usePicture(id: string | null, size: PictureSize): string | null {
  const [shown, setShown] = useState<{ key: string; url: string } | null>(null);
  const key = id ? `${size}:${id}` : null;
  useEffect(() => {
    if (!id) return;
    let live = true;
    pictureUrl(id, size).then(
      (url) => live && setShown({ key: `${size}:${id}`, url }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [id, size]);
  return shown && shown.key === key ? shown.url : null;
}
