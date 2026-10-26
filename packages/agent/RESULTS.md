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

## 2026-10-17: portrait-first games, 3D model library

**Portrait first** (parked #17). The template is portrait (720×1280, handheld orientation
portrait); `rules/BASE.md` says when to switch to landscape (1152×648: side-scrollers, wide 3D
racing), the runner skill switches for side view, the puzzle skill stays portrait. The check
reads the orientation and shoots portrait games on a phone-shaped page (432×936), so the agent
sees what a phone shows. New rule: the game's 2-3 word title also goes in `config/name` (the
server names projects from it).

**3D model library.** `node tools/assets.mjs index` scans `E:\3D models` in 16 s into
`assets/catalogue.json` (2.2 MB): 8,449 models in 137 packs (4,425 GLB, 2,224 glTF, 1,800
FBX-only from older Quaternius packs; a pack without a CC0 license file is skipped). Each
model has tags from its folder and file names, size in metres, animation names, the textures
it needs, a preview image (Kenney). The agent runs `search "<words>"` (10 short lines), `pack`,
`info`, and `copy <id>…`, which copies only those models and their textures into
`assets/<pack>/` and adds a line to `assets/CREDITS.md`. Tested by hand first: a Kenney GLB, a
Quaternius glTF, a glTF whose texture sits elsewhere in its pack, and an FBX all import, render
in the web build and keep their animations.

| Game | Model | $ | Min | Result |
|---|---|---|---|---|
| Match-3 with cute sea animals | Haiku low, 2 steps | **0.072** (0.052 + 0.020) | 7.5 | "Sea Buddies": portrait, HUD on top, board centred, Restart at the bottom; 20 test checks; title in `config/name` |
| 3D car town (same prompt as 10-13) | Haiku medium, 2 steps | **0.209** (0.186 + 0.023) | 11.8 | "Coin Dash": Kenney taxi, buildings, houses, roads, trees, gold coins (20 models from 5 packs, web pack 616 KB); chose portrait with on-screen driving buttons; grey sky |

The 10-13 Haiku town ($0.087, primitive meshes) looked plain and washed out; with real models it
looks like a real game, for 2.4× the price (34 turns in the core step: picking and placing
models). The launcher on the site now shows portrait games in a 9:16 frame (371×660 on a
1440×900 desktop, everything on one screen; landscape unchanged).

Two failed runs on the way, neither from the change: one rolled back because the catalogue scan
ran beside it and Godot's import timed out; one got the prompt "Make" because `tools/cpu.mjs`
passed arguments unquoted through the shell (fixed). It still built a portrait match-3 ($0.069).

## 2026-10-17: big games

PLAN "Better than the competitors" #0 (Tesana left Godot over ~60-min builds). One run each,
through `tools/cpu.mjs`, one at a time; no tower-defence skill yet (package 7). TD prompt: "Make a
tower defence game with a start menu and 3 levels where the enemy waves get harder and harder. I
want 4 tower types with different strengths that I can upgrade, money for every kill, lives I lose
when enemies get through, and a win and a lose screen." Match-3: "Make a match-3 game with 10
levels and a level-select map. Add three special pieces, up to 3 stars per level, and save my
progress." In the gallery under "Tower defence (big)" and "Match-3, 10 levels (big)".

| Game | Model | Min | $ | Turns | Check errors | Own test | Verdict |
|---|---|---|---|---|---|---|---|
| TD "Tower Defence" (`big-td-sonnet`) | Sonnet medium, 1 step | 5.4 | 0.614 | 19 | 0 | 12/12 | **unclear**: froze in the test runs, ran in a re-test (below); Luka plays it |
| TD "Tower Siege" (`big-td-haiku`) | Haiku medium, 2 steps | 12.8 (7.1 + 5.7) | 0.207 (0.127 + 0.080) | 59 (23 + 36) | 0 | 15/15 | good enough to show |
| Match-3 "Gem Crush" (`big-match3-haiku`) | Haiku medium, 2 steps | 16.0 (13.2 + 2.8) | 0.432 (0.407 + 0.025) | 73 (47 + 26) | 0 | 29/29 | playable and complete, plain look |
| TD "Tower Keep" (`big-td-opus`) | **Opus high**, 1 step (Luka asked, same prompt) | 15.1 | **3.038** | 25 | 0 | | most polished: title menu with locked levels, portal → castle road, drawn towers, wave banner, 1x/2x, Next wave |
| Match-3 "Jewel Trail" (`big-match3-opus`) | **Opus high**, 1 step | 25.9 | **4.147** | 46 | 0 | | clean board, level goals (score, collect, break ice), title screen; found and fixed its own ice-counter bug |

**Opus high on the same two prompts (Luka didn't like the Haiku/Sonnet big games, 10-17 evening):**
clearly the most finished-looking of the five, on the first try, with no human steering. The price
is the catch: $3.04 and $4.15 at API prices are **51 and 69 credits** (~$10 and ~$14 on Medium),
far above the pricing table's "Best new game 17 (13-24)", which was measured on small games at
medium effort, and above the 25-credit ask-first limit, so every big Opus build asks first. Medium's
100 credits buy about 1.5-2 of them. Luka plays all five side by side (gallery groups by prompt) to
judge whether the difference is worth 10-15× Haiku's price; the answer feeds the defaults and the
"honest tips" next to the model picker.

- **Sonnet TD**: everything asked for is in the code and the headless test (3 maps with 6/8/10
  waves, Arrow / Cannon splash / Frost slow / Sniper, 2 upgrades + sell, wave bonus, a boss on the
  last wave, win/lose overlays). In the browser the game drops to ~4 fps and freezes within ~1 s
  of the first wave: 6 of 6 runs of the unchanged game in the hidden browser (phone page and
  landscape window, taps or keys), and with GPU instead of software rendering too (a lightly
  changed copy). The check passed because the tests run without a renderer
  and a frozen frame looks like a normal map ("Wave 1 in progress", no enemies). Cause not found
  in ~16 experiments on a copy: not the enemy art, the HUD button or z-index; started from code
  with no input, it froze only once enemies were on screen, and drawing the map once instead of
  every frame stopped that, but not the freeze after a tap or key. Needs a real-browser play to
  confirm. **Re-test (main session, same evening, PC otherwise idle):** the unchanged game ran: the
  page kept answering, ~29-34 frames a second, and the enemies walked from the top to the middle
  of the path between the 3 s and 13 s screenshots. The test runs above overlapped with other
  agents' Godot and WSL work, so the freeze may have been the hidden browser starved of CPU.
- **Haiku TD**: menu, 3 themed maps (flowers, rocks, pines), 4 towers with 2 upgrades and sell,
  gold per kill, lives, Speed ×2, "Wave N" banner, sounds, win/lose screens. Played in the hidden
  browser: two towers cleared wave 1 (gold 30 → 102); 9 enemies walked smoothly with no towers. Its
  check screenshots once showed enemies barely moving in 10 s.
- **Haiku match-3**: title, winding 10-level map with locks, stars and best score saved, next level
  unlocks after a star, striped / bomb / rainbow pieces (in the code, not in the test), undo; it
  wrote a greedy-play simulation and set every level's star targets from it. Looks plain (glossy
  balls on a dark board).

Conclusions:
- **No 60-minute problem.** Sonnet barely slows on a big game (5.4 min vs 1.6-5.6 small); Haiku
  takes ~1.5× its small builds (12.8-16 min vs 7.5-12), with the core playable at 7-13 min.
- **Haiku copes with a big prompt but ran at its limits**: the match-3 core used 47 of 50 turns and
  $0.407 of its $0.50 cap, planned silently for 6 min (98K thinking tokens) before the first file,
  and sent 18 of 21 calls above 100K tokens (5× price). One more feature would have hit a cap and
  rolled the build back. Big prompts on Haiku need more, smaller steps (core with one level, then
  content, then polish), not a bigger core step.
- **The check couldn't see a frozen game**: it had no test that the page keeps running. Added the
  same day: the check now counts the page's frames while the game plays and **fails when the page
  stops answering** (a loop that never ends), with a plain message for the agent; proved on a game
  made to hang on the first key (fails in 84 s, browser cleaned up), and good games still pass
  (~35 s). The frame rate is printed but not judged: still screens (game over, between waves)
  legitimately show 0 in the hidden browser. A game that is merely slow still passes.
