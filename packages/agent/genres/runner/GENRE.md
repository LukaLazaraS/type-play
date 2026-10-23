## Genre: endless runner (side-view runners, vertical jumpers, flappy flyers: proven patterns from our best runners)

Use these as defaults, then make the game the player's own: theme, art, character, one twist.

- **Orientation**: a side-view runner needs width: switch the project to landscape first (see
  "The project"). A vertical runner or jumper (climbing upward) stays portrait: the same feel
  numbers turned upright, the camera only moves up, falling below the screen ends the run.
- **Scripts**: `main.gd` (states TITLE / PLAY / OVER, input, score, speed ramp, juice),
  `player.gd` (physics + drawing), `obstacles.gd` (ONE spawner that owns obstacles AND
  pickups), `world.gd` (sky, parallax layers, ground; sized from the viewport), `hud.gd`
  (`CanvasLayer`), `sfx.gd` (sounds generated in code).
- **Side view**: the character faces the direction of travel and runs in place (legs or
  wheels animate); the world scrolls past. Draw it in profile, not facing the camera.
- **Feel that works**: gravity ~2600 px/s²; jump velocity ~-1000 (peak ~190 px); variable
  jump (releasing early halves the upward speed); coyote time 0.08 s; jump buffer 0.1 s.
  Squash on take-off and landing, dust puff on landing.
- **Speed**: start ~420 px/s, rise ~14 px/s every second, cap ~1150.
- **Spawning**: gap = speed × rand(0.85, 1.5) + 120 px, so every obstacle is jumpable at
  every speed; pairs of obstacles only once speed > 550. The same spawner places pickups
  relative to the obstacles it just made: an arc of 5 coins centred over the group that
  follows the jump path, or a low row in the gap. Everything stays reachable (below the jump
  peak). Spawn just off-screen on the right so nothing pops in.
- **Extra moves** (if asked): double jump ~-850, one per airtime, refilled on landing; duck or
  slide: shrink the hitbox, keep the feet on the ground.
- **Juice**: screen shake and a tumble (X eyes) on crash; sparkle + floating "+5" on pickups;
  "NEW BEST!" on the game-over screen.
- **HUD**: score top-right, best top-left, anchored to the corners, both updated from one
  function; the game-over overlay repeats score and best.
- **Test**: `test/core_test.tscn`: start, the player clears the first obstacle with a timed
  jump, crashing shows game over, a tap restarts. Plus one test per extra move or pickup.
