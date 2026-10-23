# Launch demo video: a 60-second Short and a 5-minute video

Written 2026-10-19 for [PLAN.md](../../PLAN.md) package 9 ("the YouTube channels are the funnel"). Luka records; Claude wrote
the plan from the code as it is today (checkpoint 3). Nothing here is published. Where a feature must be live before it can be
shown, the text says so. `{like this}` means: replace it with the number from your own take.

## Start here

- **One recording session, one game, two videos.** The game is a portrait match-3 puzzle, built on the **Free plan with the Fast
  AI**, from the Puzzle starter's own sentence: "Make a match-3 puzzle game with cute fruit." Free plus Fast is what a viewer
  gets for nothing, so the build and the changes promise nothing a viewer cannot repeat. A portrait game fills a vertical Short, and the pops
  are the "satisfying" moment your audience knows.
- **Short (60 s, vertical):** no voice, captions and music. **Long (about 5:15):** your voice in plain English; every sentence
  is also burned in as a caption.
- **The hook shows the first build (version 1).** The caption says "I typed ONE sentence", so never open with the edited game.
- **Android needs a paid plan** (Free has no export). Record that part on a Medium test account and say so on screen.
- **Say your own numbers.** Section 6 shows what we measured, as the range to expect. The clock and the credits the app shows in
  your take are what you say.
