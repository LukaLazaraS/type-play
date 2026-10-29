"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowClockwise, Play, Plus } from "@phosphor-icons/react";
import type { Message, ModelChoice, QueuePlace } from "@typeplay/shared";
import { Chip } from "@/components/ui/Chip";
import { Pressable } from "@/components/ui/Pressable";
import { Pulse } from "@/components/ui/Pulse";
import { inLine } from "@/content/app";
import { clock, creditsWord, placeWords } from "@/lib/format";

const modelName: Record<ModelChoice, string> = { fast: "Fast", smart: "Smart", best: "Best" };
/** Ideas shown at first; "More ideas" adds the rest of the 9 made under them (Luka, 10-25). */
const IDEAS_SHOWN = 3;

export type LiveLine = { messageId: string; text: string } | null;

/** The conversation: what the player asked, what came back, and what each answer cost. */
export function ChatLog({
  messages,
  live,
  queue,
  now,
  currentVersion,
  models,
  onPlay,
  onSuggest,
  onBigger,
}: {
  messages: Message[];
  live: LiveLine;
  /** The game's build waiting for its turn: its place and rough wait (the queued answer shows them). */
  queue?: QueuePlace | null;
  now: number;
  /** The version playing now: only its message offers Play (older ones have Restore). */
  currentVersion: number | null;
  /** Phones: jump to the Play tab from the message that made the current version. */
  onPlay: () => void;
  /** A next-step idea was tapped: it goes into the box, to send or change first. */
  onSuggest: (text: string) => void;
  /** The AIs the player's plan has: a stop's one tap shows only when its bigger AI is one of them. */
  models: ModelChoice[];
  /** A stop's one tap (a change too big for its AI): the same message back in the box, the bigger AI picked; never sent. */
  onBigger: (text: string, model: ModelChoice) => void;
}) {
  // The newest answer's ideas for the next change, while its version is the one playing (a restore hides them): up to
  // 9, best first. Three show; "More ideas" adds the other six under them (the first three stay where they were, so
  // an earlier idea stays in sight) and goes until the next answer.
  const last = messages.at(-1);
  const all = last?.role === "agent" && last.status === "done" && last.versionN === currentVersion ? (last.suggestions ?? []).slice(0, 9) : [];
  const [opened, setOpened] = useState<string | null>(null); // the answer whose ideas are all shown
  const allShown = !!last && opened === last.id;
  const ideas = allShown ? all : all.slice(0, IDEAS_SHOWN);
  const more = !allShown && all.length > IDEAS_SHOWN;
  // The newest answer stopped a change too big for its AI (the size check, Message.biggerModel): one tap, on the player's
  // side like the ideas, puts the message they sent back in the box with the bigger AI picked.
  const asked = messages.at(-2);
  const bigger = last?.role === "agent" && last.status === "done" && last.biggerModel && models.includes(last.biggerModel) && asked?.role === "user" ? last.biggerModel : null;
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
          <AgentMessage
            key={m.id}
            m={m}
            live={live?.messageId === m.id ? live.text : null}
            queue={queue ?? null}
            now={now}
            current={m.versionN != null && m.versionN === currentVersion}
            onPlay={onPlay}
          />
        ),
      )}
      {bigger && (
        <li key={`bigger-${last!.id}`} className="ideas">
          <div className="ideas__list">
            <Chip icon={<ArrowClockwise size={15} weight="bold" aria-hidden="true" />} onClick={() => onBigger(asked!.text, bigger)}>
              Use {modelName[bigger]} for this
            </Chip>
          </div>
        </li>
      )}
      {ideas.length > 0 && (
        <li key={`ideas-${last!.id}`} className="ideas">
          <p className="ideas__label" id="ideas-label">
            Ideas for your next change
          </p>
          <div className="ideas__list" role="group" aria-labelledby="ideas-label">
            {ideas.map((idea) => (
              <Chip key={idea} onClick={() => onSuggest(idea)}>
                {idea}
              </Chip>
            ))}
            {more && (
              <Chip
                icon={<Plus size={15} weight="bold" aria-hidden="true" />}
                onClick={(e) => {
                  const group = e.currentTarget.parentElement;
                  setOpened(last!.id);
                  // The button goes with the tap: the keyboard moves on to the first new idea, and the chat (not the
                  // page: on a phone that hid the top bar) scrolls to the end so the six new ones are in view.
                  requestAnimationFrame(() => {
                    group?.querySelectorAll<HTMLElement>(".chip")[IDEAS_SHOWN]?.focus({ preventScroll: true });
                    const el = list.current;
                    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
                    el?.scrollTo({ top: el.scrollHeight, behavior: still ? "auto" : "smooth" });
                  });
                }}
              >
                More ideas
              </Chip>
            )}
          </div>
        </li>
      )}
    </ol>
  );
}

function AgentMessage({
  m,
  live,
  queue,
  now,
  current,
  onPlay,
}: {
  m: Message;
  live: string | null;
  queue: QueuePlace | null;
  now: number;
  current: boolean;
  onPlay: () => void;
}) {
  // "Fast", or "Fast, high effort" when the effort wasn't the usual medium.
  const model = m.model ? `${modelName[m.model]}${m.effort && m.effort !== "medium" ? `, ${m.effort} effort` : ""}` : null;
  if (m.status === "queued") {
    // Nothing runs yet: the still dot, the state, and the place and rough wait under it. Not a live region: the game page
    // has one announcer for the place (GameClient), so a screen reader hears a change once, not from every panel.
    return (
      <li className="msg msg--agent">
        <p className="bubble bubble--agent bubble--live">
          <Pulse still />
          <span className="bubble__line">{inLine.state}</span>
        </p>
        <span className="msg__meta figures">
          {model ? `${model}\u00a0· ` : ""}
          {queue ? placeWords(queue) : "in the queue"}
        </span>
      </li>
    );
  }
  if (m.status === "running") {
    return (
      <li className="msg msg--agent">
        <p className="bubble bubble--agent bubble--live" role="status">
          <Pulse />
          <span key={live ?? ""} className="bubble__line">
            {live || "Getting started"}
          </span>
        </p>
        <span className="msg__meta figures">
          {model ? `${model} · ` : ""}building {clock(m.startedAt ?? m.createdAt, now)}
        </span>
      </li>
    );
  }
  const failed = m.status === "failed" || m.status === "refused";
  // A build that left the line without starting (stopped, waited too long, not allowed at its turn) never ran.
  const cost = failed
    ? m.status === "refused"
      ? "Not made, not charged"
      : m.startedAt
        ? "Didn't work, not charged"
        : "Didn't start, not charged"
    : `${creditsWord(m.credits ?? 0)}${m.versionN ? ` · version ${m.versionN}` : ""}`;
  return (
    <li className="msg msg--agent" data-failed={failed || undefined}>
      <p className="bubble bubble--agent">{m.text || "Done."}</p>
      <span className="msg__meta figures">
        {model ? `${model} · ` : ""}
        {cost}
      </span>
      {current && !failed && (
        <Pressable className="msg__play" onClick={onPlay}>
          <Play size={14} weight="fill" aria-hidden="true" />
          Play
        </Pressable>
      )}
    </li>
  );
}
