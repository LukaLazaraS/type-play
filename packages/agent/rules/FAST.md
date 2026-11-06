
## Fast games (required: the check measures every build)

Players have cheap phones and laptops. The game must stay smooth at its busiest moment (the last level, a full map,
the most enemies, top speed, the far end of the world) and after an hour of play: **the cost of a frame must never
grow with play time or progress.** Build it fast from the first line; the check fails a slow game like a failed test.

- **Draw each look once** with our helper `res://lib/looks.gd` (never change the files in `lib/`): every kind of
  enemy, tower, bullet, coin, tile or prop is drawn once at start into a shared picture, and every copy is a
  `Sprite2D` showing it:
  `Looks.add("ant", Vector2i(64, 64), func(c: CanvasItem) -> void: Enemy.draw_ant(c), "Red ant")`, the same for each
  look (`Looks.add_frames(key, size, count, func(c, i), "Red ant walking")` for a walk cycle, a spin, a hit flash; the
  last argument is the look's plain name, which the player sees in the game's list of assets), then
  `await Looks.bake(self)` once; in play `var s := Looks.sprite("ant")`. Animate the sprite (position, rotation,
  scale, modulate, `Looks.set_frame(s, key, i)`), never by redrawing shapes. (0, 0) is the look's centre. The same
  draw function still draws the look on cards, buttons and the title (drawn once there too).
- **Draw calls**: the browser pays for each one in every frame, even for things drawn once. Every circle, polygon,
  polyline, outline and Line2D is a draw call of its own, and so is every switch between a sprite and a drawn shape;
  sprites of the shared picture batch into one. Bars and boxes in play are `Looks.rect(color, size)` sprites (a
  health bar's fill changes by `scale.x`, no redraw); anything drawn over many sprites (bars, labels, rings) gets
  `z_index = 1`, so all the sprites draw together first and batch. The check counts them: at most 300 a frame on the
  title and in the first seconds of play, 400 at the busiest moment. A title full of drawn icons counts too: bake
  them as looks.
- **`_draw()` every frame only for a few live things** (the player, a selection ring, a drag line). Everything else
  redraws only when its look changes: call `queue_redraw()` where the value changes (a health bar when hp changes),
  never from `_process`. A board or map is drawn once; with more than ~200 shapes, bake it into one picture
  (`await Looks.bake_one(self, "map1", size, origin, painter)`, one per level) and show that.
- **Lists, not searches**: the spawner keeps its enemies (bullets, pickups) in an Array that the others read. Never
  `get_nodes_in_group()`, `get_children()` or `find_child()` per object per frame.
- **Think a few times a second**: towers and AI pick a target every 0.1-0.25 s (a timer per object, started at a
  random offset), not every frame. Things far off screen skip their logic.
- **Nearby only**: with more than ~50 things that hit each other (bullets × enemies), keep them in a grid
  (`Dictionary` of cell → Array, cells ~2× their size) and check only the cells around each one, never every pair.
- **Reuse, cap, free**: bullets, effects and floating numbers come from a small pool (hide and reuse) or have a hard
  cap; one particle node per effect kind, moved and restarted (`restart()`), not a new node per hit. Everything that
  leaves the screen or ends is freed or returned. Trails, skid marks, decals and debris keep a maximum (the oldest
  goes). A long or endless world keeps a fixed number of pieces around the player and frees (or moves ahead) the
  ones behind; the world never builds itself ahead without removing what is behind.
- **Text**: set a Label's text only when the value changes.
- **3D**: one mesh and one material per look, shared by every copy (`MultiMeshInstance3D` for many copies: trees,
  coins, crowds); a few lights, shadows only from the sun (`Lighting.setup()`); nothing past the camera's far distance. Never switch a
  material's features during play (emission, transparency, a texture on/off): make a second material for the lit
  look and warm both up.
- **Warm-up**: the first time the browser draws a new kind of thing (a material, a particle effect, a text size)
  the game freezes for up to seconds. After the world, the camera and the title are built, call our helper
  `await Warmup.run(self, [a fresh copy of every enemy, tower, bullet, pickup and particle effect, every 3D model
  and material, a label of each style], [every font size the game uses])` (`res://lib/warmup.gd`), and build the
  first level behind the title, so the tap that starts play is instant. Nothing may be drawn for the first time
  during play.
- `physics/common/max_physics_steps_per_frame=3` stays in `project.godot` (a slow frame then turns into a moment of
  slow motion, not a slide show).

### The stress test (required)

`test/stress_test.tscn` + `test/stress_test.gd` (`extends "res://test/helpers.gd"`) puts the game straight into its
busiest moment through its own functions, never by playing up to it, so it works for a game of any length: the last
level or wave, the hardest difficulty and top speed, every free cell built at the top level, the most enemies,
bullets and pickups the game ever has at once (its caps), the player at the far end of the world, and the player
kept alive (huge lives or health). `check()` that it got there, then
`await measure("what is on screen", 20.0, keep)` and `finish()`. `keep` is a function run every frame that holds the
moment (refill the enemies to the cap, keep the player alive, keep driving). The check reads the measurement: a frame
that takes too long, many things redrawn every frame or nodes that keep growing fail the game. Fix the game with the
rules above, never the test (making the busy moment smaller than the game really gets is cheating the player).

```gdscript
extends "res://test/helpers.gd"
const Levels = preload("res://levels.gd")

func _ready() -> void:
	load_game()
	await frames(5)
	game.start_level(Levels.LEVELS.size() - 1)  # the last level
	game.gold = 1000000
	game.lives = 1000000
	for cell in game.map.free_cells():           # every free cell, the top tower, fully upgraded
		var t = game.build(cell, "cannon")
		game.upgrade(t); game.upgrade(t)
	check(game.towers.size() > 40, "the map is full")
	var keep := func() -> void:                  # the last wave, held at its size, tough enough to last
		while game.enemies.size() < 120:
			game.spawn_enemy("brute", randf() * game.map.road_length).hp *= 50.0
	await measure("last level, %d top towers, 120 enemies" % game.towers.size(), 20.0, keep)
	finish()
```