- Sonnet cost 3× Haiku on the same TD ($0.61 vs $0.21); one run each, so dice again.

## 2026-10-17 night: genre skills (tower defence, racer) and "look finished" rules

Luka didn't like the Haiku/Sonnet big games; the Opus ones ("Tower Keep", "Jewel Trail") looked
clearly better at 10-15× the price. Read side by side, what Opus did and the others didn't:

- **The title sits over the live game** (map dimmed behind it, enemies walking in a demo), with
  the game's own towers as icons, a big green PLAY and the level list with locked entries.
  Haiku/Sonnet: text on a flat dark screen.
- **One UI kit** (`ui.gd`: `StyleBoxFlat` panels and buttons with borders, shadows and states,
  outlined labels); the HUD in solid bars with a drawn heart and coin. Others: loose "Gold 200".
- **Show, don't label**: one static `draw_shape()` per tower, used on the map, the cards and the
  title; gems differ by shape (circle, octagon, star, hexagon, diamond, triangle). Haiku's tower
  cards were text; its gems were same-shape balls.
- **A world that makes sense**: portal → road → castle with a flag, trees outside the grid.
  Others: a road running off the screen edge, or ending mid-map.
- **A status line and toasts**: "First wave in 12 s. Tap grass to build!", "Wave 3!", "FINAL WAVE!",
  "A BOSS appears!", "Not enough gold!".
- **Juice on every action**: pop-in (`TRANS_BACK`) + dust on build, squash + gold ring on upgrade,
  burst + floating "+7" on a kill, shake + red flash on a leak, screens fade in.
- **Difficulty as formulas in one data script**; levels differ in goal (score / collect / ice) and
  layout (holes); a bot test wins level 1 and sets the star targets.
- **The static map drawn once**, a small overlay node redrawn every frame.

