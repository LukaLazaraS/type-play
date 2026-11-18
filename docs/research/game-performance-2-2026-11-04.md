# Dead Haul and Scrap Siege: why they crawl on a fast PC, and the proof they can be fixed (2026-11-04)

HQ asked, for Luka, as a follow-up to `docs/research/game-performance-2026-11-01.md`. Luka played two gallery games on his own
PC (Ryzen 7 5800X, no CPU slowdown):
- **Dead Haul** (`l4fo6bytz6-v3`, a truck runner, built 11-03) drops to about 5 fps from the middle of the map.
- **Scrap Siege** (`rwrcgqhnik-v5`, a tower defence, built 11-01) is unplayable in the late waves.
- Both freeze in the first seconds after the loading screen.

Questions: why exactly, can it really be fixed, and how sure are we for future games.

This was an investigation only. No code, rules, export settings, games or live data were changed, and this report is
the only new file. The test copies of the two games lived in a scratch folder and are deleted.

## The answer

**1. Why.** Both games draw everything as hundreds or thousands of small shapes, and they draw them again every frame.
- **The browser makes this expensive.** In Godot's web renderer, every circle and filled shape is its own job for the
  graphics card ("draw call"). A shape that is redrawn every frame is also sent to the card again.
  - A shape drawn once costs about 7 µs a frame; one redrawn every frame costs about 45 µs.
  - A zombie is ~60 shapes, a tower 20-45, an enemy 35-60.
- **The cost grows with what is on screen:**
  - Dead Haul's generator puts more and bigger zombie groups on the road the further you drive.
  - Scrap Siege pays ~1 ms per tower and ~2 ms per enemy, every frame.
- **The catch-up rule makes it worse.** Once a frame takes longer than 1/60 s, Godot runs up to 8 catch-up logic steps
  in the next frame.
- **What it is not:** a memory leak (the node count stays flat), the window size, or Luka's PC.

**2. Can it be fixed?** Yes, measured on the same PC in the same browser, with the same pictures on screen. Each look is
drawn once into a picture when the game starts and then shown from it, and Dead Haul's ground is drawn as one batch.
That took 120-150 changed lines per game plus a 90-line helper, and the game logic was not touched.

| Same moment, this PC, normal browser setup | Original | Fixed copy |
|---|---|---|
| Dead Haul, the whole road 0-510 km (1-second averages) | **4-66 fps**, 46% of the drive under 20 fps | **57-161 fps**, never under 56 |
| Dead Haul at km 410 (14 zombies on screen) | **6.6-11 fps** (88-153 ms a frame) | **64 fps** (16 ms) |
| Scrap Siege, late waves (12 towers, waves 9-10 at 2× speed) | **11-45 fps**, frames up to 280 ms | **85-223 fps**, worst frame 44 ms |
| Scrap Siege, 20 towers firing at 60 enemies | **7.2 fps** (139 ms, 8 catch-up steps) | **173 fps** (5.8 ms) |
| Scrap Siege, the title screen | **34 fps** | **309 fps** |

**3. Is the approach itself the problem (AI-written Godot games in a browser)?** No. The same engine in the same browser
went from 4-11 fps at the worst moments to 57-309 fps once the drawing was done the economical way. The approach does
have three real costs:
- **A 3.6-3.8 s freeze on the first open in a browser**, from the engine compiling its shaders. It is fixed on the
  platform side.
- **Every draw costs more in a browser than in an app**, so games must be drawn economically. That takes a rule plus an
  automatic check.
- **Phones have 4-6× less CPU.** After the fix both games hold 35-47 fps at their heaviest moments on a 4× slower CPU.
  A 6× slower CPU (a low-end phone) still struggles there.

**4. How sure, for future games:**
- **These two games can be fixed:** certain, shown above.
- **The agent writing fast games by itself:** fairly sure, but only once three things exist:
  - a drawing helper in every new game;
  - rules that say when to use it;
  - an automatic late-game stress test in the build check that fails slow builds like a failed test.
- **With rules alone:** I expect it to keep slipping. The agent followed today's drawing rule to the letter and still
  wrote both games.

