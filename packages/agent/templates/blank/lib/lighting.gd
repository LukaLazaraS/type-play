# TypePlay's helper (use it, never change it): the sky, light and tonemapping of every 3D game, in one call.
#
# Godot's web renderer adds every light on top of the others. A light-coloured wall or floor lit by a full sun AND a
# strong ambient light goes past white, and the screen turns chalky: Buzz Bite's kitchen (sun 1.05 + ambient colour
# 0.6, Filmic) was 71% pure white; the same room with the "indoor" light below 0%. Tonemapping alone doesn't save it:
# the amount of light does. So every 3D game takes its light from here, tested in the browser (2026-11-07):
#
#   const Lighting = preload("res://lib/lighting.gd")
#   # In _ready of the 3D root, once:
#   var sun := Lighting.setup(self, "day")    # "day", "sunset", "night", "indoor" (inside a room) or "space"
#   # A level that changes mood calls it again with the new one (it replaces the old sky and sun).
#
# It returns the sun (a DirectionalLight3D with shadows): turn it (`sun.rotation_degrees`) if the scene needs, never
# make it brighter. The colours of things come from their materials, never from more light. The sky's colours can be
# changed for the game's theme: `Lighting.sky(self).sky_top_color = Color("...")` (keep the same lightness).
extends RefCounted

## Each mood: sky top, sky horizon, ground below the horizon, ground bottom, sun colour, sun energy, sun pitch, sun yaw,
## ambient source ("sky" or a colour), ambient energy, background (a sky, or a flat colour for "space").
const MOODS := {
	"day": ["3f7fd6", "b4d4ee", "a9c3cf", "56614a", "fff6e8", 0.5, -52.0, -35.0, "e8eef8", 0.16, "sky"],
	"sunset": ["2b3a78", "f2a066", "d98a5c", "3a2f3a", "ffc890", 0.5, -24.0, -60.0, "f0d8e8", 0.16, "sky"],
	"night": ["0e1838", "33497e", "2a3a62", "10141f", "b8ccff", 0.32, -48.0, -30.0, "9fb2e8", 0.16, "sky"],
	"indoor": ["5a7fc4", "d8c8b0", "a89c8c", "3d3630", "fff0dc", 0.32, -60.0, -30.0, "ffeedd", 0.2, "sky"],
	"space": ["05070f", "141a33", "0b0e1a", "05070f", "ffffff", 0.55, -40.0, -40.0, "8c9ac8", 0.12, "color"],
}

## Adds (or replaces) the game's sky, ambient light, tonemapping and sun under `root`. Returns the sun.
static func setup(root: Node, mood: String = "day") -> DirectionalLight3D:
	var m: Array = MOODS.get(mood, MOODS["day"])
	for n in root.get_children():
		if n.has_meta("tp_lighting"):
			root.remove_child(n)
			n.queue_free()
	var env := Environment.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(m[0])
	sky_mat.sky_horizon_color = Color(m[1])
	sky_mat.ground_horizon_color = Color(m[2])
	sky_mat.ground_bottom_color = Color(m[3])
	sky_mat.sun_angle_max = 20.0
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env.sky = sky
	if m[10] == "color":
		env.background_mode = Environment.BG_COLOR
		env.background_color = Color(m[0])
	else:
		env.background_mode = Environment.BG_SKY
	# A plain ambient colour: the sky's own colours would tint every surface (a blue sky turns green grass mint).
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(m[8])
	env.ambient_light_sky_contribution = 0.0
	env.ambient_light_energy = m[9]
	# AgX keeps a bright surface from clipping to flat white (it rolls off and desaturates instead); Linear (Godot's
	# default) and Filmic at its default white of 1.0 clip at 1.0.
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 1.0
	env.glow_enabled = false
	var world := WorldEnvironment.new()
	world.environment = env
	world.set_meta("tp_lighting", true)
	root.add_child(world)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color(m[4])
	sun.light_energy = m[5]
	sun.rotation_degrees = Vector3(m[6], m[7], 0.0)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 60.0
	sun.set_meta("tp_lighting", true)
	root.add_child(sun)
	return sun

## The sky's material, to change its colours for the game's theme (keep their lightness).
static func sky(root: Node) -> ProceduralSkyMaterial:
	for n in root.get_children():
		if n is WorldEnvironment and n.has_meta("tp_lighting"):
			return (n as WorldEnvironment).environment.sky.sky_material
	return null
