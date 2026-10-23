"use client";

import { useCallback, useRef } from "react";
import { ArrowsOut, Flag } from "@phosphor-icons/react";
import type { Orientation } from "@typeplay/shared";
import { GameFrame, type GameFrameHandle } from "@/components/GameFrame";
import { ReportDialog, type ReportHandle } from "@/components/app/ReportDialog";
import { playsWord } from "@/lib/format";
import { countPlay } from "@/lib/gallery";

/** The shared game in its frame: the name, Made with TypePlay and its plays, Play, Full screen outside the
 * game, and Report this game. The game's first start on this page view counts one play. */
export function PlayStage({
  id,
  buildId,
  name,
  orientation,
  poster,
  plays,
}: {
  id: string;
  buildId: string;
  name: string;
  orientation: Orientation;
  poster?: string;
  plays: number;
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
            Made with TypePlay{plays > 0 && <> · {playsWord(plays)}</>}
          </p>
        </div>
        {/* Outside the game, so it never covers the game's own buttons. */}
        <button ref={full} type="button" className="launcher__close" onClick={() => frame.current?.fullscreen()}>
          <ArrowsOut size={18} weight="bold" aria-hidden="true" />
          <span className="launcher__label">Full screen</span>
        </button>
      </header>
      <div className="play__frame" data-orientation={orientation}>
        <GameFrame ref={frame} slug={buildId} poster={poster} name={name} orientation={orientation} mode="click" onReady={onReady} returnFocus={full} />
      </div>
      <div className="play__foot">
        <p className="play__how">Play with keys or touch. On a phone it opens full screen.</p>
        <button type="button" className="play__report" onClick={() => report.current?.open({ id, name })}>
          <Flag size={16} weight="bold" aria-hidden="true" />
          Report this game
        </button>
      </div>
      <ReportDialog ref={report} />
    </section>
  );
}