**5. The start freezes** are the engine's own shader compile, not the two games' code:
- **First open in a browser:** 3.6-3.8 s right after the loading bar.
- **Second open:** 0.8 s.
- **After the freeze:** Scrap Siege's own title screen then ran at 24-34 fps for a few seconds; the fixed copy fixes that.
- **The engine part:** fixes 1b and 1c of the first report.

## Dead Haul: the cause, with numbers

### What Luka saw, measured

An upgraded truck driven from the start to the evac zone. These are 1-second averages in a normal browser setup on this
PC:

| Stretch of the road | Original | Fixed copy |
|---|---|---|
| 0-50 km | 22-43 fps | 57-141 fps |
| 50-100 km | 9-33 fps | 91-161 fps |
| 100-250 km | 13-40 fps | 94-138 fps |
| 250-300 km (the middle) | 17-40 fps | 77-143 fps |
| 300-350 km | **4-50 fps** (3.8 fps at km 324, a 342 ms frame) | 84-141 fps |
| 350-400 km | 12-66 fps | 64-128 fps |
| 400-450 km | **6-28 fps** (6.4 fps at km 414) | 73-104 fps |
| 450-510 km | 9-20 fps | 57-86 fps |

Luka's "about 5 fps" is reproduced: 3.8-9.8 fps in eight places of the drive, all from km 96 on, mostly past the middle.
Godot's node count stayed at 71-81 for the whole drive, so nothing piles up. The slowdown comes from what is on screen.

### Exactly why

At fixed spots, each part was measured by hiding it for a few seconds:

| Spot | On screen | Whole frame | The ground's share | The zombies' share |
|---|---|---|---|---|
| km 10 | no zombies | 21 ms (47 fps) | **16 ms** | ~0 |
| km 100 | 5 zombies, 1 brute, a barrel, a station | 35 ms (28 fps) | 17 ms | 15 ms |
| km 250 | 2 zombies, a car, cash | 26 ms (38 fps) | 7 ms | 1 ms |
| km 410 | **14 zombies** | 88-153 ms (6.6-11 fps) | 31 ms | **44 ms** |

**1. The ground is redrawn every frame as ~200 separate shapes** (`track.gd`: `_process` calls `queue_redraw()` every
frame).
- **What `_draw()` does:** for every 16-pixel column of road on screen, two filled four-corner shapes and a rectangle,
  plus a stone or a bone in every seventh column, then three thick road lines.
- **Cost:** about 70 columns on screen, 16-31 ms a frame for the ground alone. Hiding it took km 10 from 21 ms to 5 ms.

**2. Each zombie is ~60 shapes, ~20 of them circles,** and is redrawn 60 times a second (`ents.gd`, `_zombie()`).
- **Cost:** ~3 ms per zombie per frame.
- **Zombies grow with distance** (`track_gen.gd`, `_fill()`):
  - the chance of a zombie group every 120 px is 30% at the start, 50% at the middle and 70% at the end (`0.3 + 0.4 × distance`);
  - a group is 1-2 zombies at the start and up to 1-5 at the end;
  - brutes appear after the first 50 km.
- **Result:** 0 zombies on screen at km 10, 14 at km 410.

**3. Why shapes are so expensive here.** In Godot's web renderer (WebGL 2), rectangles and single lines are grouped into
a few jobs for the graphics card, but every circle, filled shape, arc and multi-point line is a job of its own. When a
node redraws, its shapes are built and sent to the card again. Measured in Scrap Siege:
- **Drawn once:** its board, about 1,230 jobs, costs 8.5 ms a frame (~7 µs each).
- **Redrawn every frame:** each extra job from towers costs ~45 µs, about six times more.

**4. Catch-up steps.** At km 410 Godot ran 5-8 logic steps per frame instead of 1, to keep game time up with real time.
Dead Haul's logic is light (0.6-1.4 ms a frame even then), so here the catch-up adds little: the drawing is the cost.

**5. Not the window size.** km 410 measured the same at 1280×720, 1920×1080 and 2560×1440 (13-18 fps in the faster
setup): the cost is the number of shapes, not pixels.

### The fix on the copy, before and after

