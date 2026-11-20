"use client";

import type { GalleryGame } from "@typeplay/shared";
import { GameTile } from "@/components/app/GameTile";
import { GameCard } from "@/components/ui/GameCard";
import { PlayCount } from "@/components/ui/PlayCount";
import { genreName } from "@/content/gallery";
import { playsShort, playsWord } from "@/lib/format";
import { posterUrl } from "@/lib/urls";

/** The row's columns by screen width (app.css "More games"): six, four, three, two. */
const ACROSS = [6, 4, 3, 2] as const;

/** How many cards make whole rows at `across` a row: all of them when they don't fill one row. */
const whole = (count: number, across: number) => (count > across ? count - (count % across) : count);

/** MoreGames' row (a client component for the cards' icons; rendered on the server all the same, so its links are in
 * the page as served): the gallery's cards, each opening its game's page. Whole rows only: at each width the cards past
 * the last whole row are hidden (`data-cut6`... say how many stay; 12 fills every width). */
export function OtherGames({ title, games }: { title: string; games: GalleryGame[] }) {
  const cuts = Object.fromEntries(ACROSS.filter((a) => whole(games.length, a) < games.length).map((a) => [`data-cut${a}`, whole(games.length, a)]));
  return (
    <section className="play__others" aria-labelledby="play-others">
      <h2 id="play-others" className="title library__title">
        {title}
      </h2>
      <ul className="explore__grid play__grid" {...cuts}>
        {games.map((g) => (
          <GameCard
            key={g.id}
            name={g.name}
            label={`Play ${g.name}`}
            href={`/play/${g.id}`}
            orientation={g.orientation}
            picture={<GameTile id={g.id} name={g.name} building={false} poster={g.poster ? posterUrl(g.buildId) : null} fill />}
          >
            {(g.plays > 0 || g.genre) && (
              <p className="figures glist__meta">
                {g.plays > 0 && <PlayCount count={playsShort(g.plays)} words={playsWord(g.plays)} />}
                {g.genre && <span>{genreName[g.genre]}</span>}
              </p>
            )}
          </GameCard>
        ))}
      </ul>
    </section>
  );
}
