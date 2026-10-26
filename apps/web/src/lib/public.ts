// Server side of the share pages and the gallery: what anyone may see (GET /public/*, no sign-in).
// Memoised per request, so a page and its metadata ask the API once.
import { connection } from "next/server";
import { cache } from "react";
import type { GalleryPage, GallerySort, Genre, PublicGame } from "@typeplay/shared";
import { app } from "@/content/app";
import { galleryQuery } from "@/lib/gallery";

/** The API could not say (down, a deploy, too slow): the page says so instead of crashing. */
export const UNAVAILABLE = "unavailable";

/** The shared game; null when it isn't shared or doesn't exist (the API answers both with 404);
 * UNAVAILABLE when the API gave no answer within 5 s or answered with an error. */
export const publicGame = cache(async (id: string): Promise<PublicGame | null | typeof UNAVAILABLE> => {
  if (!/^[a-z0-9]{4,40}$/.test(id)) return null;
  // Always at request time: unsharing must make the page disappear at once, never from a cache.
  await connection();
  try {
    const res = await fetch(`${app.apiOrigin}/public/games/${id}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (res.status === 404) return null;
    if (!res.ok) return UNAVAILABLE;
    return (await res.json()) as PublicGame;
  } catch {
    return UNAVAILABLE;
  }
});

/** The gallery's first page in an order, of a genre, for a search (the browser asks for the rest, lib/gallery.ts);
 * UNAVAILABLE as above. Plain arguments, so a page and its parts asking for the same view ask the API once. */
export const galleryFirst = cache(async (sort: GallerySort, genre: Genre | null = null, q = ""): Promise<GalleryPage | typeof UNAVAILABLE> => {
  // At request time, like the share pages: a game taken out of the gallery leaves it at once.
  await connection();
  try {
    const res = await fetch(`${app.apiOrigin}/public/gallery?${galleryQuery({ sort, genre, q })}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return UNAVAILABLE;
    return (await res.json()) as GalleryPage;
  } catch {
    return UNAVAILABLE;
  }
});