What changed:
- **The ground:** the same columns, colours, stones and road, collected into one list of triangles and drawn in one go
  (`track.gd`: 38 lines changed).
- **Zombies and objects:** zombies, brutes, cars, crates, barrels, barriers, fuel cans, cash, the fuel station and the
  evac gate are drawn once at start into one shared picture and then shown from it (`ents.gd` +73 lines, `main.gd` +6, a
  new 90-line helper).
  - Zombies are drawn in 32 steps of their walk, in their 3 looks.
  - The rare giant and the floating "+$" texts are drawn as before.
- **Game logic:** not touched.

| Spot (normal browser setup) | Original | Fixed copy |
|---|---|---|
| km 10 | 21 ms (47 fps) | 7.5 ms (133 fps) |
| km 250 | 26 ms (38 fps) | 10.4 ms (100 fps) |
| km 410 | 88-153 ms (6.6-11 fps) | 15.7 ms (64 fps) |
| Jobs for the graphics card per frame | 420-1,140 | 170-280 |

- **Looks:** screenshots of the same spot look the same by eye; only the zombies' walking poses differ.
- **What the fix costs:**
  - Drawing the looks at start takes ~0.5 s of the title screen at about 50 fps instead of 60+.
  - The picture uses ~30 MB of graphics memory, drawn at 2× size so it stays sharp when the window scales the game up.

## Scrap Siege: the cause, with numbers

### What Luka saw, measured

A normal game on level 1 with 12 towers, waves sent early every 6 s, and 2× speed from wave 8:

| Wave | Original | Fixed copy |
|---|---|---|
| 1 | 30-45 fps | 178-229 fps |
| 5 | 24-30 fps | 187-214 fps |
| 7 | 22-26 fps | 208-223 fps |
| 9 (2× speed) | 20-25 fps | 187-222 fps |
| 10 (2× speed, up to 19 enemies) | **11-45 fps, frames up to 280 ms** | 85-223 fps, worst frame 44 ms |

With more towers and more enemies alive, which is what a late wave looks like when the defence falls behind, it collapses:

| Moment (normal browser setup) | Original | Fixed copy |
|---|---|---|
| Title screen (the demo) | 29 ms (34 fps) | 3.3 ms (309 fps) |
| Level start, no towers | 9.6 ms (105 fps) | 4.2 ms (238 fps) |
| 10 towers | 18 ms (55 fps) | 4.0 ms (251 fps) |
| 30 towers | 38 ms (26 fps) | 4.1 ms (245 fps) |
| 20 towers firing at 20 enemies | 62 ms (16 fps) | 4.9 ms (202 fps) |
| 20 towers firing at 40 enemies | 98 ms (10 fps) | 6.6 ms (152 fps) |
| 20 towers firing at 60 enemies | **139 ms (7.2 fps), 8 catch-up steps every frame** | 5.8 ms (173 fps) |
| Jobs for the graphics card per frame | 1,230-3,610 | 74-260 |

### Exactly why

1. **Every tower and every enemy redraws itself every frame** (`tower.gd` and `enemy.gd`: `_process` calls
   `queue_redraw()`).
   - **Towers:** a tower is 20-45 shapes (base, turret, level pips): ~1 ms a frame each.
   - **Enemies:** an enemy is 35-60 shapes (shadow, legs, body, eyes, teeth, health bar): ~2 ms a frame each, with its
     shots and hit effects.
   - **Late waves add both:** more gold buys more towers, and waves overlap. A wave is 7 + 2 × its number enemies, and
     a new one comes every 8-10 s, so 20-60 enemies can be alive at once.
2. **The board is drawn once, as the rules ask, but it is ~1,230 shapes.** Even empty it costs 9.6 ms a frame: half the
   budget for 60 fps before a single tower.
3. **The title screen redraws its art (6 towers and 3 enemies) and the demo every frame:** 34 fps on a fast PC.
4. **The logic adds up, and the catch-up rule multiplies it.**
   - **Targeting:** every tower picks a target 60 times a second by checking every enemy; 20 towers × 60 enemies is
     1,200 checks per step.
   - **Shots:** saw and rail shots copy the whole enemy list every step.
   - **Total:** 6.6 ms of logic per frame at 60 enemies, mostly from 8 catch-up steps of 0.8 ms each.
   - That is small next to the drawing on this PC, but it is the next wall on a weak phone (below).

