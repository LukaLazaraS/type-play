extends SceneTree
# 3D probe: highest point of one jump vs a jump + a second jump in the air (metres above the floor).
func _initialize() -> void:
	_run()

func _frames(n: int) -> void:
	for i in n:
		await physics_frame

func _press_jump() -> void:
	var down := InputEventAction.new()
	down.action = "jump"
	down.pressed = true
	Input.parse_input_event(down)
	await _frames(2)
	var up := InputEventAction.new()
	up.action = "jump"
	up.pressed = false
	Input.parse_input_event(up)

func _run() -> void:
	var g = load("res://main.tscn").instantiate()
	root.add_child(g)
	await _frames(5)
	g.start_level(0)
	await _frames(40)
	var p = g.player
	var floor_y: float = p.global_position.y
	await _press_jump()
	var top1 := 0.0
	for i in 90:
		await _frames(1)
		top1 = maxf(top1, p.global_position.y - floor_y)
	await _frames(60)
	floor_y = p.global_position.y
	await _press_jump()
	await _frames(14)
	await _press_jump()
	var top2 := 0.0
	for i in 90:
		await _frames(1)
		top2 = maxf(top2, p.global_position.y - floor_y)
	var third := 0
	await _frames(60)
	floor_y = p.global_position.y
	await _press_jump()
	await _frames(14)
	await _press_jump()
	await _frames(10)
	var before_third: float = p.velocity.y
	await _press_jump()
	await _frames(1)
	print("PROBE one jump peaks %.2f m above the floor; jump + second jump peaks %.2f m (x%.2f); jumps_made=%d" % [top1, top2, top2 / maxf(top1, 0.01), p.jumps_made])
	quit()
