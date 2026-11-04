"use client";

import { useEffect, useRef } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { InkPill } from "@/components/ui/InkPill";
import { Toast } from "@/components/ui/Toast";
import { update } from "@/content/app";

/** A press this soon after the bar or the chip shows is ignored: in a game played by tapping, a tap meant for the game can
 * land on Restart as it appears, and that would throw away the very run the bar is there to keep. */
const ARM_MS = 700;

/**
 * A version the AI made while the player was playing waits for them (Luka, 11-04: a finished change restarted his game
 * and his progress was gone): "Version 3 is ready." over the top of the game, with Restart (loads it) and Later (keeps
 * playing). After Later, the small New version chip in its place loads it any time. It never takes the focus and is not
 * a live region: the stage's line reads it out once. The stage places it; the frame shows the same one in full screen.
 */
export function UpdateBar({ n, later, onRestart, onLater }: { n: number; later: boolean; onRestart: () => void; onLater: () => void }) {
  const shownAt = useRef<number | null>(null);
  useEffect(() => {
    shownAt.current = performance.now();
  }, [n, later]);
  const restart = () => {
    if (shownAt.current !== null && performance.now() - shownAt.current >= ARM_MS) onRestart();
  };

  if (later) {
    return (
      <InkPill size="small" float className="updatebar__chip" aria-label={update.chipLabel(n)} icon={<ArrowClockwise size={16} weight="bold" aria-hidden="true" />} onClick={restart}>
        {update.chip}
      </InkPill>
    );
  }
  return (
    <Toast edge="top" className="updatebar">
      <span className="updatebar__text">{update.ready(n)}</span>
      <Button size="small" className="updatebar__go" aria-label={update.restartLabel(n)} onClick={restart}>
        <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
        {update.restart}
      </Button>
      <InkPill size="small" className="updatebar__go" aria-label={update.laterLabel} onClick={onLater}>
        {update.later}
      </InkPill>
    </Toast>
  );
}
