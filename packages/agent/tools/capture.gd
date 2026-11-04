extends Node
## TypePlay's asset capture: build time only, never in a game a player gets. tools/capture.mjs copies the game, adds this
## script to the copy as an autoload (res://tp_capture.gd), exports the copy for the web and plays it in the hidden
## browser. Asked by the page (window.__tpAsk), it hands over what the game made in code and so has no file: each shared
## look (lib/looks.gd) as a picture, each sound made in code as a WAV, and a still picture of each 3D model. Every item
## goes into window.__tpOut as one JSON object; window.__tpDone says an ask is answered. GPU read-backs happen here only,
## in this copy: the game itself never reads a picture back.

## res:// paths of the game's 3D models, filled in by the tool.
const MODELS: Array = []
## A model's still: square, this many pixels.
const STILL := 384
## Big sounds (music made in code) are kept up to this many bytes each.
const MAX_SOUND_BYTES := 12 << 20

var _asked := 0
var _busy := false
var _sent_looks := {}
var _sent_sounds := {}
var _sent_stills := false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if not OS.has_feature("web"):
		set_process(false)
		return
	JavaScriptBridge.eval("window.__tpOut = window.__tpOut || []; window.__tpReady = true;", true)

func _process(_delta: float) -> void:
	if _busy:
		return
	var ask := int(JavaScriptBridge.eval("window.__tpAsk || 0", true))
	if ask <= _asked:
		return
	_asked = ask
	_busy = true
	await _collect()
	JavaScriptBridge.eval("window.__tpDone = %d;" % ask, true)
	_busy = false

func _collect() -> void:
	_looks()
	_sounds()
	if not _sent_stills:
		_sent_stills = true
		await _stills()

func _send(item: Dictionary) -> void:
	JavaScriptBridge.eval("window.__tpOut.push(%s);" % JSON.stringify(item), true)

func _note(text: String) -> void:
	_send({"kind": "note", "text": text})

# ---- Looks: the pictures lib/looks.gd drew once ----------------------------------------------------------------------

func _looks() -> void:
	if not ResourceLoader.exists("res://lib/looks.gd"):
		return
	var looks: Script = load("res://lib/looks.gd")
	var tex = looks.get("_tex")
	if not (tex is Dictionary):
		_note("lib/looks.gd keeps its pictures in an unknown way: looks not listed")
		return
	var labels = looks.get("_labels")
	var atlases := {} # atlas instance id -> its Image, read back once
	for key in (tex as Dictionary).keys():
		var k := str(key)
		if _sent_looks.has(k):
			continue
		var value = tex[key]
		var frames: Array = value if value is Array else [value]
		var images: Array[Image] = []
		for t in frames:
			var img := _image_of(t, atlases)
			if img != null and not img.is_empty():
				img.convert(Image.FORMAT_RGBA8)
				images.append(img)
		if images.is_empty():
			continue
		_sent_looks[k] = true
		var first: Image = images[0]
		var item := {
			"kind": "look", "key": k, "w": first.get_width(), "h": first.get_height(), "frames": images.size(),
			"png": Marshalls.raw_to_base64(first.save_png_to_buffer()),
		}
		if labels is Dictionary and (labels as Dictionary).has(key):
			item["label"] = str(labels[key])
		if images.size() > 1:
			# The frames side by side, left to right: a sprite sheet.
			var strip := Image.create(first.get_width() * images.size(), first.get_height(), false, Image.FORMAT_RGBA8)
			for i in images.size():
				var f: Image = images[i]
				strip.blit_rect(f, Rect2i(Vector2i.ZERO, Vector2i(mini(f.get_width(), first.get_width()), mini(f.get_height(), first.get_height()))), Vector2i(i * first.get_width(), 0))
			item["strip"] = Marshalls.raw_to_base64(strip.save_png_to_buffer())
		_send(item)

func _image_of(t, atlases: Dictionary) -> Image:
	if t is AtlasTexture:
		var a: Texture2D = (t as AtlasTexture).atlas
		if a == null:
			return null
		var id := a.get_instance_id()
		if not atlases.has(id):
			atlases[id] = a.get_image()
		var whole: Image = atlases[id]
		if whole == null:
			return null
		var r := Rect2i((t as AtlasTexture).region)
		r = r.intersection(Rect2i(Vector2i.ZERO, whole.get_size()))
		return whole.get_region(r) if r.has_area() else null
	if t is Texture2D:
		return (t as Texture2D).get_image()
	return null

# ---- Sounds made in code: every AudioStream the game holds that came from no file -----------------------------------

