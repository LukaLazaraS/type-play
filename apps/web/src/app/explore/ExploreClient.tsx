"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { ArrowsOut, Flag, Play, ShareNetwork } from "@phosphor-icons/react";
import type { GalleryGame, GalleryPage, GallerySort } from "@typeplay/shared";
import { GameFrame, type GameFrameHandle } from "@/components/GameFrame";
import { GameTile } from "@/components/app/GameTile";
import { ReportDialog, type ReportHandle } from "@/components/app/ReportDialog";
import { genreName, NEWEST } from "@/content/gallery";
import { playsWord } from "@/lib/format";
import { countPlay, moreGames } from "@/lib/gallery";
import { posterUrl } from "@/lib/urls";

const noop = () => () => {};
const useCanShare = () => useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);

/** Figures joined with a dot; each one keeps its words together, so a narrow line breaks only between them. */
const figures = (parts: (string | null)[]) =>
  parts
    .filter((p): p is string => !!p)
    .map((p) => p.replace(/ /g, "\u00a0"))
    .join(" · ");
/** The plays the order is about: this week's on Popular (what it sorts by), all of them on New; none said
 * when there are none (as everywhere else plays show). */
const playsOf = (g: GalleryGame, sort: GallerySort) => {
  const n = sort === "popular" ? g.playsWeek : g.plays;
  return n === 0 ? null : sort === "popular" ? `${playsWord(n)} this week` : playsWord(n);
};
/** A card's plays, held together so a narrow card can only break between "12.3K plays" and "this week". */
const cardPlays = (s: string | null) => s?.replace(/ (plays?)/, "\u00a0$1").replace(/ week$/, "\u00a0week") ?? null;
const genreOf = (g: GalleryGame) => (g.genre ? genreName[g.genre] : null);

/** A sort link's words; while its page is on the way the pill takes the current look at once (CSS, data-pending). */
export function SortLabel({ name }: { name: string }) {
  const { pending } = useLinkStatus();
  return <span data-pending={pending || undefined}>{name}</span>;
}

/** "Make your own game.": beside an upright top game (as on an upright share page), or at the end (`wide`);
 * `narrowOnly`: at the end only where nothing can sit beside the stage (a lone upright game). */
export function Invite({ wide = false, narrowOnly = false }: { wide?: boolean; narrowOnly?: boolean }) {
  const id = useId();
  return (
    <section className={`widget play__made${wide ? " explore__made" : ""}`} data-narrow-only={narrowOnly || undefined} aria-labelledby={id}>
      <h2 id={id} className="title play__made-title">
        Make your own game.
      </h2>
      <p className="play__made-text">Type an idea in a sentence. TypePlay builds a real game you can play in a few minutes, and you change it by chatting.</p>
      <div className="play__cta">
        <Link href="/create" className="button">
          Make your own
        </Link>
        <Link href="/#how" className="button button--quiet">
          How it works
        </Link>
      </div>
    </section>
  );
}