### The fix on the copy

What changed:
- **The board:** drawn once into a picture (`main.gd`).
- **Every look:** each tower base, turret (3 levels, 8 animation steps) and the level pips; each enemy (16 steps of its
  walk, in a normal, a slowed and a hit-flash version, with health bars from the same picture); and the title art. All
  drawn once at start into one shared picture and shown from it.
- **Size:** `main.gd` +69 lines, `tower.gd` +14, `enemy.gd` +18, `screens.gd` +17, plus the same 90-line helper.
- **Not touched:** game logic, tower stats, waves.
- **Looks:** screenshots look the same by eye.
- **What the fix costs:** baking takes ~0.75 s of the title screen at 21-45 fps (once, at start) and ~30 MB of graphics
  memory.

## The start freezes (first minute, cold browser)

A fresh Edge profile opened the live games on typeplay.dev and played them for 45-60 s. Every WebGL call that made the
page wait 4 ms or more was timed.

| | First open in a browser | Second open (same browser) |
|---|---|---|
| Dead Haul | **3.8 s** frozen right after the loading bar (2.9 s of it shader compiles) | 0.8 s |
| Scrap Siege | **3.6 s** frozen (2.7 s shader compiles), then ~3 s at 24-28 fps on its title screen | 0.8 s |

- **Where the big freeze comes from:** it happens before the game's first frame. It is the engine compiling its WebGL
  shader programs, the same in every Godot web game (problem 1 of the first report). The loading bar is already gone, so
  it looks like the game froze.
- **The fixed copies:** they don't change it (3.1-3.5 s cold).
- **The fix is on the platform:**
  - **1b:** warm the browser's shader store on typeplay.dev while the player waits for a build.
  - **1c:** keep the loader on screen, with honest text, until the first frame.
- **After it:**
  - **Scrap Siege:** the next few seconds at 24-28 fps are its title screen's own drawing (fixed in the copy).
  - **Both games:** a handful of 50-120 ms hitches in the first seconds, the first time an effect or a new text size
    appears.
  - **Later hitch clusters:** these are the per-frame drawing cost from above, when the screen gets busy.

## Why the game agent wrote it this way

It followed our rules.
- **The base rules (`packages/agent/rules/BASE.md`):**
  - "2D art is drawn in code".
  - "each piece, tower, enemy or car has ONE static draw function, used in the game AND on its button, the title and the
    help".
- **The tower defence skill (`genres/towerdefence/GENRE.md`):** asks for `tower.gd` with a static `draw_shape` used by
  the cards and the title, and the map drawn once.
- **`rules/GOTCHAS.md`:** "Draw a static board or map once in its own node …; redraw only what changes (pieces,
  enemies, a small overlay for selections)".

So both games draw their boards once and redraw every piece and enemy every frame, exactly as written. Nothing in the
rules says:
- that a circle or a filled shape is a separate job for the graphics card;
- that a shape redrawn every frame costs ~6× one drawn once;
- that the number that matters is the cost per piece × the pieces on screen at the end of the game;
- that repeated looks should be drawn once into a picture.

The runner skill (`genres/runner/GENRE.md`) says nothing about the cost of a ground redrawn every frame. It also doesn't
say that a difficulty curve that adds enemies also adds drawing cost.

The first report's fixes are not in yet:
- **2a (these rules):** the rules are unchanged since 10-27.
- **2b (3 catch-up steps):** the template still has Godot's default of 8.
- **2c (the stress test):** not built.

Both games were built after that report (11-01 and 11-03), under the old rules.

## Why the build check let them through

I ran `packages/agent/tools/check.mjs` on the recovered code of both games, with its error log kept out of the repo:
- **Dead Haul:** "CHECK: OK", frames a second "22, then 11".
- **Scrap Siege:** "18, then 5". Its one error was an artifact of the recovery (the export drops a default screen
  setting), not of the game.

