## Genre: shooter (arcade shooting: space shooters, top-down or side-on shoot 'em ups and twin-stick arenas with waves of enemies, bullets and power-ups; never an online first-person shooter)

Use these as defaults, then make the game the player's own: theme, ship or hero, enemies, one twist.

- **What makes it**: the player's ship or hero shoots waves of enemies that shoot back or ram;
  bullets are easy to read; power-ups (spread shot, faster fire, shield, bomb) drop from
  enemies; the waves get denser, and every few waves a boss with a health bar.
- **Views**: a vertical space shooter stays portrait (the ship near the bottom, enemies come
  down); a side-on shoot 'em up is landscape (the ship on the left, enemies come from the
  right); a top-down arena shooter (twin-stick) is landscape with the hero in the middle of a
  walled arena. Pick the one the idea suggests; the vertical shooter if it says nothing.
- **Scripts**: `main.gd` (states TITLE / PLAY / OVER, score, lives, wave counter), `player.gd`,
  `enemies.gd` (ONE spawner: wave patterns as data: formation, path, count, fire rate),
  `bullets.gd` (ONE pool of bullets for both sides, moved in `_physics_process`, drawn in one
  `_draw()`), `pickups.gd`, `fx.gd` (explosions, hit flashes), `world.gd` (scrolling stars or
  ground), `hud.gd`, `sfx.gd`.
- **Controls**: keys move (arrows / WASD), Space fires (holding fires automatically); in the
  arena the mouse aims and the button fires. Touch, vertical and side-on: the ship follows the
  finger with an offset (it sits ~120 px above the finger so the thumb never hides it) and fires
  by itself; arena: the virtual joystick on the left moves, a second on the right aims and
  fires (the rules above).
- **Feel that works**: ship speed ~520 px/s with quick acceleration; player bullets ~1100 px/s,
  ~8 per second; enemy bullets 260-380 px/s, round and bright with a dark outline; the player's
  hitbox much smaller than the drawing (a dot in its middle).
- **Juice**: muzzle flash, a hit flash on enemies, explosions of particles and a little screen
  shake, score numbers popping, a slow-down beat when the boss falls.
- **Pitfalls**: thousands of nodes for bullets slow the web build: pool them and draw them in
  one node. Waves must leave a path to dodge through. No unfair spawns on top of the player:
  enemies enter from off-screen. After a hit: 1.5 s of blinking safety.
- **Test**: `test/core_test.tscn`: start, a bullet hits and destroys the first enemy, an enemy
  bullet costs a life, a power-up changes the shot, losing all lives shows game over, a tap
  restarts.
