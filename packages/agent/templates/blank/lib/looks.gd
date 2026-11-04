# TypePlay's helper (use it, never change it): every look is drawn ONCE into a shared picture.
#
# A look drawn with draw_* calls in _draw() every frame is what makes busy games slow: 100 enemies redrawing
# themselves is thousands of shapes a frame. Here each look (an enemy, a tower, a coin, a bullet, a tile) is drawn
# once, at start, and every copy shows that same picture (moved, turned, scaled and tinted: all cheap).
#
#   const Looks = preload("res://lib/looks.gd")
#   # In _ready, before the title shows: every look with its draw function. (0, 0) is the look's centre.
#   Looks.add("ant", Vector2i(64, 64), func(c: CanvasItem) -> void: Enemy.draw_ant(c, 1.0), "Red ant")
#   Looks.add_frames("ant_walk", Vector2i(64, 64), 6, func(c: CanvasItem, i: int) -> void: Enemy.draw_ant(c, i / 6.0), "Red ant walking")
#   await Looks.bake(self)            # draws everything added so far, all at once
#   # In play, one Sprite2D per copy, made by the helper:
#   var s := Looks.sprite("ant")      # centred; animate s.position, s.rotation, s.scale, s.modulate
#   Looks.set_frame(s, "ant_walk", i) # show a pre-drawn frame (walk cycles, spins, flashes)
#   Looks.texture("ant")              # the picture itself (TextureRect, TextureButton, draw_texture)
#   var bar := Looks.rect(Color.RED, Vector2(30, 4))   # a box that batches with the looks: hp bars, flashes
#   bar.scale.x = 30.0 * hp / max_hp / 2.0             # a bar's fill changes by scale, never by redrawing
#
# The last argument of add(), add_frames() and bake_one() is the look's plain name for the player ("Red ant", "Level 2
# map"): the game page lists every look by it (TypePlay's asset capture reads _tex and _labels at build time).
# Pictures last for the whole game, across restarts. Add new looks and bake again any time (a new level's map);
# baking shows nothing on screen. Keep looks under ~512 px; draw a big static map once with bake_one().
extends RefCounted

const PAGE_W := 2048
const PAD := 2

static var _pending: Array = [] # [key, size, painter, frames]
static var _tex: Dictionary = {} # key -> Texture2D, or Array[Texture2D] for frames
static var _labels: Dictionary = {} # key -> the look's plain name, when one was given
static var _keep: Array = [] # the pictures' owners (one per bake)
static var _white: Texture2D = null # a white patch in the first picture: rect() bars and boxes batch with the looks

## A look: `painter(canvas)` draws it with draw_* calls around (0, 0), inside `size` pixels. `label`: its plain name.
static func add(key: String, size: Vector2i, painter: Callable, label: String = "") -> void:
	_pending.append([key, size, painter, 0])
	if label != "":
		_labels[key] = label

## An animated look: `painter(canvas, i)` draws frame i of `count` (0 .. count - 1). `label`: its plain name.
static func add_frames(key: String, size: Vector2i, count: int, painter: Callable, label: String = "") -> void:
	_pending.append([key, size, painter, maxi(1, count)])
	if label != "":
		_labels[key] = label

