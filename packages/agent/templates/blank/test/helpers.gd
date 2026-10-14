# Base for feature tests. A test script starts with:  extends "res://test/helpers.gd"
# Tests count physics frames (game time), never wall-clock time, so they give the same result
# at any speed. Call check() for each thing you verify and finish() at the end.
extends Node

var game: Node
var _failed := 0

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

## A mouse click or touch tap at a position in the game's own coordinates (the space node
## positions use, e.g. a board cell's centre). Use: await tap(cell_centre)
## The headless test window is tiny and scaled, so the position is converted to window
## coordinates here; don't scale it yourself.
func tap(at: Vector2) -> void:
	var window_pos: Vector2 = get_viewport().get_final_transform() * at
	for pressed in [true, false]:
		var e := InputEventMouseButton.new()
		e.button_index = MOUSE_BUTTON_LEFT
		e.position = window_pos
		e.global_position = window_pos
		e.pressed = pressed
		Input.parse_input_event(e)
		await frames(1)

## Prints "PASS: label" or "FAIL: label" (the check reads these lines).
func check(ok: bool, label: String) -> void:
	print(("PASS: " if ok else "FAIL: ") + label)
	if not ok:
		_failed += 1

## Ends the test run.
func finish() -> void:
	get_tree().quit(1 if _failed else 0)