/** The gallery under its head: the first game in its frame, ready to play, then the rest as listings. */
export function ExploreGames({ sort, first }: { sort: GallerySort; first: GalleryPage }) {
  const top = first.games[0];
  const [games, setGames] = useState(() => first.games.slice(1));
  const [next, setNext] = useState(first.next);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Said to screen readers when Show more has added games (the new cards land below the focus).
  const [added, setAdded] = useState("");
  const report = useRef<ReportHandle>(null);

  const more = async () => {
    if (!next || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await moreGames(sort, next);
      // Popular moves while people play: a game that changed pages meanwhile shows once.
      const fresh = page.games.filter((g) => g.id !== top.id && !games.some((x) => x.id === g.id));
      setGames((gs) => [...gs, ...fresh.filter((g) => !gs.some((x) => x.id === g.id))]);
      setNext(page.next);
      setAdded(`${fresh.length} more ${fresh.length === 1 ? "game" : "games"}${page.next ? "" : ", the last of them"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="explore__top" data-orientation={top.orientation}>
        <Featured key={top.id} game={top} sort={sort} onReport={() => report.current?.open(top)} />
        {/* Beside an upright top game on a wide screen (CSS hides it on narrow ones); the page ends on it too. */}
        {top.orientation === "portrait" && <Invite />}
      </div>
      {games.length > 0 && (
        <section className="explore__more" aria-labelledby="explore-more">
          <h2 id="explore-more" className="title explore__subtitle">
            More to play.
          </h2>
          <ul className="explore__grid">
            {games.map((g) => (
              <Listing key={g.id} game={g} sort={sort} onReport={() => report.current?.open(g)} />
            ))}
          </ul>
          <p className="sr-only" role="status">
            {added}
          </p>
          {(next || error) && (
            <div className="explore__next">
              {error && (
                <p className="explore__error" role="alert">
                  {error}
                </p>
              )}
              {next && (
                <button type="button" className="button button--quiet" disabled={loading} onClick={() => void more()}>
                  {loading ? "Loading…" : error ? "Try again" : "Show more games"}
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {/* A lone upright game has its invitation beside it on a wide screen: at the end only on a narrow one. */}
      <Invite wide narrowOnly={top.orientation === "portrait" && games.length === 0} />
      <ReportDialog ref={report} />
    </>
  );
}

/** The first game: the share page's ink stage, its frame beside its words; a play counts once per page view. */
function Featured({ game, sort, onReport }: { game: GalleryGame; sort: GallerySort; onReport: () => void }) {
  const frame = useRef<GameFrameHandle>(null);
  const full = useRef<HTMLButtonElement>(null);
  const counted = useRef(false);
  const canShare = useCanShare();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  // When the game has really started (the frame's "ready"), once, whatever happens after (Try again, full screen).
  const onReady = useCallback(() => {
    if (counted.current) return;
    counted.current = true;
    countPlay(game.id);
  }, [game.id]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  // Its share page's address, to send to a friend: the phone's share sheet, or the clipboard.
  const share = () => {
    const url = `${window.location.origin}/play/${game.id}`;
    if (canShare) {
      navigator.share({ title: game.name, text: `Play ${game.name}, a game made with TypePlay`, url }).catch(() => {
        /* closed the share sheet */
      });
      return;
    }
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => router.push(`/play/${game.id}`), // no clipboard: its page, where the address is
    );
  };

  return (
    <section className="widget widget--ink feature" data-orientation={game.orientation} aria-labelledby="feature-name">
      <div className="feature__frame" data-orientation={game.orientation}>
        <GameFrame
          ref={frame}
          slug={game.buildId}
          poster={game.poster ? posterUrl(game.buildId) : undefined}
          name={game.name}
          orientation={game.orientation}
          fits={game.platform === "fill"}
          mode="click"
          onReady={onReady}
          returnFocus={full}
        />
      </div>
      <div className="feature__text">
        <h2 id="feature-name" className="title feature__name">
          <Link href={`/play/${game.id}`} prefetch={false}>
            {game.name}
          </Link>
        </h2>
        <p className="figures feature__figures">{figures([sort === "new" ? NEWEST : null, playsOf(game, sort), genreOf(game)])}</p>
        <div className="feature__actions">
          <button ref={full} type="button" className="inkpill" onClick={() => frame.current?.fullscreen()}>
            <ArrowsOut size={18} weight="bold" aria-hidden="true" />
            Full screen
          </button>
          <button type="button" className="inkpill" onClick={share}>
            <ShareNetwork size={18} weight="bold" aria-hidden="true" />
            {canShare ? "Share…" : copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <div className="play__foot feature__foot">
          <p className="play__how">Play with keys or touch. On a phone it opens full screen.</p>
          <button type="button" className="play__report" onClick={onReport}>
            <Flag size={16} weight="bold" aria-hidden="true" />
            Report this game
          </button>
        </div>
      </div>
    </section>
  );
}

/** A game as a store listing: its start screen, its name and its figures; the whole card opens its page. */
function Listing({ game, sort, onReport }: { game: GalleryGame; sort: GallerySort; onReport: () => void }) {
  return (
    <li className="glist" data-orientation={game.orientation}>
      <Link href={`/play/${game.id}`} className="glist__link" prefetch={false} aria-label={`Play ${game.name}`}>
        <span className="glist__pic">
          <GameTile id={game.id} name={game.name} building={false} poster={game.poster ? posterUrl(game.buildId) : null} fill />
          <span className="glist__play" aria-hidden="true">
            <Play size={13} weight="fill" />
            Play
          </span>
        </span>
        <span className="glist__name" aria-hidden="true">
          {game.name}
        </span>
      </Link>
      <p className="figures glist__meta">
        {[cardPlays(playsOf(game, sort)), genreOf(game)].map((part) => part && <span key={part}>{part}</span>)}
      </p>
      {/* In the picture's top corner, above the card's link: the figures below get the card's whole width. */}
      <button type="button" className="glist__report" aria-label={`Report ${game.name}`} onClick={onReport}>
        <Flag size={16} weight="bold" aria-hidden="true" />
      </button>
    </li>
  );
}
