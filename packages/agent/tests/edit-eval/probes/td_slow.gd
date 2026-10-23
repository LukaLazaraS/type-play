extends SceneTree
# Honey Pot probe: distance an ant walks in 120 frames alone vs inside the pot's range.
func _initialize() -> void:
	_run()

func _run() -> void:
	var game = load("res://main.tscn").instantiate()
	root.add_child(game)
	game.save_enabled = false
	await physics_frame
	game.start_level(0)
	await physics_frame
	game.gold = 5000
	var e = game.spawn_enemy("ant", 0, 100.0)
	var d0: float = e.dist
	for i in 120:
		await physics_frame
	var base: float = e.dist - d0
	e.queue_free()
	await physics_frame
	var kinds: Array = load("res://levels.gd").TOWER_ORDER
	print("PROBE towers: ", kinds)
	var built: bool = game.try_build(Vector2i(2, 1), kinds[kinds.size() - 1])
	print("PROBE built new tower: ", built)
	var e2 = game.spawn_enemy("ant", 0, 100.0)
	var d1: float = e2.dist
	for i in 120:
		await physics_frame
	var slowed: float = e2.dist - d1
	print("PROBE ant walked %.1f px alone, %.1f px near the new tower, ratio %.2f" % [base, slowed, slowed / base])
	quit()
