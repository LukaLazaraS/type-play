"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Play } from "@phosphor-icons/react";
import type { Genre, Orientation } from "@typeplay/shared";
import { games as showcase } from "@/content/games";
import { moreGames } from "@/lib/gallery";
import { posterUrl } from "@/lib/urls";
import { GameTile } from "./GameTile";

// A first build takes minutes (Luka, 10-24: "just watching a loading screen that long is bad: some users leave and
// never come back"). The stage offers three games to play right there while it builds, and the gallery; the build
// goes on whatever they do, and the stage (or, away from the page, BuildPill) brings them back when it is ready.

/** A game to play while waiting: from the gallery, or one of the home page's games. */
export type WaitGame = {
  key: string;
  /** What the games origin knows it by: a gallery game's build id, a home page game's slug. */
  slug: string;
  name: string;
  orientation: Orientation;
  /** It fills every screen (a gallery game made that way): no turn-your-phone hint. */
  fits?: boolean;
  /** Its start screen: the card's picture (none: GameTile draws one) and the frame's until the game runs. */
  poster?: string;
  /** Its genre skill, for the order only (most games have none: only four genres have a skill). */
  genre: Genre | null;
};

const HOME_GENRE: Record<string, Genre> = { "Endless runner": "runner", Puzzle: "puzzle", "3D driving": "racer" };
const homeGames: WaitGame[] = showcase.map((g) => ({
  key: `home-${g.slug}`,
  slug: g.slug,
  name: g.name,
  orientation: g.orientation,
  poster: g.image,
  genre: HOME_GENRE[g.genre] ?? null,
}));

/** What the first sentence sounds like, roughly: games of the same kind come first. */
const CLUES: [Genre, RegExp][] = [
  ["towerdefence", /tower|defen[cs]e|waves? of/i],
  ["racer", /rac(e|ing)|car|kart|driv/i],
  ["puzzle", /match|puzzle|tiles?|blocks?|sokoban|push(es|ing)? box/i],
  ["runner", /run|jump|dash|endless|flap|dodge|hop/i],
];
export const guessGenre = (prompt: string): Genre | null => CLUES.find(([, re]) => re.test(prompt))?.[0] ?? null;

/**
 * Three to play: the gallery's most played this week, then the home page's games; one of the kind asked for first,
 * then other kinds (the home page has three takes on one robot runner: three of those would be one game).
 */
export function pickWaitGames(gallery: WaitGame[], prompt: string): WaitGame[] {
  const genre = guessGenre(prompt);
  const kindFirst = (list: WaitGame[]) => (genre ? [...list.filter((g) => g.genre === genre), ...list.filter((g) => g.genre !== genre)] : list);
  const names = new Set<string>();
  const pool = [...kindFirst(gallery), ...kindFirst(homeGames)].filter((g) => !names.has(g.name.toLowerCase()) && !!names.add(g.name.toLowerCase()));
  const picked: WaitGame[] = [];
  for (const g of pool) if (picked.length < 3 && !picked.some((p) => p.genre && p.genre === g.genre)) picked.push(g);
  for (const g of pool) if (picked.length < 3 && !picked.includes(g)) picked.push(g);
  return picked;
}

/** The three games for this first sentence, asked for once `on` (a first build is running); null while the gallery
 * answers (at most 3 s, then the home page's). */
export function useWaitGames(prompt: string, on: boolean): WaitGame[] | null {
  const [games, setGames] = useState<WaitGame[] | null>(null);
  useEffect(() => {
    if (!on) return;
    let live = true;
    const settle = (gallery: WaitGame[]) => live && setGames((now) => now ?? pickWaitGames(gallery, prompt));
    const late = setTimeout(() => settle([]), 3000);
    moreGames("popular")
      .then((page) =>
        settle(
          page.games.map((g) => ({
            key: g.id,
            slug: g.buildId,
            name: g.name,
            orientation: g.orientation,
            fits: g.platform === "fill",
            poster: g.poster ? posterUrl(g.buildId) : undefined,
            genre: g.genre ?? null,
          })),
        ),
      )
      .catch(() => settle([]))
      .finally(() => clearTimeout(late));
    return () => {
      live = false;
      clearTimeout(late);
    };
  }, [prompt, on]);
  return games;
}

// The gallery is another page: this tab remembers which build to bring the player back to (BuildPill).
const KEY = "typeplay:waiting";
const listeners = new Set<() => void>();
const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
};
export function rememberWaiting(projectId: string) {
  try {
    sessionStorage.setItem(KEY, projectId);
  } catch {
    // private mode: the gallery still opens, just without the way back
  }
  listeners.forEach((l) => l());
}
export function waitingFor(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function forgetWaiting() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing kept
  }
  listeners.forEach((l) => l());
}
/** The game this tab's player is waiting for, away from its page (null: none). */
export const useWaiting = () => useSyncExternalStore(subscribe, waitingFor, () => null);

/**
 * Under the build's progress: three games as cards, the gallery's listings in small (Luka, 10-25: the icons were too
 * small to read as games), each a big picture with a Play chip and its name; a tap plays it in the stage. Then the gallery.
 */
export function WhileYouWait({ projectId, games, onPlay }: { projectId: string; games: WaitGame[] | null; onPlay: (g: WaitGame) => void }) {
  return (
    <section className="wait" aria-labelledby="wait-title">
      <h2 id="wait-title" className="wait__title">
        Play one while you wait
      </h2>
      <ul className="wait__games" aria-busy={games === null || undefined}>
        {(games ?? [null, null, null]).map((g, i) =>
          g ? (
            <li key={g.key} className="wait__card">
              <button type="button" className="wait__game" onClick={() => onPlay(g)} aria-label={`Play ${g.name}`}>
                <span className="wait__pic">
                  <GameTile id={g.key} name={g.name} building={false} poster={g.poster ?? null} fill />
                  <span className="wait__play" aria-hidden="true">
                    <Play size={12} weight="fill" />
                    Play
                  </span>
                </span>
                <span className="wait__name">{g.name}</span>
              </button>
            </li>
          ) : (
            <li key={i} className="wait__card wait__slot" aria-hidden="true">
              <span className="wait__pic" />
              <span className="wait__name">&nbsp;</span>
            </li>
          ),
        )}
      </ul>
      <Link href="/explore" className="inkpill inkpill--small wait__more" onClick={() => rememberWaiting(projectId)}>
        More in the gallery
        <ArrowRight size={16} weight="bold" aria-hidden="true" />
      </Link>
    </section>
  );
}
