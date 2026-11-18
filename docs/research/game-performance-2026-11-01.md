# Why games stutter and slow down on testers' devices (2026-11-01)

HQ asked, for Luka: beta testers on laptops and phones weaker than Luka's PC report (1) short freezes in the
first ~10 seconds of a game, then smooth play, and (2) a game that runs well for 2-3 minutes and then drops to a
very low frame rate (a tower defence full of towers and enemies, or ~10 minutes in), smooth again after an in-game
restart. Are they right, why, can it be fixed, how. Investigation only: no code, rules, export settings or other
files changed; this report is the only new file.

## The answer

| | Testers right? | Main cause (measured) | Fix | Fixes it fully? | Builder time |
|---|---|---|---|---|---|
| **1. Freezes in the first seconds** | **Yes** | The browser compiles Godot's shaders the first time it meets them, and a frame waits for each one: 2.3-14 s before a game's first frame, then 0.5-3.5 s freezes the first time a 3D game shows a new look. Smaller: the frame that starts play builds the whole level (0.2-1 s), and the engine runs on slow, quickly-compiled code for its first seconds | A warm-up in every game (game agent rule + helper), warming the browser's shader store while the player waits for a build, an honest loader text | Freezes **during play: yes**, for everything the warm-up covers. The first game ever in a browser still loads slower (only shorter) | ~2-3 days |
| **2. Slows down after minutes** | **Yes, but it is not a leak** | Each tower costs work every frame, so the cost grows with the towers and enemies on the map. Most of that cost is the code-drawn art being redrawn every frame. When a frame runs late, Godot runs up to **8** catch-up logic steps in the next frame, which makes it later still, so the frame rate falls off a cliff. A restart empties the map, so it is smooth again | Game agent rules: draw each look once into a picture, cheaper towers and effects. A "late game" stress test in the build check. A one-line project setting (3 catch-up steps, not 8) | Mostly. The same 73-tower map: **1.1-1.3 fps drawn every frame vs 60-84 fps drawn once** (4× CPU). A very heavy game on a very weak device stays slow; the check stops the agent from shipping one | ~3-4 days |

**Why Luka doesn't see either one:**
- **His browser has compiled Godot's shaders long ago.** A second visit in the same browser waited 0.03-0.04 s for
  them, not 2.3 s or more, and that holds across games: the runner started at once after one tower-defence game in
  the same browser.
- **His PC is far faster.** A Ryzen 7 5800X; a 4× slower CPU is a cheap laptop or a mid-range phone, 6× is a low-end
  one.

**Is it TypePlay's page or the games?** Mostly the engine in the browser and the games' code. TypePlay's page adds
nothing measurable:
- **The export** is Godot 4.7.2's release web template, byte for byte, single-threaded.
- **Live and local are identical**: the engine, `play.html` and the 5 tower defence and showcase packs tested on
  typeplay.dev have the same bytes as local.
- **No log forwarding**: `play.html` does nothing per frame, and Godot's prints go only to the browser console.
- **The site's game frame (iframe)** measured the same as the game page alone.

## See it yourself on your PC (10 minutes)

1. **A tester's first visit = a browser that has never run Godot.** Press Win+R and run:
   `msedge --user-data-dir=%TEMP%\tp-cold --no-first-run https://typeplay.dev/play.html?g=show-3d-polished`
   This is a separate, empty Edge profile. Open the game's own address on typeplay.dev, not the share page, so the
   slowdown below applies to the game itself.
2. **A weak CPU:** press F12 → **Performance** tab → the gear icon → **CPU: 4× slowdown** (6× for a low-end phone).
   Keep DevTools open and reload the page (Ctrl+R).
3. **A frame-rate meter:** in DevTools press Esc → ⋮ → **Rendering** → tick **Frame rendering stats**.
4. **Problem 1:** the loading bar fills, then nothing happens for seconds: shaders are compiling. Walk to the first
   checkpoint: the game freezes for ~3 s the first time and never again.
5. **Close the window and run the same command again:** the start is quick now. That second visit is what you have
   seen all along.
