## Tag: Retro (an old arcade look: big pixels, few colours, chip sounds)

- **Big pixels**: draw everything on a grid of square art pixels, each 4-8 screen pixels: shapes
  made of `draw_rect` blocks snapped to that grid, no anti-aliasing, no smooth curves, gradients or
  soft shadows. Characters, pieces and props are small sprites drawn in code from pixel maps (an
  Array of strings, one letter per colour), animated with 2-4 frames.
- **Few colours**: one classic 16-colour palette (PICO-8's suits most games) on a dark background,
  a hard outline one art pixel thick around everything that moves.
- **Pixel lettering**: the title, the score and big numbers in a blocky pixel font drawn from a
  small glyph table in code (5×7 capitals and digits); short help lines may use the normal font in
  a palette colour with a hard outline.
- **Arcade feel**: a score with leading zeros ("000120"), HI-SCORE on the title, a blinking
  "PRESS START" ("TAP TO START" on a touch screen), lives as small icons if the game has lives.
- **Chip sounds**: square and triangle wave blips made in code: a blip to jump or pick up, a
  falling tone on a crash, a short jingle on a win.
- **In 3D**: low-poly models in flat colours (`pack retro-fantasy-kit`, `pack retro-urban-kit`, or
  another simple pack), and the 3D view drawn at a quarter of the screen's resolution, then scaled
  up with nearest filtering (a `SubViewportContainer` with `stretch = true`, `stretch_shrink = 4`
  and `texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST`); the HUD in pixel lettering on top.
  Taps on the world: divide the position by 4 before casting the camera's ray.
