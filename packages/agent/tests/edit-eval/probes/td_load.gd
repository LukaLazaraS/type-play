extends SceneTree
# Cost of many bugs: the game's own script time per frame (process + _draw) with N bugs on the road.
# Headless, so it counts the game's code, not the renderer (the hidden browser's fps counts both).
#   godot --headless --path <game> --fixed-fps 60 --script td_load.gd -- <bugs, default 60>
func _initialize() -> void:
	_run()

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var n := int(args[0]) if args.size() > 0 else 60
	var game = load("res://main.tscn").instantiate()
	root.add_child(game)
	game.save_enabled = false
	for i in 3:
		await process_frame
	game.start_level(0)
	await process_frame
	for i in n:
		game.spawn_enemy("ant" if i % 3 != 2 else "beetle", 0, 40.0 + i * 14.0)
	for i in 30:
		await process_frame
	var frames := 300
	var t0 := Time.get_ticks_usec()
	for i in frames:
		await process_frame
	var ms := float(Time.get_ticks_usec() - t0) / 1000.0 / frames
	print("PROBE %d bugs (%d alive): %.2f ms of script per frame" % [n, game.alive_enemies(), ms])
	quit()
