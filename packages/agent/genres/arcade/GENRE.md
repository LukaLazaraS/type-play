## Genre: arcade (one-screen score chasers with one-tap or very simple controls: stacker, brick breaker, snake, catch or dodge what falls, timing games; quick rounds for a high score)

Use these as defaults, then make the game the player's own: theme, look, one twist.

- **What makes it**: one screen, one rule learned in seconds, a score and a best score, rounds
  of 30 s to 3 min that speed up until the player misses. Common kinds and their core:
  - **Stacker**: a block slides side to side; a tap drops it; what overhangs is cut off; the
    tower grows and the camera rises; a perfect drop keeps the full width.
  - **Brick breaker**: a paddle along the bottom, a ball, rows of bricks; the ball's angle
    depends on where it hits the paddle; some bricks drop power-ups (wider paddle, multi-ball).
  - **Snake**: a grid (cells ≥ 40 px), the snake moves one cell per tick and grows on food;
    hitting itself or a wall ends the round; the tick gets faster.
  - **Flappy-style**: one tap flaps up against gravity through gaps in pipes or walls.
  - **Catch or dodge**: things fall; catch the good, dodge the bad; more and faster over time.
- **Orientation**: portrait unless the kind needs width.
- **Scripts**: `main.gd` (states TITLE / PLAY / OVER, score, best, speed ramp), one script for
  the game's own mechanic (`stack.gd`, `ball.gd`, `snake.gd`, …), `world.gd`, `hud.gd`,
  `sfx.gd`. Best score saved in `user://`.
- **Controls**: a one-tap game takes a tap or click anywhere, Space or Enter. Steering kinds
  (paddle, snake, catcher): ←/→ (and ↑/↓ for snake) or WASD; touch: drag for a paddle or a
  catcher (it follows the finger's x), swipes for snake (a swipe of 30 px or more turns it).
- **Juice**: every point gets a sound and a pop; a combo or a perfect gets a bigger one ("PERFECT!",
  rising pitch); a small screen shake on a miss; "NEW BEST!" on the game-over screen.
- **Pitfalls**: the first seconds must be easy (a slow start), and the speed ramp has a cap so it
  stays playable. Snake turns are buffered (one turn per tick, never back into itself); a brick
  breaker's ball never goes perfectly horizontal or vertical (keep a minimum angle) and never
  tunnels through a brick at speed (move it in small steps). Restart in one tap.
- **Test**: `test/core_test.tscn`: start, one scoring action scores, one miss ends the round
  (or costs a life), a tap restarts with the score at 0 and the best kept.
