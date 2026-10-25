- **The screen**: this game was made before games had one fixed shape: its window stretches to
  any screen shape (`window/stretch/aspect="expand"`), so the visible area can be wider or
  taller than the viewport size in `project.godot`. Keep that setup unless the player asks.
  Size backgrounds, ground and sky from `get_viewport_rect().size` (and redraw on
  `get_viewport().size_changed`), and anchor the HUD to the screen edges: drawing to a fixed
  size leaves a grey strip. The game is portrait (720×1280, `window/handheld/orientation=1`)
  or landscape (1152×648, orientation 0); later changes keep it unless the player asks.
