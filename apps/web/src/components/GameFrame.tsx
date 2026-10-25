"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { Play, X } from "@phosphor-icons/react";
import { site } from "@/content/site";
import type { Orientation } from "@/content/games";
import { RotateHint } from "./RotateHint";

/** `quiet`: a Free build's mark starts small, without its few seconds of "Made with" (play.html `mark=quiet`). */
export const playUrl = (slug: string, auto = false, quiet = false) =>
  `${site.gamesOrigin}/play.html?g=${encodeURIComponent(slug)}${auto ? "&auto=1" : ""}${quiet ? "&mark=quiet" : ""}`;


const gamesOrigin = new URL(site.gamesOrigin).origin;

// Phones and tablets: no hover, a finger for a pointer. Play opens them full screen.
const TOUCH = "(hover: none) and (pointer: coarse)";
const PORTRAIT = "(orientation: portrait)";

const subscribePortrait = (onChange: () => void) => {
  const mq = window.matchMedia(PORTRAIT);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const isPortrait = () => window.matchMedia(PORTRAIT).matches;
const isPortraitOnServer = () => false;

// Fullscreen with the prefixed API that older iPad Safari still needs. iPhone Safari has neither
// for anything but video, so it gets the fixed layer instead.
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };
type LockableOrientation = ScreenOrientation & { lock?: (o: Orientation) => Promise<void> };

const fsDoc = () => document as FsDocument;
const fullscreenElement = () => fsDoc().fullscreenElement ?? fsDoc().webkitFullscreenElement ?? null;

function requestFullscreen(el: FsElement): Promise<void> {
  const d = fsDoc();
  if (el.requestFullscreen && d.fullscreenEnabled) {
    return Promise.resolve(el.requestFullscreen({ navigationUI: "hide" }));
  }
  if (el.webkitRequestFullscreen && d.webkitFullscreenEnabled) {
    return new Promise((resolve, reject) => {
      const done = (ok: boolean) => {
        d.removeEventListener("webkitfullscreenchange", onChange);
        d.removeEventListener("webkitfullscreenerror", onError);
        window.clearTimeout(timer);
        if (ok) resolve();
        else reject(new Error("full screen refused"));
      };
      const onChange = () => done(fullscreenElement() === el);
      const onError = () => done(false);
      const timer = window.setTimeout(() => done(false), 1500);
      d.addEventListener("webkitfullscreenchange", onChange);
      d.addEventListener("webkitfullscreenerror", onError);
      el.webkitRequestFullscreen!();
    });
  }
  return Promise.reject(new Error("no full screen here"));
}

function exitFullscreen() {
  const d = fsDoc();
  if (d.exitFullscreen) d.exitFullscreen().catch(() => {});
  else d.webkitExitFullscreen?.();
}

