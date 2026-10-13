
## Play-test (required)

After the check passes, play the game with a bot to find gameplay bugs a screenshot can't
show. Write `test/playtest.tscn` + `test/playtest.gd`: it instances `res://main.tscn`, plays
it like a real player for about 60 seconds of game time (simulated taps/keys with
`Input.parse_input_event`, timed from the game's state, such as jumping when an obstacle is
near), and prints one line per event and a final summary: did it start, score over time,
deaths and their cause, whether game over shows and restart works, anything impossible
(unreachable items, unavoidable obstacles, stuck player). Run it with:

`"{GODOT}" --headless --path . --fixed-fps 60 --quit-after 4000 res://test/playtest.tscn`

Fix real bugs it finds, run the check again, and keep the test files (they are not exported).
Keep the bot simple: one script, no more than ~150 lines.
