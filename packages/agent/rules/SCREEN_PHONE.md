- **Made for phones held upright** (the player chose it): portrait, 720×1280
  (`window/handheld/orientation=1`), already set. Keep it whatever the game, also where the
  genre notes say landscape: HUD along the top, the thumbs' controls along the bottom; a
  side-scroller zooms its camera out so it still sees far enough ahead, with sky above.
- **One shape, scaled to fit any screen**: the window scales the game to fit any phone, tablet
  or computer, with bars around it (`window/stretch/aspect="keep"`, already set). The visible
  area is always exactly the viewport size: lay everything out inside it with fixed numbers;
  nothing re-lays out for other screens.
