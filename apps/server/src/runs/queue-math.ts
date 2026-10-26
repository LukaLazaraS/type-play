// The build queue's arithmetic (runs/queue.service.ts), pure so test/queue-math.mjs checks it without a database: the
// order of the line and a rough wait for each build in it.
//
// The order: paid plans' builds first, first come first served; a free build lines up as if it had come `freeDelay`
// later (aging, apps/server/README.md "The build queue"). A paid build that arrives within that delay goes ahead of it;
// nothing that arrives later ever does, so every free build reaches the front, and a paid build's place never moves back.
import type { Effort, ModelChoice } from "@typeplay/shared";

export type Lane = "paid" | "free";
export type RunKind = "new" | "edit";

/**
 * Typical minutes from a build's start to its end, by what it is (the wait's only guess), at medium effort: the median wall
 * time of this PC's runs (packages/agent/runs.jsonl, 2026-10-12..24; docs/research/build-capacity-2026-10-26.md). New
 * games since 10-17, when they grew to 2-3 steps: Haiku 16.6 (15 runs), Sonnet 9.1 (21); Opus at medium about 6 per step
 * (4). Edits: Haiku 2.3 (65), Sonnet 2.0 (17), Opus at medium 2.1 (3). The live server's vCPUs are slower than this PC's
 * cores, so waits there run longer. Rough on purpose: the site says "about".
 */
export const TYPICAL_MIN: Record<RunKind, Record<ModelChoice, number>> = {
  new: { fast: 17, smart: 9, best: 7 },
  edit: { fast: 2.5, smart: 2, best: 2 },
};
/** Where high effort was measured to run much longer: Opus, new games 20 min (32 runs), edits 38.7 (7). Elsewhere the
 * effort moved the time less than the runs vary, so the medium figure stands. */
const HIGH_EFFORT_MIN: Partial<Record<RunKind, Partial<Record<ModelChoice, number>>>> = { new: { best: 20 }, edit: { best: 39 } };
/** A build past its typical length can end any moment, or run on: count a minute more. */
const LAST_MINUTE_MS = 60_000;

export const typicalMs = (kind: RunKind, model: ModelChoice, effort: Effort = "medium") =>
  ((effort === "high" ? HIGH_EFFORT_MIN[kind]?.[model] : undefined) ?? TYPICAL_MIN[kind][model]) * 60_000;

/** When a build's turn is: a paid build's when it was queued, a free one's `freeDelayMs` later. */
export const turnAtOf = (queuedAt: number, lane: Lane, freeDelayMs: number) => queuedAt + (lane === "free" ? freeDelayMs : 0);

export interface Waiting {
  id: string;
  turnAt: number;
  queuedAt: number;
  kind: RunKind;
  model: ModelChoice;
  effort?: Effort;
}

/** The line in order: by turn, then by when it was queued, then by id (builds queued in the same millisecond keep one order). */
export function inLine<T extends Waiting>(waiting: Iterable<T>): T[] {
  return [...waiting].sort((a, b) => a.turnAt - b.turnAt || a.queuedAt - b.queuedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** A build holding builders now: an agent run (one) or an Android build (two, `units`). */
export interface Going {
  /** When it should end (ms). */
  endsAt: number;
  units: number;
}

/** A run going now: it should end its typical length after it started, and at least a minute from now. */
export const runEndsAt = (startedAt: number, kind: RunKind, model: ModelChoice, now: number, effort: Effort = "medium") =>
  Math.max(startedAt + typicalMs(kind, model, effort), now + LAST_MINUTE_MS);

/**
 * Rough waits (ms from now) for the line, in its order: each waiting build takes the first builder to come free (list
 * scheduling). `slots` builders in all (MAX_RUNS); the builds going now hold theirs until they should end, and each
 * waiting build holds one for its typical length once it starts.
 */
export function waits(line: Waiting[], going: Going[], slots: number, now: number): number[] {
  const builders = Math.max(1, slots);
  // When each builder comes free: the ones nobody holds now, then one per unit as the builds going end (with more units
  // held than there are builders, as after MAX_RUNS was lowered, the first ends free none).
  const ends = going.flatMap((g) => Array<number>(Math.max(0, g.units)).fill(g.endsAt)).sort((a, b) => a - b);
  const free: number[] = Array<number>(Math.max(0, builders - ends.length)).fill(now);
  free.push(...ends.slice(Math.max(0, ends.length - builders)));
  return line.map((w) => {
    let at = 0;
    for (let i = 1; i < free.length; i++) if (free[i] < free[at]) at = i;
    const start = Math.max(now, free[at]);
    free[at] = start + typicalMs(w.kind, w.model, w.effort);
    return start - now;
  });
}

/** A wait as the site says it: whole minutes, at least one. */
export const waitMinutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));
