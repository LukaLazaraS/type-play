## Tag: 2 players (two people on one screen, never online)

- **Two players at once on the same device**: both play together or against each other on one
  screen, side by side or in two halves (a split-screen only if the genre needs two views).
  Never online, no network code, no accounts.
- **Computer: split keys.** Player 1: WASD to move, Space or F for the action. Player 2: the
  arrows to move, Enter or L for the action. Separate `InputMap` actions per player (`p1_left`,
  `p2_left`, …), so both can press at the same time. The title shows both key sets.
- **Phone or tablet: screen halves.** Player 1 owns the left half (or the bottom half when the
  screen is upright), player 2 the other, each with their own controls inside their half, read
  by `event.index` so both thumbs work at once; player 2's half is turned to face them when they
  sit opposite (an upright phone on a table).
- **Tell them apart**: each player has their own colour and name ("P1" / "P2" or the names of
  their characters), their own score in their own corner, and a clear winner screen ("Blue
  wins!") with a rematch button.
- **Fair**: both start equal; for a game that is usually played alone, make it a race or a duel,
  or both together against the game.
- **Test**: both players' controls move their own character at the same time; each one can
  score or win.
