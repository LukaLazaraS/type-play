# Base for feature tests. A test script starts with:  extends "res://test/helpers.gd"
# Tests count physics frames (game time), never wall-clock time, so they give the same result
# at any speed. Call check() for each thing you verify and finish() at the end.
extends Node

var game: Node
var _failed := 0
var _fingers := {} # finger index -> its last window position

## Loads res://main.tscn, adds it, and returns it.
func load_game() -> Node:
	game = load("res://main.tscn").instantiate()
	add_child(game)
	return game

## Waits n physics frames (1/60 s of game time each).
func frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame

## Presses an input action (e.g. "ui_accept"), holds it, releases it. Use: await press("ui_accept")
func press(action: String, hold_frames: int = 2) -> void:
	var down := InputEventAction.new()
	down.action = action
	down.pressed = true
	Input.parse_input_event(down)
	await frames(hold_frames)
	var up := InputEventAction.new()
	up.action = action
	up.pressed = false
	Input.parse_input_event(up)
	await frames(1)

## A mouse click at a position in the game's own coordinates (the space node
## positions use, e.g. a board cell's centre). Use: await tap(cell_centre)
## The headless test window is tiny and scaled, so the position is converted to window
## coordinates here; don't scale it yourself.
func tap(at: Vector2) -> void:
	var window_pos := _to_window(at)
	for pressed in [true, false]:
		var e := InputEventMouseButton.new()
		e.button_index = MOUSE_BUTTON_LEFT
		e.position = window_pos
		e.global_position = window_pos
		e.pressed = pressed
		Input.parse_input_event(e)
		await frames(1)

## A finger tap at a position in the game's coordinates, as on a phone: Godot also turns the
## first finger into a mouse click, as a real touch screen does. Use: await touch(button_centre)
func touch(at: Vector2, hold_frames: int = 2) -> void:
	await finger_down(at)
	await frames(hold_frames)
	await finger_up(at)

## A finger that stays down (a thumb on a joystick): finger 0 is the first one, 1 a second one
## held at the same time (a button pressed while moving). Move it with finger_move(), lift it
## with finger_up(). Positions are in the game's coordinates.
func finger_down(at: Vector2, finger: int = 0) -> void:
	var e := InputEventScreenTouch.new()
	e.index = finger
	e.position = _to_window(at)
	e.pressed = true
	_fingers[finger] = e.position
	Input.parse_input_event(e)
	await frames(1)

func finger_move(at: Vector2, finger: int = 0) -> void:
	var e := InputEventScreenDrag.new()
	e.index = finger
	e.position = _to_window(at)
	e.relative = e.position - _fingers.get(finger, e.position)
	_fingers[finger] = e.position
	Input.parse_input_event(e)
	await frames(1)

func finger_up(at: Vector2, finger: int = 0) -> void:
	var e := InputEventScreenTouch.new()
	e.index = finger
	e.position = _to_window(at)
	e.pressed = false
	_fingers.erase(finger)
	Input.parse_input_event(e)
	await frames(1)

func _to_window(at: Vector2) -> Vector2:
	return get_viewport().get_final_transform() * at

## Prints "PASS: label" or "FAIL: label" (the check reads these lines).
func check(ok: bool, label: String) -> void:
	print(("PASS: " if ok else "FAIL: ") + label)
	if not ok:
		_failed += 1

## Ends the test run.
func finish() -> void:
	get_tree().quit(1 if _failed else 0)

