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
