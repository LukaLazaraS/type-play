# Agent core: experiment results

All on Luka's Max; $ = the SDK's API-price estimate. Same runner prompt unless noted. Raw data:
`runs.jsonl` (v2) and `../proof/runs.jsonl` (v1). Games: `output/` (git-ignored), browsable
with `node tools/gallery.mjs` → http://127.0.0.1:8070/.

## 2026-10-12: effort, isolation, edits

**The biggest lever was isolation.** On a claude.ai login the SDK gave the game agent Luka's
claude.ai connectors (Drive, vidIQ, Docs): 84 extra tools, +89K tokens on every call, and
write access to his accounts. Isolated (`run.mjs` `ISOLATED`), the first call is ~9K tokens
(v1 had 33K; v2 before the fix 122K). Also keeps Haiku under its 100K-token price jump.

New game, first build only:

| Setup | Model, effort | $ | Min | Turns | Look / bugs |
|---|---|---|---|---|---|
| v1 | Opus high | 1.46 | 6.1 | 16 | polished |
| v1 | Opus medium | 0.82 | 3.4 | 10 | best-looking of v1 |
| v1 | Sonnet high (×2) | 0.42-0.54 | 3.2-3.7 | 9-12 | good; Luka 9/10 (after 1 edit) |
| v1 | Sonnet medium | 0.24 | 1.1 | 6 | plain; grey strip on wide screens |
| v1 | Haiku high | 0.42 | 12 | 43 | good; 95K thinking, 20 of 25 calls >100K tokens |
| v1 | Haiku medium | 0.15 | 5.5 | 17 | good |
| v1 | Haiku low | 0.037 | 3.2 | 9 | simple; grey strip |
| v2, not isolated | Sonnet medium (± play-test) | 0.87-0.88 | 3.8-4.1 | 20 | inflated by connectors |
| v2, not isolated | Haiku low | 0.30 | 3.3 | 13 | inflated (>100K price tier) |
| **v2 isolated** | **Sonnet medium** | **0.16** | 1.6 | 9 | simple, full width, game-over shot works |
| **v2 isolated** | **Haiku medium** | **0.049** | 5.0 | 16 | good |
| **v2 isolated** | **Haiku low** | **0.038** | 3.9 | 15 | decent, full width |
| v2 isolated | Sonnet high | 0.375 | 4.5 | 14 | polished; HUD drawn mid-height on wide screens |
| v2 isolated | Opus medium | 0.80 | 6.0 | 15 | polished, no bug seen (Opus cost is mostly output) |
| v2 isolated | Sonnet medium + play-test | 0.23 | 5.5 | 15 | bot: 25 s, no deaths, restart OK; no bug found |
| v2 isolated, 3D car town | Haiku medium | 0.087 | 6.7 | 21 | works (20 coins, timer); plain, washed out vs Sonnet's $0.76 town |

**Edits (v2 isolated, fresh session + NOTES.md, git commit per edit), 8 in a row on the
Sonnet-medium game, routed `auto` (all went to Haiku medium): $0.063 total, $0.003-0.015 each,
1.1-2.6 min each, 8/8 passed the check.** The v1 edit (resumed build session) cost $0.62.
Edits: jump higher; coins; double jump; easier start; shield power-up; bigger score; night sky;
sounds (generated in code). NOTES.md kept the features, "must not break" rules and a
"Not verified" list (shield pickup and sounds are beyond what the check reaches).

## 2026-10-13: 2×2 edit test (who built it × who edits)

Luka played both edited runners: the v1 game (Sonnet high build + one Sonnet high edit in the
resumed session) had coins in arcs over the cactuses and a good double jump; the v2 game
(Sonnet medium build + Haiku edits) had coins inside cactuses and a weaker double jump.
Same 3 edits (jump higher, coins, double jump) on identical copies of two base games:

| Base | Edits by | $ for 3 edits | Coins avoid cactuses? |
|---|---|---|---|
| Sonnet medium build | Haiku medium | 0.021 | no (own timer) |
| Sonnet medium build | Sonnet high | 0.218 | no (own timer) |
| Sonnet high build | Haiku medium | 0.033 | **yes** (skips spawning next to a cactus) |
| Sonnet high build | Sonnet high | 0.378 | no (own timer) |