These became rules and skills (all re-read every turn, so kept short):
`rules/BASE.md` "Make it look finished" (8 bullets), `rules/GOTCHAS.md` (draw a static map once),
`genres/towerdefence/GENRE.md` and `genres/racer/GENRE.md` (new), `genres/puzzle/GENRE.md`
(levelled match-3: goals, ice, specials, a map through a drawn scene), `rules/STEP_CORE.md`
(the look's frame in the core, "plan briefly"), `rules/STEP_CONTENT.md` (new, step 2 of 3),
`run.mjs` (one cheap Haiku call classifies genre AND size: `towerdefence big`; big Haiku builds
take 3 steps: core with one level → content → polish; a failed later step is rolled back and the
build goes on; `chargeUsd` = only the kept attempts, see below), `tools/gallery.mjs` (Racer
group). Genre detection checked on 10 prompts: TD / racer / puzzle / runner / none all right,
"3D car town" stays `none`, a short "tower defense with zombies" is `small`.

Same prompts as the big-games test (TD, 10-level match-3) plus the racer prompt "Make a racing
game where I drive a car around a track against 3 other cars, 3 laps, with a finish screen":

| Game | Model, steps | Min | $ | Turns | Check | Verdict vs the earlier one · vs Opus |
|---|---|---|---|---|---|---|
| TD "Tower Defence" (`td2-haiku`) | Haiku medium, 3 | 25.4 (12.4 + 8.7 + 4.3) | **0.491** (0.421 + 0.033 + 0.037) | 33 + 41 + 52 | OK; 22 checks + a bot wins all 3 levels | **much better than `big-td-haiku`** ($0.21): title panel over the map with a demo, heart/coin HUD, portal → castle, drawn tower cards, 1x/Next wave/Menu, trees outside. **Close to Opus** ($3.04): same layout and features; Opus' art is a notch finer (castle, tufts) |
| TD "Meadow Guard" (`td2-sonnet`) | Sonnet medium, 1 | 9.7 | **1.079** | 30 | OK; 17 checks + bot wins level 1 | **much better than `big-td-sonnet`** ($0.61): same Opus layout, stars on the level list, countdown on the Next wave button. **Close to Opus**; one flaw: the bars float mid-screen on tall phones (dark bands top and bottom) |
| Match-3 "Gem Crush" (`m3big3-haiku`) | Haiku medium, 3 | 23.5 (12.6 + 8.3 + 2.6) | **0.778** (0.403 + 0.354 + 0.021) | 44 + 79 + 29 | OK; 28 checks | **better than `big-match3-haiku`** ($0.43): gems differ by shape, specials shown on the title, HUD panel with goal and star bar, levels vary (score / collect / ice, ice layouts, specials introduced one per level with a hint). **Between the two**: the level map is a plain zig-zag on dark blue; Opus has a meadow with a river and a trail |
| Racer "Circuit Rush" (`racer-haiku`) | Haiku medium, 2 | 16.7 (11.4 + 5.3) | **0.376** (0.331 + 0.045) | 28 + 52 | OK; 16 checks | new genre (no earlier version, no Opus): a real top-down racer: kerbs, start line, minimap, lap / place / time bar, ◀ ▶ buttons, 3-2-1-GO, AI cars, results. Flaw: a grey band at the top of the screen where the grass ends (fixed in the skill) |
| Racer "Turbo Laps" (`racer-sonnet`) | Sonnet medium, 1 | 6.9 | **0.782** | 21 | OK; 10 checks | new genre: the best-looking of the night: kerbs, a grandstand with a crowd, tyre stacks, minimap, cars with stripes; cars race on behind the title |
| TD "Tower Guard" (`td2-haiku-low`, 10-18 morning, same prompt) | Haiku **low**, 3 | 16.6 (9.5 + 5.1 + 2.0) | **0.262** (0.176 + 0.068 + 0.018) | 43 + 54 + 26 | OK; 34 checks in 3 tests | **same layout as `td2-haiku` for half the price** (1/12 of Opus): title over the map with a demo, tower and enemy icons, level list with stars, bars, cards. Plainer map (no tufts or flowers, a shorter road), one typo on a card ("Arther"). Its first run was cut by the Max session limit at 7 min (05:20 reset); this is the retry |

Conclusions:

- **The look moved to Opus' layout on every build, Haiku included.** The rules name what Opus
  did (title over the map, UI kit, icons from the same draw function, portal → castle, status
  line, juice) and both models follow them. What is left is Opus' finer art and taste, not
  structure: Luka plays `td2-*` and `racer-*` next to `big-td-opus` in the gallery to judge.
- **Cost went up 2-2.5× because the games do more**: Haiku TD $0.21 → $0.49, Sonnet TD $0.61 →
  $1.08, Haiku match-3 $0.43 → $0.78; a small racer costs $0.38 on Haiku and $0.78 on Sonnet.
  Still 1/6 (Haiku) and 1/3 (Sonnet) of Opus. One run each: dice.
- **"Plan briefly" did not work on Haiku**: every core step still thinks silently for 6-7 min
  (110-120K thinking tokens) before the first file, and that thinking stays in the session's
  context, so the context jumps from 17K to 125K+ in one turn and 13 of 16 calls are in Haiku's
  5× price tier: ~$0.40 of each core step. A thinking budget (`thinking: {type: 'enabled',
  budgetTokens: 8000}`) does not cap Haiku 5.5 (adaptive: 47K thinking anyway); effort low cut
  it only to 40K in a one-turn probe. The content and polish steps stay under 100K and cost
  $0.02-0.05 (the match-3 content step grew to 151K: $0.35). The 3-step core ignored "ONE level"
  on TD (built all 3) but followed it on match-3 (3 of 10 levels, the rest in step 2).
  **Effort low halves the Haiku price with the same layout** (`td2-haiku-low`: 67K thinking in
  the core, its big turn landed at 98K, $0.26 in all): a candidate default for Fast new games;
  one run, so re-check on a match-3 and a racer before changing the server's default.
- **Check fix**: at night (display off) the hidden page counted as hidden, the browser paused
  its animation frames, and the "10 s later" screenshot was the same frame as "3 s" for every
  game, old and Opus alike (enemies never left the portal); the frame count read 0.
  `tools/web.mjs` now turns on focus emulation: the later screenshot shows the wave walking or
  the race under way. In the software-rendered hidden browser the richer games run at 1-5 fps
  (Opus TD 3 fps, old plain TD 30-40): Luka checks `td2-haiku` and `racer-sonnet` on a phone.
- **`chargeUsd`** (10-18 morning, code review): `costUsd` sums every attempt, including a step
  or Haiku try that failed the check and was rolled back, while pricing.md promises a failed
  check costs nothing. The record and the `@@event result` line now also carry `chargeUsd`: the
  attempts in the game the player gets (0 when the run failed); the server charges that.

## 2026-10-19: showcase candidates (Opus)

Six games for the home page (parked #14), all on **Opus high, one session each** (`--model opus --effort high
--budget 8` through `tools/cpu.mjs`, one at a time, Luka's Max), from a one or two sentence prompt in a player's
words, themes varied. Luka's finding: Opus makes the best games, especially the big ones. In the gallery as the first
group, "Showcase (Opus)"; packs, posters and card pictures in `apps/games/builds/show-*`
(`node apps/games/scripts/build-demo.mjs --showcase`, which also prints the `games.ts` entry for each; the live
demo list and `apps/web` are untouched). **All six passed the check on the first build: no retry, no rollback.**

| Game (folder) | Min | $ (credits) | Turns | Check, own tests | fps in the hidden browser (quiet re-run) | Verdict |
|---|---|---|---|---|---|---|
| **Gingerbread Guard** (`show-td`, portrait) | 22.9 | 3.92 (65) | 29 | OK, 18 checks | 17, then 2 | Looks finished and is the deepest: 3 maps, 5 candy towers with 3 levels, a boss each map. Candy theme faint (plain checker grass), towers small, slow with many bugs |
| **Island Rush** (`show-racer`, portrait) | 23.2 | 4.65 (78) | 41 | OK, 15 checks | 18, then 11 | Best first impression: beach island, grandstand, minimap, nitro ring, podium. Hint text hard to read on the sand |
| **Rooftop Ninja** (`show-runner`, landscape) | 17.1 | 3.35 (56) | 22 | OK, 21 checks | 16, then 2 | Moody night city, ninja cat in profile, "Bonk!" screen with NEW BEST. A runner again; the later stages (gaps from 120 m, crows from 320, drones from 600) are past what the check's 3 s picture reaches |
| **Petal Pop** (`show-match3`, portrait) | 19.7 | 4.18 (70) | 28 | OK, 23 checks | 16, then 2 | The garden map is the prettiest screen of the night; 10 levels, 3 goal types, 3 specials. The board is the plainest part: it sits high with the bottom third empty, flat pieces |
| **Sky Hopper** (`show-3d`, landscape) | 20.0 | 4.37 (73) | 57 | OK, 29 checks | 6, then 7 (software 3D) | Charming Kenney islands, 3 themed levels, joystick + jump button. From behind the hero is a white ball, grass is mint, the feel is untested by hand |
| **Sky Stack** (`show-arcade`, portrait) | 11.5 | 1.92 (32) | 23 | OK, 15 checks | 59, then 16 | Instantly fun and the best picture: the sky goes sunset, night, space around a rainbow tower. The cheapest and fastest; a very familiar mechanic |
| **Total** | **114.4** | **22.38 (373)** | | | | 1 credit = $0.06 of API |

Prompts (as typed): **td** "Make a tower defence game where I protect a gingerbread castle from waves of hungry ants and
beetles. I want 3 different maps, 5 candy towers that I can upgrade, money for every kill, and a giant boss wave at the end
of each map." **racer** "Make a top-down racing game on a tropical island where I race against 5 rivals around a winding
beach track for 3 laps, with boost pads on the road, a nitro boost button, a 3-2-1 countdown and a podium with a trophy at
the end." **runner** "Make an endless runner where a ninja cat runs across city rooftops at night, collecting fish and
power-ups like a magnet and a shield. The obstacles should change as I go, from chimneys and gaps to crows and drones, it
should speed up, and I want to beat my best score." **match3** "Make a match-3 game in a magical flower garden with a level map
that winds through the garden. Each level has a different goal, like collecting flowers, breaking ice or reaching a score,
with special pieces from big matches and up to 3 stars per level." **3d** "Make a 3D platform game where a cute little
character runs and jumps across floating islands and moving platforms, collects coins and stars, and dodges spikes and spinning
saws. There are 3 levels, a green meadow, a snowy mountain and a night level, each ending at a flag, and falling off puts me
back at the last checkpoint." **arcade** "Make a one-tap stacking game: blocks slide back and forth and I tap to drop each one
on my tower, anything that overhangs gets sliced off, and perfect drops give combos. The sky should change from sunset to night
to outer space as the tower grows, and I want a best score."

**Ranking for the home page** (first impression, readable in 20 seconds, depth, speed, a genre the page lacks):
1. **Island Rush**: the one that looks like a store game at first sight, every asked feature is in (5 rivals, boost pads, nitro, podium), and it ran at 18, then 11 fps here after the agent fixed its own draw-call problem.
2. **Sky Stack**: instantly fun, the best picture of the night, the cheapest ($1.92, 11.5 min) and the lightest (59 fps): "a polished game for $2".
3. **Gingerbread Guard**: the deepest (3 maps, 5 upgradable towers, bosses) and finished-looking, proof that one sentence builds a big game; the page has no tower defence today. Risk: the frame rate with many bugs, so play it on a phone before it goes up.
4. **Petal Pop**: lovely map and a solid 10-level match-3, but match-3 is already on the page and the board is its weakest screen. Take it as the upgrade of Fruit Match.
5. **Rooftop Ninja**: strong mood, and the only landscape game that fits today's page, but a runner again (three of the eight demo games are). The upgrade of Robot Runner.
6. **Sky Hopper**: the most promising to improve, but the hero reads as a white ball and the feel is unproven (Town Driver and Little Car already cover 3D).

Findings:
- **Opus high works first time on big prompts**: 6 of 6 passed, 11.5-23.2 min, $1.92-4.65, and everything asked is in each game (checked against NOTES.md and the tests: 3 maps + 5 towers + boss; 5 rivals + pads + nitro + podium; chimney / gap / crow / drone stages + magnet + shield; 10 levels with score / collect / ice goals + 3 specials; 3 levels + saws, spikes, movers, checkpoints; the three sky zones). Every game follows the "Make it look finished" rules (title over the game, one UI kit, icons from the same draw function, status line, toasts).
- **The price is far above the pricing table's "Best new game 17 credits (13-24)"**: 32-78 credits (about $6-16 on Medium at $0.20 a credit), 373 for the six. Every Opus high new game is over the 25-credit ask-first limit and Medium's 100 credits buy 1-3 of them; Sonnet medium stays the right default for new games.
- **Half of every build is silent thinking**: the first file is written after 10.6-12.8 min in the five bigger games (4.8 min for the stack game), 72-93K thinking tokens (33K for the stack game), and the progress line stays at "Looking at the starting project…" the whole time. In the app the chat would look stuck for ~12 minutes on Opus high; the live runner could turn the SDK's `thinking_tokens` events into a progress line ("Planning your game"). "Plan briefly" in `STEP_CORE.md` does not reach single-session Opus builds.
- **The frame rate the check prints works as feedback**: the racer (14 then 2 fps) and the stack game (25 then 3) found that thousands of draw calls were the cause and fixed it themselves (scenery merged into one `ArrayMesh`; the town trimmed to what is near). The tower defence read 10 then 2 at the end of its build (17 then 2 on the quiet re-run; 30 then 7 earlier), blamed the software renderer and left it: the 2 is the 10 s window with the first wave walking. One line added to `rules/GOTCHAS.md` (the same mistake twice). The hidden browser's numbers are noisy, since other agents ran tests beside it (the same racer read 14 to 20 across its checks, the stack game 25 to 50): trust only big gaps. The table shows a re-run of all six on a quiet PC after the builds (CHECK: OK again for each); the 3D game's 6-7 is software-rendered 3D.
- **The check's three pictures cannot show a game at its best**: the tower defence has no tower built, the stack game is at floor 0, the match-3 shows the board but not its map. The hero pictures (`export/screenshot-hero.png`, shown in the gallery and used for the card pictures) were taken by hand: clicks in the hidden browser for the tower defence (3 towers, 2x speed, a wave walking) and the garden map; for the stack game an auto-player in a patched copy that drops 66 floors (the built game is unchanged).
- Mistakes seen once, so no rule: a const named `Sky` shadows a native class (stack game), the check run from the wrong folder (racer), `:=` inference in test scripts (match-3; already a GOTCHAS line). The tower defence's three failed checks were its own experiments (a sell-price rounding test, a bot on map 3), not mistakes.
- **3D and the stack game got no genre skill** (the cheap Haiku call said `none`) and neither needed one. Sky Hopper picked 26 platformer-kit models itself (780 KB in the folder, 285 KB in the pack); packs are 35-285 KB.
- Not verified by anyone: touch controls on a real phone (steering + nitro together, the joystick + jump), how the 3D and tower defence levels feel by hand (balance came from bots), real-device frame rates.

## 2026-10-19: chat edits on big games

Why: "build once, then change it by chat many times" is where players will spend most credits, and
edits had been measured only 4 times, on a small runner (10-13). Here: five of the six Opus showcase games
(2,000-2,600 lines each; the arcade game was not used), **copied** to `output/edit-show-*` with their git
history (the `show-*` originals are untouched), changed by messages typed the way a player would, one at a
time, each through `tools/cpu.mjs` and the product's path (`run.mjs --edit --model haiku|sonnet --events`;
medium effort). `--budget` was raised for the test ($1 Fast, $2 Smart) so nothing could stop a run early;
none would have hit the product's caps ($0.15 Fast, $0.75 Smart): the most was $0.085 and $0.216. After
every edit a fresh check, the old tests (lines before → after), the screenshots, and **a measurement of
the change itself** (a Godot probe on the code, the pixel brightness of the screenshots, a bot): see the table.
The harness is in `tests/edit-eval/` (`queue.sh` has every prompt, `edit-eval.mjs` runs one edit and measures it, `probe.mjs`
runs a `SceneTree` script from `probes/` on the version before or after an edit, `table.mjs` prints the table; output
in `output/_edit-eval/`). Gallery group: "Chat edits on big games" (`node tools/gallery.mjs`): 17 copies, the Fast
sequences, the four Smart runs and the re-runs, each card listing its messages with $, credits, minutes.

**Fast = Haiku 5.5 medium, 19 edits** (15 small-to-medium asks, then 4 bigger ones). All 19 passed the final check
on the first attempt: no rollback, no retry. Credits are by `docs/pricing.md`'s rule (agent + player message, ÷ $0.06, up to 0.1).

| Game · edit (as typed) | Min | $ · credits | Context | Old tests → after | The change, measured | Verdict |
|---|---|---|---|---|---|---|
| **Gingerbread Guard** (TD) · "Add a sixth tower that slows down all the bugs around it." | 2.8 | 0.030 · 0.6 | 68K | 18 pass; new `honey_test` 24 | 6th card (key 6) and a title-screen demo tower; probe: an ant walks 116 px alone, 81 px beside the pot = ×0.70, the 30% it says | good: hooks into cards, HUD info, title |
| · "The bugs are too easy. Make the game harder." | 2.5 | 0.012 · 0.3 | 38K | pass | 12 numbers moved (lives 20→15, bug HP +20-30%, speed +10-18%, wave 7+2w→8+3w, shorter gaps and breaks). The balance bot (9 towers): map 1 won, 10 lives lost → 10 lost (of 15); map 2 won (11 lost) → **lost at wave 5/8**; map 3 won (0 lost) → **lost at wave 4/10** | worked, overshot: total bug HP ×1.8 / ×2.1 / ×2.2 on maps 1-3 and 28% more bugs; its message says "later maps get much tougher" |
| · "Make it night time." | 2.7 | 0.016 · 0.3 | 52K | pass | mean brightness title 94→53, play 165→64 (−44%, −61%); dark teal grass, moon, glowing portal and castle, fireflies | good |
| **Island Rush** (racer) · "The car turns too slowly." | 1.3 | 0.006 · 0.2 | 24K | 15 pass | `TURN` 2.6→3.8; probe: 1.30→1.90 rad in 30 frames of full steering (+46%). The 5 rivals share the constant: their 30 s progress +2.1% | good; the side effect is not mentioned |
| · "I can't read the hint text on the sand. Please make it easier to read." | 1.6 | 0.008 · 0.2 | 29K | pass | hint on a dark rounded panel, font 26→30; contrast on the screenshot 6.0:1 (light text on the panel) vs ~1.3:1 for white on the sand (palette `f4dca2`) | good |
| · "Add a shield power-up on the road that protects me from the next bump." | 3.6 | 0.034 · 0.6 | 80K | 15 pass; new `shield_test` 5 | new `pickups.gd`; by the "10 s later" picture the car wears a shield bubble; "Shield" in the title legend | works; **the toast "SHIELD! The next bump is free" is wider than the phone and cut at both edges** (64 text pixels in the first 3 columns) |
| **Petal Pop** (match-3) · "Add two more levels." | 2.8 | 0.013 · 0.3 | 33K | `bot_test` 10→**12** checks, all pass | `LEVELS` 10→12 ("Lily Lake": holes + ice + collect; "Rainbow Crown": ice ring); the map (unlock forced in a patched copy) shows 12 stops, "0/36" stars | good, 14 lines |
| · "Add a new special piece, like a butterfly that clears the flowers around it." | 4.8 | **0.080 · 1.4** | **105K (4 of 18 calls over 100K)** | 25 pass; new `butterfly_test` 7 | a 2×2 square makes a butterfly that clears its 8 neighbours; "2x2 square" on the title legend; it also taught the test bot to use it | good; the costliest edit: read all 75K chars of code, 34.7K thinking tokens |
| · "Make it night time." | 2.4 | 0.019 · 0.4 | 53K | pass | brightness title 77→54, board 155→69; dark-blue board, moon, lanterns | good |
| **Sky Hopper** (3D) · "Make it night time." | 1.9 | 0.014 · 0.3 | 39K | 29 pass | brightness title 128→48, play 191→59; the two day levels turned to night (the third already was) | good; renamed level 1 "Moonlit Meadow" unasked (said so) |
| · "Let the character double jump." | 1.8 | 0.011 · 0.2 | 35K | 29 pass; new `double_jump_test` 21 (3 cycles) | probe: one jump peaks 1.57 m, jump + second jump 2.78 m (×1.77), a third press does nothing; before: a second press added nothing | good |
| · "The character is too slow. Make it run faster." | 3.9 | 0.014 · 0.3 | 38K | pass, but **it edited an old test** (`play_test`: coin pick + velocity reset) | `SPEED` 7→10.5 (+50%); jump reach grows with it, so every gap gets easier | works; a leap, and an old test touched |
| **Rooftop Ninja** (runner) · "The crows and drones should be faster." | 2.1 | 0.009 · 0.2 | 30K | 21 pass; new `flyers_test` 3 | crow speed 70→240 (×3.4), drones 0→180 | works; a big step |
| · "Add a power-up that slows down time for a few seconds." | 2.5 | 0.023 · 0.4 | 68K | 24 pass; new `slow_test` 7 | a third power-up kind, 4 s at 0.45× speed; test: world under 60% speed while slowed; "Slow time" in the title legend | good; the player message began "The request was in English, so I'll reply in English." (a leak from the rewrite step, fixed below) |
| · "Add a new obstacle, a laser that blinks on and off across the rooftop." | 4.1 | 0.051 · 0.9 | 87K | 31 pass; new `laser_test` 6 | new kind in the one spawner (art, hit boxes, stages from 320 m); not in the check's 3 s picture | good; the second costliest |
| *bigger asks:* TD · "Add a fourth map." | **21.5** (6.5 + a 15 min hang) | 0.045 · 0.8 | 79K | pass; `map4_test` 9 | `LEVELS` 3→4 ("Caramel Canyon", 10 waves); title lists 4; the map (forced unlock) shows a new road | good, but it ran `tools/gallery.mjs` (a server) in the foreground: **hung 15 minutes** until its server process was killed by hand |
| racer · "Add a second track that I can pick on the title screen." | 4.5 | 0.034 · 0.6 | 72K | pass; `track_test` 8 | title shows "Palm Bay" / "Volcano Ridge" and a track preview | good |
| match-3 · "Add a hammer button that breaks one flower, 3 uses per level." | 3.6 | 0.038 · 0.7 | 83K | pass; `hammer_test` 19 | hammer button with "3" in the bottom bar | good |
| 3D · "Add a fourth level in a desert." | 4.4 | 0.054 · 1.0 | 95K | pass; `levels_test` 13→**17**, `desert_test` 6 | "Dusty Dunes" (forced unlock): orange sandstone islands under the night sky | good |

**Smart = Sonnet 5.5 medium, the same four prompts on fresh copies** (the first edit of their game, so the same start):

| Edit | Fast: min · $ · credits | Smart: min · $ · credits | Smart ÷ Fast | Same result? |
|---|---|---|---|---|
| TD sixth tower | 2.8 · 0.030 · 0.6 | 2.5 · 0.215 · **3.6** | 7.3× $ · 6× cr | yes: also a "Honey Pot" (100 gold, 40% slow, probe ×0.60), a 7-check test |
| racer turns slowly | 1.3 · 0.006 · 0.2 | 1.2 · 0.057 · 1.0 | 9.8× · 5× | yes (`TURN` 3.6); it **told the player the rivals also turn sharper**, Fast did not |
| match-3 two levels | 2.8 · 0.013 · 0.3 | 1.5 · 0.099 · 1.7 | 7.6× · 5.7× | yes (12 stops, `bot_test` 12) |
| 3D night | 1.9 · 0.014 · 0.3 | 1.5 · 0.102 · 1.8 | 7.3× · 6× | yes (brightness 129→45); all three levels, names kept |

**Success: Fast 19/19 and Smart 4/4** (plus 8 more Fast runs below: 31 of 31 in all); not one rolled back, refused or
over a product cap. Old tests: never broken; two edits changed an old test file (a helper taught about the new piece;
`play_test` after a +50% speed). **Cost on a big game:** Fast median **0.3 credits** (0.2-1.4; mean 0.44; $0.006-0.080)
on the 15 small-to-medium asks and 0.75 (0.6-1.0) on the 4 bigger ones; by kind: tuning 0.2-0.3, look 0.3-0.4, fix 0.2,
two more levels 0.3, new feature 0.2-0.9 (the butterfly 1.4), new map / level / track / button 0.6-1.0. Smart 1.0-3.6
(median 1.75, mean 2.0). Time: Fast 1.3-4.8 min (median 2.5; 3.6-6.5 with the bigger asks, 21.5 with the hang), Smart 1.2-2.5 (median 1.5). Context 17-105K tokens:
**one kind of edit (the butterfly, twice) crossed Haiku's 100K price step**; no run came near the 50-turn limit
(most API calls 31). **vs `docs/pricing.md`: Fast edit "0.3 (0.1-0.5)" holds for the median but its top is 3× too low
(8 of 19 cost over 0.5); Smart edit "1.3 (0.8-2.1)" is low (1.75 median, 3.6 top); "350 Fast edits" per 100 credits is
~200-230 at the measured mean.** Size does not make an edit dearer: the agent reads what it needs (10 of 19 read under half the
code; the 5 that read nearly all of it were new mechanics or levels) and a one-constant change costs 0.2-0.3 on every game.
What does: **thinking**. The nine dearest Fast edits all thought 10K+ tokens (the butterfly 34.7K), which also fills the
context; a design decision costs, a number does not.

**Re-runs, to test a rules fix** (below) on fresh copies at the same start, old rules twice where it mattered:

| Edit | Old rules | New rules |
|---|---|---|
| butterfly | 0.080 · 1.4 cr · 4.8 min · 105K (4 calls >100K); 0.085 · 1.5 · 5.7 · 104K (4) | **0.054 · 1.0 · 7.4 · 93K (0); 0.044 · 0.8 · 5.0 · 83K (0)** |
| TD fourth map | 0.045 · 0.8 · 21.5 min (hang); 0.027 · 0.5 · 3.2 | 0.020 · 0.4 · 2.8 |
| runner laser | 0.051 · 0.9 · 4.1 | 0.033 · 0.6 · 3.1 |
| racer turns | `TURN` for everyone, +46%, rivals +2.1% | `PLAYER_TURN` 3.4 (+31%), rivals keep 2.6 (probe 1.30→1.70 rad; rivals' 30 s progress 15,377 vs 15,399 px); message "about 30% faster… rival cars keep their old turning speed" |
| 3D faster | `SPEED` +50%, an old test edited, 0.014 · 3.9 min | `SPEED` 9.1 (+30%), no test touched, 0.005 · 1.5 min |

**What the rules fix was.** The data showed no failures to fix, so it went after what did show up twice or cost
most: (1) `rules/EDIT.md`: a request about a number ("faster", "harder", "too slow") is **one clear step, about +25-40%**,
only for the thing named (grep who else uses it: the rivals shared the turn rate), and the last message says how much;
(2) `rules/EDIT.md`: **pick the simplest design** that does what was asked, don't weigh alternatives; (3)
`rules/GOTCHAS.md`: **never run `tools/serve.mjs`, `tools/gallery.mjs` or any server or watcher** (the 15 minute hang).
Did it help? In every paired re-run the new rules were cheaper (butterfly −41% over two runs each, and with no call over
100K, which is most of it: by token counts at list prices the 4 calls in Haiku's 5× tier cost about $0.027 of each old run's
$0.08; laser −35%; map −26% to −55%), and the number steps landed at +30% for the player
only. n is 1-2 per cell and the hang cannot be proved gone (it happened once in 27 runs); time did not improve
(the butterfly 5.2 → 6.2 min on average). Keep it, watch it in the beta.

**The silent stretches (UX).** A Haiku edit on a big game thinks 40-85 s between tool calls, and the player's line stayed
on the last tool's words: "Reading the game" 85 s, "Changing the board" 82 s, "Making your change" 57 s (6 of the 19
Fast edits sat 53-82 s on one line; the long "Testing the game" lines are the check itself, and the 10-13 minutes of a big
Opus build were worse). `run.mjs` now turns the SDK's `thinking_tokens`
events into plain lines through `tools/thinking.mjs`: after 8 s of an unchanged line "Planning your change…" /
"Planning your game…", then every 45 s "Still planning: big games take a few minutes (2 min so far)"; a tool line takes
over at once. Unit test with a fake clock in `tests/thinking.mjs` (a 12 minute Opus build gives lines at 8, 53, 98, 143 s…;
a Haiku edit cut into pieces by tool calls still changes), part of `npm run check`. In the re-runs with the final version the longest
unchanged line outside the check was 45-46 s, where it was 53-85 s (m2: "Reading the game" → "Planning your change…" at 13 s →
"Still planning…" at 75 s → "Changing the board" at 83 s; the first draft of the fix, in `m2-new1`, still sat 70 s on one planning line,
which is why the clock now counts from the last change of the line the player sees).
`--dir`, `--events`, `--budget`, `chargeUsd` and the player message are untouched (one phrase added to the rewrite
prompt, "never mention the language", for the leak above); `tests/isolation.mjs` still prints 7 tools, no MCP, 9.8K first call.

**Found on the way** (not rules): the check's three pictures cannot show what an edit adds (a new tower, map, level, laser):
the agent wrote "Not verified" in NOTES.md for those, and the clipped shield toast got through; the map, level and
laser pictures here come from forcing `unlocked` in patched copies and scripting clicks (`tests/edit-eval/shot.mjs`). A `--steps` option on the check (clicks and keys, then a picture) would
let the agent look at what it just added. A copy reset to an older commit (`git reset --hard`, what the server does on a
restore) probably keeps a stale `.godot` import cache: the first check printed `[import] ERROR: Condition "f.is_null()"…` (harmless,
reported as CHECK: FAIL once) and Godot rewrote tracked `.import` files; worth clearing `.godot` after a restore. The hidden
browser's fps stayed noisy (the same TD read 28, 8, 22, 19, 15, 21): no edit slowed a game by more than the noise.

**Conclusions for Luka**
1. **Fast (Haiku) is good enough as the default for edits on big games**: 31 of 31 passed on the first attempt with the old tests
   intact, the change was there every time (measured), and the median costs 0.3 credits. Smart gave the same result on all
   4 pairs for 5-6× the credits (7-10× the dollars); its one edge was telling the player about a side effect. Keep Fast as
   the default; the tip next to Smart can say it is for changes Fast got wrong. The server runs the picked model as is (no
   Haiku→Sonnet retry), which is fine on this data.
2. **The pricing table's edit rows should change a little** (numbers are yours, `docs/pricing.md` has the note): Fast edit 0.3
   typical stays, range 0.2-1.5 instead of 0.1-0.5 (the estimate next to the send button now understates a new mechanic by
   3×); Smart edit 1.8 (1.0-3.6) instead of 1.3 (0.8-2.1); "350 Fast edits" on the Medium card is ~250-330 at the median and
   ~200-230 at the mean.
3. **Two real risks, both small and fixed in the rules**: a session that hangs on a server command (1 of 27 runs; the
   server would kill it at 40 minutes), and number requests that overshoot or move things the player did not name.
4. The new UX lines and the 100K step are the beta's two things to watch: one edit kind (a new mechanic with a big design
   decision) sits at Haiku's 100K price step, and crossing it added about a third to the price (+$0.027 on $0.08); if it
   bites, cut the thinking (which also fills the context), not the code reading.
5. Not tested: Haiku- or Sonnet-built games (these five were built by Opus and are tidy: data scripts, NOTES.md), Opus edits,
   real players' vaguer messages, the arcade game; the numbers are 31 runs, one or two per cell.

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

## 2026-10-20: Black Hole Galaxy ported from Unity (Opus high, showcase candidate)

Luka's Unity game (`games/BlackHoleGalaxy`) rebuilt in Godot by the agent from a long brief (core eat rule, growth formula,
rival-hole AI, 40 generated levels with compound objectives, endless after 20, shop with 6 skins, tutorial). Art and sounds
come from the Unity project: FBX → glb via Blender (ASCII FBX kept raw), textures resized to 256, audio copied (~8 MB, heavy for web).
Seed pack and brief were built in the session scratchpad; new `--seed <dir>` option in `run.mjs` copies it into the new game.
Result: `output/black-hole-galaxy`, passed the check first time, 35.2 min, 97 turns, $7.01 (~117 credits).
Not verified: feel by hand, phone touch (steer + boost), web sound, frame rate with many objects. Play: `node tools/serve.mjs output/black-hole-galaxy`.
The ported planets/asteroid/UFO packs' licences are not confirmed CC0 (ships are): check before it goes on the home page.

## 2026-10-20: showcase polish and the low-effort test

Two jobs on Luka's Max, one build at a time through `tools/cpu.mjs` (the PC restarted once mid-way; the copy state was intact, so it resumed). Other agents' builds ran beside some of the runs, so minutes and fps are noisy. In the gallery: "Showcase: original vs polished" and "Low vs medium effort" (`npm run gallery`). Harness: `tests/edit-eval/` (`edit-eval.mjs`, new `build-eval.mjs`, `note.mjs`, `contrast.mjs`, a `td_load.gd` probe, `shot.mjs` got an `fps:<ms>` step). Per-run JSON in `output/_edit-eval/runs/`.

**Part 1: polish by chat.** The six originals `show-*` are untouched; each copied (with git history) to `show-*-polished`, changed by messages as a player types them, Fast (Haiku medium) first, Smart only when Fast did not land. 11 runs, 10 on Fast, 1 on Smart: **30.7 min, $0.29 (5.5 credits)**. Every run passed the check with the old tests intact (before → after equal). Web packs are in `apps/games/builds/show-*-polished` (`build-demo.mjs --showcase`; the `showcase` list got the six as separate entries; nothing in `apps/web` touched).

| Game · message (as typed) | Model | Min | $ · credits | Measured | Verdict |
|---|---|---|---|---|---|
| **Gingerbread Guard** · "...really slow and choppy when there are lots of bugs... make it run smoother?" | Fast | 4.3 | 0.042 · 0.8 | board and every bug look baked into textures; 6 waves called at once in the hidden browser: **1, 1, 1, 1 fps → 33, 46, 45, 46** with 2.5× the bugs on screen; check fps 23 then 1 → 52 then 24 | better |
| · "...does not look like candy at all... a candy land, with a candy road and sweets everywhere" | Fast | 4.1 | 0.034 · 0.6 | pink margins with candy canes, donuts, wrapped sweets, mint tiles with sprinkles, caramel road; baked, so speed holds (27-33 fps) | better (a little loud) |
| · "still really choppy when my towers start shooting" (found by playing 3 towers + a wave: still 1 fps after edit 1) | Fast | 3.4 | 0.033 · 0.6 | tower pictures drawn once; 3 towers + wave: **1, 1 → 36, 12 / 22, 42 fps**; check 40 then 15 → 55 then 28 | better |
| **Island Rush** · "can not read the hint text... on the sand" | Fast | 1.4 | 0.009 · 0.2 | hint on a dark rounded panel, larger text; panel is wider than the buttons and covers a strip of road | better |
| **Petal Pop** · "board sits too high... move it down to the middle" | Fast | 4.9 | 0.007 · 0.2 | one line; on the tall phone page the board moved **up** 30 px (top 287 → 257) | **worse, rolled back** (`git reset --hard`, `.godot` cleared, fresh check) |
| · "still too high... lower, closer to the bottom buttons" | **Smart** | 1.4 | 0.089 · 1.5 | board now sits 8 px above the bottom bar (top 287 → ~440 of 936 px), hills show above it | better |
| · "board looks plain... wooden garden frame, shinier, rounder flowers" | Fast | 4.2 | 0.036 · 0.7 | wooden frame with corner gems, glossier pieces; but blue diamonds became balls, so blue and purple differ by colour only | mixed, kept |
| **Sky Hopper** · "from behind my character looks like a plain white ball... ears, a tail and a backpack" | Fast | 2.1 | 0.014 · 0.3 | ears, tail, cyan backpack visible from behind (before/after pictures); the body is still a white blob | better (modest) |
| · "grass looks pale and washed out... a richer, greener green" | Fast | 2.0 | 0.008 · 0.2 | grass clearly green; island sides turned acid yellow-green (unasked) | mixed, kept |
| **Rooftop Ninja** · "cat is hard to see against the dark rooftops" | Fast | 1.6 | 0.010 · 0.2 | cat from near-black 3a3658 to lavender 8c84d6 with a warm halo; clearly visible; less "ninja-black" | better |
| **Sky Stack** · "the +1 popups... hard to see against the sky" | Fast | 1.3 | 0.006 · 0.2 | popup on a dark pill with a thicker outline (diff); **not seen** in a picture (it lives under a second, two timed shots missed it) | same (unconfirmed) |

Heroes (`screenshot-hero.png`, the cards' pictures) were re-taken by script for the polished tower defence (3 towers, 2x, a wave) and match-3 (garden map); the polished stack game has none (the card uses the 3-second picture; the old hero would have shown the original). **10-27**, for the home page: a hero for the polished stack game too, the original's way (a patched copy that plays itself: runs of perfect drops, misses of 12 and 16 px every 8 floors; shot at floor ~45, score 120, with the polished +1 pill), and the polished runner's icon is cut at the left edge, where the cat runs (`build-demo.mjs` `iconAt`). Like every hero it lives in `output/show-arcade-polished/export/screenshot-hero.png`, outside git: a re-run of `--showcase` without it puts the card back at floor 0.

**Part 2: effort low as the Fast default for new games.** The same prompt on Haiku at both efforts, product step rule (the classifier picked 2 steps for the racer, 3 for the match-3), `--budget 1` (so a cap could not stop a run; no step went over the product's $0.50: largest $0.396). Prompts: racer "Make a top-down racing game where I drive a car around a track against 3 rival cars for 3 laps. I want a countdown at the start, a lap counter, and a results screen at the end." Match-3 "Make a match-3 game with candy pieces and 10 levels. Each level has a goal, like reaching a score or collecting a certain candy, and I can win up to 3 stars. I want a level map to pick my level, and the game should remember my progress."

| Game | Effort | Min | $ | Credits | First file at | Core step thinking | Check · tests · fps | Layout and features |
|---|---|---|---|---|---|---|---|---|
| Lap Rush (racer) | low | 16.1 | 0.414 | 7.0 | 5.0 min | 100K tokens | OK · 14 · 61, then 14 | same as medium; plainer buttons |
| Lap Rush (racer) | medium | 17.0 | 0.414 | 7.0 | 6.2 min | 106K | OK · 14 · 60, then 23 | title over track, GO, HUD, minimap, 3 rivals, results; a grandstand and nicer buttons |
| Candy Match (match-3) | low | 16.8 | 0.379 | 6.4 | 7.0 min | 108K | OK · 16 · 72, then 33 | 10 levels, goals, map trail, 3 stars, saved progress, 3 specials, undo |
| Candy Match (match-3) | medium | 21.7 | 0.431 | 7.2 | 7.3 min | 114K | OK · 35 · 71, then 21 | same list; plainer balloon map, more test checks |

Total of the four: 71.6 min, $1.64.

Conclusions:
1. **Low is safe as the Fast default for new games, but it is not the half-price saving the tower-defence run suggested.** 4 of 4 builds passed with the same layout and the same feature list; low cost the same on the racer, 12% cheaper and 23% faster on the match-3 ($0.38 vs $0.43). The earlier tower defence (10-18, low $0.26 vs medium $0.49) was the outlier: with 3 runs, the median saving is about 12%.
2. **Why the saving is small:** the core step's silent thinking is 100-114K tokens at both efforts and the core step is 90% of the price ($0.34-0.40 of $0.38-0.43); effort low trimmed it by 2-9%. Haiku's 5× price above 100K input is what the cost is, so effort is not the lever; a cap on thinking is (not available on Haiku 5.5, see 10-17 night).
3. **What medium buys:** slightly more finish (grandstand, nicer buttons) and twice the test checks on the match-3 (35 vs 16), not different features. Fine for a free-tier default; Luka's call (row added to `docs/parked.md`).
4. **Polish by chat works on Fast: 9 of 10 Fast edits landed first time, for $0.20 and 29 minutes in all.** The one miss (Petal Pop's board) passed the check and tests but moved the board the wrong way; only the picture showed it, and a Smart retry ($0.089) fixed it. The check cannot tell "did what was asked" from "passed", so a before/after picture of the edited screen is the missing guard.
5. **"Slow with many bugs" took two follow-ups, not one:** edit 1 fixed bugs and map (1 → 33-46 fps) but a realistic state (towers shooting) stayed at 1 fps until edit 3; the first edit's own notes named the towers as next. Measure in the state the player is in, not only the stress case.
6. Side effects of loose asks (rounder flowers, greener grass) were real in 2 of 10 edits: unasked shape and colour changes. Say how, in the final message to the player.

## 2026-10-21: Black Hole Galaxy, a full port of a live Unity game (Opus high, 4 jobs)

**What it was:** Luka's store game, ported to Godot to replace the Unity app on Google Play and the App Store.
- The gameplay feel came from the 10-20 edits (eating, motion, scale).
- The rest came from four `--edit` jobs, run one after another by a Builder chain script. Each job ran with
  `--max-turns 500 --budget 300`, worked from a gap list and the Unity C# in `reference/`, and resumed itself after a failure.
- The four jobs: (A1) 100 levels, spawning, rewards, saves under Unity's PlayerPrefs keys; (A2) upgrades,
  energy, revives, ad / IAP stubs; (B1) 26 skins with the painted ring art; (B2) boost input, tutorial, settings, haptics,
  warmup, and a file-by-file comparison with the C#.

**Results:**

| Job | Time | Cost (API prices) | Result |
|---|---|---|---|
| A1 | 43.9 min | $8.18 | passed the check on the first try |
| A2 | 32.5 min | $9.88 | passed the check on the first try |
| B1 | 38.7 min | $10.10 | passed the check on the first try |
| B2 | 50.5 min | $12.85 | passed the check on the first try |
| **Total** | **165.6 min** | **$41.01** | **509 checks across 23 test files** |

A spot-check of A1 against Levels.cs found the level table 1:1. The agent even wrote a half-to-even rounding helper to match Unity's `RoundToInt`.

**Run tooling added for big jobs (`run.mjs`):**
- `--seed <dir>`: a new game starts with files (the converted art).
- `--max-turns`: the edit default of 60 turns killed a 27-min port.
- **A failed attempt is now kept on the branch `failed`** before the rollback. A session cut off by a Max usage limit ("session limit, resets 3am") had lost 19 min of work. The chain script restores that branch's files and tells the agent to finish the job.

**Builder store layer (in the store copy, `games/BlackHoleGalaxy-godot`):** AdMob, StoreKit 2, GameAnalytics, ATT, notifications,
the Unity save import, the AAB in WSL and the iOS export. Builder time, not agent time.

**Takeaway for TypePlay:** Opus high does a 2-3 h "port this big game" job reliably when it is split into ~40-min jobs, each with its
own check. One long session ran out of turns or hit the usage limit twice.

## 2026-10-25: platforms (one shape, or every screen)

**Question (Luka, 10-25):** shared games are opened mostly on phones, many makers build on a computer. Base rules for every
game (touch, mouse and keys; a real phone layout for complex games; one shape scaled to fit any screen with bars), and if
filling every screen costs little more, maybe no choice at all. Six prompts, three simple (runner, flappy-style, match-3)
and three complex (top-down action with 4 spells, a platformer with 6 moves, a small MOBA lane), each built three ways:
**(a)** today's agent (a frozen copy of `0e80a22`: the window stretches to any shape), **(b)** the base rules
(`--platform auto`), **(c)** fills every screen (`--platform fill`). Sonnet medium (Smart, the default for a new game), one
build each, three at a time (one prompt's three ways together), this PC's Max login, 10-25 02:52-03:54. Tooling:
`tests/platform-eval/` (`builds.mjs`, `devices.mjs`, `try.mjs`, `table.mjs`, `verdicts.json`); games in `output/plat-*`.

**How "works" was judged:** each game opened as the site serves it, an iPhone (393×852) and an iPad (820×1180) as touch
screens (a wide one-shape game with the device turned, as the site's hint asks), a laptop (1366×768) with keys and mouse;
9-13 inputs with a screenshot after each (`devices.mjs`), and exact taps where the generic ones missed (`try.mjs`: Play
buttons, swipes until fruit swapped, the joystick held while a spell fires). ✓ works, ~ works with the flaw noted.

| Game | Way | Credits | Min | iPhone | iPad | Laptop | Note |
|---|---|--:|--:|:-:|:-:|:-:|---|
| runner | (a) | 11.9 | 7.1 | ✓ | ✓ | ✓ | wide; stretches to each shape |
| runner | (b) | 8.8 | 8.1 | ✓ | ✓ | ✓ | wide, bars on a turned phone; Tap on touch, Space on the laptop |
| runner | (c) | 8.1 | 9.1 | ~ | ✓ | ✓ | upright phone: robot small, the lower half empty ground |
| flappy | (a) | 7.3 | 5.2 | ✓ | ✓ | ✓ | spread thin across the laptop |
| flappy | (b) | 7.1 | 5.9 | ✓ | ✓ | ✓ | upright; a column with bars on the laptop |
| flappy | (c) | 9.8 | 6.1 | ~ | ✓ | ✓ | upright phone: bee small; the best laptop view |
| match-3 | (a) | 13.9 | 8.5 | ✓ | ✓ | ✓ | swipes swap |
| match-3 | (b) | 9.0 | 6.4 | ✓ | ✓ | ✓ | starts only from Play; swipes swap |
| match-3 | (c) | 11.8 | 9.6 | ✓ | ✓ | ✓ | the board fills each shape |
| action | (a) | 14.8 | 8.6 | ✓ | ✓ | ✓ | drag to move + a 4-spell bar, also on the laptop |
| action | (b) | 14.7 | 12.6 | ✓ | ✓ | ✓ | joystick + 4-spell arc, both thumbs at once; starts only from Play |
| action | (c) | 13.6 | 12.8 | ✓ | ✓ | ✓ | joystick + arc on touch, a J K L spell bar on the laptop |
| platformer | (a) | 17.7 | 11.0 | ✓ | ✓ | ~ | touch buttons cover the level on the laptop |
| platformer | (b) | 12.7 | 9.6 | ✓ | ✓ | ✓ | arrows + jump / dash / slide (double and wall jump on Jump) |
| platformer | (c) | 15.3 | 12.2 | ~ | ✓ | ✓ | upright phone: cat small, little of the level ahead |
| MOBA | (a) | 17.3 | 9.7 | ✓ | ✓ | ✓ | tap to move + 3 skills |
| MOBA | (b) | 15.2 | 10.8 | ✓ | ✓ | ✓ | joystick + attack / dash / stun / blast arc; starts only from Play |
| MOBA | (c) | 13.4 | 9.9 | ~ | ✓ | ✓ | upright phone: the lane a thin sideways band; the best laptop view |

| Way | Credits, simple | Complex | All 6 | Minutes | Works on all three | Output / thinking tokens |
|---|--:|--:|--:|--:|--:|--:|
| (a) today | 33.1 | 49.8 | 82.9 | 50.1 | 5 of 6 | 310K / 127K |
| (b) base rules | 24.9 | 42.6 | 67.5 | 53.4 | 6 of 6 | 246K / 85K |
| (c) every screen | 29.7 | 42.3 | 72.0 | 59.7 | 2 of 6 | 261K / 110K |

**Findings:**
- **Every screen costs little: +7% credits, +12% time over one shape** (about +0.75 credits and +1 minute a game; simple
  games +19%, complex −1%). One build per cell, and a prompt's Sonnet builds vary 2-5× run to run (`runs.jsonl`), so read
  under ~25% as noise.
- **But it does not work as well where shared games are opened, an upright phone:** a side-view or lane game that fills a
  tall screen keeps its view ahead, so everything shrinks (4 of 6 fill games). On a laptop fill is the better view. So the
  platform choice was built (Phone / Computer / Every screen, `apps/web` /create), with Every screen's measured cost said.
- **The touch layout for hard games costs nothing extra** ((b) is 19% under (a), within noise): all three complex (b)
  games got a joystick under the left thumb and an arc of buttons under the right that work with both thumbs at once.
- 3 of 6 (b) titles started only from their Play button; `BASE.md` now says a tap anywhere but on other buttons starts.
- The check's touch phone page shows the agent its own touch controls (`DisplayServer.is_touchscreen_available()` is true
  under the browser's touch emulation; a tap there arrives as a touch and a click, hence "handle it once").

## 2026-10-27: genre and tags (the picks on /create)

**Question (Luka, 10-27):** /create's genre pictures became one pick at most, and tags several at once (2D or 3D,
Retro, Cute, Cozy or Hard; `tags/`). Does the agent build what was picked, and does a tag cost more? One idea that names
no genre and no look, "A game about a fox who collects berries in a forest.", built on Smart (Sonnet, medium: the
default for a new game) as Puzzle, Racer and Runner, each with no tags and with each tag (the Runner's Retro with 2D),
one build per cell, three at a time, this PC's Max login, 10-27 01:48-03:15. Tooling: `tests/tags-eval/` (`builds.mjs`,
`table.mjs`); games in `output/tag-*`, records in `output/_tags-eval/`.

**All 19 built on the first try, and each is what was picked** (its screenshots and its own description):

| Genre | Tags | Credits | Min | What it built |
|---|---|--:|--:|---|
| Puzzle | none | 13.9 | 12.3 | sliding fox on a board, eat every berry, par moves, levels |
| Puzzle | 3D | 9.2 | 6.5 | the same idea in 3D: a cube-pets fox, low-poly pines and rocks, 6 levels |
| Puzzle | Retro | 16.0 | 12.1 | pixel art, SCORE 000000 / HI 000000, blocky lettering, a dark palette |
| Puzzle | Cute | 10.2 | 11.6 | big-eyed fox, trees and berries with faces, "sleepy rocks", pastel |
| Puzzle | Cozy | 13.1 | 8.6 | a calm match-3 filling a basket, no timer, no move limit, Hint and Shuffle |
| Puzzle | Hard | 9.0 | 11.4 | a sliding puzzle with a move limit and par stars |
| Racer | none | 16.8 | 12.1 | 3 laps against three rival animals, minimap, countdown (after the fix below) |
| Racer | 3D | 17.4 | 15.1 | a 3D forest race, start/finish gate, 3 laps, 3 rivals, wide |
| Racer | Retro | 19.8 | 11.8 | a pixel-art race, LAP 1/3, 3RD/4, berries for speed |
| Racer | Cute | 14.5 | 15.3 | kart race against a bunny, a bear and a kitten |
| Racer | Cozy | 12.4 | 12.5 | a "cosy" two-lap race, berries grow back every lap |
| Racer | Hard | 12.8 | 13.6 | a timed race: berries add time, and the clock running out loses |
| Runner | none | 10.0 | 10.1 | side-view runner over logs and rocks, speeds up |
| Runner | 3D | 14.3 | 14.5 | three-lane 3D runner, swipe to change lane |
| Runner | 2D + Retro | 10.8 | 7.8 | side-view pixel runner, GAME OVER / NEW BEST! in pixel lettering |
| Runner | Cute | 15.7 | 16.9 | chubby fox, "grumpy stumps", "pouting mushrooms", smiling clouds |
| Runner | Cozy | 7.9 | 7.9 | "nothing can go wrong": a bump only slows the fox, 30 berries end the day |
| Runner | Hard | 9.8 | 9.8 | one hit ends the run, the speed keeps climbing |

**Found and fixed: the genre skill's first line.** It was written for the AI's own pick ("The player's request always
wins … if this genre doesn't fit what they asked for, do what they asked"). Under it Racer with no tags built a berry
chase with wolves and a timer, not a race: the idea won over the picked genre (kept in `_tags-eval/old-genre-line/`).
A picked genre now opens its skill with "The player picked this genre for the game: make it one, with their idea inside
it. Their own words win over the genre defaults below (theme, characters, extra features), never over the genre
itself." The same Racer then built a 3-lap race. Puzzle (none, 3D, Retro) and Racer (3D, Retro) were built under the old
line (they kept their genre anyway); the rest under the new one.

**Cost and time per tag** (the three genres' credits as the app charges them, against the same genres with no tags):

| Tag | Credits | Minutes |
|---|--:|--:|
| 3D | +0% | +5% |
| Retro | +14% | −8% |
| Cute | −1% | +27% |
| Cozy | −18% | −16% |
| Hard | −22% | +1% |

One build per cell, and the same Sonnet build varies 2-5× run to run (10-25, platforms), so read differences under
~25% as noise: **no tag measurably changes the credits or the build time**, and /create says nothing about cost under
the tags (Any screen's +7% line came from a measurement; here there is nothing to say). Single games swing widely either
way (3D Puzzle 9.2 credits against 13.9 without; 3D Runner 14.3 against 10.0). 19 builds, $14.45 at API prices on the
Max login, 217 build minutes. Then (HQ 10-27 03:25, the subscription near its weekly limit) the API path was checked
on the API key without a full build: the API started `run.mjs --model sonnet --effort medium --genre towerdefence --tags
retro,cute` for `POST /projects` with those picks, and run.mjs said "genre skill: towerdefence", "tags: retro, cute"
before it was stopped (0 credits); an edit of the 3D Racer said "genre skill: racer", "tags: 3d" (it reads the game's
GENRE and TAGS) before its model call.

Not done: Fast (Haiku, 2-3 short steps) and Best (Opus) with tags; play by hand on a phone; Tower defence only through
the stopped API run above.
