extends SceneTree
# Racer probe: how far the player's heading turns in 30 frames of full steering, and how far the 5 rivals get in 30 s.
func _initialize() -> void:
	_run()

func _run() -> void:
	var g = load("res://main.tscn").instantiate()
	root.add_child(g)
	for i in 5:
		await physics_frame
	g.start_race()
	for i in 210:
		await physics_frame
	var p = g.player
	var h0: float = p.heading
	var sp0: float = p.speed
	Input.action_press("steer_right")
	for i in 30:
		await physics_frame
	Input.action_release("steer_right")
	print("PROBE player turned %.3f rad in 30 frames of full steering (speed %.0f)" % [absf(wrapf(p.heading - h0, -PI, PI)), sp0])
	var prog := []
	for c in g.cars:
		prog.append(c.progress)
	for i in 1800:
		await physics_frame
	var out := []
	for i in range(1, 6):
		out.append(int(g.cars[i].progress - prog[i]))
	print("PROBE rivals' progress in 30 s (px): ", out, " mean ", int((out[0] + out[1] + out[2] + out[3] + out[4]) / 5.0))
	quit()