Three reasons it can't catch this:
1. **The frame rate is information, not a test.** It is measured in a hidden browser that draws in software, where every
   game is slow, so the agent can't tell a slow game from a slow renderer. `GOTCHAS.md` says to act only when the rate
   at game start is under ~10, and both start above it.
2. **It only sees the first ~13 seconds:** a title, one tap, Space. It never reaches km 400 or wave 10, and the slowness
   only exists late.
3. **The agent's own tests run Godot headless, which draws nothing,** so drawing cost is invisible to them.

## Can the agent write games this fast by itself, every time?

**What has to be true:**

1. **A drawing helper in every new game** (`packages/agent/templates/blank/`), like the one in the appendix: draw each
   look once into a shared picture at start, then show it. The rules then say:
   - **Repeated looks** (pieces, towers, enemies, obstacles, pickups, cars) always come from the picture.
   - **Shapes redrawn every frame:** only a handful (HUD gauges, a selection ring, a few effects).
   - **Static scenery:** drawn once, and as few shapes as possible; a ground or terrain is one batch.

   Same look, and the art is still drawn in code.
2. **The late-game stress test in every build's check,** failing a slow build like a failed test (the first report's 2c,
   made concrete):
   - **Setup:** the genre's test hooks put the game in its heaviest state. Tower defence: every free cell built and
     upgraded, 60 enemies walking. Runner: the far end of the road. Racer: a full grid.
   - **Draw budget:** the check counts the graphics-card jobs per frame there. A count doesn't depend on the PC, so even
     the software-drawing hidden browser measures it exactly. Proposed budget: 300 jobs per frame at the heaviest state.
     The fixed copies run at 170-280; the originals at 420-3,610.
   - **Logic budget:** headless Godot times the logic of one step at the same state. The budget is set so that a 6×
     slower phone still keeps up, and is calibrated on these copies: Scrap Siege's worst state takes 0.8 ms per step in
     this PC's browser, 8 ms at 6×, and 5 ms at 6× once towers pick targets 10 times a second.
3. **At most 3 catch-up steps** in the template (`physics/common/max_physics_steps_per_frame=3`): a safety net, not the
   fix.
4. **The platform fixes for the first-open freeze** (1b, 1c of the first report).

**How sure:**
- **The gate:** sure that, with it, no game like these two ships unnoticed. It is a count, not a judgement.
- **The agent fixing what the gate finds:** fairly sure it can do so on its own in a fix round or two. These fixes were
  120-150 lines per game with the helper given, the same kind of edit it already makes when a test fails.
- **Rules alone:** not sure. The board rule was followed to the letter and both games still crawl. In the first report's
  audit, 6 of 13 games redraw towers or enemies every frame.
- **Builder time:** about what the first report estimated for 2a + 2c, ~3 days: the helper and rules ~1 day, the stress
  test ~2 days.

**Honest limits:**

- **Browser vs app:**
  - Every job for the graphics card costs more in a browser: WebGL checks each call, and a normal browser hands the work
    to a separate GPU process.
  - With Edge's GPU work in a separate process, as in Luka's browser, the same frames took up to 2.7× longer than with
    the GPU work inside the browser process: 1.1× at Scrap Siege's heaviest moment, 1.5-2.7× at Dead Haul's km 410.
    Measurements made the other way are on the kind side.
  - Logic and drawing share one CPU core (single-threaded web export).
  - The first open compiles shaders: 3.6-3.8 s on this PC.
  - A native build (our Android export) avoids the browser layer. Not measured here.
- **Phones,** measured only as a slowed CPU on this PC (DevTools CPU throttling; the GPU is not slowed; the faster
  browser setup, so a real device does worse):

  | Heaviest moment, fixed copy | 4× slower CPU (cheap laptop, mid-range phone) | 6× slower CPU (low-end phone) |
  |---|---|---|
  | Dead Haul, km 10 / 250 / 410 | 44 / 41 / 35 fps | 17 / 19 / 16 fps |
  | Scrap Siege, 30 towers | 86-95 fps | 48 fps |
  | Scrap Siege, 20 towers firing at 60 enemies | 41-47 fps | 13 fps |
  | The same, plus targeting 10×/s and 3 catch-up steps | 44 fps | 22 fps |

  - At 4× the original Dead Haul hits **5.1 fps** at km 410.
  - After the fix, mid-range devices are fine.
  - On low-end phones the heaviest moments are still slow. There the logic is the wall: targeting, the copied enemy
    lists, and catch-up steps.
  - **Not measured:** real phones, iPhone Safari, phones slowing down when hot, high-density screens, and memory. The
    pictures take ~30 MB of graphics memory; a phone build should draw them smaller.
