# Proposed text for the public pages (for Luka's website review)

Written 2026-10-19. Nothing here is on the site: every block is a proposal for your review. "Now" is the text in the repo today
(checkpoint 3), which is newer than the live typeplay.app (the 10-16 build; the new plans and "Your game is yours" wait for your
"deploy", [parked #1](../parked.md)). The voice is the site's: short, plain, no hype, no em dashes, US dollars, no dates, and
"now" only for what works ([PRODUCT.md](../../PRODUCT.md)). Numbers come from [RESULTS.md](../../packages/agent/RESULTS.md) and
[pricing.md](../pricing.md). The launch video ([demo-video.md](demo-video.md)) assumes the pages say what is proposed here.

## Start here

**Where the pages and the product disagree today (fix these first)**

1. ~~**The Free plan's "small TypePlay badge in your game".**~~ **Built 2026-10-20**: Free builds show "Made with TypePlay" while
   they load and a small tab on the game's right edge; paid builds have none ([apps/games/README.md](../../apps/games/README.md),
   "The Free plan's mark"). The Free card, the terms and pricing.md now match the product.
2. **Version history looks like a Medium perk** (A3). The app gives Restore to every plan.
3. **"As often as you like" for Android builds** ([android.ts](../../apps/web/src/content/android.ts)). The API stops at 10 builds a
   game and 30 an account a day (C5).

**Decisions only you can make**

- **Terms, D1 and D2.** "Download the whole project any time" is a promise, so the terms must carry it before any page says it
  (D1). And with share pages and a gallery the terms must let TypePlay show your players' games (D2). Both are short texts below.
- **A3:** version history on every plan (the copy follows the app) or locked on Free.
- ~~**The badge** (above): build it or drop it.~~ Built 10-20.

## How the proposals are marked

| Mark | Meaning |
|---|---|
| **Any time** | True today. Can go in the next site deploy. |
| **With the app** | Only when the app is open (beta): share pages, the download and version history exist only then. The live site has no app yet. |
| **With the gallery** | When /explore is open and holds games made by other people. |
| **With Android** | Only when Android is live ([parked #14](../parked.md)). |
| **With racer + tower defence** | When the two starters on /create stop saying "coming". |
| **Terms first** | Needs a change in `legal.ts` and your yes before any page uses it. |

## All proposals at a glance

| # | Page | What | When |
|---|---|---|---|
| A1 | Pricing FAQ | What a credit costs: "simple" games, and what a bigger game cost in our tests | Any time |
| A2 | Home, "You pick the AI" | Build times for bigger games | Any time |
| A3 | Pricing cards | Version history on every plan | With the app (your decision) |
| A4 | Search description | Say "coming" for platforms that are not live | With the app, then with Android |
| B1 | Pricing, Free card | A share link and the project download | With the app |
| B2 | Home, the games strip | A link to the gallery | With the gallery |
| B3 | Pricing FAQ (new) | Who can see my game? | With the gallery |
| B4 | Share page | "Make your own game." with the real build time | With the app |
| B5 | Pricing FAQ (new) | Can I download my game? | With the app |
| C1 | Home dock, pricing | Android "coming" becomes "now" (you agreed) | With Android |
| C2 | Home, "One game. Every screen." | What each platform really gives you | With Android |
| C3 | Medium card, home teaser | Android apps, no credits to build them | With Android |
| C4 | Pricing FAQ (new) | Can I put my game on Google Play? | With Android |
| C5 | Android page (app) | Fix "as often as you like" | With Android |
| D1 | Terms, then home and pricing | Download the whole project, in the terms first | Terms first |
| D2 | Terms (new section) | Sharing your games | Terms first |
| E1 | Home, "Made from one sentence each." | The kinds of game we are tuned for | With the app, then with racer + tower defence |
| E2 | /create starters | Sentences for Racer and Tower defence | With racer + tower defence |

## A. Any time: true today

### A1. Pricing FAQ: what a credit costs

**Page:** /pricing, FAQ "What is a credit?" ([pricing/page.tsx](../../apps/web/src/app/pricing/page.tsx); the typical numbers are in
`credits.typical` in site.ts).

**Now:**
> What a message costs. Each one spends credits for the work it does: usually about 0.3 for a Fast edit, 2 for a Fast new game, 7
> for a Smart new game and 17 for a Best one. The cost shows next to the send button before it runs, and a build that fails gives
> its credits back.

**Proposed:**
> What a message costs. Each one spends credits for the work it does: usually about 0.3 for a Fast edit, 2 for a simple Fast game,
> 7 for a simple Smart game and 17 for a simple Best one. A bigger game costs more: in our tests a racer or a tower defence on Fast
> took 6 to 8 credits, and a ten-level puzzle 13. The cost shows next to the send button before it runs, and a build that fails
> gives its credits back.

**Why:** After the 10-17 night "look finished" rules, new games do more and cost 2 to 3 times the old rows: a Fast racer was 6.3
credits, a Fast tower defence 8.2, a ten-level puzzle 13 (RESULTS.md "10-17 night"; pricing.md "Measured 2026-10-18"). The page
still says "2 for a Fast new game". pricing.md keeps the "usually" numbers until the beta measures real prompts; this only adds the
word that makes them true ("simple") and one honest sentence. The price next to the send button stays the real answer.

**When:** Any time. Your call: the numbers.

### A2. Home: how long a build takes

**Page:** Home, "You pick the AI, per message." ([page.tsx](../../apps/web/src/app/page.tsx): the three figure blocks and the end of the lead).

**Now:** Fast "new game 8 to 12 min / edit 1 to 3 min". Smart "new game 1.6 to 9 min / more credits than Fast". Best "new game about
8 min / most credits". The lead ends: "Numbers are from our test builds."

**Proposed:** Fast "new game 8 to 25 min / edit 1 to 3 min". Smart "new game 1.6 to 10 min / more credits than Fast". Best "new game 6
to 26 min / most credits". The lead ends: "Numbers are from our test builds: the short end is a simple game, the long end a big one
with menus and levels."

**Why:** The old ranges come from simple games. Measured since: Fast racer 16.7 min, tower defence 25.4 (16.6 at low effort),
ten-level puzzle 23.5; Smart racer 6.9, tower defence 9.7; Best (Opus) tower defence 15.1, ten-level puzzle 25.9. Someone who asks
for a tower defence on Fast would otherwise wait up to twice as long as the page says.

**When:** Any time. Your call: the ranges.

### A3. Pricing cards: version history

**Page:** /pricing, the Free and Medium cards (`plans` in site.ts).

**Now:** Free: "20 credits a month, up to 5 a day", "Fast builds and edits", "Unlimited play, and a link to share", "A small TypePlay
badge in your game". Medium has "No badge, and version history to undo any edit".

**Proposed:** Free gets a line: "Every change is a version you can go back to". Medium's line becomes "No badge".

**Why:** In the app, Restore is open to every plan (no plan check in the code) and costs no credits. It is the best answer to
"results are partly luck" (PRODUCT.md, principle 3). Today the Medium card makes it
look like a paid perk. Option B is to lock Restore on Free: more code, a worse free plan; not recommended.

**When:** With the app. **Luka decides:** A (copy follows the app) or B (lock it).

### A4. The search description

**Page:** the default description of every page and the home page's structured data ([seo.ts](../../apps/web/src/content/seo.ts), `description`).

**Now (184 characters; Google shows about 155):**
> Describe a game in one sentence. TypePlay builds it in a real game engine in minutes; you play it in the browser, change it by
> chatting, and ship it to the web, Android, iOS and Steam.

**Proposed, with the app (160 characters):**
> Describe a game in one sentence. TypePlay builds it in minutes. Play it in your browser, change it by chatting, share a link.
> Android, iOS and Steam are coming.

**Proposed, once Android is live (158 characters):**
> Describe a game in one sentence. TypePlay builds it in minutes. Play it in your browser, change it by chatting, share a link, or
> put it on your Android phone.

**Why:** Search results show this sentence. "Ship it to the web, Android, iOS and Steam" reads as available today; PRODUCT.md says
copy may promise a platform but must not say it is available before it is. The new lines put the useful words in the first 155
characters.

**When:** The first with the app, the second with Android.

## B. With the app: share pages, the gallery, the download

### B1. Pricing: the Free card

**Page:** /pricing, the Free card (`plans` in site.ts).

**Now:** "Unlimited play, and a link to share".

**Proposed:** two lines, "A share link anyone can open, no account needed" and "Download your project as a .zip".

**Why:** The share page and the download exist. "Unlimited play" says little: play runs on the player's device and costs us nothing.
The download on Free is one of your provisional calls (parked.md, "For Luka's website review": "allowed, the terms promise people
their own work"). A rival locks code export to its $50 plan (competitors.md). No "any time" here (see D1).

**When:** With the app. The download line needs your yes to that provisional call.

### B2. Home: a way into the gallery

**Page:** Home, under the strip of test games, "Made from one sentence each." ([page.tsx](../../apps/web/src/app/page.tsx)).

**Now:** nothing after the strip.

**Proposed:** one line with a link to /explore:
> More games, made by people. Explore the gallery.

**Why:** It shows that real people make games here, without quoting users we do not have (PRODUCT.md: users, testimonials and
published games are "not to be made up"). It gives the gallery an inside link, and it is "Better than the competitors" #9 in PLAN.md.

**When:** With the gallery, and only when it holds at least [6] games by other people (your number). Add "Explore" to the status bar at the same time
(parked.md: "No Explore in the status bar"). /explore stays noindex until you answer parked row 13.

### B3. Pricing FAQ (new): who can see my game?

**Page:** /pricing, "Good to know." (add a question).

**Proposed:**
> **Who can see my game?**
>
> Only you, until you share it. Sharing gives a link that anyone can open, with no account. Showing the game in the gallery is a
> second switch, off until you turn it on. Turn sharing off and the link stops working. Turn the gallery off and the game leaves
> Explore. Your chat and your ideas stay private.

**Why:** Teens and their parents will ask. It repeats the privacy policy's "Public games" and the Share menu's own words, on the page
that sells the product. Every statement is how the app behaves (unsharing makes the page 404 at once).

**When:** With the gallery. Needs D2 first.

### B4. The share page: "Make your own game."

**Page:** /play/<id> ([page.app.tsx](<../../apps/web/src/app/play/[id]/page.app.tsx>)).

**Now:**
> Type an idea in a sentence. TypePlay builds a real game you can play in a few minutes, and you change it by chatting.

**Proposed:**
> Type an idea in a sentence. A simple game takes about 10 minutes to build, and you change it by chatting. Free to start.

**Why:** "A few minutes" is a Smart build. A visitor who clicks here is a free user, and the free plan builds on Fast: 7.5 to 12 minutes
for a simple game. The same promise the home page makes ("8 to 12 min").

**When:** With the app.

### B5. Pricing FAQ (new): can I download my game?

**Page:** /pricing, "Good to know." (add a question).

**Proposed:**
> **Can I download my game?**
>
> Yes, on every plan. The project comes as one .zip with all its files, and it opens in Godot, a free game engine. It is the game as
> it is now; the version history stays here. It is yours: change it, publish it, keep what it earns.

**Why:** A rival (Gambo) shut down on 2026-05-01 and deleted every user's games; another locks code export to its $50 plan
(competitors.md). The app does it on every plan: More menu, "Download the project"; the .zip has a README that says how to open it
([download.ts](../../apps/server/src/games/download.ts) skips the version history, Godot's cache and the builds).

**When:** With the app. This is the feature statement. Do not write "any time" until D1.

## C. With Android

### C1. Android "coming" becomes "now"

**Page:** the home page's dock and ship section, via `platforms` in site.ts.

**Now:** Android: "coming".

**Proposed:** Android: "now".

**Why:** You agreed (parked.md, "For Luka's website review": "at the Android go-live: fine"). Listed here so the switch happens with
C2 to C4 and A4, not alone.

**When:** With Android: after the go-live items in parked #14 (the key made, the phone test, one real APK and AAB on the live server).

### C2. Home: "One game. Every screen."

**Page:** Home, the ship widget ([page.tsx](../../apps/web/src/app/page.tsx)).

**Now:**
> Every game is a real Godot project, so the same game exports to the web, Android, iOS and Steam. We make the build; you publish
> it on your own Google or Apple developer account, under your own name. Next on the list: connect your Google Play account once
> and publish from TypePlay in one click.

**Proposed (short lines, one per platform):**
> Every game is a real Godot project, so one game can reach every screen.
>
> **Web.** Send a link and anyone can play it in a browser, with no account.
>
> **Android.** TypePlay makes an app file for your own phone (an APK) and the file Google Play takes (an AAB), signed with a key
> made for your game.
>
> **iOS and Steam.** Coming.
>
> You publish on your own Google or Apple developer account, under your own name. Later: connect your Google Play account and
> publish from TypePlay in one click.

**Why:** It says what each platform gives you today. "Publish in one click" was the one sentence that is not built (parked #15), so it
moves to the end as "Later". Plain words for APK and AAB are the ones the Android page uses.

**When:** With Android (the Web line with the app). Until then keep the current text.

### C3. Medium card and the home teaser

**Page:** /pricing and Home, the Medium card and the plan teaser (`plans` in site.ts; [page.tsx](../../apps/web/src/app/page.tsx)).

**Now:** Medium: "Export to Android, iOS and Steam as each one arrives". Teaser: "20 free credits a month on Fast, played in the
browser. The Medium plan is $20 a month for Smart builds and exports."

**Proposed:** Medium: "Android apps now, with no credits to build them. iOS and Steam as each one arrives". Teaser: "20 free
credits a month on Fast, played in the browser. The Medium plan is $20 a month for Smart and Best builds and Android apps."

**Why:** "Exports" is vague. pricing.md: exports cost no credits on paid plans, so the $20 buys the Android app on top of the AI.

**When:** With Android.

### C4. Pricing FAQ (new): can I put my game on Google Play?

**Page:** /pricing, "Good to know." (add a question).

**Proposed:**
> **Can I put my game on Google Play?**
>
> Yes, from any paid plan. TypePlay builds the file Google Play takes (an AAB) and an APK you can install on your own phone, both
> signed with a key made for your game, and checks the file for the things Google Play looks at. Building costs no credits. You
> upload it from your own Google Play developer account: $25 once, and you must be 18 or older. A newer personal account also
> needs 12 testers for 14 days before it can go public. iOS and Steam are coming.

**Why:** It is the first question after the word "Android", and it states the parts nobody likes to say up front: your own account,
the fee, the age, the testers. All of it is what the Android page's checklist already tells the user
([android.ts](../../apps/web/src/content/android.ts)). It also keeps the promise honest: we make the file, you upload it.

**When:** With Android.

### C5. The Android page: "as often as you like"

**Page:** /games/<id>/android, the Free-plan panel (app text, [android.ts](../../apps/web/src/content/android.ts) `plan.text`).

**Now:**
> Free is for making and playing in the browser. Every paid plan builds Android apps, as often as you like, for no credits.

**Proposed:**
> Free is for making and playing in the browser. Every paid plan builds Android apps for no credits, up to 10 builds a game a day.

**Why:** The API stops at 10 builds per game and 30 per account per day ([android.service.ts](../../apps/server/src/android/android.service.ts)),
and the hub already says "That's today's builds for this game". "As often as you like" is not true at the limit.

**When:** With Android.

## D. Terms first

### D1. Download the whole project: the terms, then the pages

**Page:** /terms, "Your games are yours" ([legal.ts](../../apps/web/src/content/legal.ts)); then the "Your game is yours." box on Home and
Pricing (`ownership` in site.ts).

**Now:** The terms say you own your games and we take no share. They say nothing about downloading; the only link is "You can
close your account at any time; your games can be exported first." The ownership box has three points, none about the download
(the comment in site.ts says why: "the terms don't promise that yet").

**Proposed terms sentence** (a last paragraph in "Your games are yours"):
> You can download the whole project of any of your games as a .zip, on every plan, whenever no build is running. It opens in
> Godot, a free game engine, and holds the current version of your game; the version history stays with TypePlay.

**Optional second sentence** (it binds you, so it is only yours to decide):
> If we ever stop TypePlay, we will tell you at least [30] days before, and you can download your games until then.

**Proposed fourth point in the ownership box:**
> Download the whole project whenever you like, and open it in Godot.

**Why:** "Download the whole project any time" is PLAN.md's "Better than the competitors" #1, and Gambo, which shut down on 2026-05-01
and deleted every user's games, is the reason it sells. It is a promise, so the terms carry it first. The sentence says what the app
really does: a .zip of the current version (not the history), blocked while a build runs
([download.ts](../../apps/server/src/games/download.ts); the API also says 409 during an Android build). The optional sentence is the
Gambo lesson in one line.

**When:** Terms first, and your yes. Until then B5 and B1 say "download", never "any time".

### D2. Sharing your games: a new section in the terms

**Page:** /terms, a new section after "Your games are yours" (`legal.ts`).

**Now:** The terms say you own your games and bar sharing games that break the rules. Nothing lets TypePlay host and show a game to
other people, and nothing says we can take one down. The privacy policy's "Public games" says what is shown, not on what right.

**Proposed** (heading "Sharing your games"):
> A game is private until you share it. When you share it, anyone with the link can play it, and we show its name, its start screen
> and its number of plays on its page and in link previews. If you also switch on the gallery, we list it on typeplay.app/explore.
> You can switch either off at any time. You keep all rights in your game; you only let us host and show it for these purposes
> while it is shared. Anyone can report a game. We can take a game out of the gallery, or remove it, if it breaks these terms, for
> example after reports.

**Why:** The app has share pages, a gallery and a "Report this game" button (three open reports take a game out of the gallery by
itself; its link keeps working). A site that shows users' games needs the permission to show them and the right to remove them. The
wording is yours (and your accountant's or a lawyer's, if you want it read).

**When:** Terms first, and before the share pages and the gallery open to the public (beta 1).

## E. The kinds of game

### E1. Home: what we are tuned for

**Page:** Home, "Made from one sentence each." ([page.tsx](../../apps/web/src/app/page.tsx)), the lead.

**Now:**
> Test games from our builds, exactly as the AI made them, with the sentence that made each one. Tap one to see it.

**Proposed, until racers and tower defence are open** (add after the lead):
> TypePlay is tuned for endless runners and puzzles today. Racers and tower defence are next. Other ideas can work, but the results
> vary more.

**Proposed, with all four:**
> TypePlay is tuned for four kinds of game: endless runners, puzzles, racers and tower defence. Other ideas can work, but the
> results vary more.

**Why:** PRODUCT.md: "Genres first, 'any game' later". The genre skills are why the result is reliable (RESULTS.md: with the skill 4
of 4 runners had the good patterns; without it they came and went). The four names are also what people search for. "Vary more" keeps
us honest about other ideas (a 3D car town works, it is just not a tuned kind).

**When:** The first with the app; the second with racer + tower defence: both starters open on /create and at least one racer and
one tower-defence showcase game on the home page (parked #14).

### E2. /create: sentences for Racer and Tower defence

**Page:** /create, "Or start from a kind of game" (`starters` in [content/app.ts](../../apps/web/src/content/app.ts)).

**Now:** Racer and Tower defence are `ready: false`, with no example sentences; the tiles say "coming".

**Proposed sentences** (the prompts we measured, so their cost and time are known):
> Racer: Make a racing game where I drive a car around a track against 3 other cars, 3 laps, with a finish screen.
>
> Tower defence: Make a tower defence game with a start menu and 3 levels where the enemy waves get harder and harder. I want 4
> tower types with different strengths that I can upgrade, money for every kill, lives I lose when enemies get through, and a win
> and a lose screen.

**Measured** (RESULTS.md "10-17 night"): racer on Fast 16.7 min, 6.3 credits; on Smart 6.9 min, 13 credits. Tower defence on Fast
25.4 min, 8.2 credits (16.6 min, 4.4 at low effort); on Smart 9.7 min, 18 credits.

**Check before you flip them:** Free allows 5 credits a day, and Build is off when the price's low end is above what is left today.
A Fast racer or tower defence may not fit a Free day. Try both on a Free account first; if they do not fit, the tile needs a plain
note ("needs about 6 credits") or a smaller sentence.

**When:** With racer + tower defence.

## When a feature goes live: what to switch

For Claude, when you say the word. Each line is the set of proposals that flip together.

| Event | Switch | Also |
|---|---|---|
| Any time | A1, A2 | Re-check the numbers against RESULTS.md after the beta's real prompts |
| Terms approved | D1 (terms sentence, then the ownership point) | B5 and B1 may then say "whenever you like" |
| Before the share pages go public | D2 | |
| The app opens (beta 1) | A3, A4 (first), B1, B4, B5, E1 (first) | (The Free-plan badge is built, 10-20) |
| The gallery holds games by others | B2, B3 | "Explore" in the status bar; answer parked row 13 (noindex) |
| Android is live | C1, C2, C3, C4, C5, A4 (second) | Set `platforms` Android to "now"; the demo video's Android beats unlock |
| Racers and tower defence open | E1 (second), E2 | Showcase games on the home page (parked #14); test them on a Free account |

## Not proposed, on purpose

- **The hero** (headline, prompt box, hint): they do the job, and "Play first" says nothing should come between the sentence and the game.
- **Any claim about size**: users, games made, testimonials. We have none (PRODUCT.md: "not to be made up").
- **"Any game"**, model names, the AI maker's name, rival names. Comparisons belong on later "TypePlay vs X" pages, with sources.
- **iOS and Steam dates**, and **"publish in one click"** as a present feature (parked #15). It stays "Later".
- **"Try another version"** (PRODUCT.md lists a re-roll button): the app has only "Try again" after a failed first build.
- **Sliders for numbers, or "playable while it builds"**: not in the app. (RESULTS.md says a Fast core is playable at about 5 to 7
  minutes, but the preview appears when the build ends.)

## Checked against

The repo on 2026-10-19: [site.ts](../../apps/web/src/content/site.ts), [seo.ts](../../apps/web/src/content/seo.ts),
[legal.ts](../../apps/web/src/content/legal.ts), [android.ts](../../apps/web/src/content/android.ts),
[app.ts](../../apps/web/src/content/app.ts), the home, pricing, share and gallery pages, the Share, Versions and More menus, the
server's restore, download and Android limits, [RESULTS.md](../../packages/agent/RESULTS.md), [pricing.md](../pricing.md),
[competitors.md](../research/competitors.md) and [parked.md](../parked.md). No code was changed.
