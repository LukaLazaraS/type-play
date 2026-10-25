"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/IconButton";
import { InkPillLink } from "@/components/ui/InkPill";
import { Pulse } from "@/components/ui/Pulse";
import { watchProject } from "@/lib/api";
import { clock } from "@/lib/format";
import { ReadyLine } from "./ReadyLine";
import { useNow } from "./useNow";
import { forgetWaiting, useWaiting } from "./WhileYouWait";

/** `at`: when it was last heard of, so the clock is right before the first tick (the pill lives as long as the page). */
type Seen = { name: string; status: "running" | "ready" | "failed"; since: string | null; line: string; at: number };

/**
 * The way back from the gallery (WhileYouWait's "More in the gallery"): on every other page of this tab, a pill
 * that follows the first build ("Building your game · 1:23") and turns into "Spike Cat is ready · Play it".
 * Gone once the player is back on the game's page, or closes it.
 */
export function BuildPill() {
  const pathname = usePathname();
  const id = useWaiting();
  const away = !!id && pathname !== `/games/${id}`;
  const [seen, setSeen] = useState<Seen | null>(null);
  const now = useNow(seen?.status === "running");

  useEffect(() => {
    if (!id || !away) return;
    return watchProject(
      id,
      (e) => {
        if (e.type === "snapshot") {
          const running = e.project.messages.findLast((m) => m.role === "agent" && m.status === "running");
          setSeen({
            name: e.project.name,
            status: e.project.status === "running" ? "running" : e.project.buildId ? "ready" : "failed",
            since: running?.createdAt ?? null,
            line: "",
            at: Date.now(),
          });
        } else if (e.type === "progress") {
          setSeen((s) => (s ? { ...s, line: e.text, at: Date.now() } : s));
        } else if (e.type === "done" || e.type === "failed") {
          setSeen((s) => ({ name: e.project.name, status: e.project.buildId ? "ready" : "failed", since: s?.since ?? null, line: "", at: Date.now() }));
        }
      },
      () => {},
      // Deleted, or not this account's game: nothing to bring anyone back to.
      () => forgetWaiting(),
    );
  }, [id, away]);

  if (!id || !away || !seen) return null;
  const href = `/games/${id}`;
  // On the page itself, not inside the status bar it is mounted from (whose phone layout hides its links).
  return createPortal(
    <div className="buildpill" role="status" data-status={seen.status}>
      {seen.status === "running" ? (
        <>
          <Pulse />
          <span className="buildpill__text">
            <b>Building your game</b>
            {seen.since && (
              <span className="figures" aria-hidden="true">
                {" "}
                {clock(seen.since, Math.max(now, seen.at))}
              </span>
            )}
            {seen.line && <span className="buildpill__line">{seen.line}</span>}
          </span>
          <InkPillLink href={href} size="small" className="buildpill__back" icon={<ArrowRight size={16} weight="bold" aria-hidden="true" />} iconAfter>
            <span className="buildpill__label">Back to it</span>
          </InkPillLink>
        </>
      ) : seen.status === "ready" ? (
        <ReadyLine name={seen.name} href={href} />
      ) : (
        <>
          <span className="buildpill__text">Your game didn&apos;t build. Nothing was charged.</span>
          <InkPillLink href={href} size="small">
            See what to do
          </InkPillLink>
        </>
      )}
      <IconButton label="Hide this" className="buildpill__close" onClick={forgetWaiting}>
        <X size={16} weight="bold" aria-hidden="true" />
      </IconButton>
    </div>,
    document.body,
  );
}
