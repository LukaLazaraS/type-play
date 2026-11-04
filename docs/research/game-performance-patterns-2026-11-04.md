# Fast games by construction: patterns, sources and how the game agent uses them (2026-11-04)

Night task for Luka (through HQ): make TypePlay's games fast, and make the game builder build fast games every time.
This is step 1, the research, with sources. It builds on `docs/research/game-performance-2026-11-01.md` (main
checkout; the measurements of why games freeze at the start and slow down later) and on the session that measured
Dead Haul and Scrap Siege (`docs/research/game-performance-2-2026-11-04.md`). What the agent now does with it:
`packages/agent/rules/FAST.md`, the genre skills, `templates/blank/lib/`, and the check (`tools/check.mjs`).

Every quote below was checked against the page on 2026-11-04; the docs pages are Godot 4.7's ("stable").

## The short version

| Problem | The pattern that fixes it | Godot 4.7 specifics | Where the agent gets it |
|---|---|---|---|
| Code-drawn art redrawn every frame (thousands of shapes) | **Flyweight + dirty flag**: draw each look once into a shared picture; every copy shows it; redraw only on change | `_draw()` output is cached until `queue_redraw()`; in the Compatibility renderer sprites sharing one texture batch into one draw call, while every polygon, circle, polyline and Line2D is a draw call of its own | `lib/looks.gd`, FAST.md "Draw each look once" |
| Every tower scans every enemy every step; `get_nodes_in_group()` per tower | **Update method** (one list of live objects) + **spatial partition** (grid buckets) + think a few times a second | `get_nodes_in_group()` copies the whole group into a new array on every call | FAST.md "Lists, not searches", "Nearby only", "Think a few times a second" |
| A new node per hit, effect or floating number; trails and worlds that only grow | **Object pool** or a fixed cap; free what leaves | Godot nodes are cheap but not free; the official bullet demo draws all bullets from one node | FAST.md "Reuse, cap, free" |
| A late frame makes the next one later (8 catch-up steps) | **Fixed timestep with headroom**: cap the catch-up | `physics/common/max_physics_steps_per_frame` (default 8) | Template `project.godot` = 3; run.mjs adds it to older games |
| Freezes the first time something is drawn | **Warm-up**: draw every material, effect and text size once behind the loading/title screen | The only answer for the Compatibility renderer (Godot's own docs); the web has no Godot shader cache | `lib/warmup.gd`, FAST.md "Warm-up" |
| Slow games shipped because nobody played to the end | **Stress test of the worst case on every build, with a budget** | `--fixed-fps` headless runs, `Performance` monitors | `test/stress_test` + `measure()` (test/helpers.gd), the check's budgets |

## 1. Draw once, show many (flyweight, dirty flag)

**What the engine does with `_draw()`.** Godot records a node's draw commands once and replays them every frame until
the node asks to be redrawn:

- "The _draw function is only called once, and then the draw commands are cached and remembered, so further calls are
  unnecessary. If re-drawing is required because a variable or something else changed, call CanvasItem.queue_redraw
  in that same node and a new _draw() call will happen." ([Custom drawing in 2D](https://docs.godotengine.org/en/stable/tutorials/2d/custom_drawing_in_2d.html))
- Moving is free, redrawing is not: canvas items "can't be modified. The Item needs to be cleared and the primitives
  re-added. This is not the case for setting the transform, which can be done as many times as desired."
  ([Optimization using Servers](https://docs.godotengine.org/en/stable/tutorials/performance/using_servers.html))

So a look that changes position, rotation, scale or colour should change the node's transform or `modulate`, never
call `queue_redraw()`. Our agent-made games did the opposite: 6 of 13 audited games redrew towers or enemies every
frame (11-01 report).

**Why cached commands still cost: batching.** The renderer replays every recorded command each frame and sends it to
the GPU in batches; each batch is a draw call, and "the communication and driver activity involved can be quite
costly, especially in OpenGL, OpenGL ES and WebGL" ([GPU optimization](https://docs.godotengine.org/en/stable/tutorials/performance/gpu_optimization.html)).
The Compatibility renderer (our web renderer) has batched 2D since 4.0
([4.4 dev 3](https://godotengine.org/article/dev-snapshot-godot-4-4-dev-3/)), but only some commands batch. From the
renderer's source at 4.7-stable ([rasterizer_canvas_gles3.cpp](https://github.com/godotengine/godot/blob/4.7-stable/drivers/gles3/rasterizer_canvas_gles3.cpp)):

- "Polygon's can't be batched, so always create a new batch" (L1094); "Meshes can't be batched" (L1178, meshes,
  multimeshes, particles).
- A batch also ends when the texture, material, blend mode, texture filter or repeat, clip or lighting changes.
- In practice: `draw_polygon`, `draw_colored_polygon`, `draw_polyline`, an unfilled `draw_rect`, `draw_circle` (a
  64-point polygon), `Line2D` and `Polygon2D` are one draw call each; filled `draw_rect`, `draw_line`,
  `draw_texture*` and `Sprite2D` batch. Godot's maintainers say the same in
  [#107042](https://github.com/godotengine/godot/issues/107042): "Outlines use Polygons internally which cannot be
  batched together", and "I would just use a sprite that represents a circle instead of relying on draw_circle() if
  the circle's size doesn't change continuously."
- A hard limit: `rendering/gl_compatibility/item_buffer_size` (16384): "Maximum number of canvas items commands that
  can be drawn in a single viewport update. If more render commands are issued they will be ignored."
  ([ProjectSettings](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html)). A code-drawn crowd
  can silently lose its art past that.

An enemy drawn as 30 polygons and circles is ~30 draw calls; 120 of them are 3,600 a frame. The same enemies as
sprites of one shared picture are one batch. That is the measured 1.1-1.3 fps vs 60-84 fps of the 11-01 report
(3,870-4,560 draw calls a frame vs ~290).

**The patterns.** Flyweight: "comes into play when you have objects that need to be more lightweight, generally
because you have too many of them" ([Game Programming Patterns: Flyweight](https://gameprogrammingpatterns.com/flyweight.html)):
the look (the heavy, shared part) is stored once; each copy keeps only its position, rotation and tint. Dirty flag:
"If the flag is set when the derived data is needed, then it is reprocessed and the flag is cleared. Otherwise, the
previous cached derived data is used." ([Dirty Flag](https://gameprogrammingpatterns.com/dirty-flag.html)): a health
bar redraws when hp changes, not every frame.

**How we bake a look in Godot 4.7.** Draw it into a `SubViewport` that renders once: "Once will re-render the next
frame and change to Never afterwards. … This flexibility allows users to render an image once and then use the texture
without incurring the cost of rendering every frame." ([Using Viewports](https://docs.godotengine.org/en/stable/tutorials/rendering/viewports.html)).
The texture is only valid after the frame is drawn: "it might be completely black or outdated if used too early …
you can await RenderingServer.frame_post_draw signal" ([Viewport](https://docs.godotengine.org/en/stable/classes/class_viewport.html)).
Reading it back to the CPU (`get_image()`) "will fetch the texture data from the GPU, which might cause performance
problems when overused" ([Texture2D](https://docs.godotengine.org/en/stable/classes/class_texture2d.html)): the
polished tower defence does that and pays 45-82 ms per read on a real GPU, 332-477 ms in software (11-01).

`lib/looks.gd` (new tonight) avoids the read-back entirely: all looks are packed into one atlas, drawn in one
SubViewport pass, and every look is an `AtlasTexture` region of that one ViewportTexture, so every sprite shares one
texture and batches. Two things found while testing it in the web build (Edge, WebGL 2):

- **A transparent SubViewport stores premultiplied colour.** A circle of 50% red read back as (0.502, 0, 0, 0.502):
  drawn again with normal blending it looked muddy brown. `looks.gd` copies the picture once through a tiny shader
  with `render_mode blend_disabled` that divides the colour by alpha; read back after the fix: (1.0, 0, 0, 0.502), and
  the screenshot shows the right pink. Fades and tints on the sprites then work as with the shapes.
- **Headless runs have no renderer** (the check's tests): `RenderingServer.frame_post_draw` never fires there (probe),
  so `looks.gd` hands out blank pictures of the right sizes and the game logic runs the same way. A game that instead
  falls back to drawing shapes when a picture is missing measures as slow headless (the polished tower defence: 214
  redraws a frame headless, its towers and bugs fall back to `_draw()`).

Many copies of one look also fit `MultiMeshInstance2D` ("can be faster to render compared to displaying many Sprite2D
nodes with large transparent areas", [MultiMeshInstance2D](https://docs.godotengine.org/en/stable/classes/class_multimeshinstance2d.html)),
and in 3D `MultiMesh`, "a single draw primitive that can draw up to millions of objects in one go"
([Optimization using MultiMeshes](https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html)).
For our games sprites are simpler and enough; the rules name MultiMesh for 3D crowds, trees and coins.

## 2. Work that grows with the number of things (update method, spatial partition, data locality)

- **Every node costs.** "be aware that every node has a cost", "Each node is handled individually in the Godot
  renderer. Therefore, a smaller number of nodes with more in each can lead to better performance", and "you can
  sometimes get much better performance by removing nodes from the SceneTree, rather than by pausing or hiding them"
  ([CPU optimization](https://docs.godotengine.org/en/stable/tutorials/performance/cpu_optimization.html)).
- **Searches per frame.** `get_tree().get_nodes_in_group()` re-sorts the group when needed and copies every node into
  a new array on each call ([scene_tree.cpp L1555-1577](https://github.com/godotengine/godot/blob/4.7-stable/scene/main/scene_tree.cpp#L1555-L1577)).
  One audited game called it once per tower, 60 times a second. The update method's answer is a list owned by the
  spawner: "The more you have, the more useful it is to have a separate collection that avoids them during your core
  game loop." ([Update Method](https://gameprogrammingpatterns.com/update-method.html)).
- **Every pair.** Towers × enemies or bullets × enemies is O(n²): "Spatial partitions exist to knock an O(n) or O(n²)
  operation down to something more manageable. The more objects you have, the more valuable that becomes."
  ([Spatial Partition](https://gameprogrammingpatterns.com/spatial-partition.html)). For our sizes a grid of cells
  (a Dictionary of cell → Array) is enough; `distance_squared_to()` "runs faster than distance_to()"
  ([Vector2](https://docs.godotengine.org/en/stable/classes/class_vector2.html)).
- **Think less often.** Targets and AI decisions don't need 60 updates a second: "you may update them only 30 or even
  20 times per second. This can greatly reduce the CPU load" (CPU optimization). The rule: re-pick targets every
  0.1-0.25 s, each object on its own staggered timer.
- **Off-screen things sleep.** `VisibleOnScreenEnabler2D`: "The target node will be automatically enabled (via its
  Node.process_mode property) when any part of this region becomes visible on the screen, and automatically disabled
  otherwise." ([class doc](https://docs.godotengine.org/en/stable/classes/class_visibleonscreenenabler2d.html)).
- **Data locality** ("Accelerate memory access by arranging data to take advantage of CPU caching",
  [Data Locality](https://gameprogrammingpatterns.com/data-locality.html)) and Mike Acton's "Where there is one,
  there are many" ([CppCon 2014](https://www.youtube.com/watch?v=rX0ItVEVjHc)): hundreds of bullets are one node with
  packed arrays, as Godot's own bullet demo does ("a lot more efficient than using instancing and nodes",
  [bullet_shower](https://github.com/godotengine/godot-demo-projects/blob/master/2d/bullet_shower/bullets.gd)).

## 3. Things that pile up (object pool, caps)

Godot's tutorial says pooling "usually isn't needed" in GDScript ("The main reason to use pools is to avoid freezes
with garbage-collected languages like C# or Lua", [Your first 3D game](https://docs.godotengine.org/en/stable/getting_started/first_3d_game/04.mob_scene.html)),
but also "Nodes are cheap to produce, but even they have their limits" ([Node alternatives](https://docs.godotengine.org/en/stable/tutorials/best_practices/node_alternatives.html))
and suggests reusing physics objects ("maybe you allow 8 monsters per area, for example, and reuse these", CPU
optimization). The rule we use is about the count, not the allocator: whatever is made per hit, per shot or per
second (bullets, bursts, floating numbers, skid marks, world pieces) either comes from a small pool
([Object Pool](https://gameprogrammingpatterns.com/object-pool.html): "reusing objects from a fixed pool instead of
allocating and freeing them individually") or has a hard cap, and everything that leaves or ends is freed. One
particle node per effect kind, moved and restarted, also keeps the warm-up honest (the effect is drawn once).
`CPUParticles2D` "may perform better on low-end systems or in GPU-bottlenecked situations"
([Particle systems (2D)](https://docs.godotengine.org/en/stable/tutorials/2d/particle_systems_2d.html)); GPU
particles' `emit_particle()` doesn't work in Compatibility.

## 4. The catch-up spiral (game loop)

All our games run their logic in fixed steps (`_physics_process`, 60 a second). When a frame runs late, Godot runs up
to `max_physics_steps_per_frame` steps in the next one: "This snowballs into a situation where framerate keeps
dropping until it reaches a very low framerate (typically 1-2 FPS) and is called the physics spiral of death"
([ProjectSettings](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html)). Glenn Fiedler: "being
behind causes your update to simulate more steps to catch up, which causes you to fall further behind" and "In order
to ensure a stable update I recommend leaving some headroom" ([Fix Your Timestep!](https://gafferongames.com/post/fix_your_timestep/)).
Robert Nystrom: "The game will slow down then, but that's better than locking up completely"
([Game Loop](https://gameprogrammingpatterns.com/game-loop.html)).

Godot's default of 8 lets a late frame do up to 8× the logic; "the game will appear to slow down if the rendering FPS
is less than 1 / max_physics_steps_per_frame of physics_ticks_per_second" ([Engine](https://docs.godotengine.org/en/stable/classes/class_engine.html)).
With 3, slow motion starts below 20 fps instead of a slide show below 7.5 (measured 11-01: the runner at 6× CPU gave
2.2× more frames with 3 than with 8). It is a safety net, not the fix. The template now sets 3; run.mjs adds the line
to older games on their next change, and the check requires it in new ones.

## 5. Freezes the first time (warm-up)

- Godot's own docs, for our renderer: "This page only applies to the Forward+ and Mobile renderers, not
  Compatibility." … "To avoid shader stutters in Compatibility, you need to use the legacy approach of preloading
  materials, shaders, and particles by displaying them for at least one frame in the view frustum when the level is
  loading." … "the shader baker is not supported on the web platform"
  ([Reducing stutter from shader compilations](https://docs.godotengine.org/en/stable/tutorials/performance/pipeline_compilations.html)).
- Godot has no shader cache on the web (`#ifdef WEB_ENABLED // not supported in webgl`,
  [shader_gles3.cpp L547](https://github.com/godotengine/godot/blob/4.7-stable/drivers/gles3/shader_gles3.cpp#L547-L549));
  the browser's own cache is why a second visit is fast (11-01: 0.03-0.04 s).
- Compiles block the page: "shader compilation, which can't be made asynchronous on HTML5. Therefore, it needs to
  block the main thread", and "ANGLE is very slow at compiling shaders" ([#72584](https://github.com/godotengine/godot/issues/72584)).
- The warm-up must really draw: "Reduce the button's opacity to a very low but non-zero value … and use queue_free()
  on that button after one frame has passed", "the scale should be greater than 0", and "Both 2D and 3D games often
  end up having to do this to minimize shader compilation stutter during gameplay, even AAA productions."
  ([#76241](https://github.com/godotengine/godot/issues/76241)).
- Text: "Godot caches glyphs on a per-font and per-size basis. This reduces stuttering, but it can still occur the
  first time a glyph is displayed" ([Using Fonts](https://docs.godotengine.org/en/stable/tutorials/ui/gui_using_fonts.html)).
  So every text size the game uses is drawn once. (An MSDF default font would make sizes free, "rendering fonts at any
  size, without having to re-rasterize them", but changes every game's text look: not done tonight.)

`lib/warmup.gd` (new tonight) draws one fresh copy of each thing the game names, plus the 2D basics every game uses
(a polygon, a line, particles, a label), behind everything at 6% opacity on screen, and 3D things small in front of
the camera behind the title, for a few frames, then frees them. Tested in the web build (cold profile, 4× CPU): the
same probe game compiled **0 shader programs after the first tap with the warm-up, 1 without** (the first particle
burst, 143 ms after the tap). Never switching a material's features in play (emission on/off) follows from the same
fact: a new feature set is a new shader (the 3D showcase froze 3.46 s the first time a checkpoint lit up, 11-01).

## 6. Proving it on every build (budgets and stress tests)

- A frame at 60 fps is 16.66 ms, and "Even a single frame that exceeds the target frame budget will cause hitches";
  for long sessions on phones, "leave a frame idle time of around 35%" against heat
  ([Unity: profiling best practices](https://unity.com/how-to/best-practices-for-profiling-game-performance)). The
  browser takes its own share: "all of your work needs to be completed inside 10 milliseconds"
  ([web.dev](https://web.dev/articles/rendering-performance)).
- Benchmarks belong in CI: "You can run benchmarks in Continuous Integration (CI) to track performance over time and
  recognize performance regressions" ([Android Developers](https://developer.android.com/topic/performance/benchmarking/benchmarking-in-ci));
  Godot runs its own daily ([benchmarks.godotengine.org](https://benchmarks.godotengine.org/)); "Optimization is often
  treated as an end-of-production task, resulting in rushed fixes and missed opportunities"
  ([GDC 2025, Virtuos](https://gdcvault.com/play/1035370/Automating-Optimization-The-Power-of)). And from Godot's
  own docs: "the most important time to consider performance is at the design stage, before a key has even hit a
  keyboard" ([General optimization tips](https://docs.godotengine.org/en/stable/tutorials/performance/general_optimization.html)).
- **Our design.** Playing a game to its end can't be automated for a 2-hour game, so every game carries a stress test
  that sets its worst moment directly through its own functions (the last level, every cell built, the last wave held
  at full size, top speed, the far end of the world). Our `measure()` (in `test/helpers.gd`, the agent can't change
  it) runs 20 s of game time headless with `--fixed-fps 60` (one logic step per frame, unsynced, so the time a frame
  takes is the game's own cost) and reports the median and slow frames, which scripts redraw every frame (the `draw`
  signal fires headless), the node count over time (growth) and nodes made per second. A fixed piece of script work is
  timed alongside, so a slower machine (the live server) gets a proportionally larger budget. The check fails a new
  game over budget like a failed test.
- **The start-freeze check.** A browser with a fresh profile (nothing compiled), CPU slowed 4× (DevTools'
  `Emulation.setCPUThrottlingRate`), waits until the title has stopped compiling, taps, and watches 8 s: every WebGL
  program linked after the tap is counted (a probe wraps `linkProgram`). The count is the verdict, not frame times:
  the hidden browser draws in software (SwiftShader), where a 3D game's frames take ~220 ms whatever the game does, and
  the same probe measured a 49 ms worst frame in one run and 1,019 ms in the next on the shared PC.

## What was measured tonight (method)

- Godot 4.7.2 headless on this PC (Ryzen 7 5800X), below normal priority on 12 cores (`tools/cpu.mjs`), with a
  second night session sharing the PC; Edge headless with SwiftShader, one browser at a time (`tools/web.mjs` lock).
- Copies of the showcase games in the job's temporary folder; nothing in the main checkout's game folders changed.
- Numbers per game: the night log (`docs/overnight/2026-11-04.md`) and the morning report.

## Not covered

- Real phones (GPU drivers, heat, high-density screens); a real weak laptop. The check approximates with a 4× slower
  CPU and counts compiles; frame times in software rendering are a rough guide only.
- Draw calls are not measured headless (the dummy renderer counts none); the redraw count and the frame time stand in.
- Warming the browser's shader store on /create while a build runs (11-01 fix 1b) and a 2D-only engine (1d): not
  tonight.
