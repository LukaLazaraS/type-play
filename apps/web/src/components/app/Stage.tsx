"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { AndroidLogo, ArrowSquareOut, ArrowsOut, ArrowClockwise, DeviceRotate, Play, X } from "@phosphor-icons/react";
import type { Project } from "@typeplay/shared";
import { BuildLayers } from "@/components/BuildingIcon";
import { GameFrame, playUrl, type GameFrameHandle } from "@/components/GameFrame";
import { android } from "@/content/android";
import { posterUrl } from "@/lib/urls";
import { api } from "@/lib/api";
import { clock, playsWord } from "@/lib/format";
import type { LiveLine } from "./ChatLog";
import { DeviceMenu, FILL, type Device } from "./DeviceMenu";
import { GameMenu } from "./GameMenu";
import { ShareMenu } from "./ShareMenu";
import { Versions } from "./Versions";
import { useWaitGames, WhileYouWait, type WaitGame } from "./WhileYouWait";

/** Phones and tablets, as GameFrame decides it: a game started there opens full screen. */
const TOUCH = "(hover: none) and (pointer: coarse)";

/** Room kept around a device's drawn bezel (the widest, a tablet's, is 16 px). */
const BEZEL = 16;

/** The game side of the game page: the playable frame, or the build on its way, and the versions. */
export function Stage({
  project,
  live,
  now,
  played,
  onPlayed,
  onRestore,
  onRetry,
  onChange,
  android: androidOn,
}: {
  project: Project;
  live: LiveLine;
  now: number;
  /** The player has started this game once: new versions start playing by themselves. */
  played: boolean;
  onPlayed: () => void;
  onRestore: (n: number) => Promise<void>;
  /** No version yet and nothing running: build the first sentence again. */
  onRetry: (() => Promise<void>) | null;
  /** A rename or a share changed the project. */
  onChange: (p: Project) => void;
  /** This server builds Android apps (Me.features.android): the Android pill shows. */
  android: boolean;
}) {
  const frame = useRef<GameFrameHandle>(null);
  // The error of the last Try again, shown only while nothing has happened since (no new message).
  const [retryError, setRetryError] = useState<{ text: string; after: number } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const full = useRef<HTMLButtonElement>(null);
  const running = project.status === "running";
  const runningMessage = running ? [...project.messages].reverse().find((m) => m.role === "agent" && m.status === "running") : undefined;
  const nextN = (project.versions.reduce((n, v) => Math.max(n, v.n), 0) || 0) + 1;

  // While the first build runs: another game playing in the stage, picked from WhileYouWait.
  const firstBuild = running && !project.buildId;
  const waitGames = useWaitGames(project.messages.find((m) => m.role === "user")?.text ?? "", firstBuild);
  const [waiting, setWaiting] = useState<WaitGame | null>(null);
  const ready = !!waiting && !running && !!project.buildId; // the build finished while they played
  const [startOwn, setStartOwn] = useState(false); // "Play it": their game starts at once
  const [goFull, setGoFull] = useState(0);
  // A phone plays full screen (as GameFrame's own Play does): asked right after the tap that picked the game.
  useEffect(() => {
    if (goFull && window.matchMedia(TOUCH).matches) frame.current?.fullscreen();
  }, [goFull]);
  const playOwn = () => {
    setWaiting(null);
    setStartOwn(true);
  };
  // The preview's device (Luka, 10-24): the game at a phone's, a tablet's or a computer's own screen size, or filling
  // the stage (as before, the default). It is the same frame, resized: the game keeps running and fits itself to the
  // new size, as it would on that screen.
  const screen = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<Device>(FILL);
  const [turned, setTurned] = useState<boolean | null>(null); // null: the game's own way up
  const turns = device.kind !== "computer"; // phones and tablets
  const sideways = turns && (turned ?? (waiting?.orientation ?? project.orientation) === "landscape");
  const [room, setRoom] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = screen.current;
    if (!el || !device.size) return;
    const ro = new ResizeObserver(() => setRoom({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);
  const size = device.size && (sideways ? { w: device.size.h, h: device.size.w } : device.size);
  // Drawn smaller when the stage is smaller than the screen; the game still runs at the device's size.
  const scale = size && room ? Math.min(1, (room.w - 32 - 2 * BEZEL) / size.w, (room.h - 2 * BEZEL) / size.h) : 0;
  const screenAt = size && scale > 0 ? { ...size, scale } : null;
  const fitProps = {
    className: "stage__fit",
    "data-view": screenAt ? device.kind : undefined,
    style: screenAt ? { width: screenAt.w * screenAt.scale, height: screenAt.h * screenAt.scale } : undefined,
  };
  const frameProps = (orientation: Project["orientation"]) => ({
    className: "stage__frame",
    "data-orientation": orientation,
    "data-view": screenAt ? device.kind : undefined,
    style: screenAt ? ({ "--w": `${screenAt.w}px`, "--h": `${screenAt.h}px`, "--s": screenAt.scale } as CSSProperties) : undefined,
  });

  const readyLine = (
    <>
      <span className="readyline">
        <b>{project.name}</b>
        <span>&nbsp;is ready.</span>
      </span>
      <button type="button" className="button button--small" onClick={playOwn}>
        <Play size={16} weight="fill" aria-hidden="true" />
        Play it
      </button>
    </>
  );

  return (
    <section className="stage" aria-label="Your game">
      <header className="stage__bar">
        {renaming ? (
          <RenameForm project={project} onDone={() => setRenaming(false)} onChange={onChange} />
        ) : (
          <>
            <h1 className="title stage__name" title={project.name}>
              {project.name}
            </h1>
            {project.currentVersion !== null && (
              <span className="figures stage__version">
                version {project.currentVersion}
                {project.plays > 0 && <> · {playsWord(project.plays)}</>}
              </span>
            )}
          </>
        )}
        <div className="stage__actions">
          {(project.buildId || waiting) && <DeviceMenu id={project.id} value={device} onChange={setDevice} />}
          {(project.buildId || waiting) && turns && (
            <button
              type="button"
              className="inkpill devicepick__turn"
              aria-label={sideways ? `Turn the ${device.kind} upright` : `Turn the ${device.kind} sideways`}
              title={sideways ? "Turn upright" : "Turn sideways"}
              onClick={() => setTurned(!sideways)}
            >
              <DeviceRotate size={18} weight="bold" aria-hidden="true" />
            </button>
          )}
          {project.buildId && <ShareMenu project={project} onChange={onChange} />}
          {project.buildId && androidOn && (
            <Link href={`/games/${project.id}/android`} className="inkpill" data-on={project.status === "exporting" || undefined} aria-label={project.status === "exporting" ? "Android: a build is running" : "Android: put it on a phone"}>
              <AndroidLogo size={18} weight="bold" aria-hidden="true" />
              <span className="inkpill__label">{android.pill}</span>
            </Link>
          )}
          {(project.buildId || waiting) && (
            <button ref={full} type="button" className="inkpill" onClick={() => frame.current?.fullscreen()}>
              <ArrowsOut size={18} weight="bold" aria-hidden="true" />
              <span className="inkpill__label">Full screen</span>
            </button>
          )}
          {project.buildId && (
            <a className="inkpill stage__newtab" href={playUrl(project.buildId)} target="_blank" rel="noopener">
              <span className="inkpill__label">New tab</span>
              <ArrowSquareOut size={18} weight="bold" aria-hidden="true" />
            </a>
          )}
          <GameMenu project={project} onRename={() => setRenaming(true)} />
        </div>
      </header>

      {/* Another game while the first build runs: the build's line, then "ready" with the way to their game. */}
      {waiting && (
        <div className="stage__busy stage__wait" role="status" data-ready={ready || undefined}>
          {running ? (
            <>
              <span className="pulse" aria-hidden="true" />
              <span className="stage__busy-text">
                Building your game: {live?.text || "getting started"}
                {runningMessage && (
                  <span className="figures" aria-hidden="true">
                    {" "}
                    {clock(runningMessage.createdAt, now)}
                  </span>
                )}
              </span>
              <button type="button" className="inkpill inkpill--small" onClick={() => setWaiting(null)}>
                <X size={16} weight="bold" aria-hidden="true" />
                Close
              </button>
            </>
          ) : ready ? (
            readyLine
          ) : (
            <>
              <span className="stage__busy-text">Your game didn&apos;t build. Nothing was charged.</span>
              <button type="button" className="inkpill inkpill--small" onClick={() => setWaiting(null)}>
                See what to do
              </button>
            </>
          )}
        </div>
      )}
      {/* Always there when a game is, so the frame keeps its size when a build starts or ends. */}
      {project.buildId && !waiting && (
        <p className="stage__busy" role="status">
          {running && (
            <>
              <span className="pulse" aria-hidden="true" />
              <span className="stage__busy-text">
                Making version {nextN}: {live?.text || "getting started"}
              </span>
            </>
          )}
          {project.status === "exporting" && (
            <>
              <span className="pulse" aria-hidden="true" />
              <span className="stage__busy-text">{android.exporting.stage}</span>
            </>
          )}
        </p>
      )}

      <div ref={screen} className="stage__screen">
        {waiting ? (
          <div {...fitProps}>
            <div {...frameProps(waiting.orientation)}>
              <GameFrame
                ref={frame}
                key={`wait-${waiting.slug}`}
                slug={waiting.slug}
                poster={waiting.poster}
                name={waiting.name}
                orientation={waiting.orientation}
                mode="click"
                autoStart
                returnFocus={full}
                notice={ready ? readyLine : undefined}
              />
            </div>
          </div>
        ) : project.buildId ? (
          <div {...fitProps}>
            <div {...frameProps(project.orientation)}>
              <GameFrame
                ref={frame}
                key={project.buildId}
                slug={project.buildId}
                poster={project.poster ? posterUrl(project.buildId) : undefined}
                name={project.name}
                orientation={project.orientation}
                mode="click"
                autoStart={played || startOwn}
                onReady={onPlayed}
                returnFocus={full}
              />
            </div>
          </div>
        ) : running ? (
          <div className="stage__empty stage__empty--wait">
            <span className="app__icon build stage__build" aria-hidden="true">
              <BuildLayers />
            </span>
            {/* Only the step is announced: the clock ticking inside the live region was read out every second. */}
            <p className="stage__line">
              <span role="status">{live?.text || "Getting started"}</span>
              {runningMessage && <span className="figures"> {clock(runningMessage.createdAt, now)}</span>}
            </p>
            <p className="stage__note">This takes a few minutes. You can leave this page: it keeps building.</p>
            <WhileYouWait
              projectId={project.id}
              games={waitGames}
              onPlay={(g) => {
                setWaiting(g);
                setGoFull((n) => n + 1);
              }}
            />
          </div>
        ) : (
          <div className="stage__empty">
            <p className="stage__line">No game yet.</p>
            <p className="stage__note">The first build didn&apos;t work. Nothing was charged. Try again, or say it in other words in the chat.</p>
            {retryError && retryError.after === project.messages.length && (
              <p className="stage__note stage__note--error" role="alert">
                {retryError.text}
              </p>
            )}
            {onRetry && (
              <button
                type="button"
                className="button"
                disabled={retrying}
                onClick={() => {
                  setRetryError(null);
                  setRetrying(true);
                  const after = project.messages.length;
                  onRetry()
                    .catch((e: Error) => setRetryError({ text: e.message, after }))
                    .finally(() => setRetrying(false));
                }}
              >
                <ArrowClockwise size={18} weight="bold" aria-hidden="true" />
                {retrying ? "Starting…" : "Try again"}
              </button>
            )}
          </div>
        )}
      </div>

      <Versions versions={project.versions} current={project.currentVersion} running={running} onRestore={onRestore} />
    </section>
  );
}

/** The name, editable in place: Enter or Save keeps it, Escape or Cancel puts it back. */
function RenameForm({ project, onDone, onChange }: { project: Project; onDone: () => void; onChange: (p: Project) => void }) {
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    const next = name.replace(/\s+/g, " ").trim();
    if (!next || next === project.name) return onDone();
    setBusy(true);
    setError(null);
    try {
      onChange(await api.update(project.id, { name: next }));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <form className="rename" onSubmit={(e) => void save(e)} noValidate>
      <label htmlFor="rename" className="sr-only">
        Name of the game
      </label>
      <input
        id="rename"
        className="rename__input"
        value={name}
        maxLength={60}
        autoFocus
        enterKeyHint="done"
        autoComplete="off"
        spellCheck={false}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onDone();
          }
        }}
        aria-describedby={error ? "rename-error" : undefined}
      />
      <button type="submit" className="button button--small" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" className="inkpill inkpill--small" disabled={busy} onClick={onDone}>
        Cancel
      </button>
      {error && (
        <p id="rename-error" className="rename__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
