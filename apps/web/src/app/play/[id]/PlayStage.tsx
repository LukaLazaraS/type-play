"use client";

import { Fragment, useCallback, useRef, type ReactNode } from "react";
import type { Orientation } from "@typeplay/shared";
import { FullScreenPill, GameFrame, type GameFrameHandle } from "@/components/GameFrame";
import { ReportDialog, type ReportHandle } from "@/components/app/ReportDialog";
import { ReportGameButton } from "@/components/app/ReportGameButton";
import { howToPlay } from "@/content/games";
import { playsWord } from "@/lib/format";
import { countPlay } from "@/lib/gallery";

/**
 * A figures line's parts, each a box of its own with its dot (app.css ".play__part"): the line breaks between parts,
 * after a dot, so no line starts with one. A part wider than the line (a long genre at large text on a phone) wraps at
 * its own spaces, its dot kept on its last word. Empty parts are left out.
 */
function Parts({ parts }: { parts: ReactNode[] }) {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== "");
  return shown.map((part, i) => (
    <Fragment key={i}>
      <span className="play__part">
        {part}
        {i < shown.length - 1 && "\u00a0·"}
      </span>
      {i < shown.length - 1 && " "}
    </Fragment>
  ));
}

/** A date the page shows: the words ("12 Nov 2026") and the day for <time> ("2026-11-12"). */
export type ShownDate = { text: string; iso: string };

/** The shared game in its frame: the name, its genre, Made with TypePlay and its plays, while it is in the gallery when
 * it went in and was last changed, Play, Full screen outside the game, and Report this game. The game's first start on
 * this page view counts one play. */
export function PlayStage({
  id,
  buildId,
  name,
  orientation,
  fits,
  poster,
  plays,
  genre,
  dates,
}: {
  id: string;
  buildId: string;
  name: string;
  orientation: Orientation;
  /** It fills every screen: no turn-your-phone hint. */
  fits: boolean;
  poster?: string;
  plays: number;
  /** Its genre's name ("Tower defence"), or null. */
  genre?: string | null;
  /** A gallery game's dates (server-rendered): in the gallery since, and updated when a later day. None on a link-only
   * page. */
  dates?: { listed: ShownDate; updated: ShownDate | null } | null;
}) {
  const frame = useRef<GameFrameHandle>(null);
  const full = useRef<HTMLButtonElement>(null);
  const report = useRef<ReportHandle>(null);
  const counted = useRef(false);
  const onReady = useCallback(() => {
    if (counted.current) return; // Try again, or a new frame after an error: still one play per page view
    counted.current = true;
    countPlay(id);
  }, [id]);
  return (
    <section className="widget widget--ink play__stage" aria-labelledby="play-name">
      <header className="play__bar">
        <div className="play__titles">
          <h1 id="play-name" className="title play__name">
            {name}
          </h1>
          <p className="figures play__by">
            <Parts parts={[genre, "Made with TypePlay", plays > 0 ? playsWord(plays) : null]} />
          </p>
          {dates && (
            // Like the line above, each date a box of its own with its dot: whole unless it alone is wider than the line.
            <p className="figures play__dates">
              <span className="play__part">
                In the gallery since{" "}
                <span className="play__date">
                  <time dateTime={dates.listed.iso}>{dates.listed.text}</time>
                  {dates.updated && "\u00a0·"}
                </span>
              </span>
              {dates.updated && (
                <>
                  {" "}
                  <span className="play__part">
                    updated{" "}
                    <span className="play__date">
                      <time dateTime={dates.updated.iso}>{dates.updated.text}</time>
                    </span>
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <FullScreenPill ref={full} onClick={() => frame.current?.fullscreen()} />
      </header>
      <div className="play__frame" data-orientation={orientation}>
        <GameFrame ref={frame} slug={buildId} poster={poster} name={name} orientation={orientation} fits={fits} mode="click" onReady={onReady} returnFocus={full} />
      </div>
      <div className="play__foot">
        <p className="play__how">{howToPlay}</p>
        <ReportGameButton onClick={() => report.current?.open({ id, name })} />
      </div>
      <ReportDialog ref={report} />
    </section>
  );
}