v1 put the coins inside the cactus spawner (arc over each cactus group, or a row in the gap).
All v2 editors but one bolted on a separate `coins.gd` on its own timer. Not the model, not
the effort: the v2 edit rule ("smallest change, leave everything else exactly as it is") plus
split files pushed every model to add a separate system. Sonnet high edits cost ~10× Haiku's
and were no better at it. → `rules/EDIT.md` rewritten ("fit the change into the game as if it
had been planned from the start; hook into the existing systems") + a GOTCHAS line; the same
2×2 re-run as `ab3-*`:

| Base | Edits by | $ for 3 edits | Coins avoid cactuses? (new rule) |
|---|---|---|---|
| Sonnet medium build | Haiku medium | 0.032 | **yes**: world.gd spawns a coin arc with 75% of cactus spawns |
| Sonnet medium build | Sonnet high | 0.316 | **yes**: arc over 80% of cactus groups |
| Sonnet high build | Haiku medium | 0.045 | **yes**: obstacles.gd owns the coins, arc per cactus |
| Sonnet high build | Sonnet high | 0.355 | **yes**: obstacles.gd asks coins to place an arc or a low row |

**The rule was the cause: 4/4 integrated with the new rule vs 1/4 with the old one.** Haiku
edits now do it right for ~1/10 of Sonnet high's price.

Luka played the four (new rule), best to worst:
1. Sonnet high build + Sonnet high edits ($0.355): best coins, jump and animations, **but the
   double jump works only once** (a behaviour bug screenshots can't catch).
1. Sonnet medium build + Haiku edits ($0.032): as good, slightly better than the next one.
3. Sonnet medium build + Sonnet high edits ($0.316): good.
4. Sonnet high build + Haiku edits ($0.045): worst: coin arcs sit *in front of* each cactus,
   not over it (the rule followed literally, without taste).

So: no consistent winner between Haiku and Sonnet edits (one win each) at 1/10 the price;
the cheaper medium build was enough; single runs vary as much as models do ("dice"). Luka also
noted Opus draws the character better (side view, running forward). Fixes: a quick test of
each new feature after an edit (would catch "double jump only once"), and genre skills with
proven patterns (coin arcs centred over obstacles, double-jump values).

## 2026-10-13: Opus edits, and 3D on all three models (isolated, new edit rule)

| Test | Model | $ | Min | Result |
|---|---|---|---|---|
| Opus-built runner + 3 edits | Opus medium edits | 0.596 | 6.4 | coins only from the cactus spawner, arcs follow the real jump path; double jump refills on landing |
| Opus-built runner + 3 edits | Haiku medium edits | 0.040 | 6.5 | coin arcs above cactus groups; double jump resets on landing, backflip |
| 3D car town | Haiku medium | 0.087 | 6.7 | works, plain, washed out |
| 3D car town | Sonnet medium | 0.386 | 4.4 | good: building with windows, trees, coins, timer |
| 3D car town | Opus medium | 1.033 | 7.6 | best: city grid, park with fountain, arrow to the nearest coin, tap-to-drive |

Opus wins on looks and design in both 2D (Luka: side-view robot) and 3D: the "Best" option.
Player messages now come from the rewrite step and read plainly ("Spinning gold coins now float
through the desert! Some form an arc above a cactus…").

## 2026-10-13: feature tests, bug-fix flow, puzzle baselines

**Feature tests** (EDIT.md: every behaviour change adds `test/<name>_test.tscn`; the check
runs all of them after every change). 4 edits on the Sonnet-medium runner, default routing
(all went to Haiku): jump higher $0.004 · coins $0.021 (coin_test, 5 checks) · double jump
$0.012 (double_jump_test, 10 checks) · birds + duck $0.032 (duck_test, 16 checks; coin and
double-jump tests re-ran and still passed). **Total $0.069**, about 15% more than the same edits
without tests. This is the protection against "fix one thing, break another". The tests
caught real bugs inside these edits ("touching coin 3: coins 2 -> 2", "ducking under the bird"
×3); Haiku fixed them before finishing.

**Bug-fix flow**: on the game whose double jump worked only once, the player message "The
double jump only works once, then it never works again. Please fix it." → Haiku, $0.01, 1.5
min: found the cause (the jump was only refilled at game start), fixed it, and wrote a test
that runs jump → double jump → land → recharged cycle after cycle (all PASS).

**Puzzle baselines** (no genre help):

| Puzzle | Model | $ | Min | Result |
|---|---|---|---|---|
| Match-3 with cute fruit | Sonnet medium | 0.21 | 2.2 | lovely 8×8 board, faces, combos, time bonus |
| Match-3 with cute fruit | Haiku medium | 0.058 | 6.5 | as cute; drag, tap-tap and keyboard cursor; new fruit at 20/40 s |
| Push boxes onto targets, 5 levels | Sonnet medium | 0.273 | 3.4 | wrote a BFS solver and verified all 5 levels solvable (min moves 1, 12, 22, 22, 34); undo/restart buttons; plain look; touch controls not mentioned |

## 2026-10-13: genre skills (`genres/<name>/GENRE.md`, picked by a cheap Haiku call)

| Prompt | Model | $ | Min | With the skill |
|---|---|---|---|---|
| Runner | Sonnet medium #1 | 0.302 | 3.6 | coin arc over cactuses (unasked), tumble with X eyes, NEW BEST, HUD in corners |
| Runner | Sonnet medium #2 | 0.494 | 5.6 | same patterns; different look |
| Runner | Haiku medium #1 | 0.087 | 8.2 | same patterns ("CRASHED!", coin arc over the cactus) |
| Runner | Haiku medium #2 | 0.063 | 6.6 | side-view robot running in profile, coin arc centred over the cactus |
| Box pushing, 5 levels | Sonnet medium | 0.457 | 8.8 | now has swipe + tap, stars vs. solver par, undo/restart buttons, core_test solves every level |
| Match-3 fruit | Haiku medium | **0.349** | 12.1 | level-based, goal/moves, cute; but 40 turns, 97K thinking, context to 158K (13 of 16 calls in Haiku's 5× tier) |

- **Consistency: 4/4 runners have the good patterns** that came and went at random without the
  skill. Builds cost more because they do more (Sonnet $0.16 → $0.30-0.49, Haiku $0.05 →
  $0.06-0.09).
- **Haiku + a demanding skill can blow past 100K tokens** (match-3: $0.058 → $0.349). For the
  free tier: build in short steps (core game, then polish, each a fresh session reading
  NOTES.md, like edits), lower effort on Haiku builds, and keep skills short.

## 2026-10-13: short-step builds on Haiku (core, then polish in a fresh session)

New Haiku games are built in two sessions (`--steps 2`, the default on Haiku): step 1 the
playable core (committed), step 2 polish from NOTES.md (rolled back to the core if it fails).

| Game | Haiku effort | $ total (core + polish) | Min | Notes |
|---|---|---|---|---|
| Runner | low | **0.072** (0.045 + 0.027) | 7.7 | core_test via helpers.gd, passes |
| Runner | medium | **0.088** (0.056 + 0.032) | 10.2 | side-view robot running |
| Match-3 | medium | 0.126 / 0.261 | 10.5 / 12.1 | before the test helper; #1's core step thought 84K tokens |
| Match-3 | low | 0.346 | 16.1 | ate its core step debugging my tap() (headless window scaled ~18×); fixed |
| Match-3 | low ×2, medium ×1 (fixed helper) | **0.105 / 0.117 / 0.112** | 10.4-11.8 | core_test 16 checks pass; lovely |

Before short steps the same Haiku match-3 cost $0.349 (13 of 16 calls in the 5× tier).
**Haiku builds now cost ~$0.07-0.12**, the free-tier target. Cost of the extra time: 8-12 min
total, but the core is playable after ~5-7 min (show it in the preview while polish runs).

Also fixed on the way: the SDK throws on the turn limit (now a clean rollback; Haiku limit 50);
`test/helpers.gd` in every game (frames not clock time, PASS:/FAIL:, `tap()` in game
coordinates); the check refuses folders without `project.godot` and calls the main Godot exe
(the `_console` wrapper re-enabled Windows' crash dialog: Luka got a pop-up).

## Findings

- Effort is a cost ↔ polish dial. Lower effort also looks at screenshots less carefully
  (missed the grey strip until GOTCHAS.md named it).
- Haiku can build and edit; free-tier build ≈ $0.04-0.05, edit ≈ $0.01.
- Play-test bot: works (confirmed game over + restart), found no bug in 2 simple runners;
  costs +$0.07 (+46%) and +4 min on Sonnet medium. Next: try it on a complex game; Luka's
  idea of a "Test my game" button runs it on demand.
- The final message stays technical on every model despite the rules ("automatic check",
  "untested on a phone") → needs a separate rewrite step for the player.
- The small/big classifier said SMALL to everything, including new mechanics → fix or switch
  to "Haiku first, Sonnet if the check fails".
- The game-over screenshot showed a real bug the agent missed (HUD "Best 0" vs "Best 37").