func _sounds() -> void:
	var stack: Array[Node] = [get_tree().root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		if n == self:
			continue
		if n is AudioStreamPlayer or n is AudioStreamPlayer2D or n is AudioStreamPlayer3D:
			var s = n.get("stream")
			if s is AudioStream:
				_sound(s, String(n.name))
		if n.get_script() != null:
			for p in n.get_property_list():
				if p.usage & PROPERTY_USAGE_SCRIPT_VARIABLE:
					_scan(n.get(p.name), str(p.name), 0)
		stack.append_array(n.get_children())

func _scan(value, name: String, depth: int) -> void:
	if depth > 2:
		return
	if value is AudioStream:
		_sound(value, name)
	elif value is Dictionary:
		for k in (value as Dictionary).keys():
			_scan(value[k], str(k), depth + 1)
	elif value is Array:
		var i := 0
		for x in value:
			i += 1
			_scan(x, "%s %d" % [name, i], depth + 1)

func _sound(stream: AudioStream, name: String) -> void:
	# A sound from a file is the file: the server lists those itself.
	if stream.resource_path != "" and not stream.resource_path.contains("::"):
		return
	if not (stream is AudioStreamWAV):
		return
	var id := stream.get_instance_id()
	if _sent_sounds.has(id):
		return
	_sent_sounds[id] = true
	var w := stream as AudioStreamWAV
	if w.format != AudioStreamWAV.FORMAT_8_BITS and w.format != AudioStreamWAV.FORMAT_16_BITS:
		_note("a sound made in code is compressed (%s): not listed" % name)
		return
	var path := "user://tp_capture_sound.wav"
	if w.save_to_wav(path) != OK:
		return
	var bytes := FileAccess.get_file_as_bytes(path)
	DirAccess.remove_absolute(path)
	if bytes.is_empty() or bytes.size() > MAX_SOUND_BYTES:
		return
	var channels := 2 if w.stereo else 1
	var per_second := float(w.mix_rate * channels * (1 if w.format == AudioStreamWAV.FORMAT_8_BITS else 2))
	_send({"kind": "sound", "name": name, "seconds": snappedf(w.data.size() / maxf(per_second, 1.0), 0.01), "wav": Marshalls.raw_to_base64(bytes)})

# ---- 3D models: a still picture of each, as the game's renderer shows it ---------------------------------------------

func _stills() -> void:
	for path in MODELS:
		var p := str(path)
		if not ResourceLoader.exists(p):
			continue
		var res = load(p)
		var node: Node3D = null
		if res is PackedScene:
			node = (res as PackedScene).instantiate() as Node3D
		elif res is Mesh:
			var mi := MeshInstance3D.new()
			mi.mesh = res
			node = mi
		if node == null:
			continue
		var img := await _still_of(node)
		if img != null and not img.is_empty():
			_send({"kind": "still", "path": p.trim_prefix("res://"), "png": Marshalls.raw_to_base64(img.save_png_to_buffer())})

func _still_of(node: Node3D) -> Image:
	var vp := SubViewport.new()
	vp.size = Vector2i(STILL, STILL)
	vp.transparent_bg = true
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	var world := Node3D.new()
	vp.add_child(world)
	world.add_child(node)
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1, 1, 1)
	env.ambient_light_energy = 0.55
	var we := WorldEnvironment.new()
	we.environment = env
	world.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, 35, 0)
	sun.light_energy = 1.1
	world.add_child(sun)
	var cam := Camera3D.new()
	cam.fov = 35.0
	world.add_child(cam)
	add_child(vp)
	await get_tree().process_frame
	var box := _bounds(node)
	var centre := box.get_center()
	var radius := maxf(box.size.length() / 2.0, 0.01)
	var dist := radius / sin(deg_to_rad(cam.fov / 2.0)) * 1.04
	var eye := centre + Vector3(1.0, 0.75, 1.15).normalized() * dist
	cam.near = maxf(dist / 200.0, 0.001)
	cam.far = dist * 4.0
	cam.look_at_from_position(eye, centre, Vector3.UP)
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var img := vp.get_texture().get_image()
	vp.queue_free()
	return img

func _bounds(root: Node3D) -> AABB:
	var box := AABB()
	var first := true
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		if n is VisualInstance3D:
			var b: AABB = (n as VisualInstance3D).global_transform * (n as VisualInstance3D).get_aabb()
			box = b if first else box.merge(b)
			first = false
		stack.append_array(n.get_children())
	return box if not first else AABB(Vector3(-0.5, -0.5, -0.5), Vector3.ONE)
