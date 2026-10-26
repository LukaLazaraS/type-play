# gVisor for the build runner: the trial (2026-10-26)

Luka's question (via HQ): does running the runner container under gVisor make builds slower? If it does, we
don't need it. Measured on this PC in WSL, the live runner container under plain Docker (runc, as the server
runs it today) and under gVisor (runsc), same machine, same image, same jobs.

## The answer

**Yes, builds get slower under gVisor, by about a tenth.** In 18 pairs of real builds (the same prompt on the same
model, started at the same moment under each runtime) the gVisor build took longer in 12. The median pair: Fast +12%,
Smart +3%; over the 12 pairs of 2D games +7.5%. The model's own time doesn't change; the rest of a build does: +25% in
the 2D pairs, mostly Godot, which is +35-40% on every fixed Godot job.

**How much of it is noise.** One build differs from the next by ±30-50% on the same runtime (the model takes another
path and makes 2 to 25 checks), so no single build figure is outside the noise: every build row's 95% interval spans 0.
The direction is not noise: 12 of 18 pairs, the 2D pairs' time outside model calls and the fixed jobs agree, and on the
fixed jobs (3 to 30 runs each) the two runtimes' ranges don't overlap (web export 6.3 → 8.5 s, interval +33% to +43%).

**One confounder, and it is a bug on the live server today.** The check is pinned to one CPU there (`tools/cpu.mjs`;
gVisor ignores pinning). A 3D check then takes 58 s with the browser at 1 frame a second, and the trial's runc 3D builds
on Smart took 13 min in 2 of 3 runs. So gVisor's 3D builds look better than today's for a reason that has nothing to do
with gVisor. With the pin removed (the `runc-nopin` arm, 18 more builds, not paired), plain runc is the fastest of the
three: Fast 12.3 min, Smart 4.7 min median; gVisor +22% and +21% against it (that arm ran at another hour, so some
model-time drift is in those two).

**Everything works under gVisor**: all 18 gVisor builds (and the 36 runc ones), every fixed job, the live compose file's
checks and the upgrade path, without a failure; nothing in the game agent changed, only the runner's setup (below).
Model spend for the trial's 54 builds: $15.10, metered by the proxy.

## In one table

| | without gVisor (runc, as live) | with gVisor (this branch) | change | 95% interval | runs |
|---|---|---|---|---|---|
| Fast build (haiku), what the player waits | 13.0 min | 15.0 min | **+15%** | -12% to +51% | 9 + 9 |
| Fast build, outside model calls | 4.6 min | 5.6 min | **+21%** | -31% to +164% | 9 + 9 |
| Smart build (sonnet), what the player waits | 5.7 min | 5.8 min | **+1%** | -55% to +39% | 9 + 9 |
| Smart build, outside model calls | 3.1 min | 2.7 min | **-13%** | -68% to +78% | 9 + 9 |
| The agent's check, 2D games, as on the server today | 29.9 s | 31.7 s | **+6%** | +3% to +8% | 8 + 8 |
| The agent's check, 3D game, as on the server today | 58.4 s | 43.6 s | **-25%** | -32% to -20% | 4 + 4 |
| The agent's check, 2D, like for like (no pin) | 28.6 s | 31.7 s | **+11%** | +10% to +12% | 3 + 3 |
| The agent's check, 3D, like for like (no pin) | 36.5 s | 43.5 s | **+19%** | +11% to +57% | 3 + 3 |
| Web export job (3 games) | 6.3 s | 8.5 s | **+35%** | +33% to +43% | 15 + 15 |
| Android APK | 9.6 s | 12.9 s | **+34%** | +25% to +52% | 3 + 3 |
| Android AAB | 38.7 s | 54.4 s | **+40%** | +33% to +43% | 3 + 3 |
| A minimal job (git rev-parse) | 10 ms | 34 ms | **+229%** | +209% to +245% | 30 + 30 |
| An empty agent job (node starts and exits) | 33 ms | 73 ms | **+120%** | +114% to +128% | 30 + 30 |
| Runner start until its socket answers | 332 ms | 404 ms | **+22%** | +18% to +28% | 8 + 8 |
| Runner memory when idle | 15 MB | 30 MB | **+100%** | +88% to +100% | 8 + 8 |
| Fast build, CPU seconds | 310 CPU-s | 728 CPU-s | **+135%** | +43% to +388% | 9 + 9 |
| Fast build, peak memory | 1416 MB | 1141 MB | **-19%** | -30% to +3% | 9 + 9 |
| Smart build, CPU seconds | 193 CPU-s | 371 CPU-s | **+92%** | -30% to +288% | 9 + 9 |
| Smart build, peak memory | 1308 MB | 1183 MB | **-10%** | -32% to +23% | 9 + 9 |

### If the pin bug were fixed: runc without the pin against gVisor

| | runc, no pin | with gVisor | change | 95% interval | runs |
|---|---|---|---|---|---|
| Fast build, what the player waits | 12.3 min | 15.0 min | **+22%** | -23% to +56% | 9 + 9 |
| Fast build, outside model calls | 3.4 min | 5.6 min | **+64%** | -39% to +176% | 9 + 9 |
| Fast: runner | 10.3 min | 11.6 min | **+12%** | -32% to +30% | 3 + 3 |
| Fast: match3 | 11.6 min | 16.9 min | **+45%** | +3% to +66% | 3 + 3 |
| Fast: car3d | 18.0 min | 17.8 min | **-1%** | -20% to +78% | 3 + 3 |
| Smart build, what the player waits | 4.7 min | 5.8 min | **+21%** | -21% to +65% | 9 + 9 |
| Smart build, outside model calls | 2.8 min | 2.7 min | **-3%** | -34% to +75% | 9 + 9 |
| Smart: runner | 3.5 min | 4.9 min | **+39%** | +3% to +103% | 3 + 3 |
| Smart: match3 | 6.5 min | 5.8 min | **-11%** | -41% to +0% | 3 + 3 |
| Smart: car3d | 4.7 min | 5.8 min | **+21%** | -3% to +139% | 3 + 3 |

change = with / without − 1. The 95% interval (a bootstrap of the medians) says how much of a change could be noise: one that spans 0% means these runs can't tell the two apart. "Outside model calls" = a build's time minus the SDK's `duration_api_ms`.

## What was set up

