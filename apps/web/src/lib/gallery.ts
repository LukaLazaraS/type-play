// The gallery's calls from the browser, none of them signed in: one play of a shared game, a report, and
// the gallery's next page (GET /public/* on the API; /explore's first page is fetched on the server, lib/public.ts).
import type { ApiError, GalleryPage, GallerySort, Genre, ReportBody } from "@typeplay/shared";
import { app } from "@/content/app";

const OFFLINE = "We can't reach TypePlay right now. Check your connection and try again.";
const SERVER = "Something went wrong on our side. Please try again.";

/** The game in a share page's frame started: one play. The API answers 204 whatever came of it, so nothing waits. */
export function countPlay(gameId: string) {
  fetch(`${app.apiOrigin}/public/games/${encodeURIComponent(gameId)}/play`, { method: "POST", keepalive: true, cache: "no-store" }).catch(() => {
    /* offline: the play goes uncounted */
  });
}

/** "Report this game". `already`: this device sent one about this game lately (the API's 429), said as thanks. */
export async function reportGame(gameId: string, body: ReportBody): Promise<{ already: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${app.apiOrigin}/public/games/${encodeURIComponent(gameId)}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error(OFFLINE);
  }
  if (res.ok) return { already: null };
  const error = (await res.json().catch(() => ({}))) as Partial<ApiError>;
  if (res.status === 429) return { already: error.message ?? "We already have your report. Thank you." };
  throw new Error(error.message ?? SERVER);
}

/** What the gallery shows: its order, one genre or all, and the words searched for (none: every name). */
export type GalleryView = { sort: GallerySort; genre?: Genre | null; q?: string };

/** The gallery's query for a view (and a page of it): the API's, and /explore's own address (defaults left out). */
export function galleryQuery({ sort, genre, q }: GalleryView, cursor?: string): string {
  const u = new URLSearchParams();
  if (sort !== "popular") u.set("sort", sort);
  if (genre) u.set("genre", genre);
  if (q) u.set("q", q);
  if (cursor) u.set("cursor", cursor);
  return u.toString();
}

/** A page of the gallery as `view` shows it: the first, or the one after `cursor` (Show more). `signal` drops an answer
 * that a newer choice made stale. */
export async function galleryPage(view: GalleryView, cursor?: string, signal?: AbortSignal): Promise<GalleryPage> {
  let res: Response;
  try {
    res = await fetch(`${app.apiOrigin}/public/gallery?${galleryQuery(view, cursor)}`, { cache: "no-store", signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(OFFLINE);
  }
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as Partial<ApiError>).message ?? SERVER);
  return (await res.json()) as GalleryPage;
}

/** The gallery's first page in an order (games to play while a first build runs). */
export const moreGames = (sort: GallerySort) => galleryPage({ sort });
