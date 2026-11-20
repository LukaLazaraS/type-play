import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MakeYourOwn } from "@/components/app/MakeYourOwn";
import { JsonLd } from "@/components/JsonLd";
import { genreName } from "@/content/gallery";
import { gameDescription, gamePreview, gameStructuredData, gameTitle } from "@/content/seo";
import { site } from "@/content/site";
import { publicGame, UNAVAILABLE } from "@/lib/public";
import { posterUrl } from "@/lib/urls";
import { MoreGames } from "./MoreGames";
import { PlayStage, type ShownDate } from "./PlayStage";

/** A date as the page shows it, in plain English and the day it was in UTC ("12 Nov 2026"), not "3 days ago". */
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shown = (at: string): ShownDate => ({ text: day.format(new Date(at)), iso: at.slice(0, 10) });

/**
 * A gallery game's dates: when it went into the gallery, and when the version that plays now was made if that was a
 * later day (a game built before it was listed reads as listed only). A link-only page shows none: nothing about it
 * beyond what it showed before.
 */
function galleryDates(listedAt: string | null, builtAt: string | null) {
  if (!listedAt || !Number.isFinite(Date.parse(listedAt))) return null;
  const listed = shown(new Date(listedAt).toISOString());
  const built = builtAt && Number.isFinite(Date.parse(builtAt)) ? shown(new Date(builtAt).toISOString()) : null;
  return { listed, updated: built && built.iso > listed.iso ? built : null };
}

// App builds only (.app.tsx), like the API it reads. A shared game's public page: anyone with the
// link plays it here, no sign-in. It waits for the game before answering, so a private, unshared
// or missing game is a real 404 (the same for all three: nothing tells them apart). In search only
// while the game is in the gallery (2026-11-20; apps/web/README.md "Share pages").
export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = await publicGame(id);
  if (game === UNAVAILABLE) return { title: "This game can't load right now", robots: { index: false } };
  if (!game) return { title: "Game not found", robots: { index: false } };
  // The same words for search and for link previews; a link-only game's friends get good previews too.
  const title = gameTitle(game.name, game.genre ?? null);
  const description = gameDescription(game.name, game.genre ?? null, game.plays ?? 0);
  const image = { url: gamePreview(game), width: 1200, height: 630, alt: `${game.name}, a game made with TypePlay`, type: "image/png" };
  return {
    title,
    description,
    alternates: { canonical: `/play/${game.id}` },
    // In search only while the game is in the gallery by the API's own rule (listed, shared, not taken out by an admin,
    // built: PublicGame.listed). Shared by link only, taken out, or an API too old to say: kept out (a link is for friends).
    robots: game.listed === true ? { index: true, follow: true } : { index: false, follow: true },
    // The link preview: the game's start screen on the dusk desert (./preview.png, card.tsx).
    openGraph: { type: "website", siteName: site.name, locale: "en_US", title, description, url: `/play/${game.id}`, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function Play({ params }: Props) {
  const { id } = await params;
  const game = await publicGame(id);
  if (!game) notFound();
  // The API gave no answer (a deploy, an outage): a plain page, not Next's error screen.
  if (game === UNAVAILABLE) {
    return (
      <main className="play">
        <section className="widget play__made" aria-labelledby="play-unavailable">
          <h1 id="play-unavailable" className="title play__made-title">
            We can&apos;t load this game right now.
          </h1>
          <p className="play__made-text">Try again in a minute.</p>
        </section>
      </main>
    );
  }
  return (
    <main className="play" data-orientation={game.orientation}>
      {/* What search engines read about a gallery game: the game and its page, nothing about its maker. */}
      {game.listed === true && <JsonLd data={gameStructuredData(game)} />}
      <PlayStage
        id={game.id}
        buildId={game.buildId}
        name={game.name}
        orientation={game.orientation}
        fits={game.platform === "fill"}
        poster={game.poster ? posterUrl(game.buildId) : undefined}
        plays={game.plays ?? 0}
        genre={game.genre ? genreName[game.genre] : null}
        dates={game.listed === true ? galleryDates(game.listedAt ?? null, game.builtAt ?? null) : null}
      />
      <MakeYourOwn id="play-made" more />
      <MoreGames id={game.id} genre={game.genre ?? null} />
    </main>
  );
}