## The stress test's measurement (test/stress_test.gd): call it once the game is at its busiest moment. The game
## runs on for `seconds` of game time (at most ~30 s of real time) and one "PERF:" line is printed for the check:
## how long a frame takes, what redraws itself every frame, how many nodes there are and whether they keep growing.
## `keep` (optional) runs every frame to hold the busy moment (spawn enemies back up to the cap, keep the player
## alive). The check, not the test, decides what is too slow. Use: await measure("last wave, every cell built")
func measure(label: String, seconds: float = 20.0, keep: Callable = Callable()) -> void:
	var tree := get_tree()
	var old_scale := Engine.time_scale
	Engine.time_scale = 1.0
	if keep.is_valid():
		keep.call()
	await frames(30) # let the busy moment settle (spawns, first shots)
	var bench := _bench()
	var stats := {"draws": 0, "custom": 0, "by": {}, "added": 0}
	var hooked := {}
	var hook := func(n: Node) -> void:
		if n is CanvasItem and not hooked.has(n.get_instance_id()):
			hooked[n.get_instance_id()] = true
			var custom: bool = n.get_script() != null and n.has_method("_draw")
			var who: String = n.get_script().resource_path.get_file() if custom else n.get_class()
			(n as CanvasItem).draw.connect(func() -> void:
				stats["draws"] += 1
				if custom:
					stats["custom"] += 1
				stats["by"][who] = int(stats["by"].get(who, 0)) + 1)
	var stack: Array[Node] = [tree.root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		hook.call(n)
		stack.append_array(n.get_children())
	var on_added := func(n: Node) -> void:
		stats["added"] += 1
		hook.call(n)
	tree.node_added.connect(on_added)
	var times := PackedFloat32Array()
	var nodes_at := PackedInt32Array()
	var total := maxi(60, int(seconds * 60.0))
	var t_start := Time.get_ticks_usec()
	var t_prev := t_start
	for i in total:
		if keep.is_valid():
			keep.call()
		await tree.process_frame
		var t := Time.get_ticks_usec()
		times.append((t - t_prev) / 1000.0)
		t_prev = t
		if i % maxi(1, total / 4) == 0:
			nodes_at.append(int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT)))
		if t - t_start > 30_000_000:
			break
	tree.node_added.disconnect(on_added)
	nodes_at.append(int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT)))
	Engine.time_scale = old_scale
	var n_frames := times.size()
	var sorted := times.duplicate()
	sorted.sort()
	var half := n_frames / 2
	var first := times.slice(0, half)
	var second := times.slice(half)
	first.sort()
	second.sort()
	var by: Dictionary = stats["by"]
	var top: Array = by.keys()
	top.sort_custom(func(a, b) -> bool: return by[a] > by[b])
	var redrawn := {}
	for k in top.slice(0, 6):
		redrawn[k] = snappedf(float(by[k]) / n_frames, 0.1)
	print("PERF: " + JSON.stringify({
		"label": label,
		"frames": n_frames,
		"game_seconds": snappedf(n_frames / 60.0, 0.1),
		"median_ms": snappedf(sorted[n_frames / 2], 0.01),
		"p95_ms": snappedf(sorted[mini(n_frames - 1, int(n_frames * 0.95))], 0.01),
		"max_ms": snappedf(sorted[n_frames - 1], 0.01),
		"first_half_ms": snappedf(first[first.size() / 2], 0.01),
		"second_half_ms": snappedf(second[second.size() / 2], 0.01),
		"redraws_per_frame": snappedf(float(stats["draws"]) / n_frames, 0.1),
		"custom_redraws_per_frame": snappedf(float(stats["custom"]) / n_frames, 0.1),
		"redrawn": redrawn,
		"nodes": nodes_at,
		"nodes_added_per_s": snappedf(float(stats["added"]) / (n_frames / 60.0), 0.1),
		"objects": int(Performance.get_monitor(Performance.OBJECT_COUNT)),
		"bench_ms": snappedf(bench, 0.01),
	}))

# The same fixed piece of script work every time, timed: how fast this machine runs game code right now. The check
# scales the budget by it, so a slower server or a busy PC doesn't fail a fast game.
func _bench() -> float:
	var best := INF
	for r in 5:
		var t0 := Time.get_ticks_usec()
		var acc := Vector2.ZERO
		var d := {}
		var arr: Array = []
		for i in 20000:
			var v := Vector2(i % 97, i % 31)
			acc += v.normalized() * 0.5
			d[i % 64] = acc.x
			arr.append(i)
			if arr.size() > 32:
				arr.pop_back()
		best = minf(best, (Time.get_ticks_usec() - t0) / 1000.0)
	return best
