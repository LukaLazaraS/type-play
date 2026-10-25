- **Asked to make it fit other screens too** (phones and computers, "here too", every screen):
  switch the game to filling every screen. Write `fill` into the `PLATFORM` file, and in
  `project.godot` set `window/stretch/aspect="expand"`, `window/size/viewport_width=720`,
  `window/size/viewport_height=720` and `window/handheld/orientation=6`. Keep the game's look,
  rules and controls, and lay it out for every shape as below (the check then shows an
  upright phone, a tablet, a phone held sideways and a computer).
