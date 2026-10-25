import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MakeYourOwn } from "@/components/app/MakeYourOwn";
import { site } from "@/content/site";
import { publicGame, UNAVAILABLE } from "@/lib/public";
import { posterUrl } from "@/lib/urls";
import { PlayStage } from "./PlayStage";

// App builds only (.app.tsx), like the API it reads. A shared game's public page: anyone with the
// link plays it here, no sign-in. It waits for the game before answering, so a private, unshared
// or missing game is a real 404 (the same for all three: nothing tells them apart).
export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = await publicGame(id);
  if (game === UNAVAILABLE) return { title: "This game can't load right now", robots: { index: false } };
  if (!game) return { title: "Game not found", robots: { index: false } };
  const description = `Play ${game.name} free in your browser. Made with TypePlay: type a game idea, play it in minutes.`;
  // The build id in the address: a new version is a new picture (link previews cache by address).
  const image = { url: `/play/${game.id}/preview.png?v=${game.buildId}`, width: 1200, height: 630, alt: `${game.name}, a game made with TypePlay`, type: "image/png" };
  return {
    title: game.name,
    description,
    alternates: { canonical: `/play/${game.id}` },
    // Kept out of search until Luka says otherwise (apps/web/README.md, "Share pages").
    robots: { index: false, follow: true },
    // The link preview: the game's start screen on the dusk desert (./preview.png, card.tsx).
    openGraph: { type: "website", siteName: site.name, locale: "en_US", title: game.name, description, url: `/play/${game.id}`, images: [image] },
    twitter: { card: "summary_large_image", title: game.name, description, images: [image] },
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
      <PlayStage
        id={game.id}
        buildId={game.buildId}
        name={game.name}
        orientation={game.orientation}
        fits={game.platform === "fill"}
        poster={game.poster ? posterUrl(game.buildId) : undefined}
        plays={game.plays ?? 0}
      />
      <MakeYourOwn id="play-made" more />
    </main>
  );
}