6. **Problem 2:** in the same window open `https://typeplay.dev/play.html?g=show-td` (the plain tower defence) at 4×.
   Build towers on most cells and watch the meter fall as the towers grow. Restart the map and it is back up. The
   polished one (`g=show-td-polished`) stays smooth at 4× and only sags at 6×: that difference is fix 2a below.
7. Delete `%TEMP%\tp-cold` afterwards.

## Problem 1: freezes in the first seconds

**What happens, in order** (cold browser, CPU throttled 4-6×, this PC's real GPU through the browser's normal
Direct3D path):

1. **The engine starts (every game, 2D too).** Godot's web renderer (WebGL 2) compiles 22 shader programs before the
   first frame. Two are Godot's built-in 3D material shader, about 123 KB of shader text each, even in 2D games. On Windows the browser
   translates and compiles each one (ANGLE → Direct3D): **1.1-1.3 s per program** on this PC when it is calm, up to
   9 s when it is busy.
   - **Total wait:** 2.3-2.9 s in 24 of 33 cold runs, 4.0-14.3 s in the other 9 (runs where the PC was busy with other
     work, or a 3D game that adds its own materials). A tester's laptop is slower still.
   - **What the player sees:** the download bar is already full, so it looks like a second load after loading.
   - **Second visit in the same browser:** 0.03-0.04 s. The browser keeps the compiled shaders and shares them
     between all games on typeplay.dev.
2. **A 3D game keeps compiling** a shader for each new material look (StandardMaterial3D settings), ~1.0-2.2 s each,
   cold.
   - **Before play:** the 3D showcase compiled 66 programs (13.3 s of waiting) before its loader went away. Load time
     at 4× was 17.9-18.4 s (6×: 25.3 s). Two 3D games built through the app took 18.4 s and 26.7 s at 6×.
   - **During play,** the first time something new appears:

     | 3D showcase, 4× CPU, cold | Freeze |
     |---|---|
     | first coin effect (a new material, particles, a big 3D label) | **0.46 s** |
     | first checkpoint lighting up (`emission_enabled = true` turns on a new shader) | **3.46 s** (two programs, 1.57 s + 1.49 s) |
     | second coin, second checkpoint | none |

3. **2D games compile 2 more programs** in their first seconds, the first time they draw a polygon and the first time
   they draw particles: 10-57 ms each here, longer on a slower CPU.
