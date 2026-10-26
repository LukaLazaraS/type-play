import type { Metadata } from "next";
import type { GallerySort, Genre } from "@typeplay/shared";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { genreName } from "@/content/gallery";
import { galleryFirst, UNAVAILABLE } from "@/lib/public";
import { ExploreGames, Invite } from "./ExploreClient";

// App builds only (.app.tsx), like the share pages it leads to. The public gallery: the games their makers chose to show
// (shared, then "Show it in the gallery"). On top, the week's most played game in its frame; under it the library, every
// game in the order, genre and search the address asks for (Luka, 10-27), which the page then changes in place. It waits
// for the API before answering, so the first page arrives whole.
export const instant = false;

export const metadata: Metadata = {
  title: "Explore games",
  description: "Play games people made with TypePlay, free in your browser. Each one started as a typed idea.",
  alternates: { canonical: "/explore" },
  // Kept out of search until Luka says otherwise, like the share pages (docs/parked.md, row 13).
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<{ sort?: string | string[]; genre?: string | string[]; q?: string | string[] }> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Explore({ searchParams }: Props) {
  const params = await searchParams;
  const sortWord = one(params.sort);
  const sort: GallerySort = sortWord === "new" || sortWord === "all" ? sortWord : "popular";
  const genreWord = one(params.genre);
  const genre = Object.hasOwn(genreName, genreWord) ? (genreWord as Genre) : null;
  // As the API takes it: spaces tidied, 60 letters at most.
  const q = [...one(params.q).replace(/\s+/g, " ").trim()].slice(0, 60).join("");
  // The top game and the gallery's counts come from its usual first page; the library's first page is the same one
  // unless the address asks for another order, a genre or a search.
  const top = await galleryFirst("popular");
  const asked = sort === "popular" && !genre && !q ? top : await galleryFirst(sort, genre, q);
  const empty = top !== UNAVAILABLE && top.games.length === 0;
  return (
    <main className="explore">
      <header className="explore__head">
        <div>
          <h1 className="title explore__title">Explore.</h1>
          <p className="explore__lead">Games people made with TypePlay, each one from a typed idea. Play any of them here, free.</p>
        </div>
      </header>

      {top === UNAVAILABLE ? (
        <>
          <section className="widget explore__empty" role="alert">
            <p>We can&apos;t load the games right now. Try again in a minute.</p>
            <ButtonLink href="/explore" look="quiet" prefetch={false}>
              Try again
            </ButtonLink>
          </section>
          <Invite wide />
        </>
      ) : empty ? (
        <section className="widget explore__empty" aria-labelledby="explore-empty">
          <div>
            <h2 id="explore-empty" className="title explore__empty-title">
              No games here yet.
            </h2>
            <p>Make a game, share it from its page, then switch on “Show it in the gallery”. It shows up here.</p>
          </div>
          <ButtonLink href="/create">Make a game</ButtonLink>
        </section>
      ) : (
        <ExploreGames
          top={top.games[0]}
          gallery={top.total ?? top.games.length}
          genres={top.genres ?? {}}
          view={{ sort, genre, q }}
          first={asked === UNAVAILABLE ? null : asked}
        />
      )}
    </main>
  );
}
