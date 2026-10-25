## Mistakes already made in this project (don't repeat them)

- Tests that wait on clock time (`Time.get_ticks_msec()`, timers in seconds) or print
  anything other than `PASS:` / `FAIL:` lines never finish or never count: one build spent
  its whole turn budget on this. Use `test/helpers.gd` (`frames()`, `press()`, `check()`).

- Never run `tools/serve.mjs`, `tools/gallery.mjs` or any web server or watcher: they never
  end, and the whole session hangs until it is killed (one edit sat 15 minutes on this). Use
  only the check, the assets tool, Godot with `--quit-after`, and your own tests.

- "Cannot infer the type of … variable" (our most common error): `:=` only works when the
  right side has a known type. For values from a Dictionary, an Array, `get()`,
  `get_node()`, `min()`/`max()` or an untyped function, write the type (`var h: float =
  d["h"]`) or use plain `=`.

- HUD labels belong in the screen corners: on a `CanvasLayer`, use anchor presets
  (`set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT / PRESET_TOP_RIGHT)`), not fixed
  positions or vertical centring, or they drift when the screen's shape changes.
- Things that appear over time (coins, power-ups, enemies, obstacles) must know where the
  others are: spawn them from the same spawner, or relative to each other (a coin arc over a
  cactus group, a row in the gap), never on separate timers that let them overlap.
- Every on-screen copy of a value (best score in the HUD and on the game-over screen) must be
  updated from the same place when it changes.
- Draw a static board or map once in its own node (its `_draw()` runs again only after
  `queue_redraw()`: call that on load and resize); redraw only what changes (pieces,
  enemies, a small overlay for selections). A map redrawn every frame made a game crawl.
- Even drawn once, thousands of tiny `draw_*` calls (scattered props, windows, grass, a town)
  crawl in the web build: the renderer replays every command each frame (a racer and a stack
  game both fell to 2-3 fps). Keep static scenery to a few hundred shapes near the camera, or
  merge it into one `ArrayMesh`; if the frame rate the check prints at game start is under
  ~10, fix that before polishing.

- `Color.with_alpha()` doesn't exist. Use `Color(c, alpha)` or copy the colour and set `.a`.
- "Invalid polygon data, triangulation failed": a Polygon2D / `draw_colored_polygon()` needs
  at least 3 points in order (no crossing edges, no duplicate or collinear runs). For hills
  and ground, list the top edge left→right, then the two bottom corners.
- "on a base object of type 'Nil'" / "Required object … is null": a node made in code exists
  only after `add_child()`; `@onready` variables are null before `_ready()`; use
  `is_instance_valid()` on nodes that may have been freed.
- One script with a parse error breaks every script that loads it ("Failed to compile
  depended scripts", "Nonexistent function 'new' in base 'GDScript'"): fix the first error in
  the list, then check again.
