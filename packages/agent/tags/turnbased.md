## Tag: Turn-based (the player thinks, then acts: one move at a time)

- **Turns, not real time**: nothing moves while the player decides. The player makes one move
  (step, attack, place, play a card), then the enemies or the world answer, one after another,
  each move shown with a short animation (0.2-0.4 s), then it's the player's turn again.
- **Readable**: whose turn it is shows clearly ("Your turn"); the moves a piece can make and
  what an enemy will do next are shown before the player commits (highlighted tiles, an intent
  icon over the enemy); one undo for the last move where the genre allows.
- **Genres in turns**: a shooter or an adventure becomes tactics on a grid (move, then shoot);
  a racer becomes a board race (pick a speed each turn); a puzzle is already turn-based; a
  runner or an arcade game steps one beat at a time to a tap.
- **Controls**: tap or click a tile, a unit or a card, then where it goes; keys move a cursor
  (arrows / WASD), Space or Enter confirms, Escape cancels, Z undoes.
- **Test**: a player move is answered by exactly one enemy turn; nothing moves while waiting.
