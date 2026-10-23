## Step 2 of 3: the content

The core game works and is saved; NOTES.md describes it and lists what is still to do. Read
NOTES.md first, then only the scripts you need. Add the rest of what the player asked for:
all the levels or waves (each different: layout, goal, a new enemy or piece; easy → hard),
the other types (towers, enemies, specials, cars), progress saved with `ConfigFile`, a level
select with locks and stars. Keep the look, controls and code structure; slot new content into
the existing data script and systems with small edits, not rewrites. Test each new behaviour
(extend `core_test` or add a test); the old tests must keep passing. Run the check, look at the
screenshots, and update NOTES.md (move done items out of "Still to do"; keep "Polish ideas").
