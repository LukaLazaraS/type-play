// The capacity model of docs/research/build-capacity-2026-11-07.md, from the measurements in that doc:
// 1. how many builds at once fit a runner (memory and CPU), with and without a limit on hidden browsers at once;
// 2. what a player waits at the busiest hour, by simulation: builds arrive at random (Poisson), wait in the line for a
//    free build slot (MAX_RUNS), then alternate the AI (no CPU) with checks; each check's four browser pages wait for a
//    free browser slot. Out: the time from "send" to the answer, against the same build on an idle server.
//   node scripts/capacity/model.mjs
const M = {
  agentGb: 0.65, // run.mjs + Claude Code: 0.48 typical, 0.64 peak, 0.83 for the last ~40 s (the real build)
  browserGb: 1.3, // a check's browser at its peak (anon; 0.9-1.28 measured on Linux)
  cacheGb: 0.15, // of a check's page cache (0.1-0.6 GB, droppable), the part it keeps using: the 3 runs + 2 slots test peaked at 4.74 GB
  roomGb: 0.4, // never planned: the runner itself, an agent running Godot by hand, a heavier game than tested
  vcpuPerBrowser: 1.5, // 2 browsers on the CPX32's 3 vCPU passed every check; 3 failed 2 of 3 (measured)
};

// The runner's share of each server (the API, signer, Caddy and the system keep the rest, as compose.yaml does today).
const SERVERS = [
  { name: 'CPX32 today (runner 3 vCPU / 5.5 GB)', usd: 41.99, vcpu: 3, gb: 5.5 },
  { name: 'CPX42 (runner 7 vCPU / 13 GB)', usd: 81.99, vcpu: 7, gb: 13 },
  { name: 'CPX62 (runner 15 vCPU / 29 GB)', usd: 152.99, vcpu: 15, gb: 29 },
  { name: 'Worker CPX42, builds only (7.5 vCPU / 15 GB)', usd: 81.99, vcpu: 7.5, gb: 15 },
];

const perRunUnlimited = M.agentGb + M.browserGb + M.cacheGb;
console.log(`1. Builds at once (agent ${M.agentGb} GB, browser ${M.browserGb} GB + ${M.cacheGb} GB cache, ${M.roomGb} GB kept free, ${M.vcpuPerBrowser} vCPU a browser)\n`);
console.log('server                                         browser slots   no browser limit (mem / CPU)   with the slots');
const plan = {};
for (const s of SERVERS) {
  const slots = Math.max(1, Math.floor(s.vcpu / M.vcpuPerBrowser));
  const byMem = Math.floor((s.gb - M.roomGb) / perRunUnlimited);
  const byCpu = slots; // without a limit, more runs than this can be in their browsers at once and checks fail
  const withSlots = Math.floor((s.gb - M.roomGb - slots * (M.browserGb + M.cacheGb)) / M.agentGb);
  plan[s.name] = { slots, runs: withSlots };
  console.log(`${s.name.padEnd(46)} ${String(slots).padEnd(15)} ${`${byMem} / ${byCpu} → ${Math.min(byMem, byCpu)}`.padEnd(30)} ${withSlots}`);
}

// --- 2. The simulation -------------------------------------------------------------------------------------------
// A check: Godot (import, tests, export) then four browser pages, each holding a browser slot. Page times at one slot's
// CPU (1.5 vCPU ≈ 1 of this PC's threads): the 2D and 3D checks alone at 2 threads (77 s and 133 s) were ~1.4× slower at 1.
const CHECK = {
  '2d': { godotS: 14, pagesS: [22, 10, 20, 14] },
  '3d': { godotS: 16, pagesS: [41, 25, 31, 24] },
};
let SLOW = 1.4; // set per setup: 1.4 when a browser has a slot's 1.5 vCPU, 1.0 when it has the whole 3 vCPU
// A build: the AI's stretches between checks (minutes), as measured (the hedgehog build, the logs, the 10-26 study).
const KINDS = {
  change: { ai: [1.2, 0.5], checks: 2 }, // a Fast change: the AI, a check, a short fix-up, run.mjs's closing check
  newGame: { ai: [5, 1.5, 0.3], checks: 3 }, // a new game: the AI, a check, more AI, a check, the closing check
};
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const expo = (mean) => -Math.log(1 - rand()) * mean;

function makeBuild(at) {
  const kind = rand() < 1 / 6 ? 'newGame' : 'change';
  const dim = rand() < 0.3 ? '3d' : '2d';
  const k = KINDS[kind];
  const steps = [];
  for (let i = 0; i < k.checks; i++) {
    steps.push({ ai: (k.ai[i] ?? 0.3) * 60 * (0.6 + rand() * 0.8) });
    steps.push({ godot: CHECK[dim].godotS });
    for (const p of CHECK[dim].pagesS) steps.push({ page: p * SLOW });
  }
  steps.push({ page: 18 }); // the asset capture's browser
  const alone = steps.reduce((s, x) => s + (x.ai ?? x.godot ?? x.page), 0);
  return { at, kind, steps, i: 0, left: null, alone };
}

