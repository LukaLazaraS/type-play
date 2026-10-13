## Mistakes already made in this project (don't repeat them)

- Tests that wait on clock time (`Time.get_ticks_msec()`, timers in seconds) or print
  anything other than `PASS:` / `FAIL:` lines never finish or never count: one build spent
  its whole turn budget on this. Use `test/helpers.gd` (`frames()`, `press()`, `check()`).

- "Cannot infer the type of … variable" (our most common error): `:=` only works when the
  right side has a known type. For values from a Dictionary, an Array, `get()`,
  `get_node()`, `min()`/`max()` or an untyped function, write the type (`var h: float =
  d["h"]`) or use plain `=`.

- The visible area is NOT always 1152×648: the window stretches to any screen shape (wide
  monitors, phones), so it can be wider or taller. Size backgrounds, ground and sky from
  `get_viewport_rect().size` (and redraw on `get_viewport().size_changed`), and anchor the HUD
  to the screen edges. Drawing to a fixed 1152 width leaves a grey strip on wide screens; the
  check's browser window is wider than 16:9 on purpose, so look for it in the screenshots.
- HUD labels belong in the screen corners: on a `CanvasLayer`, use anchor presets
  (`set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT / PRESET_TOP_RIGHT)`), not fixed
  positions or vertical centring, or they drift to mid-height on wide screens.
- Things that appear over time (coins, power-ups, enemies, obstacles) must know where the
  others are: spawn them from the same spawner, or relative to each other (a coin arc over a
  cactus group, a row in the gap), never on separate timers that let them overlap.
- Every on-screen copy of a value (best score in the HUD and on the game-over screen) must be
  updated from the same place when it changes.

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
