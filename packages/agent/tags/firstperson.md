## Tag: First-person (seen through the hero's eyes, in 3D)

- **Always 3D**, with the camera at the hero's eyes: a `CharacterBody3D` with a `Camera3D` at
  ~1.6 m (fov ~75, near 0.05), no model of the hero's own body, only hands or the tool or gun
  they hold, at the bottom right of the view. A small crosshair in the middle of the screen.
- **Computer**: WASD to move, the mouse to look (captured after the first click,
  `Input.mouse_mode = Input.MOUSE_MODE_CAPTURED`; Escape frees it and pauses), click or Space for
  the main action, Shift to run. The title says "Click to play".
- **Touch**: the virtual joystick on the left moves; dragging anywhere on the right half looks
  around (~0.25° per pixel); an action button bottom-right (the rules above).
- **Comfort**: look up and down clamped to ±85°, mouse sensitivity ~0.15° per pixel, smooth
  movement with no strong head bob, walls that stop the camera (a capsule collider), a world
  that is easy to find the way in (landmarks, lights at the goals).
- **Genres in first person**: a shooter aims with the crosshair; a racer is the cockpit view;
  an adventure explores rooms and talks to characters by looking at them; a platformer shows the
  hero's shadow under them so jumps can be judged.
- **Keep it light**: the 3D rules' limits; the check renders in software.
- **Test**: moving forward moves the hero; turning the view turns the hero's direction; the main
  action hits what the crosshair is on.
