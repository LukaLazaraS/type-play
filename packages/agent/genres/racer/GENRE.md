## Genre: racer (races on a track or road: laps or distance, against other cars or the clock; not free driving to explore or collect)

Use these as defaults, then make the game the player's own: theme, cars, track, one twist.

- **2D top-down, portrait** (the default); 3D only if the player asks (last point). The
  track is bigger than the screen; a `Camera2D` follows the player's car, a little ahead of it.
- **Scripts**: `main.gd` (states TITLE / COUNTDOWN / RACE / FINISH, laps, places, times; test
  hooks), `track.gd` (the loop: points, drawing, `progress_at(pos)`, `is_on_road(pos)`),
  `car.gd` (driving + drawing, the same for the player and the AI, `ai := true` for opponents),
  `hud.gd`, `fx.gd`, `ui.gd`.
- **Track**: a closed loop of 10-14 points made smooth with a `Curve2D` and `tessellate()`d
  into a centreline: long straights and a few tight corners. Road ~260 px wide (4 cars), red /
  white kerbs, a dashed centre line, a chequered start line, grass with trees, tyres and stands
  outside it; the grass reaches at least a screen beyond the track on every side, so the
  camera never shows the empty background. Draw the whole track once in `track._draw()`; cars,
  skid marks and dust are separate nodes.
- **Driving (arcade)**: top speed ~620 px/s, acceleration ~420, brake ~900; turning ~2.6 rad/s
  × min(1, speed / 200) (no turning on the spot); grip: each frame the velocity turns towards
  the car's facing (lerp ~6 × delta), so it slides a little in fast corners. Off the road: top
  speed ×0.5 and dust. Cars bump apart (push circles apart, lose a little speed); no walls.
- **Controls**: phones: two big ◀ ▶ buttons (≥ 140 px) at the bottom corners, or hold the
  left / right half of the screen; the car accelerates by itself. Keyboard: ← → / A D steer,
  ↓ / S brakes. A tap (or Space) starts the race.
- **Opponents** (3 if not said): the AI aims at the centreline point ~150 px ahead, each on its
  own lane offset (-70…70 px), top speed 88-100% of the player's, and a ±8% rubber band
  (slower far ahead of the player, faster far behind) so the race stays close. Own colours.
- **Laps and places**: progress = laps × track length + distance along the centreline (the
  nearest tessellated point, searched near the last one); a lap counts only after the halfway
  checkpoint. Place = rank by progress. Countdown 3-2-1-GO (big, popping); HUD: "Lap 2/3",
  "2nd / 4", race time, a minimap of the loop with a dot per car.
- **Finish**: after the last lap, a results panel: the place (1st gets a trophy and confetti),
  time, best lap, every car in order; "Race again" / "Menu". The AI drive on behind it.
- **Title** over the track with the AI cars driving a demo lap: name, the cars as icons, PLAY.
- **Juice**: fading skid marks in hard corners, dust off the road, the camera zooms out a little
  at speed, shake on bumps, toasts "Lap 2!", "FINAL LAP!", "Best lap!".
- **Distance or timer race** (if asked): a road that scrolls up, traffic to overtake,
  checkpoints that add time; the same car and controls.
- **3D** (only when asked): landscape, a chase `Camera3D` behind and above the car, on-screen
  ◀ ▶ buttons, the same rules. Kenney Racing Kit (`search "race car"`, `pack racing-kit`):
  road pieces are 1 m tiles (large corners 2 m): lay them on a grid, scale the track ~8× so the
  road is 4 cars wide; add stands, flags and trees from the same pack.
- **Test**: `test/core_test`: nothing moves during the countdown; then the car drives forward
  and steering turns it; it is slower off the road; a lap counts only after the halfway
  checkpoint; the AI cars stay on the road and gain progress over ~600 frames; finishing the
  last lap shows the results with a place.