// Android turns the screen for us; iOS and desktop refuse, which is fine: the hint covers it.
function lockOrientation(to: Orientation): Promise<void> {
  try {
    const o = screen.orientation as LockableOrientation | undefined;
    return o?.lock ? o.lock(to).catch(() => {}) : Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}
function unlockOrientation() {
  try {
    screen.orientation?.unlock();
  } catch {
    // not locked, or no API
  }
}

/** What a parent can do with the frame: its own Full screen control calls this, in the click. */
export type GameFrameHandle = { fullscreen: () => void };

type Immersive = "fullscreen" | "layer" | null;

const focusRef = (r?: RefObject<HTMLElement | null>) => r?.current?.focus({ preventScroll: true });
type Leave = "control" | "key" | "back" | "browser";

/**
 * A playable game on the games origin, inside the site. Shows the poster until the engine runs.
 * `mode="click"` waits for a Play press (the launcher); `mode="auto"` loads at once (the demo).
 *
 * Immersive: on a phone or tablet, Play opens the game full screen and locks it to the game's
 * orientation; where the browser has no full screen (iPhone), a fixed layer covers the page and
 * the back gesture closes it. A rotate hint shows while the phone is held the other way. Leaving
 * keeps the game running in the frame. The way back in (and desktop's way in) is the parent's
 * Full screen control, outside the game, so it never covers a game's own buttons.
 */
export function GameFrame({
  slug,
  poster,
  name,
  mode = "click",
  autoStart = false,
  orientation = "landscape",
  fits = false,
  fullscreen = mode === "click",
  onReady,
  onEscape,
  returnFocus,
  notice,
  ref,
}: {
  slug: string;
  /** The game's screenshot until the engine runs. Users' games have none: the frame shows its backdrop. */
  poster?: string;
  name: string;
  mode?: "click" | "auto";
  /** Click mode, but already playing: a new version of a game the player has started (the app). */
  autoStart?: boolean;
  orientation?: Orientation;
  /** The game fills every screen (platform "fill"): played either way up, so no lock and no turn-your-phone hint. */
  fits?: boolean;
  /** Offer full screen. Off for the demo, whose frame is swapped every few seconds. */
  fullscreen?: boolean;
  onReady?: (slug: string) => void;
  /** Escape pressed inside the game while it is not full screen (the launcher closes). */
  onEscape?: () => void;
  /** Focused after the close control is used: the parent's Full screen control. */
  returnFocus?: RefObject<HTMLElement | null>;
  /** Shown over the game while it is full screen, where the page around it can't be seen (the app: "Your game is ready"). */
  notice?: ReactNode;
  ref?: Ref<GameFrameHandle>;
}) {
  // Parents pass key={slug}, so a new game mounts a fresh frame.
  const [playing, setPlaying] = useState(mode === "auto" || autoStart);
  const [ready, setReady] = useState(false);
  // The loader said the game couldn't load (play.html's "error"): Try again mounts a fresh frame.
  const [failed, setFailed] = useState(false);
  // A poster that doesn't load (gone from the games origin) shows the frame's backdrop, not a broken picture.
  const [posterGone, setPosterGone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [immersive, setImmersive] = useState<Immersive>(null);
  const [byTouch, setByTouch] = useState(false);
  // The orientation lock has answered: no hint flashes in the moment before Android turns.
  const [settled, setSettled] = useState(false);
  const [stay, setStay] = useState(false); // the player chose to keep the phone as it is
  const portrait = useSyncExternalStore(subscribePortrait, isPortrait, isPortraitOnServer);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  // What the event listeners need, without re-subscribing on every change.
  const live = useRef({ immersive: null as Immersive, pushed: false, leftAt: 0, refocus: false });

  const setMode = useCallback((m: Immersive) => {
    live.current.immersive = m;
    setImmersive(m);
  }, []);

  const focusGame = useCallback(() => {
    const f = frame.current;
    if (!f) return;
    f.focus({ preventScroll: true });
    f.contentWindow?.postMessage("typeplay:focus", gamesOrigin);
  }, []);

  const leave = useCallback(
    (how: Leave) => {
      const s = live.current;
      const was = s.immersive;
      if (!was) return;
      setMode(null);
      s.leftAt = performance.now();
      // Focus goes back to the parent's Full screen control. Leaving the browser's full screen
      // drops focus on the way out, so that case focuses once the exit has happened.
      const refocus = how === "control";
      if (was === "fullscreen" && fullscreenElement()) {
        s.refocus = refocus;
        exitFullscreen();
      } else if (refocus) {
        requestAnimationFrame(() => focusRef(returnFocus));
      }
      if (was === "layer" && s.pushed) {
        s.pushed = false;
        if (how !== "back") history.back(); // drop the entry the layer pushed
      }
      unlockOrientation();
    },
    [setMode, returnFocus],
  );

  // Must run inside the click: browsers only grant full screen to a user gesture.
  const enter = useCallback(
    (touch: boolean) => {
      const el = box.current;
      if (!el || live.current.immersive) return;
      setByTouch(touch);
      setSettled(!touch);
      requestFullscreen(el)
        .then(() => {
          setMode("fullscreen");
          if (touch && !fits) void lockOrientation(orientation).finally(() => setSettled(true));
          else if (touch) setSettled(true);
          else focusGame();
        })
        .catch(() => {
          // No full screen (iPhone) or refused: cover the page instead, and let Back close it.
          setMode("layer");
          setSettled(true);
          history.pushState({ typeplay: "playing" }, "");
          live.current.pushed = true;
          if (!touch) focusGame();
        });
    },
    [orientation, fits, setMode, focusGame],
  );

  const play = () => {
    setPlaying(true);
    if (fullscreen && window.matchMedia(TOUCH).matches) enter(true);
  };

  // Full screen from outside, before or after Play: starts the game if needed.
  useImperativeHandle(
    ref,
    () => ({
      fullscreen: () => {
        setPlaying(true);
        enter(window.matchMedia(TOUCH).matches);
      },
    }),
    [enter],
  );

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.game !== slug) return;
      if (e.data.typeplay === "ready") {
        setReady(true);
        setFailed(false);
        onReady?.(slug);
        // Desktop: the keyboard works at once, without a click into the game first.
        if (mode === "click" && !window.matchMedia(TOUCH).matches) focusGame();
      }
      // The loader couldn't load the game (gone from the games origin, the engine download dropped).
      if (e.data.typeplay === "error") {
        setFailed(true);
        setReady(false);
        if (live.current.immersive) leave("control");
      }
      // play.html passes Escape up, since the game holds the keyboard focus. One press steps
      // back one level: out of full screen, else out of the launcher.
      if (e.data.typeplay === "escape") {
        const s = live.current;
        if (s.immersive) leave("key");
        else if (performance.now() - s.leftAt > 500) onEscape?.();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [slug, onReady, onEscape, mode, focusGame, leave]);

  useEffect(() => {
    if (!fullscreen) return;
    const s = live.current;
    // Escape leaves full screen only; it must not also close the launcher behind it. The browser
    // may exit its full screen before the key arrives, hence the short grace after leaving.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!s.immersive && performance.now() - s.leftAt > 500) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      leave("key");
    };
    // Esc, Android back, or the browser's own exit.
    const onFullscreen = () => {
      if (fullscreenElement() === box.current) {
        if (s.immersive !== "fullscreen") setMode("fullscreen");
      } else if (s.immersive === "fullscreen") {
        leave("browser");
      } else if (s.refocus) {
        s.refocus = false;
        focusRef(returnFocus);
      }
    };
    // The back gesture closes the layer instead of leaving the page.
    const onPop = () => {
      if (s.pushed && s.immersive === "layer") leave("back");
    };
    const el = box.current;
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("webkitfullscreenchange", onFullscreen);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("webkitfullscreenchange", onFullscreen);
      window.removeEventListener("popstate", onPop);
      if (el && fullscreenElement() === el) exitFullscreen();
    };
  }, [fullscreen, leave, setMode, returnFocus]);

  const hint = immersive !== null && byTouch && settled && !stay && !fits && (orientation === "portrait") !== portrait;

  return (
    <div
      ref={box}
      className="gameframe"
      data-ready={ready || undefined}
      data-immersive={immersive ?? undefined}
      // A game that fills every screen takes the whole screen either way up: no letterbox (globals.css).
      data-orientation={fits ? "any" : orientation}
    >
      <div className="gameframe__screen">
        {poster && !posterGone && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            // A picture that failed before the page woke up never fires onError for React: caught on mount too.
            ref={(img) => {
              if (img?.complete && img.naturalWidth === 0) setPosterGone(true);
            }}
            className="gameframe__poster"
            src={poster}
            alt={`${name} while playing`}
            onError={() => setPosterGone(true)}
          />
        )}
        {playing && (
          <iframe
            ref={frame}
            key={`${slug}-${attempt}`}
            className="gameframe__frame"
            // A new version of a game the player is already playing: the Free mark doesn't introduce itself again.
            src={playUrl(slug, mode === "auto", autoStart)}
            title={`${name}, playable`}
            allow="autoplay; fullscreen"
          />
        )}
      </div>
      {!playing && (
        <button type="button" className="gameframe__play" onClick={play}>
          <Play size={22} weight="fill" aria-hidden="true" />
          {/* In a narrow frame (an upright game on a phone, or in the app's stage) only "Play"
              shows; the name stays for screen readers and sits in the bar above anyway. */}
          <span className="gameframe__label">
            Play<span className="gameframe__name"> {name}</span>
          </span>
        </button>
      )}
      {hint && <RotateHint to={orientation} onStay={() => setStay(true)} />}
      {playing && !ready && !failed && <div className="gameframe__loading">Loading the game…</div>}
      {failed && (
        <div className="gameframe__loading gameframe__failed" role="alert">
          This game couldn&apos;t load.
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {immersive && notice && (
        <div className="gameframe__notice" role="status">
          {notice}
        </div>
      )}
      {immersive && (
        <button type="button" className="gameframe__exit" aria-label="Close full screen" onClick={() => leave("control")}>
          <X size={20} weight="bold" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
