// The gallery's calls from the browser, none of them signed in: one play of a shared game, a report, and
// the gallery's next page (GET /public/* on the API; /explore's first page is fetched on the server, lib/public.ts).
import type { ApiError, GalleryPage, GallerySort, ReportBody } from "@typeplay/shared";
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

/** The gallery's next page, after `cursor` (Show more); without one, its first page (games to play while a first build runs). */
export async function moreGames(sort: GallerySort, cursor?: string): Promise<GalleryPage> {
  let res: Response;
  try {
    res = await fetch(`${app.apiOrigin}/public/gallery?sort=${sort}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
  } catch {
    throw new Error(OFFLINE);
  }
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as Partial<ApiError>).message ?? SERVER);
  return (await res.json()) as GalleryPage;
}
