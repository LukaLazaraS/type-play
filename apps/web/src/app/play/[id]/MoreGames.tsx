import type { GalleryGame, Genre } from "@typeplay/shared";
import { genreMore } from "@/content/gallery";
import { galleryFirst, UNAVAILABLE } from "@/lib/public";
import { OtherGames } from "./OtherGames";

/** The most games the row shows: 12 fills whole rows at six, four, three and two across (OtherGames trims a shorter row
 * to whole rows the same way). */
const MOST = 12;

/**
 * More games under a shared game (on every share page, link-only too: these games are all in the public gallery): the
 * most played of its genre first, then the gallery's most played, never the game itself, as the gallery's own cards
 * (their pictures, names, plays and genres; nothing about makers). Rendered on the server, so its links are in the page
 * as served. No answer from the API: no row, and the page works as before.
 */
export async function MoreGames({ id, genre }: { id: string; genre: Genre | null }) {
  const [same, all] = await Promise.all([genre ? galleryFirst("popular", genre) : null, galleryFirst("popular")]);
  const seen = new Set([id]);
  const games: GalleryGame[] = [];
  for (const page of [same, all]) {
    if (!page || page === UNAVAILABLE) continue;
    for (const g of page.games) {
      if (games.length === MOST) break;
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      games.push(g);
    }
  }
  if (games.length === 0) return null;
  // A genre's name heads the row only when every game in it is of that genre; filled with others, plain words.
  const title = genre && games.every((g) => g.genre === genre) ? `More ${genreMore[genre]}` : "More games to play";
  return <OtherGames title={title} games={games} />;
}
