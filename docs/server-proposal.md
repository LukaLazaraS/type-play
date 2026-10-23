# Backend server proposal (package 5, parked #7)

Claude proposes, Luka decides. 2026-10-17. Prices are Hetzner's official list after the June 2026
increase (https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), excl. VAT;
stock checked today through the Hetzner API. **Luka's Hetzner account bills in USD** (the API says
so): the CX23 is $6.49 + $0.60 IPv4 a month (€5.49 list), not the "€6.49" in `deploy/README.md`.

## What one agent session needs

| Part | RAM | CPU | How long | Source |
|---|---|---|---|---|
| Claude Code process (1 per session) | 0.2-0.35 GB working set, 0.4-0.6 GB private | low: waits on the API | whole session: builds 1.6-12 min, edits 1.1-2.6 min | measured: 11 Claude Code processes on Luka's PC today; times from `packages/agent/RESULTS.md`. Anthropic's hosting page: "1 GiB RAM, 5 GiB disk, and 1 CPU per agent is a reasonable starting point" |
| Godot import / export | ~0.6 GB peak | ~1 core | ~3 s each | measured today on copies of a 2D runner and the 3D town |
| Godot run + feature tests | < 0.1 GB | 1 core | < 1 s each | measured |
| Hidden browser for screenshots (software WebGL) | ~0.6-0.9 GB | 1-2 cores | ~22 s per check | time measured (a full check takes 28 s); RAM from a snapshot of a running check browser (estimate); CPU is an estimate: a few of them in parallel took ~90% of Luka's 16-thread PC and froze it today |
| Checks per build / edit | | | 2-4 per build (up to 7), ~1 per edit | counted in the saved agent logs |

So, per session: **~0.5 GB all the time, ~1.5 GB peak while its check runs**; CPU comes almost
only from checks (~30-50 CPU-seconds each). Disk: a project is 0.4-1.3 MB of source plus ~0.15 MB of
git; each web export adds 40 MB (the engine), so delete `export/web` after the `.pck` is on R2.

**How many at once (estimates):** beta 1: 10 testers × (~2 builds + ~10 edits) ≈ 35 agent-minutes
each a day; if they play in the same 3-hour evening, ~2 sessions run at once on average and 5-8 at
the start. Launch: assuming ~200 active users a day, each doing ~1 build + 5 edits (the free tier's
5 credits a day), ≈ 3,600 agent-minutes a day, or ~10 at once over a 6-hour peak. Beyond the box's
slots, requests wait in a queue: a minute or two at the peak.

## Options (Germany/Finland; € list price, your bill in $)

| Server | vCPU / RAM / disk | €/month | $/month | In stock today | Sessions at once (est.) | Fits |
|---|---|---|---|---|---|---|
| Share the CX23 (site box) | 2 shared / 4 GB / 40 GB | +0 | +0 | (running) | 1-2 | no: one check's browser takes both vCPUs, and site deploys build on that box |
| CX33 | 4 shared / 8 GB / 80 GB | 8.49 | 9.99 | **no** (sold out in DE/FI) | 4 | beta 1, if it comes back |
| **CPX32** | 4 shared AMD / 8 GB / 160 GB | **35.49** | **41.99** | yes | 4 (2 checks at once) | **beta 1** |
| CCX13 | 2 dedicated / 8 GB / 80 GB | 42.99 | 50.49 | yes | 3 | worse than CPX32 for this work |
| **CPX42** | 8 shared AMD / 16 GB / 320 GB | **69.49** | **81.99** | yes | 10-12 (4 checks) | **launch** |
| CCX23 | 4 dedicated / 16 GB / 160 GB | 85.99 | 101.49 | yes | 8 | fewer cores than CPX42, higher price |
| AX42 (dedicated machine, monthly + setup fee) | Ryzen 7 PRO 8700GE, 8 cores, 64 GB, 2×512 GB | 97.30 | 117.10 | ordered separately | 25-30 | after launch, once load is steady |

Add $0.60 a month for IPv4 per cloud server. Prices rose twice in 2026 (CPX/CCX more than
doubled in June), so the old "~€10-50" in `parked.md` only holds for a CX33.

## Recommendation

- **Beta 1 (order when package 5 is ready to deploy, by Wed 10-21): a separate CPX32 "typeplay-api" in Falkenstein**, next to the CX23:
  €35.49 ($41.99 + $0.60). Nest API, the key-adding proxy, one container per active project, checks
  in a queue of 2. The site stays alone on the CX23: agents run bash from user prompts and should
  not share a box with the site, and a site deploy can't stall a build. If a CX33 is in stock when
  you order, take it instead (same 4 vCPU / 8 GB for $9.99).
- **Launch (~11-02, a week before): rescale the same box to CPX42** (€69.49 / $81.99), a few minutes
  of downtime. Pick "CPU and RAM only" so it can shrink back later.
- **When to scale again:** peak queue waits above ~1 min on most days, or RAM above 75% at the peak
  → move the agents to an AX42 (4× the RAM of a CPX42 for 1.4× the price) or add a second CPX42 with
  each project pinned to one box.
- **Cap the heavy work like on Luka's PC.** There, `packages/agent/tools/cpu.mjs` keeps heavy work
  to 12 of 16 cores. On the server, use container CPU limits so agent, Godot and browser work can't
  starve the API: all agent containers together get at most 3 of 4 vCPUs (7 of 8 on the CPX42),
  each container `--cpus 1.5 --memory 1.5g`, and checks run through the queue.
- For scale: Anthropic's hosting page says token cost "typically dominates container
  infrastructure cost by an order of magnitude or more". Beta API credits are ~$150-300 against
  ~$42 for this box.
