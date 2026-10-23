"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { Play } from "@phosphor-icons/react";
import type { Message, ModelChoice } from "@typeplay/shared";
import { clock, creditsWord } from "@/lib/format";

const modelName: Record<ModelChoice, string> = { fast: "Fast", smart: "Smart", best: "Best" };

export type LiveLine = { messageId: string; text: string } | null;

/** The conversation: what the player asked, what came back, and what each answer cost. */
export function ChatLog({
  messages,
  live,
  now,
  currentVersion,
  onPlay,
}: {
  messages: Message[];
  live: LiveLine;
  now: number;
  /** The version playing now: only its message offers Play (older ones have Restore). */
  currentVersion: number | null;
  /** Phones: jump to the Play tab from the message that made the current version. */
  onPlay: () => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const stick = useRef(true); // follow new messages while the reader is at the bottom

  useLayoutEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, live?.text]);

  // The list was hidden (the phone's Play tab) or the window changed size: stay at the bottom.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <ol
      ref={list}
      className="log"
      aria-label="Messages"
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
    >
      {messages.map((m) =>
        m.role === "user" ? (
          <li key={m.id} className="msg msg--you">
            <p className="bubble">{m.text}</p>
          </li>
        ) : (
          <AgentMessage key={m.id} m={m} live={live?.messageId === m.id ? live.text : null} now={now} current={m.versionN != null && m.versionN === currentVersion} onPlay={onPlay} />
        ),
      )}
    </ol>
  );
}

function AgentMessage({ m, live, now, current, onPlay }: { m: Message; live: string | null; now: number; current: boolean; onPlay: () => void }) {
  // "Fast", or "Fast, high effort" when the effort wasn't the usual medium.
  const model = m.model ? `${modelName[m.model]}${m.effort && m.effort !== "medium" ? `, ${m.effort} effort` : ""}` : null;
  if (m.status === "running") {
    return (
      <li className="msg msg--agent">
        <p className="bubble bubble--agent bubble--live" role="status">
          <span className="pulse" aria-hidden="true" />
          <span key={live ?? ""} className="bubble__line">
            {live || "Getting started"}
          </span>
        </p>
        <span className="msg__meta figures">
          {model ? `${model} · ` : ""}building {clock(m.createdAt, now)}
        </span>
      </li>
    );
  }
  const failed = m.status === "failed" || m.status === "refused";
  const cost = failed
    ? m.status === "refused"
      ? "Not made, not charged"
      : "Didn't work, not charged"
    : `${creditsWord(m.credits ?? 0)}${m.versionN ? ` · version ${m.versionN}` : ""}`;
  return (
    <li className="msg msg--agent" data-failed={failed || undefined}>
      <p className="bubble bubble--agent">{m.text || "Done."}</p>
      <span className="msg__meta figures">
        {model ? `${model} · ` : ""}
        {cost}
      </span>
      {current && !failed && (
        <button type="button" className="msg__play" onClick={onPlay}>
          <Play size={14} weight="fill" aria-hidden="true" />
          Play
        </button>
      )}
    </li>
  );
}