- **Looks:**
  - Baked looks animate in 16-32 steps instead of continuously; you only see it if you look for it.
  - They are drawn at 2×, so they stay sharp up to about 2× window scaling.

## How it was measured

- **The games:**
  - Found through the public gallery API (`/public/gallery?q=…`).
  - Their public packs were downloaded from typeplay.dev; play.html and the 4.7.2 engine there are byte-identical to
    the repo's.
  - No private data was read: no projects, prompts or run logs from the server.
- **The code:**
  - The packs hold Godot's compiled script form. A decoder written for this rebuilt the text.
  - Re-exporting it gave scripts identical token for token to the live packs, so the copies run the live code.
- **The browser:**
  - Hidden Edge 156 on this PC's GPU (AMD Radeon RX 6800 XT, Direct3D 11), frames uncapped, 1280×720 unless noted.
  - The headline numbers used a separate GPU process as in a normal browser, its priority lowered to below normal on 12
    cores.
  - A few results come from the faster setup with the GPU work inside the browser process: the window-size test, the
    slowed-CPU (phone) table, the second-open times and the fixed copies' cold starts.
- **The probe:** a probe added only to the copies recorded every frame (logic steps and time, process and drawing time,
  render time, jobs for the graphics card, nodes). It drove the games through their own functions:
  - Dead Haul: upgrade the truck, keep it fuelled and alive, teleport it to a km.
  - Scrap Siege: build towers, spawn enemies, send waves, keep lives full.
- **Each part's cost:** found by hiding one layer at a time for 3-4 s.
- **Cold starts:** a fresh profile per run against typeplay.dev, every WebGL call over 4 ms timed, and Godot's own
  frames logged on the copies.
