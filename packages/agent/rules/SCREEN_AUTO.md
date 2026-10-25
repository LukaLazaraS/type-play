- **One shape, scaled to fit any screen**: the game is made for one screen shape, and the
  window scales it to fit any phone, tablet or computer, with bars around it
  (`window/stretch/aspect="keep"`, already set). The visible area is always exactly the
  viewport size: lay everything out inside it with fixed numbers; nothing re-lays out for
  other screens.
- **Portrait first**: most players hold their phone upright, so the project starts portrait
  (720×1280, `window/handheld/orientation=1`). Keep it for puzzles, match-3, vertical runners
  and jumpers, top-down racers, tower defence, shooters that scroll up, and anything else that
  fits a tall screen: HUD along the top, big touch buttons along the bottom. Only a game that
  needs width (side-scrollers such as side-view runners and platformers, wide 3D racing)
  switches to landscape: in `project.godot` set `window/size/viewport_width=1152`,
  `window/size/viewport_height=648` and `window/handheld/orientation=0` (on an upright phone
  the site then asks the player to turn it). Decide when you build the game; later changes
  keep it unless the player asks.