- WSL Ubuntu 26.04 on this PC (Ryzen 7 5800X, 16 threads): Docker Engine 29.9.2 (the API server's version) and gVisor
  `runsc` release 20261019.0, platform **systrap** (the CPX32 has no `/dev/kvm`: checked read only, `AMD EPYC-Genoa`,
  no `vmx`/`svm` flag). `setup-wsl.sh` installs both; gVisor through `deploy/api/gvisor.sh`, the script the server
  would run (the pinned `.deb`'s SHA-512 comes from gVisor's apt index, whose `InRelease` signature checks out
  with the gVisor key `6F1D F85E … E32B D943`).
- `deploy/api/compose.yaml` with `runtime: runsc` on the runner only. Three more things were needed, each found by
  testing:
  1. `--host-uds=create` on the runtime: without it the runner's Unix socket exists only inside the sandbox and
     the api container (runc) can't reach it.
  2. **No Docker DNS inside gVisor**: `api` didn't resolve (EAI_AGAIN) while the same lookup works under runc;
     gVisor's network stack never reaches the resolver Docker runs at 127.0.0.11. Fix: the api gets a fixed
     address on the internal network (10.200.0.2, compose `ipam`) and the runner `extra_hosts: api:10.200.0.2`
     (the README's "pin the api's addresses" item, half done).
  3. **A malloc setting for the jobs** (`GLIBC_TUNABLES=glibc.malloc.arena_max=2:glibc.malloc.top_pad=67108864`,
     passed to every job by `runner.mjs`): see "Why Godot is slow under gVisor" below.
- `compose-check.sh` (the live compose file in a scratch folder): 8 of 8 pass: the runner turns healthy under
  runsc, the kernel inside is `4.19.0-gvisor`, the api container reaches the runner's socket and gets answers,
  `http://api:8787` answers from inside the sandbox, `1.1.1.1` doesn't (ENETUNREACH).
- `upgrade-check.sh`: the live server's path, main's stack (runc, agents network without a fixed subnet) then
  `docker compose up` with this file: Compose removes and recreates the agents network and the runner by itself,
  in 7.6 s; the runner comes back on runsc and reaches `api:8787`.
- The image itself (built in WSL from this branch, 9 min the first time) passed its own checks: Chromium's
  software WebGL 2 and the Android self-test (APK and AAB: target SDK 36, 16 KB pages, not debuggable).

## How it was measured

- `bench.mjs` runs the live runner service unchanged (`compose.yaml` here `extends` it: image, command, 3-CPU cap,
  5.5 GB, capabilities, pids limit) next to a stand-in api container that holds only the API's own `KeyProxy`
  class. Jobs go over the runner's socket the way the API sends them (`src/runs/runner-client.ts`).
- Each runner gets 4 vCPUs, a CPX32's count: runc on 0-3 (the server's own numbering; this matters, see "the
  pin"), runsc on 4-7. All containers stay on vCPUs 0-11 at a low weight, so 4 of the PC's threads are never used.
  Windows refused to lower the WSL VM's priority without admin rights, so the cap is the protection.
- CPU seconds and peak memory come from the runner container's cgroup: under gVisor that holds the whole sandbox
  (the Sentry and the gofer), so gVisor's own overhead is counted.
- One job at a time for the fixed workloads, the stacks' order rotating every round. Fixture games are clean
  git clones of games built earlier (`runner` steps2-runner-haiku-medium, `match3` portrait-match3-haiku, `car3d`
  car3d-assets-haiku, `td` td2-haiku), so every job starts from the same folder.
- Real builds: the same prompt on the same model, started at the same moment on both stacks (a pair), each stack
  with its own proxy and the live API key; the SDK's own record splits each build into time in model calls
  (`duration_api_ms`) and the rest.
- Two control stacks for the fixed workloads: `runc-tuned` (the malloc setting alone, on runc) and `runsc-plain`
  (gVisor without it). A third arm for the real builds, `runc-nopin` (runc with the pin bug fixed: a do-nothing
  `taskset` first on the jobs' PATH, `compose.nopin.yaml`), ran the same 18 builds beside the pairs on vCPUs 8-11,
  started after the first 6 pairs had shown the pin at work, so not paired with them.
- Noise: medians, min-max, a 95% bootstrap interval of the change and a permutation p. An interval that spans 0%
  means these runs can't tell the two apart.

## Findings beside the numbers

- **The pin: on the live server every check runs on one CPU today.** `packages/agent/tools/cpu.mjs` (made for
  Luka's PC) runs `taskset -pc 2-2` on the check, because Node sees the runner's 3-CPU cap as 3 CPUs; Godot's runs
  and the hidden browser inside the check then share CPU 2. Measured with a 3-thread burner: runc 12.0 CPU-s in
  4 s free, 4.1 CPU-s pinned. gVisor ignores CPU pinning (12.1 both ways), so under gVisor the same check gets all
  3 CPUs. The tables show the check "as on the server" and "no pin" (like for like). In real builds the pin costs
  most on 3D games: the browser draws 1 frame a second, the screenshots come out poor, and the agent checks again
  (one runc 3D build made 25 checks, its gVisor pair 7; 3D builds on Smart: runc 13.0, 13.2 and 4.2 min, runc
  without the pin 4.8, 3.7 and 4.7 min). A fix that is not part of this trial: skip the pin in the runner (the
  container caps CPU already), e.g. an env switch like `TYPEPLAY_BROWSER_LOCK=0`. Unpinned checks use the 3 CPUs, so
  builds running at once share them more (CPU per build on Fast: runc 310 CPU-s median, runc-nopin 497, gVisor 729).
- **Why Godot is slow under gVisor.** Pure computation costs the same (+5%), big file writes too, single process
  starts too. What costs 3-5×: many small system calls. A Godot import makes ~42,000 of them, 24,179 of them
  `mprotect` (glibc's per-thread heaps growing page by page), each one an address-space change gVisor's Sentry
  has to make in its own memory map. Two malloc arenas grown in 64 MB steps bring that to 25; the web export
  under gVisor goes from ~12 s to ~7 s, and plain runc is unchanged (~5 s). Tried and no help: gVisor's root
  overlay in memory (`--overlay2=root:memory`), huge pages for the Sentry (`shmem_enabled=advise`), more arenas,
  bigger steps, trim and mmap thresholds.
- **`--file-access-mounts=exclusive` can't be used**: the sandbox then never saw a game folder created from outside
  it ("no game in this project"), and the API changes game folders from outside (exports, Android files).
- gVisor quirks that don't matter on the server but cost time here: a cpuset past CPU 7 is applied wrongly (8-11
  became 0-3, 12-15 became 4-7); `docker cp` into the container writes where the sandbox doesn't look (its root
  overlay); `nproc` inside is the CPU cap (3), not the cpuset.

## How to run it again

```bash
wsl -u root -e bash apps/server/test/gvisor/setup-wsl.sh        # once: Docker 29.9.2 + gVisor (deploy/api/gvisor.sh)
# the image, from a context pruned on Windows like deploy.mjs api does (build-image.sh says how):
wsl -u root -e bash apps/server/test/gvisor/build-image.sh <pruned context>
wsl -u root -e bash apps/server/test/gvisor/compose-check.sh    # the live compose file under gVisor: 8 checks
wsl -u root -e bash apps/server/test/gvisor/upgrade-check.sh    # main's stack → this one, as a deploy would
wsl -u root -e node apps/server/test/gvisor/bench.mjs setup     # fixtures, the 3D library (Node 22: ~/tp-android/node)
wsl -u root -e node apps/server/test/gvisor/bench.mjs jobstart|coldstart|export|android|check|builds|report|down
```

`builds` uses the live API key from the root `.env` (written to a mode-600 file for the stand-in proxy only while
builds run, then deleted) and stops past $20 of metered model spend. Raw rows: `results/*.jsonl`.

Left in WSL after the trial: Docker (starts on demand through `docker.socket`, not with every WSL start), gVisor, the
`typeplay-api` image (6.6 GB) and `/srv/gvbench` (fixtures, the 3D library: 1.6 GB). All of it goes with
`docker system prune -a && rm -rf /srv/gvbench`.

## Every measurement (generated by `bench.mjs report`)

### A job's own cost (the runner: home, chown, spawn, clean-up)

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| git rev-parse (round trip) | 30 + 30 | 10 (10-25) ms | 34 (29-77) ms | **+229%** | +209% to +245% | 0.000 |
| git rev-parse (round trip), **runc-tuned** | 30 + 30 | 10 (10-25) ms | 11 (10-21) ms | **+2%** | -4% to +5% | 0.461 |
| git rev-parse (round trip), **runsc-plain** | 30 + 30 | 10 (10-25) ms | 34 (28-78) ms | **+234%** | +210% to +250% | 0.000 |
| empty agent job (node starts and exits) | 30 + 30 | 33 (30-37) ms | 73 (67-85) ms | **+120%** | +114% to +128% | 0.000 |
| empty agent job (node starts and exits), **runc-tuned** | 30 + 30 | 33 (30-37) ms | 33 (30-39) ms | **-2%** | -4% to +2% | 0.381 |
| empty agent job (node starts and exits), **runsc-plain** | 30 + 30 | 33 (30-37) ms | 72 (67-89) ms | **+119%** | +114% to +134% | 0.000 |

### Container start until the runner's socket answers

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| start → /health | 8 + 8 | 332 (319-367) ms | 404 (380-442) ms | **+22%** | +18% to +28% | 0.002 |

### Idle memory of the runner container after a start

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| memory.current, 5 s after | 8 + 8 | 15 (15-16) MB | 30 (30-31) MB | **+100%** | +88% to +100% | 0.024 |

### Web export job (Godot import + export), wall time

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| runner (2D) | 5 + 5 | 6.4 (5.2-6.6) s | 8.5 (8.3-8.9) s | **+35%** | +29% to +67% | 0.045 |
| runner (2D), **runc-tuned** | 5 + 5 | 6.4 (5.2-6.6) s | 6.1 (5.2-6.6) s | **-3%** | -17% to +19% | 0.579 |
| runner (2D), **runsc-plain** | 5 + 5 | 6.4 (5.2-6.6) s | 13.0 (12.2-13.4) s | **+105%** | +92% to +151% | 0.047 |
| match3 (2D) | 5 + 5 | 6.2 (5.2-6.4) s | 8.5 (8.3-8.9) s | **+36%** | +32% to +63% | 0.044 |
| match3 (2D), **runc-tuned** | 5 + 5 | 6.2 (5.2-6.4) s | 6.2 (6.1-6.6) s | **-0%** | -3% to +19% | 0.712 |
| match3 (2D), **runsc-plain** | 5 + 5 | 6.2 (5.2-6.4) s | 13.2 (12.9-13.6) s | **+112%** | +105% to +153% | 0.047 |
| car3d (3D) | 5 + 5 | 6.3 (6.2-6.4) s | 8.7 (8.4-9.3) s | **+39%** | +32% to +48% | 0.047 |
| car3d (3D), **runc-tuned** | 5 + 5 | 6.3 (6.2-6.4) s | 6.2 (6.1-6.6) s | **-1%** | -4% to +5% | 0.431 |
| car3d (3D), **runsc-plain** | 5 + 5 | 6.3 (6.2-6.4) s | 13.1 (12.7-13.5) s | **+108%** | +102% to +115% | 0.047 |

### Web export job, CPU seconds (whole container)

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| runner (2D) | 5 + 5 | 6.0 (5.6-6.1) s | 10.4 (10.1-11.3) s | **+74%** | +69% to +91% | 0.045 |
| runner (2D), **runc-tuned** | 5 + 5 | 6.0 (5.6-6.1) s | 5.9 (5.6-6.3) s | **-2%** | -6% to +7% | 0.716 |
| runner (2D), **runsc-plain** | 5 + 5 | 6.0 (5.6-6.1) s | 17.4 (17.1-18.1) s | **+190%** | +185% to +213% | 0.047 |
| match3 (2D) | 5 + 5 | 5.8 (5.8-6.1) s | 10.5 (10.1-11.3) s | **+80%** | +70% to +94% | 0.044 |
| match3 (2D), **runc-tuned** | 5 + 5 | 5.8 (5.8-6.1) s | 5.9 (5.8-6.4) s | **+2%** | -3% to +11% | 0.380 |
| match3 (2D), **runsc-plain** | 5 + 5 | 5.8 (5.8-6.1) s | 17.6 (17.1-18.1) s | **+203%** | +190% to +210% | 0.116 |
| car3d (3D) | 5 + 5 | 6.2 (6.1-6.5) s | 11.5 (10.7-12.4) s | **+85%** | +70% to +100% | 0.047 |
| car3d (3D), **runc-tuned** | 5 + 5 | 6.2 (6.1-6.5) s | 6.1 (6.0-6.4) s | **-2%** | -7% to +4% | 0.242 |
| car3d (3D), **runsc-plain** | 5 + 5 | 6.2 (6.1-6.5) s | 18.3 (17.4-19.0) s | **+194%** | +179% to +211% | 0.048 |

### Web export job, peak memory

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| runner (2D) | 5 + 5 | 867 (784-868) MB | 706 (675-765) MB | **-19%** | -22% to -10% | 0.117 |
| runner (2D), **runc-tuned** | 5 + 5 | 867 (784-868) MB | 730 (593-730) MB | **-16%** | -32% to -7% | 0.524 |
| runner (2D), **runsc-plain** | 5 + 5 | 867 (784-868) MB | 763 (678-763) MB | **-12%** | -22% to -3% | 0.524 |
| match3 (2D) | 5 + 5 | 868 (825-868) MB | 764 (660-765) MB | **-12%** | -24% to -7% | 0.045 |
| match3 (2D), **runc-tuned** | 5 + 5 | 868 (825-868) MB | 731 (690-731) MB | **-16%** | -21% to -11% | 0.167 |
| match3 (2D), **runsc-plain** | 5 + 5 | 868 (825-868) MB | 764 (719-764) MB | **-12%** | -17% to -7% | 0.167 |
| car3d (3D) | 5 + 5 | 868 (868-868) MB | 764 (708-765) MB | **-12%** | -18% to -12% | 0.169 |
| car3d (3D), **runc-tuned** | 5 + 5 | 868 (868-868) MB | 730 (702-731) MB | **-16%** | -19% to -16% | 0.163 |
| car3d (3D), **runsc-plain** | 5 + 5 | 868 (868-868) MB | 764 (763-765) MB | **-12%** | -12% to -12% | 0.522 |


### gVisor settings tried on the web export job (median wall time per game; CPU seconds, all games)

| variant | n | runner | match3 | car3d | CPU-s |
|---|---|---|---|---|---|
| runc, thp never | 9 | 5.2 s | 5.2 s | 6.1 s | 5.6 |
| runsc, thp never | 9 | 11.7 s | 11.8 s | 12.8 s | 16.8 |
| runsc-ovlmem, thp never | 9 | 11.8 s | 11.7 s | 12.7 s | 16.8 |
| runsc-excl, thp never | 0 | NaN s | NaN s | NaN s | NaN |
| runsc, thp advise | 9 | 11.9 s | 11.8 s | 12.8 s | 16.9 |
| runsc-ovlmem, thp advise | 9 | 13.0 s | 13.1 s | 12.9 s | 17.4 |

Not OK: runsc-excl runner #1 (runner 400: {"err":"no game in this project"}); runsc-excl match3 #1 (runner 400: {"err":"no game in this project"}); runsc-excl car3d #1 (runner 400: {"err":"no game in this project"}); runsc-excl runner #2 (runner 400: {"err":"no game in this project"}); runsc-excl match3 #2 (runner 400: {"err":"no game in this project"}); runsc-excl car3d #2 (runner 400: {"err":"no game in this project"}); runsc-excl runner #3 (runner 400: {"err":"no game in this project"}); runsc-excl match3 #3 (runner 400: {"err":"no game in this project"}); runsc-excl car3d #3 (runner 400: {"err":"no game in this project"})


### The agent's check, wall time

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| runner, as on the server | 4 + 4 | 30.5 (30.1-30.5) s | 31.8 (31.5-32.9) s | **+4%** | +3% to +8% | 0.056 |
| runner, as on the server, **runc-tuned** | 4 + 3 | 30.5 (30.1-30.5) s | 30.0 (29.8-30.7) s | **-1%** | -2% to +1% | 0.145 |
| runner, as on the server, **runsc-plain** | 4 + 3 | 30.5 (30.1-30.5) s | 36.6 (35.8-36.8) s | **+20%** | +17% to +22% | 0.056 |
| match3, as on the server | 4 + 4 | 29.5 (29.4-29.6) s | 31.6 (30.5-32.2) s | **+7%** | +4% to +9% | 0.057 |
| match3, as on the server, **runc-tuned** | 4 + 3 | 29.5 (29.4-29.6) s | 29.5 (29.2-31.2) s | **+0%** | -1% to +6% | 1.000 |
| match3, as on the server, **runsc-plain** | 4 + 3 | 29.5 (29.4-29.6) s | 37.8 (36.6-40.6) s | **+28%** | +24% to +38% | 0.058 |
| car3d, as on the server | 4 + 4 | 58.4 (56.2-64.4) s | 43.6 (42.9-46.2) s | **-25%** | -32% to -20% | 0.055 |
| car3d, as on the server, **runc-tuned** | 4 + 3 | 58.4 (56.2-64.4) s | 61.1 (58.3-63.9) s | **+5%** | -5% to +12% | 0.453 |
| car3d, as on the server, **runsc-plain** | 4 + 3 | 58.4 (56.2-64.4) s | 51.5 (47.8-54.5) s | **-12%** | -22% to -4% | 0.056 |
| runner, no pin | 3 + 3 | 28.6 (28.3-28.6) s | 31.7 (31.4-31.8) s | **+11%** | +10% to +12% | 0.204 |
| car3d, no pin | 3 + 3 | 36.5 (35.6-38.3) s | 43.5 (42.5-55.9) s | **+19%** | +11% to +57% | 0.198 |

### The check's Godot runs (import, run, tests, export)

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| runner, as on the server | 4 + 4 | 7.2 (7.1-7.2) s | 9.6 (9.2-10.1) s | **+34%** | +28% to +41% | 0.056 |
| runner, as on the server, **runc-tuned** | 4 + 3 | 7.2 (7.1-7.2) s | 7.0 (7.0-7.4) s | **-3%** | -3% to +4% | 0.145 |
| runner, as on the server, **runsc-plain** | 4 + 3 | 7.2 (7.1-7.2) s | 14.1 (13.7-14.6) s | **+97%** | +92% to +104% | 0.056 |
| match3, as on the server | 4 + 4 | 6.9 (6.8-7.1) s | 9.6 (8.8-9.9) s | **+39%** | +27% to +44% | 0.057 |
| match3, as on the server, **runc-tuned** | 4 + 3 | 6.9 (6.8-7.1) s | 6.8 (6.7-7.2) s | **-1%** | -4% to +6% | 0.943 |
| match3, as on the server, **runsc-plain** | 4 + 3 | 6.9 (6.8-7.1) s | 14.5 (14.4-18.4) s | **+111%** | +104% to +172% | 0.112 |
| car3d, as on the server | 4 + 4 | 7.4 (7.1-7.4) s | 10.0 (9.7-11.5) s | **+37%** | +31% to +57% | 0.059 |
| car3d, as on the server, **runc-tuned** | 4 + 3 | 7.4 (7.1-7.4) s | 7.2 (7.2-8.8) s | **-2%** | -3% to +21% | 0.739 |
| car3d, as on the server, **runsc-plain** | 4 + 3 | 7.4 (7.1-7.4) s | 15.6 (15.0-17.8) s | **+112%** | +103% to +146% | 0.055 |
| runner, no pin | 3 + 3 | 7.1 (7.1-7.3) s | 9.5 (9.2-9.7) s | **+34%** | +26% to +37% | 0.200 |
| car3d, no pin | 3 + 3 | 7.1 (7.0-7.2) s | 9.8 (9.7-21.5) s | **+39%** | +34% to +207% | 0.201 |

### The check's hidden browser (and node), the rest of the check

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| runner, as on the server | 4 + 4 | 23.2 (23.0-23.3) s | 22.2 (21.9-22.7) s | **-5%** | -6% to -2% | 0.059 |
| runner, as on the server, **runc-tuned** | 4 + 3 | 23.2 (23.0-23.3) s | 23.0 (22.8-23.2) s | **-1%** | -2% to +1% | 0.319 |
| runner, as on the server, **runsc-plain** | 4 + 3 | 23.2 (23.0-23.3) s | 22.2 (21.9-22.4) s | **-5%** | -6% to -3% | 0.058 |
| match3, as on the server | 4 + 4 | 22.5 (22.5-22.6) s | 21.9 (21.7-22.2) s | **-3%** | -4% to -2% | 0.056 |
| match3, as on the server, **runc-tuned** | 4 + 3 | 22.5 (22.5-22.6) s | 22.6 (22.4-23.9) s | **+0%** | -1% to +6% | 0.568 |
| match3, as on the server, **runsc-plain** | 4 + 3 | 22.5 (22.5-22.6) s | 22.1 (21.9-23.3) s | **-2%** | -3% to +3% | 0.139 |
| car3d, as on the server | 4 + 4 | 51.1 (48.8-56.9) s | 33.6 (32.7-34.5) s | **-34%** | -41% to -31% | 0.055 |
| car3d, as on the server, **runc-tuned** | 4 + 3 | 51.1 (48.8-56.9) s | 53.8 (51.1-55.1) s | **+5%** | -6% to +11% | 0.397 |
| car3d, as on the server, **runsc-plain** | 4 + 3 | 51.1 (48.8-56.9) s | 35.7 (32.6-36.5) s | **-30%** | -40% to -26% | 0.114 |
| runner, no pin | 3 + 3 | 21.2 (21.2-21.5) s | 22.1 (22.1-22.1) s | **+4%** | +3% to +4% | 0.204 |
| car3d, no pin | 3 + 3 | 29.4 (28.5-31.0) s | 33.7 (32.6-34.1) s | **+14%** | +5% to +20% | 0.198 |

### Browser frames a second while playing (software WebGL)

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| runner, as on the server | 4 + 4 | 13 (13-13) fps | 28 (27-29) fps | **+115%** | +108% to +123% | 0.146 |
| runner, as on the server, **runc-tuned** | 4 + 3 | 13 (13-13) fps | 13 (12-13) fps | **+0%** | -8% to +0% | 1.000 |
| runner, as on the server, **runsc-plain** | 4 + 3 | 13 (13-13) fps | 29 (28-30) fps | **+123%** | +115% to +131% | 0.144 |
| match3, as on the server | 4 + 4 | 15 (14-15) fps | 29 (25-30) fps | **+97%** | +72% to +111% | 0.088 |
| match3, as on the server, **runc-tuned** | 4 + 3 | 15 (14-15) fps | 15 (9-15) fps | **+3%** | -40% to +7% | 1.000 |
| match3, as on the server, **runsc-plain** | 4 + 3 | 15 (14-15) fps | 27 (11-28) fps | **+86%** | -27% to +100% | 0.139 |
| car3d, as on the server | 4 + 4 | 1 (1-1) fps | 3 (3-3) fps | **+200%** | +200% to +200% | 0.493 |
| car3d, as on the server, **runc-tuned** | 4 + 3 | 1 (1-1) fps | 1 (1-1) fps | **+0%** | +0% to +0% | 1.000 |
| car3d, as on the server, **runsc-plain** | 4 + 3 | 1 (1-1) fps | 2 (2-3) fps | **+100%** | +100% to +200% | 0.484 |
| runner, no pin | 3 + 3 | 31 (25-31) fps | 28 (27-29) fps | **-10%** | -13% to +16% | 0.397 |
| car3d, no pin | 3 + 3 | 3 (3-3) fps | 3 (3-3) fps | **+0%** | +0% to +0% | 1.000 |

### The check, CPU seconds

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| runner, as on the server | 4 + 4 | 32.2 (31.8-32.8) s | 73.4 (72.9-74.3) s | **+128%** | +124% to +132% | 0.062 |
| runner, as on the server, **runc-tuned** | 4 + 3 | 32.2 (31.8-32.8) s | 31.8 (31.7-32.7) s | **-1%** | -3% to +3% | 0.743 |
| runner, as on the server, **runsc-plain** | 4 + 3 | 32.2 (31.8-32.8) s | 81.1 (79.7-81.5) s | **+152%** | +144% to +155% | 0.056 |
| match3, as on the server | 4 + 4 | 32.2 (32.0-32.3) s | 72.2 (70.9-73.1) s | **+124%** | +120% to +127% | 0.060 |
| match3, as on the server, **runc-tuned** | 4 + 3 | 32.2 (32.0-32.3) s | 31.9 (31.6-34.2) s | **-1%** | -2% to +7% | 0.457 |
| match3, as on the server, **runsc-plain** | 4 + 3 | 32.2 (32.0-32.3) s | 79.9 (79.9-84.8) s | **+148%** | +147% to +165% | 0.166 |
| car3d, as on the server | 4 + 4 | 60.9 (58.4-67.5) s | 106.1 (103.7-111.1) s | **+74%** | +57% to +84% | 0.060 |
| car3d, as on the server, **runc-tuned** | 4 + 3 | 60.9 (58.4-67.5) s | 63.9 (60.6-67.2) s | **+5%** | -6% to +13% | 0.453 |
| car3d, as on the server, **runsc-plain** | 4 + 3 | 60.9 (58.4-67.5) s | 121.2 (111.9-124.3) s | **+99%** | +74% to +109% | 0.055 |
| runner, no pin | 3 + 3 | 68.3 (67.9-68.9) s | 73.5 (73.1-73.7) s | **+8%** | +6% to +8% | 0.204 |
| car3d, no pin | 3 + 3 | 92.0 (89.0-96.9) s | 106.4 (104.1-119.7) s | **+16%** | +7% to +35% | 0.198 |

### The check, peak memory

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| runner, as on the server | 4 + 4 | 2805 (2683-2805) MB | 1097 (1010-1101) MB | **-61%** | -64% to -59% | 0.057 |
| runner, as on the server, **runc-tuned** | 4 + 3 | 2805 (2683-2805) MB | 915 (833-915) MB | **-67%** | -70% to -66% | 0.169 |
| runner, as on the server, **runsc-plain** | 4 + 3 | 2805 (2683-2805) MB | 1011 (926-1014) MB | **-64%** | -67% to -62% | 0.057 |
| match3, as on the server | 4 + 4 | 2805 (2764-2806) MB | 1102 (1079-1107) MB | **-61%** | -62% to -60% | 0.056 |
| match3, as on the server, **runc-tuned** | 4 + 3 | 2805 (2764-2806) MB | 934 (873-954) MB | **-67%** | -69% to -66% | 0.057 |
| match3, as on the server, **runsc-plain** | 4 + 3 | 2805 (2764-2806) MB | 1013 (962-1015) MB | **-64%** | -66% to -63% | 0.057 |
| car3d, as on the server | 4 + 4 | 2872 (2870-2876) MB | 1189 (1188-1190) MB | **-59%** | -59% to -59% | 0.062 |
| car3d, as on the server, **runc-tuned** | 4 + 3 | 2872 (2870-2876) MB | 1012 (1001-1026) MB | **-65%** | -65% to -64% | 0.056 |
| car3d, as on the server, **runsc-plain** | 4 + 3 | 2872 (2870-2876) MB | 1120 (1096-1129) MB | **-61%** | -62% to -61% | 0.056 |
| runner, no pin | 3 + 3 | 2805 (2805-2806) MB | 1102 (1098-1104) MB | **-61%** | -61% to -61% | 0.405 |
| car3d, no pin | 3 + 3 | 2880 (2878-2881) MB | 1192 (1192-1196) MB | **-59%** | -59% to -58% | 0.197 |


### Android export job (unsigned), wall time

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| APK | 3 + 3 | 9.6 (8.5-10.3) s | 12.9 (12.8-13.0) s | **+34%** | +25% to +52% | 0.197 |
| APK, **runc-tuned** | 3 + 3 | 9.6 (8.5-10.3) s | 9.6 (9.5-9.6) s | **-0%** | -8% to +13% | 1.000 |
| APK, **runsc-plain** | 3 + 3 | 9.6 (8.5-10.3) s | 17.0 (16.9-17.2) s | **+77%** | +65% to +102% | 0.200 |
| AAB (Gradle) | 3 + 3 | 38.7 (38.4-40.1) s | 54.4 (53.3-54.9) s | **+40%** | +33% to +43% | 0.203 |
| AAB (Gradle), **runc-tuned** | 3 + 3 | 38.7 (38.4-40.1) s | 39.5 (38.1-39.9) s | **+2%** | -5% to +4% | 1.000 |
| AAB (Gradle), **runsc-plain** | 3 + 3 | 38.7 (38.4-40.1) s | 62.8 (58.9-65.8) s | **+62%** | +47% to +71% | 0.203 |

### Android export job, CPU seconds

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| APK | 3 + 3 | 9.7 (9.6-10.5) s | 16.1 (16.0-16.6) s | **+66%** | +53% to +73% | 0.201 |
| APK, **runc-tuned** | 3 + 3 | 9.7 (9.6-10.5) s | 9.6 (9.6-9.7) s | **-1%** | -9% to +1% | 0.400 |
| APK, **runsc-plain** | 3 + 3 | 9.7 (9.6-10.5) s | 22.9 (22.4-22.9) s | **+135%** | +113% to +139% | 0.200 |
| AAB (Gradle) | 3 + 3 | 70.0 (69.5-71.3) s | 119.0 (116.6-123.4) s | **+70%** | +63% to +78% | 0.201 |
| AAB (Gradle), **runc-tuned** | 3 + 3 | 70.0 (69.5-71.3) s | 69.6 (68.7-72.8) s | **-1%** | -4% to +5% | 1.000 |
| AAB (Gradle), **runsc-plain** | 3 + 3 | 70.0 (69.5-71.3) s | 136.7 (128.7-147.8) s | **+95%** | +80% to +113% | 0.203 |

### Android export job, peak memory

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| APK | 3 + 3 | 2364 (1112-2368) MB | 958 (789-958) MB | **-59%** | -67% to -14% | 0.403 |
| APK, **runc-tuned** | 3 + 3 | 2364 (1112-2368) MB | 814 (798-840) MB | **-66%** | -66% to -24% | 0.198 |
| APK, **runsc-plain** | 3 + 3 | 2364 (1112-2368) MB | 894 (842-897) MB | **-62%** | -64% to -19% | 0.198 |
| AAB (Gradle) | 3 + 3 | 5632 (5607-5632) MB | 4339 (4319-4393) MB | **-23%** | -23% to -22% | 0.201 |
| AAB (Gradle), **runc-tuned** | 3 + 3 | 5632 (5607-5632) MB | 4271 (4153-4326) MB | **-24%** | -26% to -23% | 0.201 |
| AAB (Gradle), **runsc-plain** | 3 + 3 | 5632 (5607-5632) MB | 4222 (4179-4312) MB | **-25%** | -26% to -23% | 0.201 |


### Real builds, wall time (what the player waits)

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| Fast (haiku), all prompts | 9 + 9 | 13.0 (10.0-28.3) min | 15.0 (11.2-23.7) min | **+15%** | -12% to +51% | 0.340 |
| Fast (haiku), all prompts, **runc-nopin** | 9 + 9 | 13.0 (10.0-28.3) min | 12.3 (9.9-18.7) min | **-5%** | -26% to +43% | 0.798 |
| Fast: runner | 3 + 3 | 11.3 (10.0-11.6) min | 11.6 (11.2-12.9) min | **+3%** | -3% to +29% | 0.604 |
| Fast: runner, **runc-nopin** | 3 + 3 | 11.3 (10.0-11.6) min | 10.3 (9.9-16.5) min | **-9%** | -14% to +66% | 1.000 |
| Fast: match3 | 3 + 3 | 14.2 (13.0-17.0) min | 16.9 (12.7-18.9) min | **+19%** | -25% to +46% | 1.000 |
| Fast: match3, **runc-nopin** | 3 + 3 | 14.2 (13.0-17.0) min | 11.6 (11.4-12.3) min | **-18%** | -33% to -5% | 0.201 |
| Fast: car3d | 3 + 3 | 13.9 (12.5-28.3) min | 17.8 (15.0-23.7) min | **+28%** | -47% to +89% | 0.597 |
| Fast: car3d, **runc-nopin** | 3 + 3 | 13.9 (12.5-28.3) min | 18.0 (13.3-18.7) min | **+29%** | -53% to +49% | 1.000 |
| Smart (sonnet), all prompts | 9 + 9 | 5.7 (3.6-13.2) min | 5.8 (3.7-8.7) min | **+1%** | -55% to +39% | 1.000 |
| Smart (sonnet), all prompts, **runc-nopin** | 9 + 9 | 5.7 (3.6-13.2) min | 4.7 (2.9-8.7) min | **-17%** | -63% to +16% | 0.555 |
| Smart: runner | 3 + 3 | 5.8 (3.6-6.5) min | 4.9 (3.7-5.9) min | **-16%** | -42% to +64% | 1.000 |
| Smart: runner, **runc-nopin** | 3 + 3 | 5.8 (3.6-6.5) min | 3.5 (2.9-3.7) min | **-40%** | -56% to +2% | 0.198 |
| Smart: match3 | 3 + 3 | 5.6 (4.1-5.7) min | 5.8 (5.1-6.5) min | **+3%** | -11% to +57% | 0.601 |
| Smart: match3, **runc-nopin** | 3 + 3 | 5.6 (4.1-5.7) min | 6.5 (6.5-8.7) min | **+16%** | +13% to +110% | 0.201 |
| Smart: car3d | 3 + 3 | 13.0 (4.2-13.2) min | 5.8 (4.7-8.7) min | **-56%** | -65% to +106% | 0.400 |
| Smart: car3d, **runc-nopin** | 3 + 3 | 13.0 (4.2-13.2) min | 4.7 (3.7-4.8) min | **-63%** | -72% to +14% | 0.400 |

### Real builds, time outside model calls (tools, Godot, checks, Claude Code itself)

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| Fast (haiku), all prompts | 9 + 9 | 4.6 (2.5-18.7) min | 5.6 (2.7-12.2) min | **+21%** | -31% to +164% | 0.796 |
| Fast (haiku), all prompts, **runc-nopin** | 9 + 9 | 4.6 (2.5-18.7) min | 3.4 (2.0-8.8) min | **-26%** | -54% to +133% | 1.000 |
| Fast: runner | 3 + 3 | 2.7 (2.5-3.0) min | 3.2 (2.7-3.8) min | **+17%** | -9% to +53% | 0.200 |
| Fast: runner, **runc-nopin** | 3 + 3 | 2.7 (2.5-3.0) min | 2.5 (2.0-5.3) min | **-8%** | -35% to +112% | 0.602 |
| Fast: match3 | 3 + 3 | 4.6 (2.7-5.6) min | 5.6 (3.9-7.1) min | **+21%** | -31% to +169% | 1.000 |
| Fast: match3, **runc-nopin** | 3 + 3 | 4.6 (2.7-5.6) min | 3.0 (2.6-3.4) min | **-35%** | -54% to +28% | 0.397 |
| Fast: car3d | 3 + 3 | 7.3 (5.3-18.7) min | 9.9 (5.8-12.2) min | **+36%** | -69% to +128% | 1.000 |
| Fast: car3d, **runc-nopin** | 3 + 3 | 7.3 (5.3-18.7) min | 7.9 (6.3-8.8) min | **+9%** | -66% to +65% | 1.000 |
| Smart (sonnet), all prompts | 9 + 9 | 3.1 (1.6-11.0) min | 2.7 (1.7-6.1) min | **-13%** | -68% to +78% | 0.801 |
| Smart (sonnet), all prompts, **runc-nopin** | 9 + 9 | 3.1 (1.6-11.0) min | 2.8 (1.4-4.6) min | **-11%** | -69% to +94% | 1.000 |
| Smart: runner | 3 + 3 | 3.2 (1.7-4.0) min | 2.7 (1.7-3.0) min | **-15%** | -57% to +78% | 0.603 |
| Smart: runner, **runc-nopin** | 3 + 3 | 3.2 (1.7-4.0) min | 1.6 (1.4-1.9) min | **-50%** | -65% to +16% | 0.201 |
| Smart: match3 | 3 + 3 | 1.7 (1.6-2.5) min | 2.2 (2.1-2.3) min | **+30%** | -13% to +40% | 0.400 |
| Smart: match3, **runc-nopin** | 3 + 3 | 1.7 (1.6-2.5) min | 3.3 (3.2-4.6) min | **+98%** | +31% to +184% | 0.197 |
| Smart: car3d | 3 + 3 | 10.6 (3.1-11.0) min | 4.3 (3.4-6.1) min | **-59%** | -69% to +95% | 0.400 |
| Smart: car3d, **runc-nopin** | 3 + 3 | 10.6 (3.1-11.0) min | 2.8 (2.0-3.5) min | **-74%** | -81% to +12% | 0.201 |

### Real builds, time in model calls (the SDK's duration_api_ms)

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| Fast (haiku), all prompts | 9 + 9 | 8.6 (6.7-11.4) min | 9.1 (8.0-11.8) min | **+5%** | -12% to +35% | 0.695 |
| Fast (haiku), all prompts, **runc-nopin** | 9 + 9 | 8.6 (6.7-11.4) min | 8.8 (7.0-11.2) min | **+2%** | -18% to +29% | 1.000 |
| Fast: runner | 3 + 3 | 8.6 (7.5-8.6) min | 8.5 (8.4-9.1) min | **-0%** | -2% to +21% | 1.000 |
| Fast: runner, **runc-nopin** | 3 + 3 | 8.6 (7.5-8.6) min | 7.9 (7.8-11.2) min | **-7%** | -9% to +50% | 1.000 |
| Fast: match3 | 3 + 3 | 10.3 (9.6-11.4) min | 11.4 (8.9-11.8) min | **+10%** | -22% to +23% | 1.000 |
| Fast: match3, **runc-nopin** | 3 + 3 | 10.3 (9.6-11.4) min | 8.8 (8.2-9.3) min | **-15%** | -28% to -3% | 0.201 |
| Fast: car3d | 3 + 3 | 7.2 (6.7-9.7) min | 9.2 (8.0-11.5) min | **+27%** | -18% to +73% | 0.403 |
| Fast: car3d, **runc-nopin** | 3 + 3 | 7.2 (6.7-9.7) min | 9.9 (7.0-10.1) min | **+37%** | -27% to +52% | 0.405 |
| Smart (sonnet), all prompts | 9 + 9 | 2.5 (1.1-3.9) min | 2.6 (1.3-4.3) min | **+4%** | -41% to +46% | 0.692 |
| Smart (sonnet), all prompts, **runc-nopin** | 9 + 9 | 2.5 (1.1-3.9) min | 2.0 (1.3-4.1) min | **-23%** | -41% to +31% | 0.391 |
| Smart: runner | 3 + 3 | 2.5 (1.9-2.6) min | 2.1 (2.0-2.9) min | **-13%** | -22% to +51% | 1.000 |
| Smart: runner, **runc-nopin** | 3 + 3 | 2.5 (1.9-2.6) min | 1.6 (1.5-2.1) min | **-36%** | -43% to +8% | 0.198 |
| Smart: match3 | 3 + 3 | 3.3 (2.5-3.9) min | 3.5 (2.9-4.3) min | **+8%** | -25% to +71% | 1.000 |
| Smart: match3, **runc-nopin** | 3 + 3 | 3.3 (2.5-3.9) min | 3.2 (3.1-4.1) min | **-1%** | -20% to +63% | 1.000 |
| Smart: car3d | 3 + 3 | 2.0 (1.1-2.6) min | 1.5 (1.3-2.6) min | **-28%** | -50% to +136% | 1.000 |
| Smart: car3d, **runc-nopin** | 3 + 3 | 2.0 (1.1-2.6) min | 1.6 (1.3-2.0) min | **-20%** | -50% to +76% | 0.604 |

### Real builds, time to the first progress event

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| Fast (haiku), all prompts | 9 + 9 | 0.2 (0.2-0.3) s | 0.3 (0.2-0.5) s | **+40%** | +12% to +104% | 0.024 |
| Fast (haiku), all prompts, **runc-nopin** | 9 + 9 | 0.2 (0.2-0.3) s | 0.1 (0.1-0.5) s | **-32%** | -42% to +12% | 0.019 |
| Fast: runner | 3 + 3 | 0.2 (0.2-0.2) s | 0.3 (0.3-0.3) s | **+40%** | +27% to +83% | 0.203 |
| Fast: runner, **runc-nopin** | 3 + 3 | 0.2 (0.2-0.2) s | 0.2 (0.1-0.3) s | **-7%** | -37% to +40% | 1.000 |
| Fast: match3 | 3 + 3 | 0.2 (0.2-0.3) s | 0.3 (0.2-0.5) s | **+31%** | -26% to +174% | 0.603 |
| Fast: match3, **runc-nopin** | 3 + 3 | 0.2 (0.2-0.3) s | 0.1 (0.1-0.2) s | **-36%** | -56% to +2% | 0.201 |
| Fast: car3d | 3 + 3 | 0.2 (0.2-0.3) s | 0.3 (0.3-0.5) s | **+48%** | -6% to +154% | 0.200 |
| Fast: car3d, **runc-nopin** | 3 + 3 | 0.2 (0.2-0.3) s | 0.1 (0.1-0.5) s | **-38%** | -56% to +137% | 0.601 |
| Smart (sonnet), all prompts | 9 + 9 | 0.2 (0.1-0.4) s | 0.3 (0.2-0.8) s | **+27%** | -17% to +171% | 0.142 |
| Smart (sonnet), all prompts, **runc-nopin** | 9 + 9 | 0.2 (0.1-0.4) s | 0.2 (0.1-0.2) s | **-37%** | -53% to +10% | 0.010 |
| Smart: runner | 3 + 3 | 0.2 (0.1-0.3) s | 0.3 (0.3-0.4) s | **+74%** | -0% to +193% | 0.197 |
| Smart: runner, **runc-nopin** | 3 + 3 | 0.2 (0.1-0.3) s | 0.2 (0.1-0.2) s | **-14%** | -43% to +40% | 1.000 |
| Smart: match3 | 3 + 3 | 0.3 (0.2-0.4) s | 0.5 (0.3-0.8) s | **+50%** | -27% to +212% | 0.405 |
| Smart: match3, **runc-nopin** | 3 + 3 | 0.3 (0.2-0.4) s | 0.1 (0.1-0.2) s | **-58%** | -61% to -25% | 0.201 |
| Smart: car3d | 3 + 3 | 0.2 (0.2-0.3) s | 0.3 (0.2-0.5) s | **+45%** | -19% to +174% | 0.397 |
| Smart: car3d, **runc-nopin** | 3 + 3 | 0.2 (0.2-0.3) s | 0.2 (0.1-0.2) s | **+10%** | -56% to +29% | 1.000 |

### Real builds, CPU seconds

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| Fast (haiku), all prompts | 9 + 9 | 310.3 (168.3-1155.8) s | 728.5 (383.9-1668.1) s | **+135%** | +43% to +388% | 0.034 |
| Fast (haiku), all prompts, **runc-nopin** | 9 + 9 | 310.3 (168.3-1155.8) s | 496.9 (292.9-1261.4) s | **+60%** | -1% to +421% | 0.058 |
| Fast: runner | 3 + 3 | 179.1 (168.3-202.0) s | 448.5 (383.9-532.3) s | **+150%** | +90% to +216% | 0.200 |
| Fast: runner, **runc-nopin** | 3 + 3 | 179.1 (168.3-202.0) s | 349.8 (292.9-777.6) s | **+95%** | +45% to +362% | 0.197 |
| Fast: match3 | 3 + 3 | 310.3 (178.0-368.0) s | 728.5 (527.2-873.5) s | **+135%** | +43% to +391% | 0.203 |
| Fast: match3, **runc-nopin** | 3 + 3 | 310.3 (178.0-368.0) s | 429.0 (363.8-496.9) s | **+38%** | -1% to +179% | 0.201 |
| Fast: car3d | 3 + 3 | 462.8 (342.3-1155.8) s | 1470.6 (827.8-1668.1) s | **+218%** | -28% to +387% | 0.204 |
| Fast: car3d, **runc-nopin** | 3 + 3 | 462.8 (342.3-1155.8) s | 1200.3 (932.8-1261.4) s | **+159%** | -19% to +268% | 0.204 |
| Smart (sonnet), all prompts | 9 + 9 | 192.6 (106.0-691.2) s | 370.6 (229.8-865.5) s | **+92%** | -30% to +288% | 0.043 |
| Smart (sonnet), all prompts, **runc-nopin** | 9 + 9 | 192.6 (106.0-691.2) s | 400.3 (202.9-552.1) s | **+108%** | -29% to +315% | 0.120 |
| Smart: runner | 3 + 3 | 221.5 (108.4-275.0) s | 370.6 (229.8-395.8) s | **+67%** | -16% to +265% | 0.201 |
| Smart: runner, **runc-nopin** | 3 + 3 | 221.5 (108.4-275.0) s | 215.7 (202.9-274.6) s | **-3%** | -26% to +153% | 1.000 |
| Smart: match3 | 3 + 3 | 111.4 (106.0-159.4) s | 296.8 (247.3-302.6) s | **+166%** | +55% to +186% | 0.197 |
| Smart: match3, **runc-nopin** | 3 + 3 | 111.4 (106.0-159.4) s | 470.8 (449.2-552.1) s | **+322%** | +182% to +421% | 0.201 |
| Smart: car3d | 3 + 3 | 664.5 (192.6-691.2) s | 618.3 (461.9-865.5) s | **-7%** | -33% to +349% | 1.000 |
| Smart: car3d, **runc-nopin** | 3 + 3 | 664.5 (192.6-691.2) s | 400.3 (298.9-518.0) s | **-40%** | -57% to +169% | 0.400 |

### Real builds, peak memory

| | n | runc median (min-max) | other median (min-max) | change | 95% interval of the change | p |
|---|---|---|---|---|---|---|
| Fast (haiku), all prompts | 9 + 9 | 1416 (1032-1548) MB | 1141 (975-1528) MB | **-19%** | -30% to +3% | 0.132 |
| Fast (haiku), all prompts, **runc-nopin** | 9 + 9 | 1416 (1032-1548) MB | 1006 (877-1444) MB | **-29%** | -40% to -22% | 0.027 |
| Fast: runner | 3 + 3 | 1416 (1359-1482) MB | 1083 (1011-1177) MB | **-24%** | -32% to -13% | 0.201 |
| Fast: runner, **runc-nopin** | 3 + 3 | 1416 (1359-1482) MB | 1060 (911-1083) MB | **-25%** | -39% to -20% | 0.201 |
| Fast: match3 | 3 + 3 | 1363 (1032-1548) MB | 1141 (975-1528) MB | **-16%** | -37% to +48% | 1.000 |
| Fast: match3, **runc-nopin** | 3 + 3 | 1363 (1032-1548) MB | 887 (880-1020) MB | **-35%** | -43% to -1% | 0.197 |
| Fast: car3d | 3 + 3 | 1465 (1348-1524) MB | 1312 (1037-1513) MB | **-10%** | -32% to +12% | 0.597 |
| Fast: car3d, **runc-nopin** | 3 + 3 | 1465 (1348-1524) MB | 1006 (877-1444) MB | **-31%** | -42% to +7% | 0.197 |
| Smart (sonnet), all prompts | 9 + 9 | 1308 (1069-1602) MB | 1183 (924-1588) MB | **-10%** | -32% to +23% | 0.693 |
| Smart (sonnet), all prompts, **runc-nopin** | 9 + 9 | 1308 (1069-1602) MB | 1044 (924-1515) MB | **-20%** | -34% to +0% | 0.135 |
| Smart: runner | 3 + 3 | 1476 (1308-1567) MB | 982 (924-1008) MB | **-33%** | -41% to -23% | 0.201 |
| Smart: runner, **runc-nopin** | 3 + 3 | 1476 (1308-1567) MB | 1085 (945-1359) MB | **-26%** | -40% to +4% | 0.201 |
| Smart: match3 | 3 + 3 | 1292 (1069-1602) MB | 1183 (1004-1538) MB | **-8%** | -37% to +44% | 1.000 |
| Smart: match3, **runc-nopin** | 3 + 3 | 1292 (1069-1602) MB | 1039 (924-1080) MB | **-20%** | -42% to +1% | 0.203 |
| Smart: car3d | 3 + 3 | 1163 (1078-1458) MB | 1534 (1324-1588) MB | **+32%** | -9% to +47% | 0.201 |
| Smart: car3d, **runc-nopin** | 3 + 3 | 1163 (1078-1458) MB | 1044 (978-1515) MB | **-10%** | -33% to +41% | 0.591 |

### Real builds, pair by pair (same prompt, same model, started together)

| pair | prompt | model | runc | runsc | change | runc rest | runsc rest | both OK |
|---|---|---|---|---|---|---|---|---|
| 1 | runner | Fast | 11.3 min | 11.2 min | -1% | 2.7 | 2.7 | yes |
| 2 | runner | Smart | 3.6 min | 3.7 min | +4% | 1.7 | 1.7 | yes |
| 3 | match3 | Fast | 14.2 min | 16.9 min | +19% | 4.6 | 5.6 | yes |
| 4 | match3 | Smart | 5.6 min | 5.8 min | +3% | 1.7 | 2.3 | yes |
| 5 | car3d | Fast | 28.3 min | 15.0 min | -47% | 18.7 | 5.8 | yes |
| 6 | car3d | Smart | 13.0 min | 5.8 min | -56% | 11.0 | 4.3 | yes |
| 7 | runner | Fast | 11.6 min | 12.9 min | +12% | 3.0 | 3.8 | yes |
| 8 | runner | Smart | 5.8 min | 5.9 min | +1% | 3.2 | 3.0 | yes |
| 9 | match3 | Fast | 13.0 min | 12.7 min | -2% | 2.7 | 3.9 | yes |
| 10 | match3 | Smart | 4.1 min | 5.1 min | +24% | 1.6 | 2.2 | yes |
| 11 | car3d | Fast | 12.5 min | 17.8 min | +42% | 5.3 | 9.9 | yes |
| 12 | car3d | Smart | 13.2 min | 4.7 min | -65% | 10.6 | 3.4 | yes |
| 13 | runner | Fast | 10.0 min | 11.6 min | +16% | 2.5 | 3.2 | yes |
| 14 | runner | Smart | 6.5 min | 4.9 min | -25% | 4.0 | 2.7 | yes |
| 15 | match3 | Fast | 17.0 min | 18.9 min | +11% | 5.6 | 7.1 | yes |
| 16 | match3 | Smart | 5.7 min | 6.5 min | +13% | 2.5 | 2.1 | yes |
| 17 | car3d | Fast | 13.9 min | 23.7 min | +70% | 7.3 | 12.2 | yes |
| 18 | car3d | Smart | 4.2 min | 8.7 min | +106% | 3.1 | 6.1 | yes |

Fast: median pair change +12% over 9 pairs (runsc slower in 6, faster in 3)

Smart: median pair change +3% over 9 pairs (runsc slower in 6, faster in 3)

Model spend of the trial builds (metered by the proxy): $15.10 for 54 builds.

