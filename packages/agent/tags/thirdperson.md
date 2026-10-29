## Tag: Third-person (the hero seen from behind, in 3D)

- **Always 3D**, with the camera behind and above the hero's own character: a `CharacterBody3D`
  with a visible model (from a character pack) and a `Camera3D` on a spring arm (`SpringArm3D`,
  ~4 m behind, ~1.8 m up, looking at the hero's shoulders, fov ~70) that follows smoothly (lerp)
  and pulls in when a wall is behind the hero, so it never ends up inside a model.
- **Controls go by the camera**: forward moves away from the camera, left and right strafe or turn
  the hero to face the way they go. The hero turns smoothly toward the move (not in a snap).
- **Computer**: WASD or the arrows to move, the mouse to turn the camera (captured after the
  first click, `Input.mouse_mode = Input.MOUSE_MODE_CAPTURED`; Escape frees it and pauses), Space
  to jump or act, Shift to run. The title says "Click to play".
- **Touch**: a virtual joystick on the left moves; dragging anywhere on the right half turns the
  camera (~0.25° per pixel); action buttons bottom-right (the rules above).
- **Comfort**: the camera's look up and down is limited (about -60° to +30°), the hero stays in the
  lower third of the screen with room to see ahead, an idle camera drifts back behind the hero
  only if the player asks for it, and walls and low ceilings never trap the camera.
- **Genres in third person**: a platformer shows a round shadow under the hero to judge jumps; a
  shooter aims over the shoulder with a small crosshair; an adventure explores a world and talks
  to characters in front; a racer is the chase camera behind the car.
- **Pitfalls**: a hero that moves relative to the world instead of the camera (sideways walking
  that feels wrong); a camera that jitters on slopes (smooth the position, not the angle); a hero
  model with no animation (at least idle and walk, even if made by moving parts).
- **Keep it light**: the 3D rules' limits; the check renders in software.
- **Test**: moving forward moves the hero away from the camera; turning the camera changes the
  direction forward goes; the camera stays behind the hero and never inside a wall.
