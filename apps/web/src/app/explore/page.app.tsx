import type { Metadata } from "next";
import Link from "next/link";
import type { GallerySort } from "@typeplay/shared";
import { sorts } from "@/content/gallery";
import { galleryFirst, UNAVAILABLE } from "@/lib/public";
import { ExploreGames, Invite, SortLabel } from "./ExploreClient";

// App builds only (.app.tsx), like the share pages it leads to. The public gallery: the games their
// makers chose to show (shared, then "Show it in the gallery"), the week's most played or the newest
// first. It waits for the API before answering, so the first page arrives whole.
export const instant = false;

export const metadata: Metadata = {
  title: "Explore games",
  description: "Play games people made with TypePlay, free in your browser. Each one started as a typed idea.",
  alternates: { canonical: "/explore" },
  // Kept out of search until Luka says otherwise, like the share pages (docs/parked.md, row 13).
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<{ sort?: string | string[] }> };

export default async function Explore({ searchParams }: Props) {
  const sort: GallerySort = (await searchParams).sort === "new" ? "new" : "popular";
  const page = await galleryFirst(sort);
  const empty = page !== UNAVAILABLE && page.games.length === 0;
  return (
    <main className="explore">
      <header className="explore__head">
        <div>
          <h1 className="title explore__title">Explore.</h1>
          <p className="explore__lead">Games people made with TypePlay, each one from a typed idea. Play any of them here, free.</p>
        </div>
        {!empty && (
          <nav className="explore__sort" aria-label="Order of the games">
            {sorts.map((s) => (
              <Link key={s.id} href={s.href} aria-current={s.id === sort ? "page" : undefined} prefetch={false}>
                <SortLabel name={s.name} />
              </Link>
            ))}
          </nav>
        )}
      </header>

      {page === UNAVAILABLE ? (
        <>
          <section className="widget explore__empty" role="alert">
            <p>We can&apos;t load the games right now. Try again in a minute.</p>
            <Link href={sort === "new" ? "/explore?sort=new" : "/explore"} className="button button--quiet" prefetch={false}>
              Try again
            </Link>
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
          <Link href="/create" className="button">
            Make a game
          </Link>
        </section>
      ) : (
        <ExploreGames key={sort} sort={sort} first={page} />
      )}
    </main>
  );
}
