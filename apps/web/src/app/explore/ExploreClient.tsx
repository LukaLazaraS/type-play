"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flag, ShareNetwork } from "@phosphor-icons/react";
import type { GalleryGame, GalleryPage, GallerySort, Genre } from "@typeplay/shared";
import { FullScreenPill, GameFrame, type GameFrameHandle } from "@/components/GameFrame";
import { GameTile } from "@/components/app/GameTile";
import { MakeYourOwn } from "@/components/app/MakeYourOwn";
import { ReportDialog, type ReportHandle } from "@/components/app/ReportDialog";
import { ReportGameButton } from "@/components/app/ReportGameButton";
import { Button } from "@/components/ui/Button";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { GameCard } from "@/components/ui/GameCard";
import { IconButton } from "@/components/ui/IconButton";
import { InkPill } from "@/components/ui/InkPill";
import { PillChoice } from "@/components/ui/PillBar";
import { PlayCount } from "@/components/ui/PlayCount";
import { SearchField } from "@/components/ui/SearchField";
import { genreName, sorts } from "@/content/gallery";
import { howToPlay } from "@/content/games";
import { playsShort, playsWord } from "@/lib/format";
import { countPlay, galleryPage, galleryQuery, type GalleryView } from "@/lib/gallery";
import { posterUrl } from "@/lib/urls";

const noop = () => () => {};
const useCanShare = () => useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);

/** Figures joined with a dot; each one keeps its words together, so a narrow line breaks only between them. */
const figures = (parts: (string | null)[]) =>
  parts
    .filter((p): p is string => !!p)
    .map((p) => p.replace(/ /g, "\u00a0"))
    .join(" · ");