4. **The tap that starts play** runs the game's whole level build in one frame: the map, the HUD and new text sizes
   (Godot's node count changes in that very frame):

   | Game, CPU | Freeze at the tap |
   |---|---|
   | Tower defence, 6× | 200-443 ms |
   | 3D showcase, 4× / 6× | 224 / 443 ms |
   | "Scaredy Alien" (a game built through the app), 6× | 1,013 ms |

   The polished tower defence also freezes half a second after its first frame (116-128 ms at 6×). It bakes its
   sprite sheets and reads each picture back from the GPU: 45-82 ms per read on this PC's GPU, 332-477 ms on a
   software GPU.
5. **The engine's code is slow for its first seconds.** The browser first runs Godot's 39.5 MB engine as quickly
   compiled code and swaps in optimised code as the game runs. With only the quick code (`--liftoff-only`), the runner
   at 4× ran at 8-11 fps instead of 28-45, so that code is 3-4× slower. This matches "a few rough seconds, then
   smooth", and it is worse on CPU-heavy games. The light tower defence barely changed (71-83 fps vs 84-108 at 6×).

**Some games are simply too heavy for a weak CPU, freezes aside:**

| Game | 4× CPU | 6× CPU |
|---|---|---|
| Runner | 28-45 fps | 3-9 fps from the start (see problem 2 for why) |
| Racer | 67-83 fps | 29-37 fps |
| Tower defence, level 1, first wave | | 81-112 fps |
| "Shape Swap" (a 2D game built through the app) | | 27 fps |

**Fixes:**

| # | Fix | Where | Effect | Builder time |
|---|---|---|---|---|
| 1a | **Warm-up in every game.** Before play (behind the title screen), draw once every material, 3D model, particle effect and text size the game uses. Never switch a material's features during play (emission on/off): make the "lit" look a second material and warm both. Godot's documentation recommends exactly this for its web/compatibility renderer. Also: build the level on the title screen or behind a short fade, not in the tap's frame | Game agent rules (`rules/BASE.md`, the 3D genre skill), a small `warmup.gd` helper in `templates/blank` | The 0.5-3.5 s freezes in play go away (compiles move to the title screen); the tap freeze shrinks | ~1 day + a test on 3 games |
| 1b | **Warm the browser's shader store before the game is needed.** The store is shared by every game on typeplay.dev, so a tiny hidden warm-up game run on typeplay.dev while the player waits for a build (/create, where a build takes minutes) removes the 2.3-14 s engine start from their first play; it can also draw the common 3D material looks | `apps/games` (a warm-up pack), `apps/web` (/create starts it) | Removes the engine-start wait for everyone who builds; gallery and share-page visitors still pay it on their first game (warming there costs phones CPU while they read; decide later) | ~1 day + a check on a real laptop |
| 1c | **Honest loader.** When the download ends, say "Preparing graphics (first time only)…" instead of showing a full bar that looks stuck | `apps/games/play.html` | Doesn't shorten anything; explains the wait | ~1 hour |
| 1d | Experiment: a 2D-only Godot web engine (built with `disable_3d`). It may drop the two big 3D shaders from every 2D game's start and makes the 9.6 MB engine download smaller. Not verified; needs our own engine build per Godot version | `apps/games/engine/`, the export | Unknown until tried | 2-3 days |
| 1e | Lead: the browser could reuse optimised engine code on later visits if Godot's loader handed it the engine file directly; the loader wraps the download to show progress, which likely prevents that | `play.html` / the engine's loader | Faster first seconds on second visits, if it works | ~0.5 day to test |

The quick-code phase (point 5) can't be switched off. It hurts less when the games do less work per frame
(problem 2's fixes).

## Problem 2: the frame rate drops after a few minutes

**No leak.** Godot's own counters stayed flat while the load stayed the same:

| Game, 4× CPU, the same load held | Nodes | Objects | Resources | Video memory |
|---|---|---|---|---|
| Tower defence, 73 towers, bugs streaming in, 5 minutes (two runs) | 415-434 | 2,345-2,414 | 16 | 72 MB |
| Runner, a run that never ends, 10 minutes | 89-91 | ~1,580 | 13 | 26.7 MB |

**A restart helps only because it empties the map.** In the polished tower defence at 4×, with nothing else running
on the PC:

| Polished tower defence, 4× CPU | Frames a second |
|---|---|
| 73 towers, 26-34 bugs on the map, minutes 0-5 | 60-84, no downward trend |
| Restart, the same 73 towers built again at once | 70-73: the same |
| Restart, no towers, 100-113 bugs walking | 156-164 |

The code audit of 20 agent-made games agrees:
- **No growth:** 0 nodes that are never freed, 0 arrays that only grow, 0 signals connected again and again.
- **No prints during play.**

The "orphan nodes" counter reads 0 throughout, but Godot's release engine may not count orphan nodes at all, so that
number proves nothing.

**What grows is the work per frame, with the number of things on the map.** The towers are the cost: 73 of them
take about 8 ms of every frame at 4× (70 fps with them, 160 fps without).

**How the towers are drawn decides most of it.** The two showcase tower defences are the same game, except the
polished one draws each tower and bug once into a picture at start and then shows the picture:

| 73 towers, bugs streaming in, 4× CPU, 3 minutes | Frames a second | Draw calls a frame | Godot's process time a frame |
|---|---|---|---|
| `show-td`: every tower and bug redrawn in code every frame (6 of the 13 main games audited redraw towers or enemies like this) | **1.1-1.3** (game time at ~25% of real time) | 3,870-4,560 | 73-85 ms |
| `show-td-polished`: drawn once into pictures | **60-84** | ~290 | ~10 ms |

- **Per tower, every 1/60 s,** in every tower-defence game audited, it scans every enemy (8 of 8 games). Across all
  the games:
  - In 6 of the 13 main games audited, towers or enemies redraw themselves every frame.
  - In 10 of 13, a hit, kill or pickup spawns a new particle node.
- **The two worst:**
  - One game asks the engine for the list of all enemies once per tower, 60 times a second.
  - Two games redraw the whole static board every frame.

**Why it collapses instead of slowing down gently:**
- **The catch-up rule.** All our games run their logic in fixed steps of 1/60 s (`_physics_process`). When a frame
  takes longer, Godot runs 2, 3 … up to **8** steps in the next frame to catch up, and that frame takes longer still.
- **The same tower-defence scene, with a little less CPU, fell off the cliff.** The first long run shared the PC with
  other work: another session's video render (ffmpeg, ~44% of this PC) was seen running during the long runs. The
  same 73 towers then gave 8-35 fps for about 4 minutes, with 8 catch-up steps in a frame, instead of 60-84. They went
  back to 56-83 fps without a restart. The clean rerun, with the PC's CPU logged next to it (16-43% in total, no
  other heavy program), is the 60-84 above. A tester's device with other tabs open, or a phone getting warm, is in
  that position.
- **The runner at 6× sits at 8 steps every frame from the start:** 5.6-6.4 fps, and its game time runs at about 83%
  of real time.
- **With 3 steps instead of 8**, the same runner gave **12.5-13 fps (2.2× more)**, and its game time ran at about 66%
  (a slow-motion game instead of a slideshow).
- **The cap is no cure on its own.** The polished tower defence with 73 towers at 6×, where drawing is a bigger share
  of each frame, gave 17-26 fps with 3 steps and 14-27 fps with 8.
- **So a game that is fine at minute 2 crosses a line** at some number of towers and bugs, and the frame rate falls
  off a cliff. A restart removes the towers and bugs, so the game is back under the line.

**Phones also slow down when they get hot.** Phones lower their CPU speed after a few minutes of steady load. That
moves the same line closer, and fits "smooth for 2-3 minutes" on phones; it can't be measured on a PC. The fixes are
the same.

**Fixes:**

| # | Fix | Where | Effect | Builder time |
|---|---|---|---|---|
| 2a | **Cheaper games, as game agent rules:**<br>- Draw each enemy, tower and other repeated look once into a picture and show that, as the polished tower defence does.<br>- Redraw only what changed; never redraw a static board per frame.<br>- Towers choose a target a few times a second (a timer), not every step.<br>- Enemies live in one list the towers read; no `get_nodes_in_group` per step.<br>- Reuse effect nodes or cap how many are alive. | `rules/BASE.md` / `GOTCHAS.md` (the redraw rule there today covers only static maps), the tower defence and runner genre skills | The drawing part is measured: 1.1-1.3 → 60-84 fps on the same 73-tower map at 4×. The other rules cut the per-tower logic (not measured separately) | ~1 day, incl. building a tower defence and a runner with the rules and rerunning the long test |
| 2b | **At most 3 catch-up steps per frame** (`physics/common/max_physics_steps_per_frame=3`; Godot's default is 8). The build tests run at a fixed frame rate (`--fixed-fps 60`), one step per frame, so they don't change | `packages/agent/templates/blank/project.godot` (every new game), and a rule so the agent keeps the line | Measured: the runner at 6× 2.2× more frames (slow motion instead of a slideshow); no change in the drawing-heavy tower defence. A safety net, not the fix | ~1 hour |
| 2c | **A "late game" stress test in every build's check.**<br>- The genres already require test hooks (tower defence: `try_build`, waves). The check fills the map (every cell built, bugs streaming) and measures Godot's logic and draw time per frame in headless Godot. A game over budget goes back to the agent like any failed test.<br>- The web check also runs once with the CPU at 4×, and counts frames over 50 ms and shader compiles after play starts. That catches problem 1's freezes too. | `packages/agent/tools/check.mjs`, the test helpers, the genre skills | Problems like these are caught before a user sees the game | ~2 days |

The check's frame rate today can't show either problem. Its hidden browser draws in software and is limited by
drawing: the tower defence runs at 42 ms a frame there even with no CPU slowdown.

## Fix order

1. **2b** (1 hour) and **1c** (1 hour): small, safe, they help every new game.
2. **1a + 2a**, the game agent rules (~2 days): the freezes in play and the cost per tower; one test build of a
   tower defence, a runner and a 3D game, and the long run again.
3. **2c**, the automatic stress test (~2 days), so the rules hold.
4. **1b**, warming the shader store on /create (~1 day + a real laptop).
5. Experiments when there is time: **1d** (2D-only engine), **1e** (engine code reuse).

Games already built keep their behaviour until they are rebuilt or edited: the rules and the setting apply to new
builds and edits.

## Found on the way (a separate bug, not performance)

**The tower defence showcase ("Gingerbread Guard", `show-td-polished`, on the home page) draws map 1's road on maps 2
and 3.**
- **Cause:** the baked board picture is reused whenever the screen size is the same (`map.gd:122`: it checks only the
  view rectangle), and `setup()` never clears it.
- **Seen:** a screenshot of map 2 ("Frosting Falls") shows Sugar Meadow's road. Map 2's bugs walk a different path
  (`levels.gd:61`) than the one drawn.

## How it was measured

- **The games:** as typeplay.dev serves them (`play.html` + `engine/4.7.2` + `builds/<id>`), from a local static
  server.
  - The tower defence, runner, racer and 3D showcase games (`*-polished`), checked byte-identical to the live ones,
    and the plain tower defence (`show-td`).
  - Three games built through the app, from the local site's builds (`.claude/worktrees/ux-fixes/apps/games/builds`):
    Night Bite, Scaredy Alien, Shape Swap.
- **The browser:** Edge 156, headless, through Playwright.
  - **A weak CPU:** DevTools' CPU throttling (`Emulation.setCPUThrottlingRate` 4 and 6).
  - **A GPU:** this PC's GPU through Direct3D 11, the path a Windows laptop uses, and once a software GPU
    (SwiftShader).
  - **Frame pacing:** vsync off, so frames are not capped; this PC's display gives ~6 ms frames at best.
  - **Cold runs:** a fresh profile per run. A kept profile for the warm-cache runs.
- **Frame times:** every browser frame recorded from the first frame Godot draws.
  - Each WebGL shader compile timed, by program, and every WebGL call that made the page wait over 8 ms.
  - Godot's own counters from a probe added only to temporary copies of the games (never to the repo): frames, logic
    and draw time, logic steps per frame, nodes, objects, resources, draw calls, memory, every frame over 50 ms.
- **The long runs, scripted through the games' own hooks:**
  - Tower defence: towers on every free cell, 3 bugs a second, restarts at set times. 12 minutes, then an 8-minute
    rerun with the PC's CPU logged next to it.
  - Runner: a run that never ends, 12 minutes.
  - 3-minute runs: the plain tower defence at 4×, and the polished one at 6× with 3 and with 8 catch-up steps.
- **Also tested:**
  - Shader compiles cold and warm, and across games.
  - Inside an iframe like the site's.
  - Quick-compiled engine code only (`--liftoff-only`).
  - Eager optimisation (`--no-liftoff`): it removed the rough first seconds but took 122 s to load, so not a fix.
  - 3 vs 8 catch-up steps.
  - The first 3D coin and checkpoint, triggered at known times.
- **The PC rules:**
  - Heavy work ran through `cpu.mjs` (12 cores, below-normal priority).
  - One hidden browser at a time, sharing the same lock as the build checks.
  - Everything was stopped afterwards.
- **The code audit:** 20 agent-made games in `packages/agent/output` (all tower defence games, the showcase games and
  7 Haiku runners).
- **The measuring scripts** lived in this session's temporary folder and are not kept. The method above is enough to
  repeat them, and fix 2c builds the same idea into the check.
- **Not measured:**
  - Real phones and an iPhone: their GPU drivers compile shaders too, with their own speeds and stores.
  - A real weak laptop's GPU.
  - Phones' high-density screens: Godot may draw at the screen's full pixel density, up to 9× the pixels of a
    desktop page.
  - Thermal slowdown on phones.
- **Related Godot reports:**
  - [#72584](https://github.com/godotengine/godot/issues/72584) (ANGLE compiles slowly on the web).
  - [#76241](https://github.com/godotengine/godot/issues/76241) (a stutter the first time a 2D element is drawn).
  - Godot's [pipeline compilation docs](https://docs.godotengine.org/en/latest/tutorials/performance/pipeline_compilations.html)
    (the warm-up advice).