- **The PC rules:**
  - Everything ran through `cpu.mjs` (12 cores, below normal), one hidden browser at a time (the check's lock).
  - Every browser and server was stopped, and the scratch folder deleted.
  - The PC was in normal use during the runs (20-38% CPU from other programs), so runs vary up to ±30%; ranges are given.
  - A stuck conversion tool of this session also kept up to one core busy, at below-normal priority, through all the runs.
    It was found and stopped at the end; it weighed on the before and after runs alike.
- **Not measured:** real phones, an iPhone, a native build, and Luka's own visible browser. The hidden one reproduced
  his 5-7 fps at km 410.

## Appendix for the Builder: the drawing helper used in both copies

Tested in both games: Godot 4.7.2, web export, Compatibility renderer.

How to use it:
- `add(key, box, fn)` for each look, then `build()`.
- Draw with `blit(canvas_item, key, pos, rot, scale, modulate)`.
- Any node that blits needs `material = atlas.mat` once `ready_to_use` is true, because the picture holds premultiplied
  colours.
- Until then, draw the old way. Shapes drawn without the picture must stay on nodes without that material.

Two traps it already handles:
- **The first render's one-time clear:** without an empty render first, the clear wipes the first batch of looks.
- **Too many looks per frame:** 48 looks a frame made a 0.1-0.24 s hitch; 8 a frame keeps the title smooth.

```gdscript
extends SubViewport
# Draws each look once into one shared picture (an atlas) at start, a few looks a frame, so the start doesn't freeze.
# The game then shows parts of that picture: Godot draws them all in one batch instead of rebuilding and sending
# hundreds of shapes (each circle and polygon its own GPU job) every frame.

const SS := 2.0 # looks are drawn at 2x, so they stay sharp when the window scales the game up
const WIDTH := 4096
const PER_FRAME := 8 # looks painted per frame while baking (more is a visible hitch on the title screen)

var cells := {} # key -> [rect in the atlas (px), box origin (game px)]
var jobs: Array = [] # [atlas position of the look's origin, Callable]
var cx := 0
var cy := 0
var row_h := 0
var next_job := 0
var painter: Node2D
var mat := CanvasItemMaterial.new()
var ready_to_use := false
var cleared := false

func _init() -> void:
	transparent_bg = true
	disable_3d = true
	render_target_clear_mode = SubViewport.CLEAR_MODE_ONCE
	render_target_update_mode = SubViewport.UPDATE_DISABLED
	painter = Node2D.new()
	painter.draw.connect(_paint)
	add_child(painter)
	# The atlas holds premultiplied colours (drawn over a transparent picture): show it with the matching blend.
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_PREMULT_ALPHA
	add("px", Rect2(0, 0, 2, 2), func(ci: CanvasItem, at: Vector2, s: float): ci.draw_rect(Rect2(at - Vector2(1, 1), Vector2(2 * s + 2, 2 * s + 2)), Color.WHITE))

# box: the look's bounds in game pixels around its origin. fn(ci, at, s) draws it with its origin at `at`, scale s.
func add(key, box: Rect2, fn: Callable) -> void:
	var w := int(ceil(box.size.x * SS)) + 4
	var h := int(ceil(box.size.y * SS)) + 4
	if cx + w > WIDTH:
		cx = 0
		cy += row_h
		row_h = 0
	cells[key] = [Rect2(cx + 2, cy + 2, box.size.x * SS, box.size.y * SS), box.position]
	jobs.append([Vector2(cx + 2, cy + 2) - box.position * SS, fn])
	cx += w
	row_h = maxi(row_h, h)

func build() -> void:
	size = Vector2i(WIDTH, cy + row_h)
	set_process(true)

func _ready() -> void:
	set_process(false)

func _process(_d: float) -> void:
	if not cleared:
		# One empty render first: the picture's one-time clear happens there, not over the first looks.
		cleared = true
		render_target_update_mode = SubViewport.UPDATE_ONCE
		return
	if next_job >= jobs.size():
		set_process(false)
		ready_to_use = true
		return
	painter.queue_redraw()
	render_target_update_mode = SubViewport.UPDATE_ONCE

func _paint() -> void:
	var end := mini(next_job + PER_FRAME, jobs.size())
	for i in range(next_job, end):
		painter.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		jobs[i][1].call(painter, jobs[i][0], SS)
	painter.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	next_job = end

func frame(t: float, period: float, frames: int) -> int:
	return int(fposmod(t, period) / period * frames) % frames

# Draws a baked look on ci with its origin at pos, rotated and scaled (ci's own coordinates).
func blit(ci: CanvasItem, key, pos := Vector2.ZERO, rot := 0.0, scl := Vector2.ONE, mod := Color.WHITE) -> void:
	var c = cells.get(key)
	if c == null:
		return
	var r: Rect2 = c[0]
	ci.draw_set_transform(pos, rot, scl / SS)
	ci.draw_texture_rect_region(get_texture(), Rect2(c[1] * SS, r.size), r, mod)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

# A plain rectangle from the atlas' white pixel: batches with the looks (a draw_rect would start a new batch).
func rect(ci: CanvasItem, r: Rect2, col: Color) -> void:
	var px: Rect2 = cells["px"][0]
	ci.draw_texture_rect_region(get_texture(), r, Rect2(px.position + Vector2(1, 1), Vector2(2, 2)), Color(col.r * col.a, col.g * col.a, col.b * col.a, col.a))
```

How the games used it:
- **A tower:** `atlas.add(["tur", kind, level, f], box, _bake_turret.bind(kind, level, t))` for each animation step, at
  start.
- **Its `_draw()`:** `A.blit(self, "tbase")`, then the turret with `A.blit(self, ["tur", kind, level, A.frame(t, PERIOD,
  FRAMES)], recoil_offset, aim)`.
- **Dead Haul's ground:** the visible columns go into one `PackedVector2Array` of triangles with a matching
  `PackedColorArray`, drawn with `RenderingServer.canvas_item_add_triangle_array(get_canvas_item(), indices, points,
  colors)`.