/** The plays the order is about: this week's on Popular (what it sorts by), all of them otherwise. */
const playsIn = (g: GalleryGame, sort: GallerySort) => (sort === "popular" ? g.playsWeek : g.plays);
/** The plays in words ("12 plays this week", "1.2K plays"); none said when there are none, as everywhere plays show. */
const playsWords = (n: number, sort: GallerySort) => (n === 0 ? null : sort === "popular" ? `${playsWord(n)} this week` : playsWord(n));
const genreOf = (g: GalleryGame) => (g.genre ? genreName[g.genre] : null);
const gamesWord = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "game" : "games"}`;
/** The search as the API takes it: spaces tidied, 60 letters at most. */
const tidy = (text: string) => [...text.replace(/\s+/g, " ").trim()].slice(0, 60).join("").trim();

/** "Make your own game.": beside an upright top game (as on an upright share page), or at the end (`wide`);
 * `narrowOnly`: at the end only where nothing can sit beside the stage (a lone upright game). */
export function Invite({ wide = false, narrowOnly = false }: { wide?: boolean; narrowOnly?: boolean }) {
  return <MakeYourOwn id={useId()} wide={wide} narrowOnly={narrowOnly} />;
}

/**
 * The gallery under its head: the week's most played game in its frame, ready to play; then the library, every game in
 * the gallery as cards (Popular / New / All, a genre, a search; 24 at a time, Show more for the next), when there is more
 * than that one game; then the invitation.
 */
export function ExploreGames({
  top,
  gallery,
  genres,
  view,
  first,
}: {
  top: GalleryGame;
  /** Games in the whole gallery. */
  gallery: number;
  genres: Partial<Record<Genre, number>>;
  /** What the address asked the library to show. */
  view: Required<GalleryView>;
  /** Its first page; null when the API didn't give it (the library asks again). */
  first: GalleryPage | null;
}) {
  const report = useRef<ReportHandle>(null);
  const library = gallery > 1;
  return (
    <>
      <div className="explore__top" data-orientation={top.orientation}>
        <Featured key={top.id} game={top} onReport={() => report.current?.open(top)} />
        {/* Beside an upright top game on a wide screen (CSS hides it on narrow ones); the page ends on it too. */}
        {top.orientation === "portrait" && <Invite />}
      </div>
      {library && <Library gallery={gallery} genres={genres} start={view} first={first} onReport={(g) => report.current?.open(g)} />}
      {/* A lone upright game has its invitation beside it on a wide screen: at the end only on a narrow one. */}
      <Invite wide narrowOnly={top.orientation === "portrait" && !library} />
      <ReportDialog ref={report} />
    </>
  );
}

type Shown = { games: GalleryGame[]; next: string | null; total: number };
const shownOf = (page: GalleryPage): Shown => ({ games: page.games, next: page.next, total: page.total ?? page.games.length });

/**
 * Every game, as cards: the order (Popular / New / All), the genres that have games, and a search by name, all changing
 * the cards in place (the address follows, so a reload or a shared link shows the same). A newer choice drops the answer
 * to an older one; the cards there stay, dimmed, until the new ones arrive.
 */
function Library({
  gallery,
  genres,
  start,
  first,
  onReport,
}: {
  gallery: number;
  genres: Partial<Record<Genre, number>>;
  start: Required<GalleryView>;
  first: GalleryPage | null;
  onReport: (game: GalleryGame) => void;
}) {
  const [view, setView] = useState(start);
  const [text, setText] = useState(start.q);
  const [shown, setShown] = useState<Shown | null>(first && shownOf(first));
  const [busy, setBusy] = useState<"list" | "more" | null>(null);
  const [error, setError] = useState<{ on: "list" | "more"; message: string } | null>(first ? null : { on: "list", message: "We can't load these games right now." });
  // Said to screen readers when the cards change (they change below the focus).
  const [said, setSaid] = useState("");
  const latest = useRef(start);
  const pending = useRef<AbortController | null>(null);
  const typing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = async (v: Required<GalleryView>, cursor?: string) => {
    pending.current?.abort();
    const ask = new AbortController();
    pending.current = ask;
    setBusy(cursor ? "more" : "list");
    setError(null);
    try {
      const page = await galleryPage(v, cursor, ask.signal);
      if (ask.signal.aborted) return;
      if (!cursor) {
        setShown(shownOf(page));
        setSaid(page.games.length ? gamesWord(page.total ?? page.games.length) : "No games match.");
      } else {
        // Popular moves while people play: a game that changed pages meanwhile shows once. (A newer choice drops this
        // answer, so the cards on screen are still the ones this page follows.)
        const now = shown?.games ?? [];
        const fresh = page.games.filter((g) => !now.some((x) => x.id === g.id));
        setShown({ games: [...now, ...fresh], next: page.next, total: shown?.total ?? now.length + fresh.length });
        setSaid(`${fresh.length} more ${fresh.length === 1 ? "game" : "games"}${page.next ? "" : ", the last of them"}.`);
      }
    } catch (e) {
      if (ask.signal.aborted) return;
      setError({ on: cursor ? "more" : "list", message: e instanceof Error ? e.message : String(e) });
    } finally {
      if (pending.current === ask) {
        pending.current = null;
        setBusy(null);
      }
    }
  };

  /** Shows `next` in place and puts it in the address (replacing it: the Back button still leaves the page). */
  const show = (next: Required<GalleryView>) => {
    latest.current = next;
    setView(next);
    const query = galleryQuery(next);
    window.history.replaceState(null, "", query ? `/explore?${query}` : "/explore");
    void load(next);
  };
  const onText = (value: string) => {
    setText(value);
    clearTimeout(typing.current);
    // A quarter second after the last letter: one search per pause, not per key.
    typing.current = setTimeout(() => {
      const q = tidy(value);
      if (q !== latest.current.q) show({ ...latest.current, q });
    }, 250);
  };
  const clearSearch = () => {
    setText("");
    clearTimeout(typing.current);
    if (latest.current.q) show({ ...latest.current, q: "" });
  };
  // A page left mid-search or mid-load: the timer and the request go with it.
  useEffect(
    () => () => {
      clearTimeout(typing.current);
      pending.current?.abort();
    },
    [],
  );

  const genreList = (Object.keys(genreName) as Genre[]).filter((g) => (genres[g] ?? 0) > 0);
  const filtered = !!view.genre || !!view.q;
  const games = shown?.games ?? [];
  const where = view.genre ? ` in ${genreName[view.genre]}` : "";

  return (
    <section className="library" aria-labelledby="library-title">
      <div className="library__head">
        <h2 id="library-title" className="title library__title">
          Every game.
        </h2>
        <p className="figures library__count" aria-hidden={!shown || undefined}>
          {shown ? (filtered ? `${shown.total.toLocaleString("en-US")} of ${gamesWord(gallery)}` : gamesWord(shown.total)) : "\u00a0"}
        </p>
        <SearchField
          id="library-search"
          label="Search games by name"
          placeholder="Search games"
          value={text}
          maxLength={60}
          onChange={(e) => onText(e.target.value)}
          onClear={clearSearch}
          className="library__search"
        />
      </div>
      {/* The genres narrow the cards (left), the order sorts them (at the row's end): two choices, kept apart. */}
      <div className="library__filters">
        {genreList.length > 0 && (
          <PillChoice
            apart
            label="Genre"
            value={view.genre ?? "any"}
            onChange={(g) => show({ ...latest.current, genre: g === "any" ? null : g })}
            options={[{ value: "any" as const, label: "Any genre" }, ...genreList.map((g) => ({ value: g, label: genreName[g] }))]}
            className="library__genres"
          />
        )}
        <PillChoice
          label="Order"
          value={view.sort}
          onChange={(sort) => show({ ...latest.current, sort })}
          options={sorts.map((s) => ({ value: s.id, label: s.name }))}
          className="library__sort"
        />
      </div>

      {games.length > 0 ? (
        <ul className="explore__grid library__grid" aria-busy={busy === "list" || undefined} aria-labelledby="library-title">
          {games.map((g) => (
            <Listing key={g.id} game={g} sort={view.sort} onReport={() => onReport(g)} />
          ))}
        </ul>
      ) : shown && !error ? (
        <div className="widget library__none" aria-busy={busy === "list" || undefined}>
          <p className="library__none-title">{view.q ? `No game names match “${view.q}”${where}.` : `No games${where} yet.`}</p>
          <Button
            look="quiet"
            onClick={() => {
              setText("");
              clearTimeout(typing.current);
              show({ ...latest.current, genre: null, q: "" });
            }}
          >
            Show every game
          </Button>
        </div>
      ) : null}

      <p className="sr-only" role="status">
        {said}
      </p>
      {(shown?.next || error) && (
        <div className="explore__next">
          {error?.message && <ErrorLine tone="sky">{error.message}</ErrorLine>}
          {error && (error.on === "list" || !shown) ? (
            <Button look="quiet" busy={busy === "list"} busyLabel="Loading…" onClick={() => void load(latest.current)}>
              Try again
            </Button>
          ) : (
            shown?.next && (
              <>
                <Button look="quiet" busy={busy === "more"} busyLabel="Loading…" onClick={() => void load(latest.current, shown.next ?? undefined)}>
                  {error ? "Try again" : "Show more games"}
                </Button>
                <p className="figures library__shown">
                  {shown.games.length.toLocaleString("en-US")} of {shown.total.toLocaleString("en-US")}
                </p>
              </>
            )
          )}
        </div>
      )}
    </section>
  );
}

/** The top game: the share page's ink stage, its frame beside its words; a play counts once per page view. */
function Featured({ game, onReport }: { game: GalleryGame; onReport: () => void }) {
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
        <p className="figures feature__figures">{figures([playsWords(game.playsWeek, "popular"), genreOf(game)])}</p>
        <div className="feature__actions">
          <FullScreenPill ref={full} onClick={() => frame.current?.fullscreen()} />
          <InkPill icon={<ShareNetwork size={18} weight="bold" aria-hidden="true" />} onClick={share}>
            {canShare ? "Share…" : copied ? "Copied" : "Copy link"}
          </InkPill>
        </div>
        <div className="play__foot feature__foot">
          <p className="play__how">{howToPlay}</p>
          <ReportGameButton onClick={onReport} />
        </div>
      </div>
    </section>
  );
}

/** A game as a store listing: its start screen, its name and its figures; the whole card opens its page. */
function Listing({ game, sort, onReport }: { game: GalleryGame; sort: GallerySort; onReport: () => void }) {
  const n = playsIn(game, sort);
  const words = playsWords(n, sort);
  const genre = genreOf(game);
  return (
    <GameCard
      name={game.name}
      label={`Play ${game.name}`}
      href={`/play/${game.id}`}
      orientation={game.orientation}
      picture={<GameTile id={game.id} name={game.name} building={false} poster={game.poster ? posterUrl(game.buildId) : null} fill />}
    >
      {(words || genre) && (
        <p className="figures glist__meta">
          {words && <PlayCount count={playsShort(n)} words={words} />}
          {genre && <span>{genre}</span>}
        </p>
      )}
      {/* In the picture's top corner, above the card's link: the figures below get the card's whole width. */}
      <IconButton look="scrim" label={`Report ${game.name}`} className="glist__report" onClick={onReport}>
        <Flag size={16} weight="bold" aria-hidden="true" />
      </IconButton>
    </GameCard>
  );
}
