"use client";

import type { GalleryGame } from "@typeplay/shared";
import { GameTile } from "@/components/app/GameTile";
import { GameCard } from "@/components/ui/GameCard";
import { PlayCount } from "@/components/ui/PlayCount";
import { genreName } from "@/content/gallery";
import { playsShort, playsWord } from "@/lib/format";
import { posterUrl } from "@/lib/urls";

/** MoreGames' row (a client component for the cards' icons; rendered on the server all the same, so its links are in
 * the page as served): the gallery's cards, each opening its game's page. */
export function OtherGames({ title, games }: { title: string; games: GalleryGame[] }) {
  return (
    <section className="play__others" aria-labelledby="play-others">
      <h2 id="play-others" className="title library__title">
        {title}
      </h2>
      <ul className="explore__grid">
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
