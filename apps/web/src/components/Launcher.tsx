"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowSquareOut, ArrowsOut } from "@phosphor-icons/react";
import type { Game } from "@/content/games";
import { DRAFT_EVENT } from "./PromptForm";
import { GameFrame, playUrl, type GameFrameHandle } from "./GameFrame";

type LauncherState = {
  game: Game | null;
  open: (game: Game, from?: HTMLElement | null) => void;
  close: () => void;
};

const Ctx = createContext<LauncherState | null>(null);

export function useLauncher() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLauncher needs <LauncherProvider>");
  return ctx;
}

export function LauncherProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<Game | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const open = useCallback((g: Game, from?: HTMLElement | null) => {
    returnTo.current = from ?? (document.activeElement as HTMLElement | null);
    setGame(g);
  }, []);
  const close = useCallback(() => {
    setGame(null);
    const el = returnTo.current;
    if (el) requestAnimationFrame(() => el.focus());
  }, []);

  useEffect(() => {
    if (!game) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [game, close]);

  const value = useMemo(() => ({ game, open, close }), [game, open, close]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <LauncherOverlay />
    </Ctx.Provider>
  );
}

const ease = [0.23, 1, 0.32, 1] as const;

function LauncherOverlay() {
  const { game, close } = useLauncher();
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<GameFrameHandle>(null);
  const fullRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (game) requestAnimationFrame(() => closeRef.current?.focus());
  }, [game]);

  const makeOwn = () => {
    if (!game) return;
    window.dispatchEvent(new CustomEvent(DRAFT_EVENT, { detail: game.prompt }));
    close();
    requestAnimationFrame(() => {
      const box = document.getElementById("prompt");
      box?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      (box as HTMLTextAreaElement | null)?.focus();
    });
  };

  return (
    <AnimatePresence>
      {game && (
        <motion.div
          key={game.slug}
          className="launcher"
          role="dialog"
          aria-modal="true"
          aria-label={game.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          transition={{ duration: 0.24, ease }}
        >
          <div className="launcher__bar">
            <button ref={closeRef} className="launcher__close" onClick={close} type="button">
              <ArrowLeft size={18} weight="bold" aria-hidden="true" />
              <span className="launcher__label">Home</span>
            </button>
            <span className="title launcher__title">{game.name}</span>
            <div className="launcher__actions">
              {/* Outside the game, so it never covers a game's own buttons. */}
              <button
                ref={fullRef}
                className="launcher__close"
                onClick={() => frameRef.current?.fullscreen()}
                type="button"
              >
                <ArrowsOut size={18} weight="bold" aria-hidden="true" />
                <span className="launcher__label">Full screen</span>
              </button>
              <a className="launcher__close" href={playUrl(game.slug)} target="_blank" rel="noopener">
                <span className="launcher__label">New tab</span>
                <ArrowSquareOut size={18} weight="bold" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="launcher__stage">
            <motion.div
              className="launcher__frame"
              layoutId={reduce ? undefined : `game-${game.slug}`}
              transition={{ duration: 0.32, ease }}
            >
              <GameFrame
                ref={frameRef}
                key={game.slug}
                slug={game.slug}
                poster={game.image}
                name={game.name}
                orientation={game.orientation}
                mode="click"
                onEscape={close}
                returnFocus={fullRef}
              />
            </motion.div>
          </div>
          <div className="launcher__info">
            <div>
              <q>{game.prompt}</q>
              <div className="figures">
                Built on {game.tier} in {game.minutes} min
                {game.edits ? `, then ${game.edits.length} edits by chat` : ""}
              </div>
              <p className="launcher__how">Play with keys or touch. On a phone it opens full screen.</p>
            </div>
            <button className="button" type="button" onClick={makeOwn}>
              Make my own
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
