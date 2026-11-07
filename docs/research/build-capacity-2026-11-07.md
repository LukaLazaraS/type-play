# Build servers before TypePlay goes public: capacity, failures, options (2026-11-07)

HQ asked, for Luka, after the 11-06 night: three game-agent runs at once on the live API server (Hetzner CPX32; the runner
container capped at 3 vCPU / 5.5 GB, `MAX_RUNS` 3, `deploy/api/compose.yaml`) ran out of memory and the kernel killed four
runs (Dead Haul, Scrap Siege, Buzz Bite, Mosquito Night: $3.58 metered, ~94 minutes of building lost, four failed answers).
Research and a plan only: measured on this PC (WSL, the runner's own limits), never on the live server or with players' data;
no code, server, deploy or Hetzner change. The measuring scripts are in [scripts/capacity/](../../scripts/capacity/).

## In plain words

**What happened on 11-06.** The cause wasn't one giant browser. Three builds were in their checks at the same moment.
Each check's hidden browser needs 0.9-1.3 GB, and each build's AI process another 0.5-0.8 GB. Together that is more than
the 5.5 GB the build area has, so the kernel killed runs. We re-ran that moment here inside the server's exact limits:
memory filled to the last megabyte. Two of the three checks also came out wrong ("the game froze" for games that work),
because three browsers drawing in software were sharing 3 processor cores. The 4.7 GB figure was most likely read on this
PC's Edge on Windows; the server's kind of browser took 1.2 GB on the same game.

**Which step peaks.** The check's hidden browser. It fills 64-120 s of every check (over 80% of it), at 0.9-1.3 GB, and
takes all the processor it can get. The AI's thinking fills most of a build's minutes but costs only 0.5-0.65 GB and almost no
processor. Godot's import and export take 2-3 s each.

**How many builds at once.**
- Today's server (CPX32): 2 safely as it is set up today (we run 3), or 3 if at most 2 browsers run at once.
- A CPX42: 4 as set up today, or 8 with at most 4 browsers at once.
- The processor is the limit, not memory: a browser needs about 1.5 cores to judge a game correctly.

**What players wait.** At the busiest evening hour, the CPX32 serves ~10-20 active players a day with no wait worth
noticing, a CPX42 ~60, and two CPX42s' worth ~100-130.

**The options.**
- **(a) CPX42:** +$40 a month and 15 minutes of work. The right step for launch, bought a week ahead: since June Hetzner has
  blocked new servers and rescales for some customers, picked at random. This account can still rescale today.
- **(b) Separate build servers:** the step after that, when the busiest hour passes ~50 active players a day. About a week
  of work.
- **(c) Servers bought automatically:** not now. It saves little, because servers are a few percent of a build's cost (the
  AI is ~14×), and Hetzner may refuse a server exactly when a spike needs one.
- **(d) First, more from the same server:** the browser limit (about a day of work), and later a lighter check, the
  cheapest capacity of all.

**Failed runs.** A run our server killed should retry by itself once, at the front of the line, and say honestly what
happened. GitLab, Kubernetes and AWS all treat infrastructure failures this way. The 11-06 night cost $3.58 and four
wrong messages ("try again, maybe in other words").

**In order.**
- **Now:** `MAX_RUNS` 2 today (5 minutes); the browser limit, then back to 3 (~1 day); a 10-minute timeout for the
  agent's commands (~1 hour); the retry (~1 day).
- **Launch:** the CPX42 a week before (+$40 a month), then watch the waits, and add a build server when they grow.

## 1. What one build uses (measured)

### The check, step by step

A build is the AI working (the agent process: run.mjs + Claude Code) with the **check** in between: the agent runs it after
each change, run.mjs once more at the end, then the asset capture. The check is where the memory and CPU go. One check of
today's (since 11-04) on Linux, inside the runner's exact limits (a systemd scope with `memory.max` 5.5 GB, no swap, a CPU
quota of 2 of this PC's threads ≈ the runner's 3 vCPU, as in the 10-26 study), each game a fresh copy (no import cache):

