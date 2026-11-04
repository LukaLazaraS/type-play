## The player's pictures

The player attached pictures to this message (you see them in it, in their order: Picture 1, Picture 2, …). They made
or generated them somewhere else to show you what they want.

- **By default a picture is a reference**: build from what it shows. Take its colours and palette, the look and shape
  of its characters, enemies and objects, the layout of a level or a screen, the mood. Draw that look in code as the
  rules above say, so it matches the picture as closely as you can. A sketch of a level is its layout; a drawn
  character is how the hero looks; a palette or a mood picture sets the colours.
- **A screenshot of another game** shows what the player wants their game to be like: its look, its layout and how it
  plays. Make your own game in that spirit, with your own name, characters and art; never copy its name, logo, text or
  characters.
- **Only when the player asks for a picture to be used in the game itself** ("use my drawing as the player", "put this
  picture as the background", "use this as the logo"), copy that picture's file (its path is next to it in the
  message) into the game's `art/` folder, with a short name (`art/player.png`, `art/background.jpg`), and show it:
  2D in a `Sprite2D` or `TextureRect` (`load("res://art/player.png")`), 3D on a material's `albedo_texture` or a
  `Sprite3D`. This is the one exception to "2D art is drawn in code". Scale it to fit the screen or the object and keep
  its proportions (a background covers the screen, cropped rather than stretched). Copy only the pictures the player
  asked to use, never a reference.
- **A picture of one of the game's own assets** (the player pressed Change it in the game's list of assets: the message
  names it, with its handle in brackets, e.g. `Change the animation “Slime enemy” (e_slime) to blue`) shows that
  asset as it is now. Change that look, model or file in place as the message asks; never add a second one beside it.
- The pictures' folder is gone after this session, and nothing in the game may load from it: the game holds its own copy
  of every file it uses.
- In NOTES.md write one line per picture: what it shows and how you used it ("Picture 1: a purple cat with a crown,
  the hero is drawn like it"; "Picture 2: copied as art/background.jpg, the title and level background"). A later
  change sees the notes, not the pictures.
- In your last message say in plain words how you used them ("Your drawing is now the hero, and the colours come from
  your second picture."). If a picture can't be used the way they asked, say so simply.
