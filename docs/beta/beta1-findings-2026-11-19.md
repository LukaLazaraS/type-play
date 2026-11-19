# Beta 1: what the testers did, and what we fixed (2026-11-19)

Closed beta 1 has been live since 2026-10-24 (typeplay.app, the beta code from 10-25; Ultra with 300 credits per
account since 10-27). Read on **2026-11-19 04:18 UTC** from the live database through the project's own read path only:
`npm run admin:live -w @typeplay/server -- stats` (new today, read only: `apps/server/src/beta/admin-stats.ts`), plus
`list`, `invite list`, `code list`, `feedback list`, `gallery reports --all`, `audit` and the API log
(`docker compose logs`, kept since the last restart on 11-09). Each admin command writes one BillingAudit row (who
looked); nothing else was written. Testers are named by role, not address: the addresses are in `admin stats`.

## The numbers

**Who** (10 accounts): Luka's admin account and two more under his name (by the addresses, unverified), our own
test account (`realrun@test.local`, 10-17) and the showcase account; **5 outside testers** in by the code (10-27: 2,
10-31: 2, 11-12: 1). Code 623175: 7 of 20 uses.

**The funnel** (accounts with activity, 9 incl. Luka's and the test account):

| Step | Accounts | Note |
|---|--:|---|
| Signed in with Google | 22 | Supabase's sign-ins, counts only |
| Got past the closed-beta page (an account) | 8 + 1 test | **14 of 22 (64%) stopped at the closed-beta page**: no code, and nothing there to ask in |
| Sent a first message | 9 of 9 | |
| A first game built | 9 of 9 | median **~18 min** from the first message (15-24) |
| A message after the first game | 8 of 9 | the one who didn't: a tower defence on Smart, shared, 1 play |
| Shared a game | 5 of 9 | every shared game was also put in the gallery |
| A shared game played | 5 of 9 | 46 plays on 10 shared games (0-12 each, the gallery included) |
| Messages on 2+ days | 4 of 9 | activity faded: 1-2 people a day, **nothing since 11-16** |

**Builds** (62 answers to players): 55 built a version, 2 failed, 3 stopped by the player, 2 stopped by the size check,
0 refused, 0 timed out, 0 interrupted, no wait in the queue. Feedback notes: **0** in 26 days. Gallery reports: 0.
Android builds: 0 (testers are on plans with it, nobody tried). TypePlay's own fixes to testers' games (`admin run`,
11-07): 11 runs, $9.88.

The two failures: a seven-feature change on Fast (10-27, before the size check existed, 8.7 min) and "a bigger map, and
the beaver dives into water and goes inside its home" on Best/high (11-09, 14.5 min, $1.49 of AI, free to the player).
The stops: two by one tester on her cat runner (1.2 min and 0.2 min in), one on our test account.

What they made: 16 games, mostly long, specific design briefs (a Battle City-style tank game, an Earn to Die-style
zombie drive, a cleaning-service simulator, two cat games from photos of the tester's own cats). Genres: runner 3,
tower defence 2, adventure (3D) 2, racer, platformer, shooter, arcade, 5 with none; 5 of 16 are 3D. Models: **10 of 16 new games on
Best/high**, 3 on Best/medium, 1 on Smart, 2 on Fast (the two early test ones).

## Cost per active user

| Who | AI cost (what we paid) | Credits charged | Per account |
|---|--:|--:|---|
| 5 outside testers, 10-27 → 11-16 | **$43.85** | 726 | **$8.77 and 145 credits** (median 79 credits; 20 to 325) |
| All 8 people's accounts (Luka's 3 included) | $60.62 | 982 | $7.58 |
| TypePlay's own fixes on their games | $9.88 | 0 (free) | |

- **$0.060 of AI per credit charged**: the 1 credit = $0.06 rule holds on real use (`docs/pricing.md`). At the list price
  ($0.20 a credit) the testers' 726 credits would have been $145, the AI 30% of it.
- At this pace the median tester fits Medium (100 credits a month); the heaviest used 325 on 5 days of building (High/Ultra).
- One tester is at **−5.2 credits** (owes; the run cost more than its hold) and can't build; another is at 75 of 300.

## What the app said a message would cost, against what it charged

The estimate next to Send ("about N credits") and the "could cost up to N" question come from one table
(`apps/server/src/credits/credits.ts`), measured on 10-12..10-19 before the "look finished" rules, the speed budgets
and the colour check made games bigger. **33 of 40 Smart and Best builds were charged more than the estimate's high.**

| Kind, AI/effort | n | Charged: p10 / median / p90 | The app said: about (range) | Above the high |
|---|--:|---|---|--:|
| New game, Best/high | 10 | 31.7 / 56.3 / 61.4 | 30.6 (23.4-43.2) | 8 |
| New game, Best/medium | 3 | 43.8 / 45.5 / 46 | 17 (13-24) | 3 |
| New game, Smart/medium | 1 | 20.1 | 6.7 (5-8.2) | 1 |
| New game, Fast/medium | 2 | 1.1, 1.7 | 1.7 (1.2-2.1) | 0 |
| Change, Best/high | 11 | 5.4 / 21.5 / 24.6 | 5.9 (4.5-7.6) | 8 |
| Change, Best/medium | 7 | 0.8 / 9.7 / 23.6 | 3.3 (2.5-4.2) | 6 |
| Change, Smart/medium | 7 | 2.7 / 4.4 / 8.9 | 1.3 (0.8-2.1) | 7 |
| Change, Fast/medium | 13 | 0.2 / 0.4 / 0.7 | 0.3 (0.1-0.5) | 4 |

Our own runs agree (`packages/agent/RESULTS.md`, `runs.jsonl`): Smart new games since 10-27 cost 9-23 credits (27
builds), the six Opus showcase games 32-78. The beta's two Fast new games were from October, before the 11-04 speed
rules; Fast new games on this PC since then: 3.1, 7.6 and **4.6 credits today** ("A game where a frog jumps between
lily pads to cross a pond, avoiding fish.", Haiku medium, 2 steps, $0.273; passed the check). The plan cards promise "about 15 Smart new games" for Medium's 100 credits;
real use buys about 6.

Build times against the home page's figures (built answers, p10-p90): Fast change 1.8-6.9 min (page: "1 to 3 min"),
Smart change 2.2-8.4, Best new game 14.8-24.4 (page: "8 to 23"), Smart new game 14.7 here and 8-30 in our runs (page:
"1.6 to 9 min").

## The problems, ranked (users hit × what it costs at the launch)

| # | Problem | Hit | What it costs in conversion | Done |
|---|---|---|---|---|
| 1 | **Estimates and plan cards understate Smart and Best 2-4×** | the code testers built 13 of 16 new games on Best; 33 of 40 Smart/Best builds | At the open launch every paying user is charged up to 3× what the app said: refunds within 14 days, chargebacks (Paddle), and plan cards promising 2.5× the games. The hold is the estimate's high, so runs end in debt (one tester at −5.2) | **Fixed** (below) |
| 2 | **The closed-beta page is a dead end** | 14 of 22 Google sign-ins (64%) | The warmest leads we get (they signed in) leave with nothing: no way to ask in, nothing to tell them when it opens | **Fixed**: "Tell me when it opens" |
| 3 | The first game takes ~18 min (Best/high 22.7) | 9 of 9 | Strangers at the launch wait 15-25 min for the first playable game; friends waited | Not in this job: agent speed. Fix 1 shows the real cost of Best, the slow choice |
| 4 | Out of credits with no way to get more (billing off) | 1 tester at −5.2, 1 at 75 | The most active tester (5 games, 5 days) stopped | Fix 1 stops new debt. **A top-up is a write to the live beta**, not this job's: one command for HQ/Luka, below |
| 5 | The size check stopped a key remap on Fast and on Smart | 1 tester, 2 stops | A small change pushed to Best (the dearest) reads like an upsell | **Fixed** |
| 6 | Few come back: 4 of 9 on a second day, nothing since 11-16 | 5 of 9 | Retention at the launch | Not a code fix; the waitlist (2) and the launch are the levers |
| 7 | In-app feedback unused: 0 notes in 26 days | 7 of 7 | Testers tell Luka directly; we can't see what bothered them | Not fixed: no conversion cost at the launch |
| 8 | Nobody tested the Free plan (Fast only, 5 credits a day) | all (everyone is Ultra) | The open launch's sign-ups land on Free, which beta 1 never measured. A Fast new game now costs ~4.6 credits (3-8), so Free's 20 a month buy **about 4 games, not the ~12** `docs/pricing.md` planned on | Estimate corrected (fix 1). The Free plan's size (20 a month, 5 a day) is a settled pricing decision: the number is HQ's/Luka's to weigh, not changed here |

## The fixes (branch `beta1-fixes`)

| Commit | Problem | What changed |
|---|---|---|
| `6cb6ab1` | 1, 8 | The estimate table from the charges above and our runs: a change on Fast 0.4 (0.2-0.7), Smart 4.5 (2.5-9), Best 10 (3-14); a new game on Fast 4.5 (3-8), Smart 15 (10-22), Best 45 (25-60); effort per kind (a new game 0.9× low, 1.25× high; a change 0.8×, 2×). Free asks first above 8 (was 3), so a typical Fast new game doesn't ask; every Best new game on a paid plan now asks ("up to 60"). Plan cards: Medium "about 6 Smart new games or 250 Fast edits", High 18, Ultra 40, Ultra+ 85; `docs/pricing.md` recomputed |
| `f1f14a3` | 2 | The closed-beta page: "No code? Tell me when it opens" puts the signed-in address on a waitlist (`/beta/waitlist`, `admin waitlist list \| remove`); a code or an invite takes it off; one privacy sentence |
| `d801954` | 5 | The size check: which keys or buttons do what is a tweak, not a rework; the tester's message and two more in `tests/size-eval.mjs`, 48 of 48 as expected |
| `a965217` | (found here) | The home page's build times from the same data: Fast new game 10-25 min, change 2-7; Smart new game 8-30; Best 12-25 |
| `2c12f23` | (found here) | Next.js 16.4.3 → 16.4.6, the patch for two moderate cache advisories (we use no `use cache`, so nothing was exposed) |
| `8c977f8`, `8302f44`, `104d468` | measuring | `admin stats` (this report's source; rerun it after the launch to check the estimates again), and the Fast build measured on this PC |

## Waiting on someone else

- **The top-up** (a write to the live beta, so not in this read-only job): the tester at −5.2 credits can't build.
  `npm run admin:live -w @typeplay/server -- grant <their address> 100 "Beta 1 top-up"` (their address: `admin stats`).
- **The 14 people stopped at the closed-beta page before the waitlist existed**: they signed in but never asked to be
  emailed. Inviting them (`admin:live invite add <email>`; ~$9 of AI each at the testers' pace) or writing to them
  once at the launch is Luka's call; their addresses are Supabase's sign-ins.