| Game | What it is | Check time | Peak, whole check | Browser at its peak | Godot import / export | Result |
|---|---|---|---|---|---|---|
| Penguin Slide (`colour-2d-snow`) | new 2D, built 11-06 under today's budgets | 77 s | 1.42 GB (0.98 can't be dropped) | 0.90 GB | 0.57 GB, 2 s each | OK |
| Mosquito house (`colour-3d-house`) | new 3D, built 11-06 under today's budgets | 133 s | **1.91 GB** (1.34) | **1.28 GB** | 0.69 GB, 2-3 s | OK |
| Petal Pop before its fix + today's stress test | heavy old 2D: 1,322 draw calls on the title, 1,752 at its busiest | 89 s | 1.60 GB (1.04) | 0.99 GB | 0.57 GB | OK (notes only: old game) |
| Sky Hopper before its fix + today's stress test | heavy old 3D: 804 draw calls on the title | 102 s | 1.32 GB (1.24) | 1.16 GB | 0.56 GB | OK |
| Mosquito Night v1, played from typeplay.dev | the 11-06 game, 1,455 draw calls a frame | (45 s of play) | 1.66 GB (1.25) | 1.23 GB | none | ran at ~1 frame a second |
| Mosquito Night v2 (fixed) | 263 / 246 draw calls | (45 s of play) | 0.95 GB (0.91) | 0.89 GB | none | |
| Scrap Siege v5 (heavy) | 1,528 / 1,301 draw calls | (45 s of play) | 1.11 GB (1.06) | 1.04 GB | none | |

"Can't be dropped" is anonymous and shared memory; the rest is page cache (the web export's 40 MB engine, the browser's
profile), which the kernel takes back before it kills anything.

**Over time, one check (the 2D game):** import 2 s (0.6 GB) → headless run and feature tests 1-5 s (0.1 GB) → web export
2 s (0.6 GB) → **four hidden-browser sessions one after another, 83% of the check**: the phone page with its screenshots
(~22 s), the computer page (~10 s), the start-freeze check on a fresh browser at 4× slower CPU (~20 s), then a second web
export of the stress test and its run in the browser at the busiest moment (~14 s). Each browser session sits at its peak
(0.9-1.3 GB) for its whole length and **takes all the CPU it is given** (1.9-2.0 of the 2 threads, the whole time): it
draws in software, as many frames as it can.

**Which step peaks:** the hidden browser, in each of its sessions (up to four), 64-120 s of every check. Godot's import
and export
are short (2-3 s at 0.6-0.7 GB) and never overlap the browser within a check.

**The 4.7 GB of 11-06 doesn't reproduce on Linux.** The heaviest published game, Mosquito Night v1 (1,455 draw calls a
frame, measured), took 1.2 GB in the server's kind of browser; a heavy old 2D game at 1,752 draw calls took 1.0 GB. Draw
calls make the browser slow (one frame a second), not big. The 4.7 GB was most likely read on this PC's Edge on Windows,
which counts memory differently. What killed the runs is the sum: three runs, each with its agent and a check's browser at
the same moment, over 5.5 GB (section 2).

### The agent process

One real new game on this PC, sampled every second (`build-sample.ps1`): "a little hedgehog catches falling apples",
Sonnet medium, phone, the default for a new game. 8.5 minutes, 22 turns, $0.76 at API prices.

