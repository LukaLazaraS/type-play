# How many builds at once the API server can take (2026-10-26)

HQ asked, with the build queue: measure, don't change, how many builds the live CPX32 (4 vCPU, 8 GB; the runner
container capped at `cpus: 3.0`, `mem_limit: 5632m`, `RUNNER_SLOTS 6`) could run at once, and recommend `MAX_RUNS`
(4 today, `deploy/api/compose.yaml`). Measured on this PC from the run records and a test of the checks; nothing ran on
the server. The summaries are in [build-capacity-2026-10-26/](build-capacity-2026-10-26/).

## The answer

**`MAX_RUNS` 3, once one bug is fixed. As deployed today, only 1 is safe.**

- **What limits it: CPU while checks overlap.** At about 3 vCPU, three 2D checks at once still pass (each 1.5-2× slower);
  four at once lose screenshots and give false "the game froze" failures. Builds going: 3 → three or more checks at once
  13-34% of the busy time; 4 → four at once 6-24%. Memory: 3 builds 2.8-4.7 GB of the 5.5 GB cap, 4 builds 3.8-6.2 GB
  (3D can pass it). `RUNNER_SLOTS` 6 never comes into play.
- **The bug: every check on the live runner is pinned to one vCPU.** `packages/agent/tools/cpu.mjs` keeps 4 cores free
  for Luka's PC: `HEAVY_CORES = max(1, availableParallelism() - 4)`. In the runner container (a CPU quota, not a cpuset)
  Node sees the host's 4 CPUs, so it is 1, and `check.mjs` and `web.mjs` call `limitThisProcess()`, whose Linux branch
  runs `taskset -pc 3-3`: every run's Godot and hidden browser share vCPU 3 (taskset is in Debian's base system, in the
  image). At about 1 vCPU one 2D check passes, but one 3D check, or any two checks at once, come out broken (the 0.75-core
  rows below). Found by reading the code, not run on the server. Fix (not made: the brief was measure only): skip the
  pinning in the runner, e.g. an env flag the runner sets for its jobs, so its `cpus: 3.0` does the capping.
- **Builds are not mostly waiting on the AI.** Edits spend 60-80% of their wall time in checks (a Haiku edit: median
  2.3 min, 2 checks); new games 16-48% (Opus least, Sonnet most).

## The builds on record (packages/agent/runs.jsonl, 201 runs 10-12..24; 166 matched to their agent logs; this PC)

| Build | n | Wall min, median / p90 | Checks, median (p90) | Share of wall time in a check |
|---|---|---|---|---|
| New, Haiku | 31 | 11.8 / 19.4 (since 10-17: 16.6 / 22.8) | 6 (13) | 0.32 |
| New, Sonnet | 42 | 5.6 / 10.7 (since 10-17: 9.1 / 12.2) | 4 (6) | 0.48 |
| New, Opus | 36 | 19.9 / 23.2 (high effort 20, medium ~6) | 6 | 0.16 |
| Edit, Haiku | 65 | 2.3 / 4.5 | 2 (3) | 0.61 |
| Edit, Sonnet | 17 | 2.0 / 2.6 | 2 | 0.79 |
| Edit, Opus | 10 | 29.8 / 51.6 (high effort 38.7, medium 2.1) | 6.5 | 0.42 |

A check = one Godot import, a headless run, the feature tests, one web export, then the hidden browser (2 pages, 4 views
for a game that fills every screen). Godot is small (import + export about 6-8 CPU-s); the hidden browser is the CPU, and
takes whatever it gets (uncapped: 252 CPU-s in 38 s, about 6.5 cores).

## Checks at once (`packages/agent/tools/check.mjs` on copies of 6 built games: 4 2D, 2 3D)

All the checks of a level started together inside one Windows job hard-capped at N cores of CPU time (as Docker's
`cpus:`), with `TYPEPLAY_BROWSER_LOCK=0` as in the runner. Degraded = a screenshot missing or the loading screen in the
first; failed = a false "froze".

| Cap (this PC's cores) | At once | 2D wall s | 3D wall s | Result | Peak commit |
|---|---|---|---|---|---|
| 3 (optimistic) | 1 | 43-56 | 68-86 | ok | 0.9-1.35 GB |
| 3 | 4 | 73-96 | 116 | 3 ok, 1 degraded | 3.1 GB |
| 3 | 6 | 100-117 | 132-147 | 4 degraded, 2 failed | 4.2 GB |
| **2 (≈ the runner's 3 vCPU)** | 1 | 47 | 98 | 2D ok; 3D lost its first shot | 1.0-1.4 GB |
| 2 | 2 | 64-73 | 105 | 2D ok, 3D degraded | 1.7-1.8 GB |
| 2 | 3 | 74-94 | 117 | 2D ok once; a repeat 2 of 3 degraded | 2.4-2.5 GB |
| 2 | 4 | 97-99 | 131 | 1 ok, 2 degraded, 1 failed | 3.2 GB |
| 0.75 (≈ 1 vCPU: today's pinning) | 1 | 70 | 119 | 2D ok; 3D 1 of 4 shots | 0.9-1.2 GB |
| 0.75 | 2 | 119 | 172 | 1 degraded, 1 failed | 1.5 GB |

Per check alone: 84 CPU-s (2D) and 147 (3D) at the 2-core cap; peak 0.6-1.1 GB private. Failures come from the browser's
fixed limits (6 s before the first screenshot, 10 s per screenshot, 5 s for a page to answer), never from Godot's.
3D checks lose their first screenshot even alone at 2 cores or fewer: waiting for the game's first frame instead of a
fixed 6 s would fix that, whatever `MAX_RUNS` is.

## Caveats

Edge on Windows, not Chromium on Linux in Docker; one CPX32 vCPU (a shared EPYC thread) taken as 0.6-0.8 of this PC's
Ryzen 7 5800X cores, so cap 2 ≈ the runner and cap 3 is an upper bound. The PC was busy with other work during the test
(other sessions, an encode, a render; a screenshot run overlapped the last three levels), and each level ran once: the
numbers are noisy. Not measured: the agent's own process under load (from other sessions: 0.01-0.17 cores, 0.4-0.8 GB
commit), Android builds under load, disk I/O, Chromium's shared memory in the container's page cache.
