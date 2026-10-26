// Unit test of the build queue's arithmetic (src/runs/queue-math.ts), no database:
//   npm run build -w @typeplay/server && npm run test:queue -w @typeplay/server
import { inLine, runEndsAt, typicalMs, TYPICAL_MIN, turnAtOf, waitMinutes, waits } from "../dist/runs/queue-math.js";

let failures = 0;
function ok(cond, what) {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
}
const MIN = 60_000;
const DELAY = 10 * MIN;
const T0 = Date.parse("2026-10-26T12:00:00Z");
/** A waiting build queued `at` minutes after T0. */
const build = (id, lane, at, kind = "new", model = "fast") => {
  const queuedAt = T0 + at * MIN;
  return { id, lane, kind, model, queuedAt, turnAt: turnAtOf(queuedAt, lane, DELAY) };
};
const order = (builds) => inLine(builds).map((b) => b.id).join(" ");

console.log("the order: paid first, first come first served, a free build ages");
ok(order([build("f1", "free", 0), build("p1", "paid", 1)]) === "p1 f1", "a paid build a minute after a free one goes first");
ok(order([build("p2", "paid", 3), build("p1", "paid", 1), build("p3", "paid", 2)]) === "p1 p3 p2", "paid builds: first come first served");
ok(order([build("f2", "free", 4), build("f1", "free", 2)]) === "f1 f2", "free builds: first come first served");
ok(order([build("f1", "free", 0), build("p1", "paid", 9.9)]) === "p1 f1", "a paid build 9.9 minutes later still goes ahead of a free one");
ok(order([build("f1", "free", 0), build("p1", "paid", 10.1)]) === "f1 p1", "a paid build 10.1 minutes later goes behind it: the free build's turn has come");
ok(order([build("p1", "paid", 10), build("f1", "free", 0)]) === "f1 p1", "a tie on the turn goes to the one queued first (the free build)");
{
  // No starvation: a free build stays ahead of every paid build that comes after its turn, however many.
  const many = [build("f1", "free", 0), ...Array.from({ length: 50 }, (_, i) => build(`p${i}`, "paid", 10.5 + i))];
  ok(inLine(many)[0].id === "f1", "a free build is first in a line of 50 paid builds that came after its turn");
  const before = [build("f1", "free", 0), ...Array.from({ length: 5 }, (_, i) => build(`p${i}`, "paid", 1 + i))];
  ok(inLine(before).map((b) => b.id).indexOf("f1") === 5, "…and behind the 5 that came within its 10 minutes");
  // A paid build's place never moves back: a later arrival of either lane never goes ahead of a waiting paid build.
  const line = [build("p1", "paid", 5), build("f1", "free", 0)];
  ok(inLine([...line, build("p2", "paid", 6), build("f2", "free", 5.5)]).findIndex((b) => b.id === "p1") === 0, "a waiting paid build keeps its place when later builds of either lane arrive");
}
ok(order([build("b", "paid", 1), build("a", "paid", 1)]) === "a b", "the same millisecond: a stable order by id");

console.log("the rough wait");
{
  const now = T0;
  // 4 builders, all free: no wait for the first four, the fifth waits for the first to end.
  const line = ["a", "b", "c", "d", "e"].map((id, i) => build(id, "paid", i / 100, "edit", "fast"));
  const w = waits(line, [], 4, now);
  ok(w.slice(0, 4).every((ms) => ms === 0) && w[4] === TYPICAL_MIN.edit.fast * MIN, `4 free builders: 0 for the first four, a typical Fast edit (${TYPICAL_MIN.edit.fast} min) for the fifth`);
  // One builder, busy for 5 more minutes: the first waits 5, the second 5 + its typical new game.
  const busy = [{ endsAt: now + 5 * MIN, units: 1 }];
  const w2 = waits([build("x", "paid", 0, "new", "fast"), build("y", "paid", 1, "edit", "smart")], busy, 1, now);
  ok(w2[0] === 5 * MIN && w2[1] === (5 + TYPICAL_MIN.new.fast) * MIN, "1 builder busy 5 more minutes: 5 min, then 5 + a Fast new game");
  // An Android build holds two builders.
  const w3 = waits([build("x", "paid", 0)], [{ endsAt: now + 3 * MIN, units: 2 }], 2, now);
  ok(w3[0] === 3 * MIN, "an Android build holds two of two builders: the next waits until it ends");
  // More held than there are builders (MAX_RUNS lowered at a restart): the first end frees none.
  const w4 = waits([build("x", "paid", 0)], [{ endsAt: now + MIN, units: 1 }, { endsAt: now + 2 * MIN, units: 1 }, { endsAt: now + 3 * MIN, units: 1 }], 2, now);
  ok(w4[0] === 2 * MIN, "3 runs going on 2 builders: the next starts when the second one ends");
  // A run past its typical length: a minute more.
  ok(runEndsAt(now - 30 * MIN, "new", "fast", now) === now + MIN, "a run past its typical length should end a minute from now");
  ok(runEndsAt(now - 2 * MIN, "new", "fast", now) === now + (TYPICAL_MIN.new.fast - 2) * MIN, "a run 2 minutes in: its typical length less 2");
  ok(waits([build("x", "paid", 0)], [], 0, now)[0] === 0, "MAX_RUNS 0 counts as one builder (never an endless wait)");
  ok(waitMinutes(0) === 1 && waitMinutes(61_000) === 2 && waitMinutes(5 * MIN) === 5, "minutes as said: at least 1, rounded up");
  // Effort: Opus at high effort was measured to run much longer (20 min new, 39 an edit); elsewhere the medium figure.
  ok(typicalMs("edit", "best", "high") === 39 * MIN && typicalMs("edit", "best") === TYPICAL_MIN.edit.best * MIN, "a Best edit at high effort: 39 min; at medium its own figure");
  ok(typicalMs("new", "fast", "high") === TYPICAL_MIN.new.fast * MIN && typicalMs("new", "smart", "low") === TYPICAL_MIN.new.smart * MIN, "Fast and Smart: the same at any effort (it moved them less than the runs vary)");
  const behindHigh = waits([{ ...build("x", "paid", 0), effort: "medium" }], [{ endsAt: runEndsAt(now, "edit", "best", now, "high"), units: 1 }], 1, now);
  ok(behindHigh[0] === 39 * MIN, "behind a Best edit at high effort that just started: about 39 min");
}

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