## Draws every look added since the last bake into one shared picture. Await it before using the looks.
static func bake(host: Node) -> void:
	if _pending.is_empty():
		return
	var items: Array = _pending
	_pending = []
	if _white == null:
		items.append(["__white", Vector2i(6, 6), func(c: CanvasItem) -> void: c.draw_rect(Rect2(-3, -3, 6, 6), Color.WHITE), 0])
	# Shelf packing: rows of looks, left to right, in pages PAGE_W wide.
	var cells: Array = [] # [key, frame or -1, rect, painter]
	var x := 0
	var y := 0
	var row_h := 0
	for it in items:
		var size: Vector2i = it[1]
		var count: int = it[3]
		for f in maxi(1, count):
			if x + size.x + PAD > PAGE_W:
				x = 0
				y += row_h + PAD
				row_h = 0
			cells.append([it[0], f if count > 0 else -1, Rect2i(Vector2i(x, y), size), it[2]])
			x += size.x + PAD
			row_h = maxi(row_h, size.y)
	var page := Vector2i(PAGE_W, y + row_h + PAD)
	var atlas: Texture2D
	if DisplayServer.get_name() == "headless":
		# No renderer in headless runs (the check's tests): blank pictures of the right sizes keep the game working.
		atlas = ImageTexture.create_from_image(Image.create(page.x, page.y, false, Image.FORMAT_RGBA8))
	else:
		# Pass 1 draws the looks into a transparent picture; the GPU stores it premultiplied (half-transparent red
		# comes out dark red), so pass 2 copies it once through a shader that undoes that, and every look then
		# draws like the shapes did (fades and tints included). Both passes run once; nothing is read back.
		var vp := _viewport(page)
		for c in cells:
			var n := Node2D.new()
			var r: Rect2i = c[2]
			n.position = Vector2(r.position) + Vector2(r.size) / 2.0
			var painter: Callable = c[3]
			var frame: int = c[1]
			if frame < 0:
				n.draw.connect(func() -> void: painter.call(n))
			else:
				n.draw.connect(func() -> void: painter.call(n, frame))
			vp.add_child(n)
		# Under the tree's root, not the game: the pictures survive a restart (reload_current_scene).
		var root := host.get_tree().root
		root.add_child.call_deferred(vp)
		await host.get_tree().process_frame
		await RenderingServer.frame_post_draw
		var out := _viewport(page)
		var copy := TextureRect.new()
		copy.texture = vp.get_texture()
		copy.size = Vector2(page)
		copy.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		var mat := ShaderMaterial.new()
		mat.shader = _straight_alpha()
		copy.material = mat
		out.add_child(copy)
		root.add_child(out)
		await RenderingServer.frame_post_draw
		atlas = out.get_texture()
		_keep.append(out)
		# Done: only the second picture stays (it draws nothing more).
		copy.queue_free()
		vp.queue_free()
	for c in cells:
		var t := AtlasTexture.new()
		t.atlas = atlas
		t.region = Rect2(c[2])
		if c[0] == "__white":
			t.region = Rect2(Rect2(c[2]).position + Vector2(2, 2), Vector2(2, 2)) # the middle: pure white when scaled up
			_white = t
			continue
		if c[1] < 0:
			_tex[c[0]] = t
		else:
			if not _tex.has(c[0]) or not (_tex[c[0]] is Array):
				_tex[c[0]] = []
			var list: Array = _tex[c[0]]
			if list.size() <= c[1]:
				list.resize(c[1] + 1)
			list[c[1]] = t

static func _viewport(size: Vector2i) -> SubViewport:
	var vp := SubViewport.new()
	vp.size = size
	vp.transparent_bg = true
	vp.disable_3d = true
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	vp.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_LINEAR
	return vp

static var _shader: Shader
static func _straight_alpha() -> Shader:
	if _shader == null:
		_shader = Shader.new()
		_shader.code = "shader_type canvas_item;\nrender_mode blend_disabled;\nvoid fragment() {\n\tvec4 c = texture(TEXTURE, UV);\n\tCOLOR = c.a > 0.0001 ? vec4(c.rgb / c.a, c.a) : vec4(0.0);\n}\n"
	return _shader

## One big static picture (a whole map or board): drawn once, returned as a texture to show with one Sprite2D or
## draw_texture(). `origin` is where the painter's (0, 0) lands in the picture. `label`: its plain name.
static func bake_one(host: Node, key: String, size: Vector2i, origin: Vector2, painter: Callable, label: String = "") -> Texture2D:
	add(key, size, func(c: CanvasItem) -> void:
		c.draw_set_transform(origin - Vector2(size) / 2.0)
		painter.call(c)
		c.draw_set_transform(Vector2.ZERO), label)
	await bake(host)
	return texture(key)

## The picture of a look (frame 0 of an animated one), or null before it is baked.
static func texture(key: String, frame: int = 0) -> Texture2D:
	var t = _tex.get(key)
	if t is Array:
		var list: Array = t
		return list[clampi(frame, 0, list.size() - 1)] if not list.is_empty() else null
	return t

## How many frames an animated look has (1 for a still one, 0 if unknown).
static func frame_count(key: String) -> int:
	var t = _tex.get(key)
	return (t as Array).size() if t is Array else (1 if t != null else 0)

static func has(key: String) -> bool:
	return _tex.has(key)

## A new Sprite2D showing the look, centred on its position. Add it to the game yourself.
static func sprite(key: String, frame: int = 0) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = texture(key, frame)
	return s

## A plain coloured box as a sprite of the shared picture (top-left at its position): health and progress bars, flashes,
## panels in play. A drawn rect between two sprites costs the browser an extra draw call each; these batch with the
## looks, and a bar's fill changes with `scale.x` (no redraw): bar.scale.x = width * hp_fraction / 2.0
static func rect(color: Color, size: Vector2) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = _white
	s.centered = false
	s.scale = size / 2.0
	s.modulate = color
	return s

## Shows frame `i` of an animated look on a sprite made by sprite() (wraps around).
static func set_frame(s: Sprite2D, key: String, i: int) -> void:
	var n := frame_count(key)
	if n > 0:
		s.texture = texture(key, posmod(i, n))
