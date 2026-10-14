## Genre: puzzle (grid puzzles: match-3, box pushing, sliding, connect, logic)

Use these as defaults, then make the game the player's own: theme, pieces, one twist.

- **Scripts**: `main.gd` (states TITLE / PLAY / WIN or OVER, input, score/moves/timer),
  `board.gd` (grid data + rules, no drawing), `pieces.gd` or `board_view.gd` (drawing and
  tweens), `levels.gd` (level data, if the game has levels), `hud.gd` (`CanvasLayer`).
  Keep the rules in plain data (an Array of rows) so tests and solvers can use them.
- **Board size from the viewport**: cell size = min(available width / columns, available
  height / rows), board centred, HUD outside the board. Works on wide screens and phones.
- **Controls, all three**: swipe (drag ≥ 30 px in a direction) and tap (tap a piece, then a
  neighbour) for phones; arrow keys / WASD for keyboards. On-screen Undo and Restart buttons
  (≥ 64 px) in levelled games.
- **Feel**: every move animates (tween 0.12-0.2 s): swaps, slides, falls, clears (pop: scale
  up, fade). Invalid moves bounce back. Small screen shake or flash on big combos or a win.
- **Match-3**: the starting board has no matches and at least one possible move; after every
  move, clear → gravity → refill → repeat until stable (cascades), each cascade step scoring
  more (combo ×2, ×3…); if no move is possible, reshuffle with a short message.
- **Levels** (box pushing, sliding, logic): 5+ levels, easy → hard, the first one teachable in
  a few moves. Write a solver (BFS over states) and verify every level is solvable; store the
  minimum moves and show a star rating against it. Never ship an unsolvable level.
- **Win / lose**: a clear win screen (moves, stars, "Next level"), level select or "continue"
  saved with `ConfigFile`; timed modes show the time bar and add time on matches.
- **Test**: `test/core_test.tscn`: the board loads valid (match-3: no starting matches, a move
  exists; levels: the solver solves level 1), a valid move changes the board as the rules
  say, an invalid move is rejected, and winning/losing shows the right screen.