- **Read section 2 before you record.** The likely blockers: the Android go-live ([parked #14](../parked.md)), the site text
  matching the video (parked #1), and the Free plan's 5-credits-a-day cap against your game's price.

## 1. Rules for both videos

**Who watches.** Teens and adults who like satisfying sims and games; many read English as a second language. So:

- One idea per caption: 6 words at most, on screen at least 2 seconds. Digits for numbers. No slang, no idioms.
- In the long video every spoken sentence is also a caption. Upload an English caption file (.srt) so YouTube can translate it.
  English only (languages are undecided, [PRODUCT.md](../../PRODUCT.md)).
- In a vertical frame keep captions in the middle: not the bottom quarter, not the right edge (YouTube's buttons sit there).
- Say plainly that you make TypePlay (first 30 seconds of the long video; the description of both). You are not a neutral reviewer.
- Age, said where it fits: TypePlay accounts are for 13 and older; paid plans for 18 and older, or a parent buys; a Google Play
  developer account is for 18 and older.
- No other company's name, logo or price in the video. Comparisons belong on the later "TypePlay vs X" pages, with sources.
- Do not name the AI maker or the models. The app says Fast, Smart and Best, so you do too
  ([the Anthropic question](../anthropic-question.md) is still open).
- Music: your own or YouTube's Audio Library. The game's own sounds stay audible in every play clip (today they are simple
  sounds made in code; real sound effects come later, [parked #10](../parked.md)).

### What you may say (and what proves it)

| You say | Proof | Needs |
|---|---|---|
| You type one sentence and an AI builds a real game. | The app; about 40 test games in `packages/agent/output` | - |
| You play it in your browser. | The game frame (typeplay.dev) | - |
| A simple game takes about 2 to 12 minutes. A bigger one, with menus and levels, 15 to 25 minutes on Fast. | [RESULTS.md](../../packages/agent/RESULTS.md) | your clock |
| A simple Fast game costs about 1 to 4 credits. The price shows before you press Build. | RESULTS.md; the "about N credits" figure on /create | your take |
| The free plan is 20 credits a month, up to 5 a day, on Fast. | [site.ts](../../apps/web/src/content/site.ts) | - |
| You change it by chatting. A Fast change takes 1 to 3 minutes and about a third of a credit. | RESULTS.md (1.1 to 2.6 min, 0.003 to 0.03 dollars each) | your take |
| Every change is a version. Restore any one: it comes back as a new version and costs nothing. | The Versions strip; the server's restore charges nothing | - |
| If a build fails, or the AI refuses, you pay nothing. | [pricing.md](../pricing.md); the chat line "Didn't work, not charged" | - |
| Share a link and anyone can play it in a browser, with no account. | `/play/<id>` | the app is open |
| On a paid plan TypePlay builds an Android app: an APK for your own phone and the AAB that Google Play takes. It costs no credits. | [android.ts](../../apps/web/src/content/android.ts), pricing.md | Android is live |
| To publish on Google Play you need your own developer account: 25 dollars once, 18 or older. | The Google Play checklist in android.ts | - |
| The game is yours. TypePlay takes no share of what it earns. | The terms, "Your games are yours" | the site is deployed (parked #1) |
| You can download the project as a .zip and open it in Godot, a free game engine. | More menu "Download the project"; the server's `games/download.ts` | the app is open |
| iOS and Steam are coming. | PRODUCT.md | no dates |

### What you must not say

- **"Any game", "anything you imagine", "GTA", "open world".** Four kinds of game are tuned (runner, puzzle, racer, tower
  defence). Other ideas can work; results vary. Open-world 3D comes as the models improve.
- **"Instantly", "in seconds", "in one click".** Builds take minutes. Uploading to Google Play is the user's own step.
- **"Unlimited", "perfect", "no bugs", "works every time".** Say "results are partly luck".
- **"Free Android app".** Android builds need a paid plan.
- **"Play it while it builds".** The app shows the game when the build is finished. (RESULTS.md says the core of a Fast build is
  playable at about 5 to 7 minutes, but the app does not show it early.)
- **"Try another version" or "re-roll".** There is no such button. After a failed first build there is only "Try again".
- **"Sliders", "the AI plays your game for you".** Not built.
- **"iOS", "Steam", "App Store" as available**, or any date for them.
- **"Download the whole project any time".** The terms do not promise it yet ([page-copy-proposals.md](page-copy-proposals.md), D1).
  "You can download the project" is fine.
- ~~**The Free plan's "small TypePlay badge in your game".**~~ Built 2026-10-20: a game made on Free shows "Made with
  TypePlay" while it loads and a small tab on its right edge. Fine to show; a game made on a paid plan has none.
- **"Make money with it", user counts, "thousands of games", reviews.** We have none of these yet. "You keep what it earns" is
  the only version.
- **"Powered by Godot" or anything that suggests Godot backs TypePlay.** "Built with the Godot engine" is fine.
- **Model names, the AI maker, rival names.**

### What the rivals show, and what we do instead

From [competitors.md](../research/competitors.md), sections 9 to 12. Internal reasoning, not for the video.

| Rivals show or claim | Our video does |
|---|---|
| Size: "most popular AI game builder", "10M monthly players", "1.5M apps built" | No size claims. We have no users, testimonials or published games yet (PRODUCT.md, "Absent, and not to be made up"). |
| Viral games made by users, "I quit my job" stories | One game made on camera, with the clock running. |
| One-shot magic. The press already mocks it. | Build, then change by chat, then undo: "iterate until it is yours". |
| Games that stay on their own site, or a web page only | The second half is leaving the browser: an Android app, a share link, the downloadable project. This is our lane. |
| A hidden bill (credits burned on the AI's own errors is the top complaint) | The price is on screen before and after every message, and a failed build costs nothing. |

## 2. Before you record: what must be true

| # | Must be true | It blocks | If it is not true |
|---|---|---|---|
| 1 | The app is open on typeplay.app (beta), with the real AI (not the fake agent), and Google sign-in works. Record on the live address: the address bar is part of the proof. | everything | Do not record yet. |
| 2 | You built your exact sentence once on a Free test account and wrote down the minutes and the credits (the "about N" before, the final line "Fast, N credits, version 1" after). | every number | Say no number you did not read off the screen. |
| 3 | Android works on the live server: [parked #14](../parked.md) is done (the key is made, the phone test is done, Play Protect's real wording is read) and the APK time is measured there. You have an Android phone (an emulator works if a caption says so). | the Android beats | Short: replace beat 7 (see section 3). Long: skip section 7, say "Android: coming", and drop title ideas 3 and 5 in section 7. |
| 4 | A Medium test account for the Android shots. Ask Claude to put the account on Medium with the admin plan command (no payment) and back to Free after. Put "Medium plan" in a caption. | the Android beats | - |
| 5 | Sharing works: open the link in a private window, and paste it in a messenger to see the preview card. | the share beat | Skip the beat. |
| 6 | The gallery is open and holds games made by other people. | one sentence | Skip the gallery sentence. |
| 7 | Racer and tower defence are no longer marked "coming" on /create. | any talk of "four kinds" | Say "runners and puzzles today; racers and tower defence next". |
| 8 | The site says what the video says: the 10-18 build is deployed (parked #1: new plans, "Your game is yours"), and the page-copy proposals you accepted are in ([page-copy-proposals.md](page-copy-proposals.md)). | posting | Do not post. A viewer who lands on a page that contradicts the video leaves. |
| 9 | Two spare Google accounts. A retake needs a fresh account: Free allows 5 credits a day, and deleting and re-making the same account does not help (its email is remembered for 90 days). | retakes | - |

**The Free plan's daily cap, in one line.** Free allows 5 credits a day, and Build is switched off when the price's low end is
above what is left today. The 10-17 "look finished" rules made new games cost 2 to 2.5 times more than the first measurements,
and the simple-game numbers in section 6 are from before them. If your sentence's price is above 5 credits, a Free viewer cannot
repeat your video in one day: use a simpler sentence, or tell Claude.

**If something fails on camera, keep it.** A message such as "Didn't work, not charged" is the honest part of the story. Say how
many tries it took. Never retake until you get a lucky build and hide the others.

## 3. The Short (60 seconds, vertical 9:16)

Title: "I typed 1 sentence. It made this game." Voice: none. Music: upbeat, no singing, starts on the first pop.

### The hook (0:00 to 0:03)

- **Picture:** shot S1 full screen: the finished first build (version 1) on a phone, a combo chain popping. No logo, no title
  card first.
- **Caption:** "I typed ONE sentence." Big, in the middle of the frame.
- **Why:** the payoff comes before the explanation, the promise is a number (one), and the open question is "how?".
- **Rule:** the game must be version 1. If it is the edited game, the caption is not true.

### Beat by beat

| # | Time | Sec | On screen (shot) | Caption | Sound |
|---|---|---|---|---|---|
| 1 | 0:00 | 3 | **Hook.** The game from one sentence, on a phone, a combo pops (S1) | "I typed ONE sentence." | The game's own pop, loud. Music starts on the first pop. |
| 2 | 0:03 | 6 | The sentence typing into the box on /create, then the click on "Build my game" (S2). Flash the price line (S3). | "This is what I typed." then "Free plan. About {2} credits." | Typing clicks. |
| 3 | 0:09 | 10 | The build, sped up: the chat's live lines and the clock counting up to {10:12} (S4). A chip: "Sped up". | "Real time: {10} min. Sped up." | A rising tick. |
| 4 | 0:19 | 8 | The game appears and plays on the computer for 3 s (S5, S6), then the same game on a phone for 5 s (S7). | "It plays in your browser." then "And on your phone." | The game's sounds. |
| 5 | 0:27 | 11 | You type the change into the chat, press Send, the clock runs (sped up), then a side-by-side: before and after (S8). | "Now I change it. By chat." then "{2} min later: night sky." | A swoosh on the reveal. |
| 6 | 0:38 | 6 | The Versions strip; Restore on version 1; "Playing now" moves (S9). | "Every change is a version." then "Go back any time." | A soft click. |
| 7 | 0:44 | 8 | Android pill, the APK building with its clock, the QR code, the phone scans it, the icon appears, the app opens (S11, S12). | "Make it an Android app." then "Paid plans. iOS, Steam: coming." | Quick cuts on the beat. |
| 8 | 0:52 | 4 | Share, Copy link, a friend's phone opens the link and the game plays (S13). | "Send a link. Anyone can play." | A send sound. |
| 9 | 0:56 | 4 | End card on ink (#170d33): "Type it. Play it." and "typeplay.app" large (S17). | "typeplay.app" then "Free to start. 13+" | Music ends on the beat. |

Fifteen caption cards in all, none over 6 words. Copy them into the editor in this order.

- **If it runs over 60 s:** cut beat 6 first, then beat 8, then shorten beat 3 to 7 s.
- **If Android is not live:** replace beat 7 with 8 s of phone play (S7) and the caption "Android app: coming."
- **Loop:** the last frame hands back to the hook (the game). Shorts replay; the end card should feel like a beat, not a stop.
- **Cover frame:** the finished game (S1).

### Post it

- **Description:** "Type a game idea. Play it in minutes. typeplay.app" / "Free to start (13+). 20 free credits a month. Android
  builds need a paid plan. iOS and Steam: coming." / "Made on the free plan with the Fast AI. The build took {10} min (sped up here)."
  / "I make TypePlay." Hashtags: #aigame #gamemaker #nocode
- **Pinned comment:** "I make TypePlay. What game should I build next? Write it as one sentence."
- **Hooks to test in a second Short** (same footage): "No code. One sentence. One game." / "{10} minutes. One sentence. One game."
  / "Watch a game get built. Real time."
- **More Shorts from the same footage:** (1) "An Android app from a sentence": S1, S11, S12, 25 s. (2) "What it really cost": S3, S5, S16, 20 s.
  (3) "Undo": S8, S9, 20 s. (4) "The build that failed": only if one failed on camera.

## 4. The long video (about 5:15)

Title: pick from section 7. Voice: yours, plain English, about 2 words a second. Read the script aloud once first and change any
word that is hard to say. Say "A-P-K" and "A-A-B" as letters. The same words appear as captions; the chips listed with each
section are the extra short labels on screen.

| # | Time | Section | Sec | Shots |
|---|---|---|---|---|
| 1 | 0:00 | Hook | 16 | S1, S2 |
| 2 | 0:16 | What TypePlay is | 20 | S17 (home page) |
| 3 | 0:36 | Type it, pick the AI | 32 | S2, S3 |
| 4 | 1:08 | The wait | 36 | S4 |
| 5 | 1:44 | Play it | 40 | S5, S6, S7 |
| 6 | 2:24 | Change it by chatting | 42 | S8, S9 |
| 7 | 3:06 | Android, on my phone | 46 | S10, S11, S12 |
| 8 | 3:52 | Google Play, honestly | 26 | S11 (the checklist) |
| 9 | 4:18 | Share it, own it | 24 | S13, S14, S15 |
| 10 | 4:42 | The bill and what to do | 34 | S16, S17 |

### 1. Hook (0:00 to 0:16)

- **First 3 seconds:** S1, the version 1 game on a phone, a combo pops. Caption: "{10} minutes ago, this didn't exist."
- **Then:** S2, the sentence typed (0:03 to 0:09); quick cuts of what is coming: the build clock, the night sky, the phone with the
  app icon, the QR code (0:09 to 0:14); a card "Real time. Real cost." (0:14 to 0:16).
- **Say:** "This game did not exist {ten} minutes ago. I typed one sentence. An AI built it. Now I will change it, put it on my
  phone, and send it to a friend. Real time. Real cost."

### 2. What TypePlay is (0:16 to 0:36)

- **On screen:** the typeplay.app home page: "Type it. Play it.", the prompt box, a slow scroll over the strip of test games, the
  platform dock (Web now; Android now only if live; iOS and Steam coming).
- **Say:** "This is TypePlay. I make it. You type the game you want. An AI builds it, and you play it in your browser. Then you
  change it by chatting. You do not write code. TypePlay is new, so I will only show what works today."
- **Chips:** "TypePlay. I make it." / "No code." / "Only what works today."

### 3. Type it, pick the AI (0:36 to 1:08)

- **On screen:** sign in with Google (cut it short), the Puzzle starter puts the sentence in the box (S2); then the three AI rows
  and the credits line (S3): Fast open with "about {2} credits", Smart and Best locked "On paid plans".
- **Say:** "I type my idea: a match-three puzzle game with cute fruit. Now I choose the AI. Fast is quick and cheap, good for
  simple games. Smart and Best are on paid plans. Next to the button I see the price before I start: about {two} credits. The free
  plan gives 20 credits a month, and 5 a day. I press Build."
- **Chips:** "Free plan. Fast AI." / "Price first: about {2} credits." / "20 free credits a month."

### 4. The wait (1:08 to 1:44)

- **On screen:** S4 sped up, the chat's live lines and the "building" clock readable at the start and the end; a chip "Sped up".
- **Say:** "Now we wait. A game takes minutes, not seconds. The AI writes the code, runs the game, and takes pictures of it to
  check it. You can leave the page. It keeps building. This one took {ten minutes}. A bigger game, with menus and levels, can take
  15 to 25 minutes on Fast. And if a build fails, you pay nothing."
- **Chips:** "Real time: {10:12}. Sped up." / "Bigger game: 15 to 25 min." / "Failed build: no charge."

### 5. Play it (1:44 to 2:24)

- **On screen:** S5 (the reply and its line "Fast, {1.9} credits, version 1"), S6 (play on the computer, with sound), S7 (the phone's
  browser).
- **Say:** "Here is the game. I match three, and they pop. It works. It is not perfect: {one real flaw you saw}. I can fix that by
  chatting. Now my phone. I open the same game in the phone's browser. It plays, but on some phones it is slower than on a
  computer. The Android app is the better way to play on a phone."
- **Chips:** "{1.9} credits. Version 1." / "Phone browser: can be slower."
- **Honesty:** if your phone is smooth, say so and drop "slower"; if it stutters, keep the stutter in the shot. Keep one real flaw
  either way. (The phone check is still open, [parked #8](../parked.md) and RESULTS.md.)

### 6. Change it by chatting (2:24 to 3:06)

- **On screen:** S8 (type, the price "about {0.3} credits", Send, the clock, the reveal, the before and after), then S9 (Versions,
  Restore on version 1, "Playing now").
- **Say:** "Now I change it, with words. I type: change the background to a night sky with stars. A Fast change is cheap: about a
  third of a credit. It took {two minutes}. Now the sky is night. Every change is saved as a version. If I do not like it, I press
  Restore on version 1. It comes back as a new version, so nothing is lost. Restoring costs nothing."
- **Chips:** "Change it by chat." / "About {0.3} credits." / "Every change is a version." / "Restore: free."

### 7. Android, on my phone (3:06 to 3:52)

- **On screen:** S10 (4 s: on the Free account, the panel "Android builds come with a plan."), a caption "Medium plan" as you
  switch accounts, S11 (set up, build the APK, the row turns Ready, the QR), S12 (scan, download, allow once, Play Protect, Install
  anyway, the icon, the app opens).
- **Say:** "Now the part I like: Android. Android apps come with the paid plans, from 20 dollars a month, and cost no credits. I
  press Android, set up the app, and build the APK. An APK is a file you install on your own phone. It took {40 seconds}. I scan
  this code, download the file, and install it. Android warns me, because the app is not from Google Play yet. I tap More details,
  then Install anyway. And here it is: my game, an app, with its own icon."
- **Chips:** "Free plan: no Android builds." / "Medium plan: 20 dollars a month." / "APK: {40} seconds." / "APK = a file for your
  phone." / "Not from Google Play yet: Install anyway." / "Paid plans: 18+, or a parent buys."
- **Honesty:** read Play Protect's real words from your phone; if they differ from the lines above, show and say the real ones.

### 8. Google Play, honestly (3:52 to 4:18)

- **On screen:** the "Putting it on Google Play" checklist scrolling, the "AAB for Google Play" button, the key card (never show
  the key's password or its download).
- **Say:** "To put it on Google Play, you need your own developer account. It costs 25 dollars, once, and you must be 18 or older.
  TypePlay gives you the file Google Play takes, called an AAB, your signing key, and a list of steps. You upload it yourself. iOS
  and Steam are coming. I will not give a date."
- **Chips:** "Your own Google Play account." / "$25 once. 18 or older." / "Newer accounts: 12 testers, 14 days." / "iOS and Steam: coming."

### 9. Share it, own it (4:18 to 4:42)

- **On screen:** S13 (Share, Copy link, the preview card in a chat, the share page opening), S14 only if the gallery is live, S15
  (More, Download the project, the .zip and its README).
- **Say:** "To share it, I turn on Share and copy the link. Anyone can play it, with no account. {Only if the gallery is live: If I
  want, I can also show it in the gallery. It stays off until I switch it on.} The game is mine. TypePlay takes no share of what it
  earns. And I can download the project as a zip file and open it in Godot, a free game engine."
- **Chips:** "Share: anyone can play." / "No account needed." / "Yours. No revenue share." / "Download the project (.zip)."

### 10. The bill and what to do (4:42 to 5:16)

- **On screen:** S16 (the chat header "{2.2} credits on this game"), then S17: the home page and the end card.
- **Say:** "This game cost {2.2} credits in all. On the free plan that is free: you get 20 credits a month. On Medium, 20 dollars
  for 100 credits, it is about {45} cents. It does not always work the first time. Results are partly luck. Try it at typeplay dot
  app. You must be 13 or older. Tell me in the comments which game to make next."
- **Chips:** "{2.2} credits in all." / "Free plan: 20 credits a month." / "Partly luck. Change it by chat." / "typeplay.app" /
  "13+. Free to start."
- **Call to action:** typeplay.app, spoken once and written big. One ask only: the comment (which game next).

## 5. The shot list: what you record yourself

Settings for every screen shot: the live site on the Free test account (the Medium account only for S10 to S12), Edge or Chrome
with a clean profile and no extensions, one tab, bookmarks bar off, browser zoom 125 to 150 percent so text reads on a phone,
notifications off, 1080p at 30 fps, desktop sound on. Hide your email: close the account menu before each shot. Phone shots: screen
recording with "show taps" on, Do Not Disturb on, a clean home screen.

| ID | Shot | How | Raw | Short | Long |
|---|---|---|---|---|---|
| S1 | The hook game: the first build (version 1) on a phone | Right after build 1 and before any change. Open the game on the phone (the share link works), play until a combo chain, record portrait with sound. Film it once more in hand. | 15 s | 1 | 1 |
| S2 | Typing the one sentence | Screen-record /create. Click the Puzzle starter once so the sentence appears (a second click gives the next example), or type it at normal speed. End on the click on "Build my game". | 25 s | 2 | 1, 3 |
| S3 | The AI choice and the price | Close-up: Fast open with "about N credits", Smart and Best locked "On paid plans", and the line with your credits left and "5 more today on Free". Hold each 3 s. | 10 s | 2 | 3 |
| S4 | The build progress | Start recording just before "Build my game" and keep going on the game page: the chat's live lines and the "building" clock. Do not click around. Fast takes about 8 to 12 minutes; record all of it. | 10 min | 3 | 4 |
| S5 | The game arrives | The finishing reply with its line "Fast, N credits, version 1", and the game appearing in the frame. | 30 s | 4 | 5 |
| S6 | Playing on the computer | 20 to 30 s of play with sound, make a combo. | 30 s | 4 | 5 |
| S7 | Playing on the phone's browser | Open the share link in the phone's browser and play. Screen-record the phone. Do not hide a slow frame rate. | 20 s | 4 | 5 |
| S8 | One change by chat | Type "Change the background to a night sky with stars." Show the price, press Send, keep the clock running, then the reveal. End with a 5 s side-by-side of version 1 and version 2. Test the sentence off camera first; spares: "Make the score text bigger." and "Add a sound when I match three." | 1 to 3 min | 5 | 6 |
| S9 | Versions and Restore | Open the Versions strip, press Restore on version 1, read the question, confirm, "Playing now" moves. Then restore the night sky again. | 20 s | 6 | 6 |
| S10 | Android on the Free plan | On the Free account press Android: the panel "Android builds come with a plan." | 5 s | - | 7 |
| S11 | Android on Medium: build the APK | Medium test account. Android, "Set up Android" (app name, the suggested package name, the game's picture as icon), "APK for your phone" with the clock on screen, wait for "Ready" and the green checks, press "Phone link" to show the QR. Then scroll the "Putting it on Google Play" card for 15 s (long video, section 8). Never show the signing key's download or its password. | 105 s | 7 | 7, 8 |
| S12 | The phone installs it | Phone camera app scans the QR on the monitor (record the phone's screen), download, allow your browser once, read Play Protect's real message, More details, Install anyway, open the app from the home screen. | 90 s | 7 | 7 |
| S13 | Sharing a link | Game page: Share, switch on, Copy link. Paste it in a chat on the phone (hide names), show the preview card, tap it, the game opens. A private window on the computer proves "no account". | 40 s | 8 | 9 |
| S14 | The gallery (only if live) | The second switch "Show it in the gallery", then typeplay.app/explore with the game in the list. | 15 s | - | 9 |
| S15 | Download the project | More, "Download the project", the .zip in the downloads folder, open it: README.txt and project.godot. | 20 s | - | 9 |
| S16 | The bill | The chat header "N credits on this game", then /account with the credit history. | 10 s | - | 10 |
| S17 | Home page and end card | The home page hero "Type it. Play it." with the prompt box. The end card is made in the editor: ink (#170d33) background, "Type it. Play it." and "typeplay.app" large, hot orange (#ff5a36) for the one action. | 10 s | 9 | 2, 10 |
| S18 | Your voice (long only) | Record last, from the script in section 4, sentence by sentence, two takes of each, in a quiet room. | 15 min | - | all |

### Recording order (about 4 hours; the builds run while you do other things)

1. **Prep, 30 min.** Clean browser profile, zoom, OBS scenes, phone ready, Free test account signed in, spare accounts listed.
2. **S2, S3, then start S4.** Press Build and let it run (8 to 12 min). Prepare the phone and the Medium account meanwhile; do not
   leave the page.
3. **Switch Share on and send the link to your phone, then S5, S6, S1, S7.** The game is done: play it, then the phone shots. Make sure S1 is version 1.
4. **S13**, the rest of it: paste the link in a chat, the preview card, a friend taps it (version 1 is the one to share first).
5. **S8, then S9.** The change takes 1 to 3 minutes; keep recording. Restore, then restore the night sky again.
6. **S16.** All the AI work is done, so the bill is final.
7. **S10, switch to Medium, S11, S12.** Switch accounts on camera or with a caption, not in secret.
8. **S14 (if live), S15.**
9. **S17, then S18** (voice last, so the numbers in your sentences are the real ones).

Editing in one line each: cut on the game's own sounds; every timelapse keeps its clock readable and carries a "Sped up" chip;
every caption card is on screen at least 2 seconds; the site's ink (#170d33) and hot orange (#ff5a36) are the only colours you add;
export the Short at 1080x1920 and the long video at 1920x1080.

## 6. Numbers: what we measured

From [RESULTS.md](../../packages/agent/RESULTS.md) (API cost divided by 0.06 dollars a credit) and [pricing.md](../pricing.md).
This is the range to expect, not what you say. You say what your take showed.

| What | Range | Where it comes from |
|---|---|---|
| A simple game on Fast: minutes | 7.5 to 12 | Runner 7.7 to 10.2, match-3 10.4 to 11.8, "Sea Buddies" 7.5, 3D town 11.8 (10-13 and 10-17) |
| A simple game on Fast: credits | 1.2 to 3.5 (0.07 to 0.21 dollars of AI) | Same runs |
| A simple game on Smart: minutes, credits | 1.6 to 9 min; 3 to 8 credits | Runner 1.6 min (0.16 dollars); with the genre skill 3.6 to 5.6 min (0.30 to 0.49); box push 8.8 min |
| A bigger game on Fast (menus, levels) | Racer 16.7 min, 6.3 credits; tower defence 25.4 min, 8.2 credits (16.6 min, 4.4 at low effort); ten-level match-3 23.5 min, 13 credits | RESULTS "10-17 night" |
| A bigger game on Smart | Racer 6.9 min, 13 credits; tower defence 9.7 min, 18 credits | Same |
| A bigger game on Best | 15 to 26 min; 51 to 69 credits | "Big games", Opus on the same two prompts |
| One change on Fast | 1.1 to 2.6 min; 0.1 to 0.5 credit (usually 0.3) | RESULTS, edits |
| Eight changes in a row | 0.063 dollars in all, about 1 credit | RESULTS, 10-12 |
| Android: the APK | "Usually under a minute" on the page; 5 to 8 s in the WSL test | android.ts, PLAN.md |
| Android: the AAB | The page says 2 to 4 minutes; 36 to 44 s in the WSL test | Same. Measure it on the live server first |
| Free plan | 20 credits a month, up to 5 a day, Fast only, no export | site.ts |
| Medium | 20 dollars a month, 100 credits; Android builds cost no credits; 1 credit is 20 cents | pricing.md |

**The warning.** The first three rows are from before the 10-17 night "look finished" rules, which made new games cost 2 to 2.5
times more because they do more. Your take on the exact sentence is the only number that counts. If it is far above the range,
tell Claude: it may mean the price shown next to Build is too low, which matters more than the video.

## 7. Five title and thumbnail ideas

Rules for all: at most 3 words of text on a thumbnail; one focal thing (the phone with the game); high contrast; the site's ink
(#170d33) and hot orange (#ff5a36) so it looks like TypePlay; no other company's logo, no fake play button, no face needed. Titles
under about 60 characters so they do not get cut on a phone. Every number in a title comes from your take. Score the titles in
vidIQ (you have it) before you choose, and test two thumbnails with YouTube's Test and Compare if your channel has it.

| # | Title | For | Thumbnail | True only if |
|---|---|---|---|---|
| 1 | I Typed One Sentence. This Game Appeared. | Long | Left: the sentence in the prompt box, large. Right: a phone with the game in a combo. Text: "1 SENTENCE" in hot orange on ink. | The game is version 1, from exactly that sentence. |
| 2 | AI Made This Game in {10} Minutes (Real Time) | Long | The build clock "{10:12}" big over the chat lines; the finished game small on a phone. Text: "REAL TIME". | The clock number is your take's. |
| 3 | From One Sentence to an Android App on My Phone | Long | A hand holding the phone, the app's icon on its home screen, a small QR code in a corner. Text: "MY OWN APP". | Android is live and you installed the APK in the video. |
| 4 | I Made a Game With AI. It Cost {2} Credits. | Long | The credits counter "{2.2} credits" next to the game. Text: "{2} CREDITS". | The credits are the chat header's number, on the Free plan. |
| 5 | 1 Sentence. 1 Game. Now on My Phone. | Short | No custom thumbnail; the cover frame is the finished game (S1). The captions carry the message. | Android is live. If not: "1 Sentence. 1 Game. Play It Free." |

## 8. After you upload

- **Caption file:** upload the English .srt made from the "Say" lines, so viewers can pick their own language.
- **Long video description** (edit the numbers to your take):
  "I typed one sentence and an AI built this game. Then I changed it by chatting and put it on my phone. Real time, real cost.
  Try it: typeplay.app (free to start, 13 and older)." Then the chapters: 0:00 One sentence, one game / 0:16 What TypePlay is /
  0:36 Typing the idea / 1:08 The wait / 1:44 Playing it / 2:24 Changing it by chat / 3:06 Android on my phone / 3:52 Google Play,
  honestly / 4:18 Share it, own it / 4:42 What it cost (move the times to match your edit). Then: "Free plan: 20 credits a month,
  up to 5 a day, the Fast AI, no Android builds. Paid plans start at 20 dollars a month, plus tax where it applies; Android builds
  need a paid plan and use no credits. Google Play needs your own developer account (25 dollars once, 18 or older). iOS and
  Steam: coming. I make TypePlay."
- **Pinned comment:** "I make TypePlay. Which game should I build next? Write it as one sentence."
- **Check the live site the same day:** the pricing and home pages say what the video says (gate 8), and the free plan really
  builds the video's sentence from a fresh account.
- **Do not reply to claims you cannot back.** If someone asks for iOS or Steam, say "coming, no date". If someone asks "any
  game?", say "runners and puzzles today, racers and tower defence next (all four once they are open); other ideas can work, results vary".
