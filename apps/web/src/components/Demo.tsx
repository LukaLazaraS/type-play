"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { demoClosing, demoSteps, demoWork, type DemoStep } from "@/content/demo";
import { GameFrame } from "./GameFrame";

/**
 * The live simulation: the sentence is typed, the build runs, the real first version plays;
 * then three real edits from the same game's history, each swapping in that version's build.
 */
type Line = { id: number; who: "you" | "agent"; text: string; stat?: string; typing?: boolean };

export function Demo() {
  const reduce = useReducedMotion();
  const [lines, setLines] = useState<Line[]>([]);
  const [version, setVersion] = useState<DemoStep | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const section = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const idRef = useRef(0);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const run = useCallback(async () => {
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        timers.current.push(window.setTimeout(res, reduce ? Math.min(ms, 150) : ms));
      });
    clear();
    setLines([]);
    setVersion(null);
    setDone(false);
    setRunning(true);
    const add = (line: Omit<Line, "id">) => {
      const id = ++idRef.current;
      setLines((l) => [...l, { ...line, id }]);
      return id;
    };
    const patch = (id: number, p: Partial<Line>) =>
      setLines((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));

    for (const step of demoSteps) {
      // You type.
      const id = add({ who: "you", text: "", typing: true });
      if (reduce) {
        patch(id, { text: step.text, typing: false });
      } else {
        for (let i = 1; i <= step.text.length; i++) {
          patch(id, { text: step.text.slice(0, i) });
          await wait(22);
        }
        patch(id, { typing: false });
      }
      await wait(500);
      // The agent works: real minutes, shown in seconds.
      const stages = demoWork[step.kind];
      const agentId = add({ who: "agent", text: stages[0] + "…", stat: step.tier });
      for (let s = 1; s < stages.length; s++) {
        await wait(900);
        patch(agentId, { text: stages[s] + "…" });
      }
      await wait(900);
      patch(agentId, { text: "Ready to play", stat: `took ${step.minutes} min on ${step.tier}` });
      setVersion(step);
      await wait(step.kind === "new" ? 6500 : 5500);
    }
    add({ who: "agent", text: demoClosing });
    setRunning(false);
    setDone(true);
  }, [reduce]);

  // Start when the section comes into view, once; stop the timers if the page leaves.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setStarted(true);
          void run();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clear();
    };
  }, [run]);

  return (
    <div className="widget demo" ref={section}>
      <div className="demo__chat" aria-live="polite">
        {lines.map((l) => (
          <div key={l.id} className={`bubble${l.who === "agent" ? " bubble--agent" : ""}`}>
            {l.text}
            {l.typing && <i className="caret" aria-hidden="true" />}
            {l.stat && <small>{l.stat}</small>}
          </div>
        ))}
        {!started && <div className="bubble bubble--agent">Scroll here to watch a game get built.</div>}
        {done && (
          <button type="button" className="button button--quiet demo__replay" onClick={() => void run()}>
            <ArrowCounterClockwise size={18} weight="bold" aria-hidden="true" />
            Play it again
          </button>
        )}
      </div>
      <div className="demo__stage">
        {version ? (
          <GameFrame key={version.id} slug={version.id} poster={version.poster} name="Robot Runner" mode="auto" />
        ) : (
          <div className="demo__empty">
            <span>{running ? "Building…" : "Your game appears here."}</span>
          </div>
        )}
        <div className="demo__caption">
          <b>{version ? (version.kind === "new" ? "First build" : `After: ${version.text}`) : "Robot Runner"}</b>
          <span className="figures">{version ? `${version.tier}, ${version.minutes} min` : "live, playable"}</span>
        </div>
      </div>
    </div>
  );
}
