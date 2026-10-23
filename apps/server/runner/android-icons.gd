# Makes a game's Android launcher icons from one picture (its poster, or the user's own PNG):
#   godot --headless --path <game> --script android-icons.gd -- <in.png> <outdir>
# Writes icon-192.png (a centre square crop, scaled), fg-432.png (the crop at 66 % on a transparent
# 432 canvas: the adaptive icon's safe zone) and bg-432.png (a solid colour sampled from the crop's
# edge). Exits 1 when the picture can't be read; android-prepare.mjs then uses the placeholders.
extends SceneTree


func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() < 2:
		push_error("usage: -- <in.png> <outdir>")
		quit(2)
		return
	var img := Image.new()
	if img.load(args[0]) != OK or img.get_width() < 16 or img.get_height() < 16:
		push_error("could not read " + args[0])
		quit(1)
		return
	var outdir: String = args[1]
	DirAccess.make_dir_recursive_absolute(outdir)
	img.convert(Image.FORMAT_RGBA8)
	var side: int = mini(img.get_width(), img.get_height())
	var crop := img.get_region(Rect2i((img.get_width() - side) / 2, (img.get_height() - side) / 2, side, side))

	var main := crop.duplicate()
	main.resize(192, 192, Image.INTERPOLATE_LANCZOS)
	# A launcher icon is opaque: anything transparent in the picture sits on the sampled ground.
	var ground := _edge_colour(crop)
	var opaque := Image.create(192, 192, false, Image.FORMAT_RGBA8)
	opaque.fill(ground)
	opaque.blend_rect(main, Rect2i(0, 0, 192, 192), Vector2i.ZERO)
	if opaque.save_png(outdir.path_join("icon-192.png")) != OK:
		quit(1)
		return

	var fg := Image.create(432, 432, false, Image.FORMAT_RGBA8)
	fg.fill(Color(0, 0, 0, 0))
	var inner: int = int(432 * 0.66)
	var small := crop.duplicate()
	small.resize(inner, inner, Image.INTERPOLATE_LANCZOS)
	fg.blit_rect(small, Rect2i(0, 0, inner, inner), Vector2i((432 - inner) / 2, (432 - inner) / 2))
	if fg.save_png(outdir.path_join("fg-432.png")) != OK:
		quit(1)
		return

	var bg := Image.create(432, 432, false, Image.FORMAT_RGBA8)
	bg.fill(ground)
	if bg.save_png(outdir.path_join("bg-432.png")) != OK:
		quit(1)
		return
	quit(0)


# The average colour of the picture's outer edge, made opaque: the adaptive icon's background.
func _edge_colour(img: Image) -> Color:
	var w := img.get_width()
	var h := img.get_height()
	var step: int = maxi(1, w / 64)
	var sum := Color(0, 0, 0, 0)
	var n := 0
	for x in range(0, w, step):
		for y in [0, h - 1]:
			sum += img.get_pixel(x, y)
			n += 1
	for y in range(0, h, step):
		for x in [0, w - 1]:
			sum += img.get_pixel(x, y)
			n += 1
	var c := sum / float(maxi(n, 1))
	return Color(c.r, c.g, c.b, 1.0)