| Process | Typical | Peak | CPU |
|---|---|---|---|
| The agent: Claude Code (the SDK's `claude` binary) + run.mjs | 0.48 GB | 0.64 GB; 0.83 GB for the last ~40 s, while the closing AI calls (next-step ideas, the chat answer) run beside it | ~0.02 cores: it waits on Anthropic |
| The check's Godot (import, export) | | 0.56 GB, seconds | 1 core |
| The check's Edge (Windows) | 0.80 GB | 1.40 GB | 5-9 cores (it takes what it gets) |

The agent's memory is flat: it is the same 0.5-0.65 GB whether the AI thinks or a check runs. Edge on Windows counted
1.4 GB for a 2D check where the Linux browser took 0.9 GB for a similar one, which fits the 4.7 GB reading above. (The
build ran on Luka's Max login, as every build on this PC does; $0.76 is its API-price equivalent.)

### A whole build over time

From the same build and, for others, from their agent logs (each tool call is time-stamped; `build-timeline.mjs`):

| Build | Length | Checks | Time in checks | The rest |
|---|---|---|---|---|
| Hedgehog (2D, Sonnet medium, sampled) | 8.5 min | 1 by the agent + run.mjs's closing check + the asset capture | ~40% (3.9 min; ~50 s of it waiting for this PC's one-browser lock, held by another session) | the AI, 59%, near zero CPU |
| Penguin Slide (`colour-2d-snow`, 2D, Sonnet) | 12.4 min | 2 by the agent (79, 109 s) + closing | 29% of the session | |
| Mosquito house (`colour-3d-house`, 3D, Sonnet) | 34.4 min | 7 by the agent (5 ran: 120-268 s) + 5 Godot runs by hand + closing | 56% | |
| 11-06 maintenance changes on this PC (Sonnet high, 14 games) | 4.6-23.2 min, median 9.4 | 1-5 each, mostly 98-236 s | 31-96%, median 56% (9 sessions) | |

So a build alternates: minutes of the AI at ~0.5 GB and no CPU, then a check of 1.5-4 minutes at its peak. A Fast change
(Haiku) is mostly checks: 60-80% of its time (10-26 study), and checks are ~1.5× as long as then at the same CPU (2D
47 → 77 s, 3D 98 → 133 s: the start-freeze and busiest-moment browser runs came on 11-04).

**A finding on the way: checks over 2 minutes are cut loose.** Claude Code's Bash tool stops waiting after 120 s and moves
the command to the background ("Command did not complete within its 120s timeout and was moved to the background"): 13
of the 48 checks agents ran on this PC since 11-04, in 10 of the 16 games (the 11-06 night's maintenance changes and the
3D colour proof; this PC ran several builds at once, which makes checks longer). The
agent then waits with `sleep 60`-`sleep 150` and reads the output file, spending turns, and nothing stops it from starting
another check meanwhile, which would put two browsers in one run. On the server a 3D check alone takes ~133 s (above), so
every 3D check there crosses that line. The standard fix is one setting: `BASH_DEFAULT_TIMEOUT_MS` (and
`BASH_MAX_TIMEOUT_MS`) in the agent's environment, e.g. 10 minutes, or the agent's rules telling it to pass a timeout
with the check (section 5, step 3).

## 2. How many builds at once

### Several checks at once, inside the runner's limits

The worst moment of a busy evening: every run in its check at the same time. Each job below is a full check of its game
plus a stand-in for its agent (550 MB held for the job's length, a little under the measured 0.64 GB); all start
together. "Browser slots" = at most that many hidden browsers at once across all runs (a `flock` on one of K files,
released by the kernel when a browser dies); today the server has no such limit.

**The CPX32 runner today (3 vCPU ≈ 2 of this PC's threads, 5.5 GB):**

| Runs at once | Browser slots | Memory peak (of 5.5 GB) | Can't be dropped | Checks | Check time (alone: 77-133 s) |
|---|---|---|---|---|---|
| 3 (2D + 3D + heavy 2D) | none (today) | **5.50 GB: at the cap** | 4.87 GB | **2 of 3 failed falsely: "the game froze"** | 155-208 s |
| 3 | **2** | 4.74 GB | 4.44 GB | 3 OK | 166-219 s (waits for a slot 0-35 s a page) |
| 3 | 1 | 3.53 GB | 3.49 GB | 3 OK | 149-271 s (waits 0-86 s) |
| 4 (+ heavy 3D) | 2 | 5.42 GB | 5.06 GB | 4 OK | 232-302 s (waits 0-73 s) |
| 1 (3D), browser capped at 1 GB | | 1.12 GB | | the browser killed 4 times in its own cgroup; the check said "froze" | 217 s |

What this shows:
- **Today's setting reproduces 11-06.** Three runs in their checks at once fill the runner to its last megabyte. Here
  the kernel got by on dropping cache; with the real agents (0.64 GB each, 0.83 GB at a build's end), a 3D game's
  heavier moment, or an agent running Godot by hand beside a check, it has nothing left to drop and kills. That is what
  happened, not one browser at 4.7 GB.
- **CPU breaks the checks before memory kills them.** Three browsers on 3 vCPU starve each other: the page stops
  answering in time and the check reports "the game froze" for a game that is fine (2 of 3 here; the 10-26 study saw the
  same at four). The agent then spends turns hunting a bug that isn't there. This happens today without any kill.
- **Two browser slots fix both on the CPX32**: 0.8 GB of room left with three runs, every check right, checks ~5%
  longer in this worst case. One slot is safer still but makes checks up to 2× longer when all three collide.
- **Four runs don't fit the CPX32**, even with two slots: 5.42 GB with stand-ins, over the cap with the real agents.
- **A per-browser memory cap contains the damage** (only that browser dies, no other run is touched), but the check must
  say what happened: today a killed browser reads as "the game froze". A cap belongs well above a normal check (1.3 GB
  measured): ~2.5 GB, with its own message ("the game needed more than 2.5 GB in the browser").

**A CPX42 runner (7 vCPU ≈ 4.5 threads, 13 GB):**

| Runs at once | Browser slots | Memory peak (of 13 GB) | Can't be dropped | Checks | Check time |
|---|---|---|---|---|---|
| 6 (2× 2D, 2× new 3D, heavy 2D, heavy 3D) | none | 9.42 GB | 8.98 GB | **2 of 6 failed falsely ("froze"), both 3D** | 178-235 s |
| 8 (2 of each) | **4** | 9.61 GB | 9.21 GB | 8 OK | 251-340 s (waits 0-101 s a page) |

The CPX42 has the memory for six without a limit, but not the CPU: the browsers starve each other again. With four slots,
eight runs pass, with ~3 GB of memory to spare.

### Safe builds at once

From the measurements, with the agent at 0.65 GB (its measured peak), each browser 1.3 GB plus the cache it keeps using,
0.4 GB never planned, and 1.5 vCPU a browser ([model.mjs](../../scripts/capacity/model.mjs) part 1; "measured" marks the
tests above):

| Runner | $ a month | No limit on browsers | With browser slots |
|---|---|---|---|
| CPX32 today (3 vCPU / 5.5 GB) | 41.99 | **2** (today's 3: at the cap, and false failures) | **3 with 2 slots** (measured: 4.74 GB, all OK); 4 doesn't fit |
| CPX42 (7 vCPU / ~13 GB) | 81.99 | 4 (6 failed checks) | **8 with 4 slots** (measured: 9.6 GB, all OK); up to 10 by memory |
| CPX62 (15 vCPU / ~29 GB) | 152.99 | 10 | ~17-21 with 10 slots |
| A worker CPX42, builds only (7.5 vCPU / ~15 GB) | 81.99 | 5 | ~9-11 with 5 slots |

**The limit is CPU, through the hidden browser**, not memory: a browser draws in software and needs ~1.5 vCPU to give
a true verdict. Memory decides how many runs can *wait* between checks: an agent thinking costs 0.65 GB and no CPU.
That is why slots raise the count: they let the runs that are thinking fill the memory while only as many browsers run
as the CPU carries.

### What it means for a player's wait

A simulation on these numbers ([model.mjs](../../scripts/capacity/model.mjs) part 2): an evening's busiest two hours,
builds arriving at random, each active player making 1 new game and 5 changes a day with 12% of them in the busiest hour
(the assumption of `docs/server-proposal.md`), 30% of games 3D; a Fast change takes ~5.5 minutes on an idle server, a new
game ~12-14. Each cell: **the extra wait for a change over an idle server, median / 90th percentile** (20 simulated
evenings):

| Active players a day (builds in the busiest hour) | CPX32, 2 runs, no limit | CPX32, 3 runs, 1 browser at a time | **CPX32, 3 runs, 2 slots** | CPX42, 4 runs, no limit | **CPX42, 8 runs, 4 slots** | CPX42 + worker, or CPX62 (17 runs, 9-10 slots) |
|---|---|---|---|---|---|---|
| 10 (7) | +0.2 / +5 min | +1.4 / +5 | **+0.2 / +1.4** | +0.2 / +0.2 | +0.2 / +0.2 | +0.2 / +0.2 |
| 30 (22) | +30 / +66 | +21 / +52 | **+9 / +28** | +0.2 / +5 | **+0.2 / +0.6** | +0.2 / +0.2 |
| 60 (43) | +88 / +141 | +86 / +133 | +70 / +112 | +29 / +55 | **+1.8 / +7** | +0.2 / +0.2 |
| 100 (72) | hours | hours | hours | +75 / +124 | +29 / +54 | +0.2 / +0.5 |
| 200 (144) | hours | hours | hours | hours | +90 / +137 | +11-15 / +23-31 |

(Today a build that waits 30 minutes leaves the line by itself, `QUEUE_WAIT_MIN`; "hours" means most builds would.)

So, at the busiest hour, roughly: **the CPX32 serves ~10-20 active players a day well; a CPX42 ~60; two CPX42s' worth
(or a CPX62) ~100-130; 200 needs about three CPX42s' worth** (~11 browsers busy on average at that hour). One browser at a
time is safe on the CPX32 but wastes its CPU: two slots wait less at every load. The browsers' CPU is what grows with
players, so a lighter check is the cheapest capacity there is (section 3, d3).

## 3. The options for launch

Prices are this account's own, read from the Hetzner API today (USD, before VAT; [scripts/capacity/hetzner-stock.mjs](../../scripts/capacity/hetzner-stock.mjs),
GET requests only). Billing is hourly with a monthly cap, and a server switched off is billed until it is deleted
([Hetzner billing FAQ](https://docs.hetzner.com/cloud/billing/faq/)).

| Server | vCPU / RAM | $ a month | $ an hour | Orderable by this account today (fsn1) |
|---|---|---|---|---|
| CPX32 (today's API box) | 4 shared / 8 GB | 41.99 | 0.0673 | yes |
| **CPX42** | 8 shared / 16 GB | **81.99** | 0.1314 | **yes** |
| CPX52 | 12 shared / 24 GB | 118.99 | 0.1907 | yes |
| CPX62 | 16 shared / 32 GB | 152.99 | 0.2452 | yes |
| CCX33 | 8 dedicated / 32 GB | 162.99 | 0.2612 | yes |
| CX33 / CX43 / CX53 | 4-16 shared, older hardware | 9.99-34.99 | | **no** (none in fsn1, nbg1 or hel1) |
| Dedicated AX42 | 8 cores (16 threads) / 64 GB | ~€97 + €49 setup (price list, 10-02) | monthly only | ordered separately |

Plus $0.60 a month per IPv4 address.

**The risk that shapes every option: Hetzner may not sell us a server when we need one.** Since 2026-06-26 Hetzner has
an open incident, "Limited availability of cloud instances": it restricts the creation of new cloud servers "for both new
customers and some of our existing customers", chosen at random ([status page](https://status.hetzner.com/incident/0a75c7ae-3377-41dc-aabe-601063724d24),
still "Identified" today). A restricted customer can't create **or rescale** servers at that location, "try again the
following day" ([Hetzner cloud FAQ](https://docs.hetzner.com/cloud/general/faq/), 2026-04-27). Existing servers are not
touched. Today the API lists CPX42 as orderable for this account in Falkenstein, Nuremberg and Helsinki; that can change
any day, which argues for buying launch capacity a week ahead, not on launch day.

**For scale: servers are a few percent of a build's cost.** A CPX42 ($81.99) serving ~60 active players a day carries
~10,800 builds a month: **~$0.008 of server a build** (~$0.003 if it were busy all day). The AI costs ~$0.11 a build on the
same mix: 1 new game (~$0.07-0.12 on Haiku, ~$0.16-1.06 on Sonnet; call it $0.50) and 5 Fast changes (~$0.02-0.03 each)
(`CLAUDE.md` table, `packages/agent/RESULTS.md`, this doc's hedgehog build at $0.76). So the AI is ~14× the servers.
Saving server money is worth little; what matters is not killing runs and not keeping players waiting.

### (a) Rescale the API server to a CPX42 (`docs/server-proposal.md` plans it)

- **Cost:** $81.99 a month instead of $41.99 (+$40).
- **Work:** ~15 minutes plus a few minutes of downtime: power off, rescale "CPU and RAM only" (so it can shrink back),
  power on; then the runner's limits in `compose.yaml` (`cpus: 7.0`, `mem_limit` ~13 GB) and `MAX_RUNS` from section 2,
  and `deploy.mjs api`. Builds in flight at that moment are interrupted (do it at a quiet hour).
- **Gives:** 8 builds at once with 4 browser slots (measured), against 3 today: ~60 active players a day at the busiest
  hour with a median extra wait under 2 minutes (section 2).
- **Risk:** a restricted account can't rescale (above); today it can. Builds and the API still share one machine: a
  failed or rebooted box stops both, and every API deploy restarts the runner and interrupts the builds going.
- **Growth:** the same box goes up to a CPX62 (16 vCPU / 32 GB, $152.99), about twice a CPX42; past that, (b).

### (b) Build workers separate from the API (a queue plus worker servers)

- **Cost:** a worker CPX42 $81.99, builds only (no API, signer, Caddy: ~7.5 vCPU / 15 GB for builds): ~9-11 builds at
  once with 5 browser slots. Beside a CPX42 API box: $164 a month for ~17 builds at once (~100-130 active players a day);
  beside today's CPX32: $124.
- **Work:** ~3-5 days of building and a week of running it beside today's setup. The pieces exist: the API already talks
  to the runner over a socket with a job protocol (`apps/server/runner/runner.mjs`, `runner-client.ts`) and keeps the
  queue (`queue.service.ts`). New: the runner listening on a private Hetzner network (free) with a per-worker token or
  mutual TLS instead of a Unix socket; each job carrying its game folder (a game is 0.4-1.3 MB of source plus git; the
  import cache can be rebuilt) to the worker and the result back, or games pinned to one worker; the 3D library copied to
  each worker; the key proxy reached over the private network (keys stay on the API box); the queue handing runs to the
  worker with free slots; health checks, and draining a worker before its deploy.
- **Gives:** an API deploy no longer interrupts builds and a heavy build can't touch the API; capacity grows by adding a
  worker (+$82 a month for ~9 more builds at once), and a cheaper dedicated machine can be a worker later (option d).
- **Risk:** more moving parts (network between the boxes, a worker lost mid-run: the retry of section 4 covers it).

### (c) Automatic scaling: workers created through the Hetzner API when the line grows, deleted when idle

- **How others do it:** GitLab's runner autoscaler with Hetzner's own plugin keeps `idle_count` spare slots, deletes a
  machine after `idle_time`, caps `max_instances`, falls back to other server types, backs off after repeated resource
  errors and deletes servers that failed to create ([fleeting-plugin-hetzner](https://github.com/hetznercloud/fleeting-plugin-hetzner),
  [GitLab docs](https://docs.gitlab.com/runner/configuration/advanced-configuration/)). Kubernetes' cluster-autoscaler
  (Hetzner provider) adds a node when work can't be placed (checks every 10 s) and removes one after 10 minutes unneeded;
  it has looped on sold-out types and used up the API limit ([autoscaler FAQ](https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md),
  issues #6240, #4133). TestFlows' GitHub runners on Hetzner create one server per job and delete stragglers after
  60-180 s, with "manual monitoring is required" in its README ([repo](https://github.com/testflows/testflows-github-hetzner-runners)).
- **Start-up:** a server from a stock image answers SSH in ~10-30 s; from a snapshot, minutes in one report; plus pulling
  or starting our image: realistically **2-4 minutes** before its first build starts. A Fast change takes ~5-6 minutes,
  so a new worker helps only a line that lasts longer than that.
- **Cost:** a CPX42 at $0.1314 an hour, every started hour billed: 4 busy hours a day ≈ $16 a month instead of $82.
- **Failure cases:** Hetzner refusing new servers to a randomly restricted customer (the open incident; `resource_unavailable`,
  placement errors, or a create that is accepted and fails later); the account's server limit (not published; a raise is
  asked in the Console and, per Hetzner's FAQ, needs a month of history and a paid invoice); the API limit of 3,600 requests
  an hour; servers that never get deleted and bill on (needs labels, a reaper and a spend cap); the snapshot falling behind
  each deploy.
- **Work:** (b) first, then ~3-5 more days, and watching it.
- **Verdict for launch: no.** It saves tens of dollars a month (servers are a few percent of a build's cost), and the moment it is
  needed, a launch spike, is the moment Hetzner may refuse a server. Worth it only at many workers, and then with a standing
  pool that carries the normal peak and autoscaling for the extra.

### (d) Better first: more builds from the same machine, then cheaper capacity

- **(d1) A limit on hidden browsers at once (before any purchase).** Runs at once are limited by memory only because
  every run may be in its browser at the same moment. A browser slot (at most K browsers at once across all runs; a
  `flock` on one of K files, which the kernel releases when a browser dies, so a killed job never leaves a stale lock; the
  existing lock in `web.mjs` is one folder, which a dead job's user can't remove, which is why it is off on the server)
  bounds the memory to K browsers plus N agents. Plus a memory watchdog per browser in `web.mjs` (stop a browser past
  ~2.5 GB with a clear error to the agent) for the game nobody has seen yet. Measured in section 2. ~1 day with tests.
- **(d2) A dedicated machine as the build worker, once (b) exists.** An AX42 (8 Ryzen cores / 16 threads, 64 GB, ~€97 a
  month + €49 setup) has 4× a CPX42's memory and dedicated threads like this PC's for ~1.3× its price: by the numbers here
  (one browser per ~1 such thread) ~12 browser slots and ~25 builds at once, about 2.5 CPX42 workers. An estimate, not
  measured. Monthly, not hourly; Hetzner's dedicated line is outside the cloud incident; a hardware fault takes it away,
  so the API box keeps a small runner as the fallback.
- **(d3) A lighter check: the cheapest capacity.** The hidden browser takes all the CPU it gets for 64-120 s of every
  check, drawing as many frames as it can, while most of the time only a few screenshots are wanted; and each check starts
  a browser four times. Fewer frames where only pictures are taken, one browser with a fresh context for the start-freeze
  page, the busiest-moment run only when the drawing changed: every CPU-second saved there is capacity on every server.
  Not measured; worth its own study before (b).

## 4. Failed runs: what they cost, and retrying

**What 11-06 cost:** $3.58 of metered AI (Dead Haul $1.25, Scrap Siege $1.30, Buzz Bite $0.83, Mosquito Night $0.20), ~94
minutes of building, and four failed answers. These were TypePlay's own maintenance changes (Sonnet, high effort, twice a
new game's room, up to 80 minutes each), so no player was charged; had they been players' changes, nothing would have been
charged either (`runs.service.ts` `fail()`: failed runs charge 0 and the game goes back to its last version). What the
player reads is wrong for this case, though: "I couldn't get that change working … Try again, maybe in other words."
Their words were fine; our server ran out of room.

**How the standard platforms treat a job the infrastructure killed, against one that failed by itself:**

| Platform | Infrastructure failure (machine lost, killed, out of memory) | The job's own failure |
|---|---|---|
| GitLab CI | `retry: when: runner_system_failure` (also `runner_interrupted`, `scheduler_failure`), at most 2 retries; `retry: exit_codes` can match 137 (killed) ([docs](https://docs.gitlab.com/ci/yaml/)) | `script_failure`: not retried unless asked |
| Kubernetes Jobs | `podFailurePolicy` with `Ignore` on the `DisruptionTarget` condition: an evicted or preempted pod is re-run without counting against `backoffLimit` (default 6, 10 s → 10 min backoff) ([docs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)) | `FailJob` on chosen exit codes |
| AWS Batch | `retryStrategy` with `evaluateOnExit`: AWS's own example retries on `onStatusReason: "Host EC2*"` up to 5 attempts ([docs](https://docs.aws.amazon.com/batch/latest/userguide/job_retries.html)) | `EXIT` for everything else |
| Google Cloud Run jobs | 3 retries per task by default (0-10); "make your jobs idempotent" ([docs](https://docs.cloud.google.com/run/docs/jobs-retries)) | the same retries |
| Celery | `acks_late` + `task_reject_on_worker_lost` re-run a task whose worker died, only for idempotent tasks ([FAQ](https://docs.celeryq.dev/en/stable/faq.html)) | explicit `retry()` |
| GitHub Actions | no automatic retry; a person re-runs failed jobs ([docs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)) | the same |
| AI app builders | none documents a refund or retry for its own failures; Lovable charges a stopped request for the work done and gives 10 free "Try to fix" uses a day ([docs](https://docs.lovable.dev/introduction/plans-and-credits)) | charged |

The common rule: **retry automatically, a small number of times, only failures the platform caused, and only jobs that
are safe to run twice.** Ours are: before any retry the game folder is reset to the last version's commit, as every failed
run already does.

**So yes: a run the server killed should retry by itself, once.**
- **Which failures:** the run's process killed by the kernel for memory (the runner reads the container's
  `/sys/fs/cgroup/memory.events` `oom_kill` count before and after the job; the job ended by SIGKILL that wasn't our Stop
  or timeout), the runner crashing, and a deploy or restart that interrupted the run (today marked "interrupted" at the
  next start, `runs.service.ts` `onModuleInit`). Never the agent's own failures: a failed check, a refusal, a Stop, a
  40-minute timeout, a request too big.
- **How:** back to the **front** of the line, not the back; on its retry it waits for room (a free browser slot, see
  section 2) instead of starting into the same squeeze; at most one retry, two attempts in all. Charge only the attempt
  that delivered, as today's `chargeUsd` already does for attempts. The chat says what happened: "Our build server ran out
  of room, so I started your change again. Nothing extra is charged." If the retry fails the same way: "Our build server
  is too busy right now. Your game is unchanged and nothing was charged. Try again in a few minutes."
- **What it costs us:** a killed run's tokens are lost and the retry pays them again: a Claude Code session can't be
  resumed cheaply after a kill (resuming re-reads the whole history, a known trap in `CLAUDE.md`). If the retry starts
  within 5 minutes, the session's opening (system prompt and rules, the same every time) is read from Anthropic's prompt
  cache at a fraction of the price ([prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching));
  the rest is paid in full. At 11-06's rate that is ~$0.90 a killed run. That is why the fix is **not killing runs**
  (section 2), with the retry as the safety net: once the limits in section 5 are in, kills should be rare, and a retry at
  our cost is cheaper than a tester who believes their idea was the problem.

## 5. Recommendation

### Now: the closed test, which runs today

| # | What | Size | What it changes |
|---|---|---|---|
| 1 | **`MAX_RUNS` 2** in `deploy/api/compose.yaml`, then `deploy.mjs api` at a quiet moment (a deploy interrupts the builds going). And TypePlay's own `admin run` batches one at a time, or at night: on 11-06 seven of them took every builder | 5 minutes | Safe by measurement today: two browsers on 3 vCPU pass, memory has room. At ~10 testers it costs almost nothing (+0.2 min median, +5 min at the 90th percentile at the busiest hour). Back to 3 with step 2 |
| 2 | **Browser slots: at most 2 hidden browsers at once on the CPX32**, then `MAX_RUNS` 3 again. `web.mjs` takes one of K slot files with `flock` (util-linux, in the image) before it starts a browser, and the browser holds it, so the kernel frees it when the browser dies (today's lock is off on the server because a killed job's lock folder could never be removed by the other jobs' users); its start timer counts from when it has the slot. The runner makes the slot files and passes K. Plus a memory watchdog per browser (~2.5 GB) and a true message when a browser was killed instead of "the game froze" | ~1 day with tests | No more 11-06 kills, no false "froze" verdicts, 0.8 GB of room with 3 runs (measured) |
| 3 | **The agent's command timeout: `BASH_DEFAULT_TIMEOUT_MS` and `BASH_MAX_TIMEOUT_MS` = 10 minutes** in run.mjs's environment for the SDK, checked with one build | ~1 hour | Checks stop being cut loose into the background at 2 minutes (every 3D check on the server) |
| 4 | **Retry once a run the server killed** (out of memory, the runner crashed, a deploy interrupted it): to the front of the line, the attempt that delivers is the one charged, honest texts (section 4). The runner reports the kernel's OOM kill (`memory.events`); the API re-queues | ~1 day with tests | A player never pays for, or is blamed for, our server's failure |

### For launch, in this order

| # | What | Size | Cost | What it changes |
|---|---|---|---|---|
| 5 | **A week before launch: rescale to a CPX42** while `node scripts/capacity/hetzner-stock.mjs` shows it orderable (it does today): runner `cpus: 7.0`, `mem_limit` ~13 GB, `MAX_RUNS` 8, 4 browser slots | ~15 minutes + a few minutes' downtime at a quiet hour | +$40 a month ($81.99) | ~60 active players a day at the busiest hour with under 2 minutes' extra wait |
| 6 | **Watch it**: the line's waits at the busiest hour, the runner's memory peak and OOM kills, the browser-slot waits; a message to Luka/HQ when the median wait passes 2 minutes or memory 75% | ~1 day | | Step 7 starts on numbers, not guesses |
| 7 | **When the busiest hour passes ~50 active players** (or step 6 fires on most days): first the lighter check (d3, every CPU-second saved is capacity), then **(b) one build worker CPX42**, then more workers or a dedicated AX42 (d2) | (d3) a study first; (b) ~3-5 days + a week beside | +$82 a month a worker | ~+9 builds at once a worker |
| 8 | **Not for launch: (c) automatic scaling.** Revisit at 4-5 workers, as a standing pool that carries the normal peak plus servers bought for spikes, with fallbacks across server types and locations | | | |

At launch that is ~$90 a month for servers (the CPX42, the site's CX23, two IPv4 addresses), next to an AI bill ~14×
larger for the same builds (section 3).

## How this was measured

- **Where:** this PC's WSL Ubuntu (kernel 6.18), not Docker (Docker there needs a sudo password), but the same kernel
  mechanism Docker uses for `cpus:` and `mem_limit:`: a delegated systemd scope per test with `MemoryMax`,
  `MemorySwapMax=0`, `CPUQuota`, `TasksMax=4096`, split into one cgroup per job as `runner.mjs` splits its jobs, each job
  at `oom_score_adj` 800 like the runner's. The kernel's own peaks (`memory.peak`) and OOM counts (`memory.events`) per job;
  every 0.5 s each process's proportional memory (`smaps_rollup`) and CPU. Below-normal priority (nice 10) and at most
  4.5 of the PC's 16 threads; the WSL VM's own Windows priority could not be lowered (needs admin).
- **The browser:** Chrome for Testing 157 (Linux) with the server's flags (`--no-sandbox --disable-dev-shm-usage`,
  SwiftShader WebGL 2); the server runs Debian bookworm's Chromium. Godot 4.7.2 Linux, Node 22, today's
  `packages/agent/tools/check.mjs` copied in.
- **CPU:** one CPX vCPU is a shared EPYC thread, taken as 0.6-0.8 of this PC's Ryzen 7 5800X threads (10-26 study): 2
  threads ≈ the CPX32 runner's 3 vCPU, 4.5 ≈ a CPX42 runner's 7. Memory doesn't scale with that; timings do.
- **The agent:** measured on Windows (the Max login only works there); in the multi-run tests a stand-in process holds the
  agent's measured memory for each job's length.
- **Not measured:** the live server itself (by rule), Android builds under load (one at a time, Gradle `-Xmx1536m`, counted
  as two run slots already), disk I/O, a run whose agent starts two checks at once.
- **Scripts** ([scripts/capacity/](../../scripts/capacity/)): `setup-wsl.sh` (once), `measure.mjs` + `pool.mjs` (the
  runner-in-a-scope test: `--games`, `--agent-mb`, `--browser-slots`, `--browser-mem`, `--job-mem`, `--pool-mem`,
  `--pool-cpu`), `peaks.mjs` (peaks per process kind), `play-public.mjs` (a public build in the hidden browser),
  `build-sample.ps1` (a real build's processes on Windows), `build-timeline.mjs` (a build's checks from its agent log),
  `model.mjs` (runs at once per server, and queue waits), `hetzner-stock.mjs` (read-only stock and prices).
