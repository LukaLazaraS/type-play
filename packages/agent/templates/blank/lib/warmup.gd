# TypePlay's helper (use it, never change it): draws every look the game uses once, behind the title screen.
#
# The first time a browser draws a new kind of thing (a material, a shader, a particle effect, a polygon, a text
# size) it stops the game to prepare it: 0.1-3 s on a laptop or phone, the freeze testers feel in the first seconds
# of play. Warmup draws one of each before play, nearly invisible behind everything, so play never stops for it.
#
#   const Warmup = preload("res://lib/warmup.gd")
#   # In _ready, after the world, camera and title are built (the title can show meanwhile):
#   await Warmup.run(self, [Enemy.make("boss"), Fx.make_burst(Color.RED), Coin.make(), $HUD.make_label(48)], [24, 36, 48, 96])
#
# `things`: a fresh copy of each kind of thing the game shows in play, made the way the game makes them: each enemy,
# tower, bullet, pickup and effect (particles), every 3D model and material, a label of each style, shader effects,
# the "lit" look of anything that lights up. Nodes, PackedScenes, Materials, Meshes and Textures all work; they are
# freed afterwards (don't pass nodes the game keeps). `font_sizes`: every text size the game uses (HUD, toasts,
# floating numbers, title, game over). Labels and buttons in `things` show every letter and digit once.
extends RefCounted

const LETTERS := "0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz +-x×/%!?:.,'\"()★♥"

## Draws each thing once, for a few frames, then frees them. Await it before play can start.
static func run(host: Node, things: Array = [], font_sizes: Array = [], frames: int = 3) -> void:
	var tree := host.get_tree()
	if DisplayServer.get_name() == "headless":
		for t in things:
			if t is Node and is_instance_valid(t) and t.get_parent() == null:
				t.free()
		return
	var view := host.get_viewport().get_visible_rect()
	var centre := view.position + view.size / 2.0
	# 2D: behind everything (layer -100) and 6% visible, in the middle of the screen, so it really is drawn.
	var layer := CanvasLayer.new()
	layer.layer = -100
	var box := Node2D.new()
	box.modulate = Color(1, 1, 1, 0.06)
	box.position = centre
	layer.add_child(box)
	# 3D: a few metres in front of the game's camera, small, behind the title (the 2D screens draw over 3D).
	var cam := host.get_viewport().get_camera_3d()
	var spot := Node3D.new()
	var made: Array = []
	# The basics every 2D game draws: a polygon, a line, particles, a label at the default size.
	var poly := Polygon2D.new()
	poly.polygon = PackedVector2Array([Vector2(-8, -8), Vector2(8, -8), Vector2(0, 8)])
	box.add_child(poly)
	var line := Line2D.new()
	line.points = PackedVector2Array([Vector2(-8, 0), Vector2(8, 4)])
	box.add_child(line)
	var dots := CPUParticles2D.new()
	dots.amount = 4
	dots.lifetime = 0.2
	box.add_child(dots)
	for s in font_sizes:
		var l := Label.new()
		l.text = LETTERS
		l.add_theme_font_size_override("font_size", int(s))
		box.add_child(l)
	var basic := Label.new()
	basic.text = LETTERS
	box.add_child(basic)
	for t in things:
		var n: Node = _as_node(t)
		if n == null:
			continue
		made.append(n)
		if n is Node3D:
			spot.add_child(n)
		elif n is CanvasItem:
			box.add_child(n)
		else:
			box.add_child(n) # plain nodes holding visuals (their children are drawn too)
	host.add_child(layer)
	if cam:
		host.add_child(spot)
		spot.global_transform = cam.global_transform.translated_local(Vector3(0, 0, -4.0)).scaled_local(Vector3.ONE * 0.25)
	_wake(layer)
	_wake(spot)
	for i in maxi(2, frames):
		await tree.process_frame
	await RenderingServer.frame_post_draw
	layer.queue_free()
	if spot.is_inside_tree():
		spot.queue_free()
	else:
		spot.free() # no 3D camera: its 3D things were never drawn (call run() after the camera exists)

# A node for a thing: nodes as they are, scenes instanced, materials and meshes on a small shape.
static func _as_node(t) -> Node:
	if t is Node:
		return t
	if t is PackedScene:
		return (t as PackedScene).instantiate()
	if t is Mesh:
		var mi := MeshInstance3D.new()
		mi.mesh = t
		return mi
	if t is Texture2D:
		var s := Sprite2D.new()
		s.texture = t
		return s
	if t is ShaderMaterial and (t as ShaderMaterial).shader and (t as ShaderMaterial).shader.get_mode() == Shader.MODE_CANVAS_ITEM:
		var r := ColorRect.new()
		r.size = Vector2(16, 16)
		r.material = t
		return r
	if t is CanvasItemMaterial:
		var r2 := ColorRect.new()
		r2.size = Vector2(16, 16)
		r2.material = t
		return r2
	if t is Material:
		var mi2 := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(0.3, 0.3, 0.3)
		mi2.mesh = box
		mi2.material_override = t
		return mi2
	return null

# Particles start emitting and text shows every letter, so each is really drawn.
static func _wake(root: Node) -> void:
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		if n is CPUParticles2D or n is GPUParticles2D or n is CPUParticles3D or n is GPUParticles3D:
			n.set("emitting", true)
		if n is CanvasItem or n is Node3D:
			n.set("visible", true)
		if n is Label or n is Button or n is Label3D:
			n.set("text", LETTERS)
		elif n is RichTextLabel:
			(n as RichTextLabel).text = LETTERS
		stack.append_array(n.get_children())
