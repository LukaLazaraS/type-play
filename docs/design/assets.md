# Assets: every picture, model, sound and font a game uses (design, 2026-11-04)

Luka (11-04): "a page, section or tab where the player sees every asset their game uses, so they can look at it,
screenshot it and ask for a change; maybe edit it there; maybe send it to the chat." This is the plan; what was built
the same night is marked **Built**, the rest **Proposal**. Night log: `docs/overnight/2026-11-04_assets.md`.

## 1. In short

- A game page gets an **Assets** tab: a third tab on phones (Chat / Play / Assets), a Play / Assets switch in the game's
  bar on computers, with the chat beside it as always.
- It shows every picture, 3D model, sound and font the game's current version uses, **including the art and sounds the
  AI made in code** (most of our games have no picture files at all). Each has a preview (a picture, a turnable model,
  a play button), a plain name, where it is used, **Download** and **Change it**.
- **Change it** puts the asset into the chat box as a picture attachment with a starter sentence naming it ("Change the
  "Slime enemy" animation (e_slime): "). The player finishes the sentence and sends; it is charged like any change.
- Code-drawn art is turned into pictures **once, at build time**, by playing a copy of the game in the hidden browser
  the check already uses. Nothing is drawn when the player opens the tab.
- Private to the game's owner, fetched through the API with the sign-in header, like the game's download and pictures.

**Built on 11-04** (branch `assets`): everything in §5 and §6 and the first two steps of §7. Agent:
`packages/agent/tools/capture.mjs` + `capture.gd`, run.mjs's call, looks' plain names (`lib/looks.gd`, rules/FAST.md), the
asset handle in rules/EDIT.md and PICTURES.md. API: `apps/server/src/assets/`, one call in `runs.service.ts`, the delete
in `projects.service.ts`, fake builds with assets. Site: `components/app/Assets.tsx` and `AssetViewer.tsx`, the pieces
`ui/AssetTile.tsx`, `ui/ModelView.tsx` and `ui/Viewer.tsx`, the tab in `GameClient.tsx` and `Stage.tsx`, Change it through
the composer's tray. Not built: §9.

## 2. What our games really contain (measured 11-04)

92 game folders on this PC (`packages/agent/output`) and the speed night's six (`night-perf`):

| Kind | Where it comes from | How common |
|---|---|---|
| **Art drawn in code** | GDScript `draw_*` calls. Since 11-04 (template 2, rules/FAST.md) each repeated look is drawn once into a shared picture by `lib/looks.gd` (`Looks.add`, `add_frames`, `bake_one`) | every 2D game; it is all of a 2D game's art |
| **3D models** | copied from the CC0 library (`tools/assets.mjs copy`) into `assets/<pack>/`, with their textures (Kenney's `Textures/colormap.png`) and a line in `assets/CREDITS.md` | every 3D game: 181 .glb, 3 .fbx |
| **Sounds made in code** | an `AudioStreamWAV` built from samples at start, usually a `sfx.gd` dictionary (`sounds["jump"] = _wav(...)`) | 28 of the folders |
| **Picture files** | a player's picture copied in as art (rules/PICTURES.md, since 11-04), a port's sprites | rare (Black Hole Galaxy: 66) |
| **Sound files** | ports only (Black Hole Galaxy: 11 .mp3) | rare until real sound effects (`docs/parked.md` #10) |
| **Fonts** | none found: games use Godot's default font, or a pixel font drawn in code (the Retro tag) | none yet |

So a list of files alone would show nothing for nearly every 2D game. The night's look helper changes that: every look
already exists as a picture inside the running game, keyed by name ("e_toaster", "tb_saw_2", "map0").

**Probe** (11-04, copies of real games, this PC): `tools/capture.mjs` on night-siege took 17.5 s and listed 71 looks
(a 4-frame toaster as a sprite sheet, the three level maps at 832×576); on night-3d 16.8 s and 2 model stills (FBX
robot and battery, rendered by Godot); on show-runner-polished 14.6 s and its 8 sounds made in code (jump, land,
crash…) as WAV files.

## 3. What others do (researched 11-04)

| Product | What it shows | Source |
|---|---|---|
| Rosebud AI | Chat on the left; **Preview / Assets / Code** tabs on the right. Assets takes images, audio and 3D files, filters "in this project" vs everything uploaded, can generate images; swap one by typing `@asset-name` in chat | [beginner guide, ~05-2025](https://lab.rosebud.ai/blog/beginner-guide), [anygen showcase, 2026](https://www.anygen.io/showcase/rosebud-ai/index.html), [RPG guide, 2026-01-30](https://lab.rosebud.ai/blog/how-to-make-an-rpg-game-with-ai) |
| Lovable | **Preview / Files / Code**. Files: grid with images at their real shape or a list, search, filters with counts, sort; per file **Add to chat**, Download, Copy link, Delete; multi-select by press-and-hold; edits (draw, erase, remove background) saved as a new file | [docs: files](https://docs.lovable.dev/features/generate-files), [changelog](https://docs.lovable.dev/changelog) (collections 2026-09-20, multi-select 10-15, image edits 10-12) |
| Lovable | "Select elements" in the preview: the element goes into the chat box as a reference | [docs: visual edit](https://docs.lovable.dev/features/visual-edit) |
| Bolt.new | A code tree; images reach the AI as chat attachments; "Edit with AI" on an image with a before/after slider | [code view](https://support.bolt.new/building/using-bolt/code-view), [images](https://support.bolt.new/building/images) |
| Replit | A file tree; generated images saved to the project; the canvas edit tool shows an image's path with Upload Image (desktop only) | [image generation](https://docs.replit.com/core-concepts/agent/image-generation), [elements](https://docs.replit.com/design/elements) |
| Roblox Studio | Asset Manager: grid (tile slider) or sortable list, filters by type and source, search, right-click Insert / Copy ID | [Asset Manager, 2026-09-19](https://create.roblox.com/docs/projects/assets/manager) |
| Unity | Project window: thumbnail slider, `t:` type filters, favourites; the Inspector turns a model by drag and plays a sound with its waveform; Find References | [Project window, Unity 6.6](https://docs.unity.com/en-us/engine/current/manual/unity-editor/editor-windows-views-reference/project-view), [audio clip](https://docs.unity.com/en-us/engine/current/manual/audio/reference/class-audio-clip) |
| Godot | FileSystem dock: thumbnail grid or list; "View Owners…" (what uses a file) | [godot-proposals #9013](https://github.com/godotengine/godot-proposals/issues/9013) |

**Taken:** the tab beside the game (Rosebud, Lovable); a grid of pictures with filter chips that carry counts and a
search (Lovable); "Add to chat" as **Change it**, through the same attachment as an uploaded picture (Lovable, Rosebud's
`@asset`); a preview that fits the kind: turn a model, play a sound (Unity); "where it is used" (Unity's Find References,
Godot's View Owners), worked out by us and said in plain words.

**Left out:** file trees, paths as the main label, asset IDs, size sliders and list columns (desktop tools for
developers), delete (an asset belongs to the game's code: removing it is a change for the AI).

**What none of them do, and we can:** list art drawn in code; a starter sentence with the asset; where it is used in
plain words; the licence and origin in plain words ("3D model from Kenney's Car Kit, free to use (CC0)").

## 4. The player's journeys

1. **"Make the boss bigger and red."** Assets → the Pictures chip (or search "boss") → tap the boss → the viewer shows
   it large, animated if it has frames → **Change it** → the chat box holds the picture and "Change the "Boss"
   animation (boss_walk): " → the player types "make him bigger and red" → Send. On a computer the box is beside the
   list, so they can add the boss's bullet too before sending.
2. **"I want the music."** Assets → Sounds → the play button on the tile to check it's the right one → open → Download
   (a .wav or the original file). Code-made sounds download as WAV; a file is the file.
3. **"What did the AI use?"** Assets shows counts per kind ("Pictures 34 · 3D models 6 · Sounds 8"), each with how it
   was made ("Drawn in code by the AI", "3D model from Kenney's Car Kit, CC0", "Sound made in code") and where it is used
   ("Used in: Enemy, Spawner").
4. **"Screenshot it for my friend."** The viewer shows one asset whole on a calm background, the name under it.
5. **"Use my own drawing for the hero."** Today: attach the drawing in the chat and say so (rules/PICTURES.md copies it
   in as art). **Proposal:** Replace on an asset (§9).

## 5. The screens

**Phone (320-959 px):** the ink tab bar gets a third tab: ← Chat · Play · Assets. The Assets panel is the ink widget
the game lives in: a figures line ("Version 4 · 49 assets"), filter chips (All · Pictures · 3D models · Sounds · Fonts,
only kinds that exist, each with its count), a search field once there are more than 12, then the grid: square tiles on
Field (a picture with see-through parts stays readable, as in the picture viewer), 3 columns at 390 px, 2-3 at 320 px.
Under each tile its name (two lines at most) and one figures line ("4 frames", "0.4 s", "3D", "Font"). A sound tile has
a round play button on its square. **Change it** on a phone goes to the Chat tab with the box filled.

**Computer (960 px and up):** the chat stays on the left; the game's bar starts with a Play / Assets switch (the same
ink pill bar as the phone's tabs, small). On Assets the device, turn, full screen and new tab pills hide (they act on
the game's frame, which stays loaded and running underneath); Share, Android and More stay. The grid fills the stage:
6-7 columns at 1440 px. A new version arriving while the list is open shows the hot dot on Play, as the phone's tab does.

**The viewer** (one asset, a dialog over ink at 92%, as the picture viewer): the asset as large as the screen allows
(a picture never more than four times its own size; an animated look plays its frames at 8 a second, still under reduced
motion with a Play button; a model turns by drag or the arrow keys, pinch or wheel to zoom, slowly by itself unless the
player asked for reduced motion; a sound has a big play button and a progress bar; a font shows a pangram, the alphabet
and digits in it). Under it: the name, how it was made, the facts in figures ("72 × 72 px · 4 frames", "0.45 s",
"84 KB"), where it is used, and the file in the game in small figures when it is a file. **Change it** (the one hot
button) and **Download** (quiet). Previous / Next and the arrow keys move through the list as filtered; Escape closes.

**States:** loading (the line "Listing the assets…" with the breathing dot); an error (the hot-dot line with
Retry); no build yet ("The assets show here once your game is built."); nothing to list ("This game draws everything as
it runs, so there is nothing to list. Ask in the chat to change anything you see.", with an Ask in the chat button that takes the keyboard to the box); a version from before the tab
(§7: "Listed from the files: art the AI drew in code shows after your next change."); a search with no match.

**Keyboard and screen reader:** the tabs and the switch move with the arrow keys (the existing Tabs piece); chips are a
radio group; the grid is a list whose tiles are buttons named "Slime enemy, animation, 4 frames"; arrow keys move between
tiles (one tab stop for the grid), Enter opens; the viewer keeps the keyboard, says "3 of 49" as it moves, and gives the
keyboard back to the tile. A sound tile's play button is a second button for pointers and screen readers; keyboard
players play it in the viewer, where the play button has the focus first.

**Big lists stay fast:** thumbnails are WebP at most 320 px, made at import; fetched only when a tile nears the screen,
four at a time; tiles use `content-visibility: auto`; filtering and search are done in the page. A 500-asset list is
one JSON of ~100 KB.

## 6. How it works

**At build time (the runner, `packages/agent/tools/capture.mjs`):** run.mjs, after the last good commit, runs the
capture beside the closing AI calls (the player-message rewrite and the 9 ideas, ~5-15 s of network), so the build gets
~5-10 s longer, not ~17. The capture copies the game to `export/.capture`, adds `tools/capture.gd` as an autoload,
exports that copy for the web and plays it in the hidden browser at the check's screen size; it asks once the title has
settled and again 3 s after a tap and Space. The autoload reads back each look from lib/looks.gd's shared pictures (the
only GPU read-backs, in the copy), walks the game's nodes and their variables for sounds that came from no file, and
renders a still of each 3D model in its own small world. Out: `export/assets/captured.json` (+ PNG and WAV files),
stamped with the commit. The game's own build is never touched; a failure is a note; the exit code is always 0.

**At publish (the API, `apps/server/src/assets/`):** after the version is saved, the API lists the game folder's files
itself (pictures, models, sounds, fonts; a model's textures belong to the model, not the list), finds where each is
used (the scripts and scenes that name it), reads `assets/CREDITS.md` for origins, and adds the captured items if their
commit is the version's. Everything the agent wrote is untrusted: files are read with the folder rules of the download
(no symlinks out, size caps), every picture is decoded and re-encoded by sharp (no metadata, no hidden payloads), a
model is re-packed as one self-contained GLB (its textures inside; only glTF extensions a browser viewer can draw
without downloading decoders), sounds and fonts are checked by their first bytes. Stored in the API's data folder:
`data/assets/<game>/blobs/<sha256>` (each file once per game, however many versions use it) and
`data/assets/<game>/builds/<build>.json` (the list). Deleted with the game and the account.

**API (owner only; 404 for anyone else):**

| Route | Answer |
|---|---|
| `GET /projects/:id/assets/:buildId` | `GameAssets`: `source` (build, files, none) and the list |
| `GET /projects/:id/assets/:buildId/:assetId` | the asset itself: what Download saves (a look as PNG, an animated one as its sprite sheet; a model as one .glb) |
| `GET /projects/:id/assets/:buildId/:assetId/picture` | its picture: a picture whole, a look's first frame, a model's still (the viewer, Change it) |
| `GET /projects/:id/assets/:buildId/:assetId/thumb` | WebP, at most 320 px |

All `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, a sandboxing CSP. No migration: the lists are
files.

**In the site:** `components/app/Assets.tsx` (the panel), `AssetViewer.tsx`; shared pieces in `components/ui`
(`AssetTile`, `ModelView` around `<model-viewer>`, `SoundButton`); `lib/assets.ts` fetches with the sign-in header and
keeps object URLs for the page's life. Change it hands the picture to the composer's tray (`prefill.files` →
`tray.add`), exactly as a dropped file, so it uploads and checks like any attachment.

**Names.** A look gets a plain name from an optional fourth argument (`Looks.add("tb_saw_2", Vector2i(72, 72), painter,
"Saw tower base, level 3")`, asked for in rules/FAST.md: a few tokens per look). Without one: the drawing function's
name and the key's own words ("tower_base" + "saw 2" → "Tower base saw 2"). Sounds: their name in the code ("jump").
Files: their file name ("building-type-a.glb" → "Building type a").

## 7. Older versions (no capture)

Cheapest first:

1. **Built:** the current version of a game made before the tab: the API lists its files on the first open (the same
   code as at publish, ~0.1-1 s) and keeps the list. A 3D game shows its models (no stills: a 3D mark, the turnable view
   works); a 2D game usually shows nothing, with the note "Art the AI drew in code shows after your next change."
2. **Built:** any older version of such a game: the note alone (its files are in the git history, which the API does not
   read on the live server; the runner owns git).
3. **Free, automatic:** the next change the player makes captures everything.
4. **Proposal:** a capture-only job in the runner (no AI, ~15-20 s of one runner slot, $0) when the tab is opened on a
   current version without a capture, or an admin batch over every game at night: ~100 games ≈ 30 runner-minutes.

## 8. Costs

- **AI:** none for listing. Change it is an ordinary message. Look names: a few output tokens per look in the build.
- **Build time:** ~15-18 s of the runner per successful build (the copy's export ~5 s, the browser ~10 s), run beside the
  closing AI calls: the player waits ~5-10 s longer. Measured again on the real Fast build (night log).
- **Storage:** a 2D game ~50-300 KB per version (looks are small flat PNGs: night-siege's 71 looks were 278 KB with three
  full maps); a 3D game ~1-3 MB once, versions after that only what changed. 1,000 games ≈ 0.5-2 GB on the API's disk.
- **API CPU at publish:** sharp thumbnails for ~70 small PNGs ≈ 0.3-1 s on the live API's one vCPU; one import at a time.
- **Site:** `<model-viewer>` (~270 KB gzip) loads only when a model is opened; the tab itself is a few KB.

## 9. Proposals (not built)

1. **Replace with my own file** (a picture, sound or model): upload on an asset; a file asset is swapped at its path and
   the game re-exported without the AI (free, ~20 s); a code-drawn look needs the AI ("use this picture for the boss",
   one message with the picture). Needs the same checks as attachments plus model and sound checks.
2. **Edit in place**: simple edits that need no AI (colour shift, flip, trim a sound) saved as a new version, before and
   after side by side (Bolt's slider, Lovable keeps the original).
3. **Asset chips**: Change it adds a chip that carries the exact asset (its key or path) to the AI as data, instead of
   words in the sentence (Lovable's selected element, Rosebud's `@asset`). Needs a message field and the agent's input.
4. **A version picker** in the tab: any version's assets without restoring it; "new in this version" badges (the
   content hashes make the comparison free).
5. **Tap the game to find its asset**: the capture can record which look each sprite shows.
6. **Download all** as a .zip; **real sound effects and music** (`docs/parked.md` #10) listed the same way.
7. **The capture-only backfill** of §7.4.

## 10. Security and privacy

- Owner only, like the download: the sign-in header, the game's owner checked, 404 otherwise; never cached by anything
  shared.
- The game folder is the agent's (and through a remix, maybe someone else's): read with the download's rules; pictures
  re-encoded; models re-packed and limited to extensions a viewer can draw without fetching code; sounds and fonts
  checked by content; sizes capped (a picture 20 MB, a model 50 MB, a sound 30 MB, a font 10 MB, 500 assets and 200 MB
  per version).
- The 3D viewer parses a re-packed GLB on typeplay.app: `<model-viewer>` is JavaScript (memory-safe), with no network
  (no decoders, no environment downloads). Proposal if this ever worries us: draw models on typeplay.dev in a sandboxed
  frame, like the game.
- Nothing new is collected: these are the game's own files, already covered by the privacy page's game lines.