// One busy evening: `hours` at the busiest hour's rate (a real peak lasts 1-2 hours); builds sent in its first 15 minutes
// are left out (the server starts empty). Every setup sees the same 20 evenings (seeds 1-20).
function simulate({ perHour, runs, slots, hours = 2 }) {
  const pooled = [];
  for (let r = 1; r <= 20; r++) { seed = r * 7919; pooled.push(...evening({ perHour, runs, slots, hours })); }
  return summarise(pooled, hours * 3600);
}
function evening({ perHour, runs, slots, hours }) {
  const end = hours * 3600;
  const arrivals = [];
  for (let t = expo(3600 / perHour); t < end; t += expo(3600 / perHour)) arrivals.push(makeBuild(t));
  const line = [], active = [], pageWait = [], done = [];
  let freeSlots = slots, a = 0;
  for (let t = 0; t < end + 7200; t++) {
    while (a < arrivals.length && arrivals[a].at <= t) line.push(arrivals[a++]);
    while (active.length < runs && line.length) { const b = line.shift(); b.started = t; active.push(b); }
    for (const b of active) {
      const s = b.steps[b.i];
      if (!s) continue;
      if (s.page != null && !b.holding) { b.waiting = true; continue; }
      if (b.left == null) b.left = s.ai ?? s.godot ?? s.page;
      if (--b.left <= 0) {
        if (b.holding) { b.holding = false; freeSlots++; }
        b.i++; b.left = null;
      }
    }
    // Free browser slots go to the pages waiting longest.
    for (const b of active.filter((x) => x.waiting).sort((x, y) => x.waitFrom - y.waitFrom)) {
      if (b.waitFrom == null) b.waitFrom = t;
      if (freeSlots > 0) { freeSlots--; b.holding = true; b.waiting = false; pageWait.push(t - b.waitFrom); b.waitFrom = null; }
    }
    for (let j = active.length - 1; j >= 0; j--) {
      if (active[j].i >= active[j].steps.length) { const b = active.splice(j, 1)[0]; b.done = t; done.push(b); }
    }
    if (t > end && !active.length && !line.length) break;
  }
  return done.filter((b) => b.at > 900 && b.at < end);
}
function summarise(measured) {
  const stats = (kind) => {
    const xs = measured.filter((b) => b.kind === kind);
    const total = xs.map((b) => (b.done - b.at) / 60).sort((x, y) => x - y);
    const extra = xs.map((b) => (b.done - b.at - b.alone) / 60).sort((x, y) => x - y);
    const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] ?? 0;
    return `${q(total, 0.5).toFixed(1)} / ${q(total, 0.9).toFixed(1)} min (+${q(extra, 0.5).toFixed(1)} / +${q(extra, 0.9).toFixed(1)})`;
  };
  return { change: stats('change'), newGame: stats('newGame') };
}

// Demand: active players a day, each starting 6 builds (1 new game + 5 changes, docs/server-proposal.md), 12% of the
// day's builds in its busiest hour.
const SETUPS = [
  { name: 'CPX32, 2 runs, no browser limit', runs: 2, slots: 2 },
  { name: 'CPX32, 3 runs, 1 browser at a time', runs: 3, slots: 1, slow: 1.0 },
  { name: 'CPX32, 3 runs, 2 browser slots', runs: 3, slots: 2 },
  { name: 'CPX42, 4 runs, no browser limit', runs: 4, slots: 4 },
  { name: 'CPX42, 8 runs, 4 browser slots', runs: 8, slots: 4 },
  { name: 'CPX42 + worker CPX42, 17 runs, 9 slots', runs: 17, slots: 9 },
  { name: 'CPX62, 17 runs, 10 browser slots', runs: 17, slots: 10 },
];
console.log('\n2. A player\'s wait at the busiest hour: median / 90th percentile from "send" to the answer, (+ the extra over an idle server)');
for (const dau of [10, 30, 60, 100, 200]) {
  const perHour = dau * 6 * 0.12;
  console.log(`\n${dau} active players a day → ${perHour.toFixed(0)} builds in the busiest hour`);
  for (const s of SETUPS) {
    SLOW = s.slow ?? 1.4;
    const r = simulate({ perHour, runs: s.runs, slots: s.slots });
    console.log(`  ${s.name.padEnd(40)} change ${r.change.padEnd(30)} new game ${r.newGame}`);
  }
}
console.log('\n(an idle server: a change ~5.5 min, a new game ~12 min, by the simulation\'s own build lengths)');
