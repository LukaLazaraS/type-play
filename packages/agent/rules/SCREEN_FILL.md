- **Fills every screen, no bars**: the game uses the whole screen of any shape: an upright
  phone (about 9:19.5), a tablet (3:4), a computer (16:9) and a phone held sideways. The
  window stretches to the screen (`window/stretch/aspect="expand"`, base 720×720, already
  set): the short side is always 720 and the long side grows, so `get_viewport_rect().size`
  is the real visible area, and it changes when the screen turns.
- **Lay out from that size**, in one `layout()` function called at start and on
  `get_viewport().size_changed` (it moves and resizes things, never rebuilds the game): a tall
  screen gets a phone layout (HUD along the top, the play area in the middle, the thumbs'
  controls at the bottom), a wide one a computer layout (the play area in the middle, HUD and
  panels at the sides). The play stays the same on every shape: a board scales to the space it
  has, a side-scroller's camera zooms so it sees as far ahead, a top-down map shows the same
  area; extra room is background, never stretched or cut off. Backgrounds, sky and ground
  cover the whole visible area (drawn to a fixed size they leave a grey strip), and HUD and
  controls are anchored to the screen's edges and corners.
