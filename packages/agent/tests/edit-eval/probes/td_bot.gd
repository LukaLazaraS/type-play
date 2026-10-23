extends SceneTree
# The game's own balance bot (test/balance_test.gd) on any map, printing how it did.
#   godot --headless --path <game> --fixed-fps 60 --script td_bot.gd -- <map index> [<speed x>]
const KINDS := ["gumdrop", "gumdrop", "jawbreaker", "frost", "gumdrop", "cane", "lollipop", "jawbreaker", "gumdrop", "cane"]

func _initialize() -> void:
	_run()

func _plan(game) -> Array:
	var map = game.map
	var scored: Array = []
	for r in 11:
		for c in 9:
			var cell := Vector2i(c, r)
			if not map.is_buildable(cell):
				continue
			var cover := 0
			for rc in map.road.keys():
				var d: Vector2i = rc - cell
				if Vector2(d).length() <= 2.2:
					cover += 1
			scored.append([cover, cell])
	scored.sort_custom(func(a, b): return a[0] > b[0])
	return scored.map(func(x): return x[1])

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var li := int(args[0]) if args.size() > 0 else 0
	var speed := float(args[1]) if args.size() > 1 else 8.0
	var Levels = load("res://levels.gd")
	var game = load("res://main.tscn").instantiate()
	root.add_child(game)
	game.save_enabled = false
	for i in 3:
		await physics_frame
	game.start_level(li)
	await physics_frame
	Engine.time_scale = speed
	var plan := _plan(game)
	var built := 0
	var n := 0
	var min_lives: int = game.lives
	while game.state_name() == "play" and n < 60000:
		for i in 10:
			await physics_frame
		n += 10
		Engine.time_scale = speed
		min_lives = mini(min_lives, game.lives)
		if built < plan.size() and built < 9:
			var kind: String = KINDS[built % KINDS.size()]
			if game.gold >= int(Levels.TOWERS[kind]["cost"]):
				if game.try_build(plan[built], kind):
					built += 1
			continue
		for t in game.towers.values():
			if t.level < 2 and game.gold >= t.upgrade_cost():
				game.try_upgrade(t)
				break
	Engine.time_scale = 1.0
	print("PROBE bot map %d: state=%s lives_left=%d (of %d) waves_sent=%d/%d frames=%d gold=%d" % [li, game.state_name(), game.lives, Levels.START_LIVES, game.waves.next_index, game.waves.total, n, game.gold])
	quit()
