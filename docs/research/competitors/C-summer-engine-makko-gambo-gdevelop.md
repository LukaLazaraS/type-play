# C. Engine-based competitors: Summer Engine, Gambo, Makko (+ GDevelop, Buildbox, other Godot AI)

Research date: **2026-10-16**. Every figure is tagged **FACT** (source + date seen) or **ESTIMATE** (method shown).
"Seen 2026-10-16" means I fetched the live page or API on that day.

**Limit on this research:** the WebSearch budget (shared across all research agents, 200 per turn) ran out partway through.
After that I only fetched primary sources directly (company sites, their public JSON/APIs, GitHub, npm, Steam, Discord invite API, RDAP/whois).
So the hunt for Reddit, Hacker News and X quotes was thinner than planned. Gaps are marked "not found" with where I looked.

---

## TL;DR for TypePlay

| | Summer Engine | Gambo | Makko |
|---|---|---|---|
| Status (2026-10-16) | Active, shipping fast | **Shut down 2026-05-01**; domain is now a GoDaddy parking page | Active, small |
| What it is | Desktop AI game engine, Godot 4-compatible (proprietary, closed source) | Browser prompt-to-game, Phaser (JS), 2D | Browser art studio + code studio, Phaser (JS), 2D |
| Store exports | Yes, but the user runs them locally (Steam/desktop/web; mobile needs the user's own toolchain and signing) | No (web on Gambo, code export on Pro) | No (web share link, GitHub push, art export) |
| Cheapest paid plan | Pro $20/mo; "Build complete games" is Pro+ $60/mo | Pro $25/mo (2,000 credits) | Starter $20/mo (Creator $50/mo is "Popular") |
| Traction signal | Discord 1,039; npm CLI 7,734 downloads/month; 11 games on its store | Discord **17,018** (still up) | 4,500+ users at launch (Apr 2026); Discord 269 |
| Threat | **Medium, could become High** | None as a product; a lesson | **Low-Medium** |

**Main finding:** no product found combines all three of TypePlay's pillars:
1. Runs in the browser with zero install, for non-developers.
2. Uses a real engine (Godot).
3. Does the store builds in the cloud (Android/iOS).

The pairs are taken:
- **Summer:** real engine + store exports, but a desktop app for developers.
- **Makko and Gambo:** browser + non-developers, but JS/Phaser, web only.
- **GDevelop:** browser + store exports, but its AI builds features, not whole games.

Caveat: the three searches the brief named ("AI Godot game generator", "Godot AI agent", "vibe code Godot") were not run, because the budget ran out. The list of Godot tools below comes from Summer's own competitor pages plus direct checks of those sites.

---

## 1. Summer Engine (summerengine.com)

### 1.1 Identity
- **URLs:** summerengine.com (site), docs.summerengine.com (docs), summer.games (its own game store), github.com/SummerEngine (open CLI/MCP), discord.gg/summerengine.
- **Legal entity: FACT.** "Summer Labs, Inc., a Delaware corporation with offices at 2810 N Church St, STE 89812, Wilmington, DE 19802" (a registered-agent address). The footer reads "Summer Engine ApS, a Summer Labs, Inc. company", so there is a Danish ApS subsidiary.
  - Sources: [summerengine.com/terms](https://www.summerengine.com/terms) and summer.games terms, seen 2026-10-16.
  - The Delaware parent plus Danish subsidiary structure is typical of a YC/US-VC "flip".
- **HQ:** Denmark and San Francisco.
  - FACT: founder's GitHub says "Denmark & SF" ([github.com/mathias-heide](https://github.com/mathias-heide)); the GitHub org location is "Denmark" (GitHub API, 2026-10-16).
  - FACT: his LinkedIn location is "San Francisco Bay Area" ([linkedin.com/in/mathiasheide](https://www.linkedin.com/in/mathiasheide/), via search snippet, 2026-10-16).
- **Founder: Mathias Heide.**
  - Copenhagen Business School (LinkedIn).
  - X bio: "Building a game engine… Creator of 'Don't Pray' on Steam" ([x.com/MathiasHeide](https://x.com/MathiasHeide/status/2078231589436465199)).
  - Personal site heide.ai. Also an open-source handheld AI assistant project, "clawdboy".
  - Contact is founders@summerengine.com, which suggests more than one founder, but no co-founder was found.
- **Team size: ESTIMATE 2-5 people.**
  - Method: the open repo SummerEngine/summer has 4 contributors: mathias-heide (469 commits), frozaken (78), "claude" (16), one other (1). The GitHub org has 1 public member (GitHub API, 2026-10-16).
  - PR bodies say "Generated with Claude Code", so they build heavily with Claude.
  - LinkedIn company page: not reachable (404 to the fetcher).

### 1.2 Age and timeline
- **Discord server created 2025-03-11.** FACT, decoded from the guild ID snowflake (Discord invite API, 2026-10-16). This is the earliest trace.
- **summerengine.com registered 2025-08-26.** FACT ([whois.com](https://www.whois.com/whois/summerengine.com), GoDaddy). The GitHub org was created the same day (2025-08-26).
- **X account @SummerEngineCom ~Aug 2025.** ESTIMATE: a search snippet showed the page as "about 416 days old".
- **summer.games registered 2026-01-17.** FACT (RDAP, Identity Digital/GoDaddy).
- **Don't Pray** (their own 3D PvP magic shooter, "Summer Game Studio"):
  - Launch tournament 2026-01-22.
  - Steam release **9 Feb 2026** (FACT, [Steam appdetails API](https://store.steampowered.com/app/4176260/Dont_Pray/)).
- **2026-02-26:** npm package `summer-engine` and the GitHub repo were created (FACT, npm registry and GitHub API).
- **~May 2026:** submitted to Product Hunt. Not featured, 0 upvotes, #112 (FACT, [hunted.space](https://hunted.space/dashboard/summer-engine), seen 2026-10-16).
- **2026-06-19:** PeerPush listing, 1 upvote (FACT, [peerpush.com](https://peerpush.com/p/summer-engine)).
- **2026-07-17:** founder post that Kimi-K3 built a paper-plane game "in 27 minutes… one shot". The agent "playtested itself… took screenshots, read the logs, fixed its own bugs" ([X](https://x.com/MathiasHeide/status/2078231589436465199)).
- **2026-08-19:** frontrun.vc lists Summer Engine as **YC F26 (Fall 2026)**, "not yet in the YC directory" as of its 2026-09-25 update ([frontrun.vc](https://www.frontrun.vc/blog/yc-f26-companies-full-list)).
  - **Not confirmed:** ycombinator.com/companies/summer-engine returned 404 on 2026-10-16.
- **2026-09-05:** "AI Game Console Hackathon" at Antler, Copenhagen (search snippet of summerengine.com). This does not prove Antler backing.
- **2026-10-07:** multiplayer shipped in Summer Engine **0.7.0**.
  - Summer runs a server per match, with matchmaking, parties, leaderboards and Elo ranked queues; a "World" holds up to 1,024 players.
  - FACT, [summerengine.com/llms-full.txt](https://www.summerengine.com/llms-full.txt), 2026-10-16.
- **2026-10-09:** the docs were repositioned with "**No GDScript or Godot on the home page and key pages**". It is now "a full 2D and 3D engine with native C++ and C#… built for AI agents" (FACT, [SummerEngine/docs PR #21](https://github.com/SummerEngine/docs/pull/21), merged 2026-10-09).
- **2026-10-11 to 10-16:** CLI 3.5.1 adds Summer Games MCP for 26 agents; Summer 4.0 and MCP/CLI 4.0; npm latest is **4.3.0** (FACT, npm registry, 2026-10-16).

### 1.3 Money
- **Funding:**
  - **YC F26 per frontrun.vc only** (see above). No amount, valuation or lead investor found.
  - Not found on: the YC directory (404), the press page ([summerengine.com/press](https://www.summerengine.com/press): none listed), and a "Summer Engine raises" web search (no results).
  - Crunchbase/Tracxn: not checked, because the search budget ran out.
- **Revenue / ARR / paying users:** not found. Looked at: the press page, llms-full.txt, founder X posts (via search), and the Zekai and Stork reviews.
- **Pricing.** FACT, [summerengine.com/pricing](https://www.summerengine.com/pricing), seen 2026-10-16:

  | Plan | Price | What it includes |
  |---|---|---|
  | Free | $0 | "5 free AI messages a day, up to 30 a month". Free MCP connection; manual editor use and export |
  | Pro | **$20/mo** | Full hosted Summer AI, frontier models, 3D/image/audio/video generation, private projects |
  | Pro+ ("Recommended") | **$60/mo** | "**Build complete games** with Summer's hosted AI", 3× limits, MCP skills and hooks |
  | Ultra | **$200/mo** | 20× limits, priority, personal support |

  - A yearly toggle exists but no yearly prices are shown.
  - Used credits are non-refundable; unused purchases can be withdrawn within 14 days.
  - Earlier pricing (Stork.ai, refreshed 2026-05-21) listed a **Basic $5/mo** plan and a "$3 startup bonus", so pricing has changed at least once ([stork.ai](https://www.stork.ai/en/summer-engine)).
  - No royalties on exported games.
  - **Summer Games store split: creators 70%, Summer 30%** (FACT, llms-full.txt).
  - Summer Games sells a virtual currency, "Sparks". The terms cover App Store purchases, which implies a Summer Games iOS app.
- **Cost of one complete game on the cheapest paid plan: not computable from public data.** Summer does not publish Pro's cap in messages or credits. Data points:
  - Free starter tokens built a rough playable prototype in **~13 chat exchanges** (FACT, [note.com/fond_tabsyo](https://note.com/fond_tabsyo/n/n66a24ed13f46), 2026-09-22).
  - Summer's own plan copy reserves "Build complete games" for **Pro+ $60/mo**.
  - Flagship claim: Don't Pray (3D multiplayer) shipped in 2.5 months by "a small team for **$2,000 in AI credits**" (company claim, llms-full.txt).
  - **ESTIMATE:** the realistic entry price for a complete game, by Summer's own framing, is **$60/month**. Pro at $20 is positioned for assisted building.

### 1.4 Users and traction
- **Discord: 1,039 members, 182-187 online.** FACT, Discord invite API, 2026-10-16. A search snippet days earlier showed 983, so it is growing.
- **X @SummerEngineCom:** follower count not retrievable (x.com blocks fetches). Bio says "Join our small community on discord".
- **YouTube @SummerEngine: 12 subscribers.** FACT, via yt-dlp, 2026-10-16.
- **GitHub SummerEngine/summer** (MIT CLI/MCP/skills): **77 stars, 6 forks**. FACT, GitHub API, 2026-10-16. The engine itself is closed source ("free to download, closed source for now").
- **npm `summer-engine`: 7,734 downloads in the month to 2026-10-12, of which 5,635 in the week 10-06 to 10-12.** FACT, npm API. This spiked with the 4.0/multiplayer release; npm counts include CI and bots.
- **Summer Games store:** 11 published game pages + 16 "upcoming" in its sitemap. FACT, [summer.games/sitemap.xml](https://summer.games/sitemap.xml), 2026-10-16.
- **Don't Pray on Steam: 6 user reviews (5 positive), free-to-play, 0 concurrent players** at the moment checked. FACT, Steam API, 2026-10-16. The flagship proof game has little traction.
- **Product Hunt:** 0 upvotes, not featured (see timeline). **PeerPush:** 1 upvote.
- **Traffic:** Stork.ai shows "Monthly visits: 6.8K" (third-party, undated; treat as weak). Similarweb is left to the main researcher.
- **Content claims (company):** 130+ templates across 12 genres; 130,000+ assets in its store; 54 generation models; hosted MCP with 20 tools / 320 operations (llms-full.txt, 2026-10-16).

### 1.5 Product
- **Desktop app**, not browser: native installers for Apple-silicon macOS and Windows.
  - Its own tagline: "Real software on your machine… not a browser tab you rent" (summerengine.com/ai-game-engine, via search).
  - Web builds are published to summer.games for players.
- **Engine:** "AI-native engine compatible with Godot 4".
  - Projects are standard `.tscn/.gd/.tres` and "open in vanilla Godot". It "follows upstream continuously", currently the **4.6.1** line with **4.7.1** next (llms-full.txt), slightly behind Godot 4.7.2.
  - It is proprietary and closed source; the site avoids saying "fork".
  - It now markets native C++ and C# too.
- **What you type and get:** you chat in the editor. The Summer Agent operates the live editor through a local bridge (localhost:6550): it creates nodes, writes GDScript, runs the game, reads errors and screenshots, and fixes them.
  - External agents connect by MCP/CLI (`npx summer-engine setup`): Claude Code, Codex, Cursor, Copilot and others, 26-29 clients listed ([GitHub README](https://github.com/SummerEngine/summer)).
  - "Summer Apps": the agent builds internal tools (balance tables, playtest boards) for a team workspace.
- **2D and 3D.**
- **AI models:**
  - Chat: the FAQ says "Claude, GPT-5, Gemini, Meshy, ElevenLabs, and more. Choose your models in settings" ([docs FAQ](https://docs.summerengine.com/essentials/faq)). Paid tiers add "premium models like Claude Opus". The founder promotes Kimi-K3.
  - Assets: 54 models (Veo 3.1, Seedance 2.0, Kling 3.0, GPT Image 2.5, FLUX.2, Hunyuan 3D 3.1 Pro, Meshy 7.1, ElevenLabs v3) (llms-full.txt).
- **Time to first playable:** the founder claims "under 30 minutes, one shot" (Kimi-K3, a paper-plane game). A user got a rough prototype in 13 exchanges.
- **Iteration:** chat in the editor, plus manual editing in a Godot-like UI. Ctrl+Z reverts AI changes.
- **Export targets** (FACT, homepage and docs FAQ):
  - Windows, macOS, Web (HTML5/WASM), Steam, itch.io and Summer Games.
  - iOS/Android "require that platform's toolchain and signing", and "iOS requires Mac and Apple Developer account". **The user does mobile builds locally, not in the cloud.**
  - Consoles go through porting partners.
- **Asset generation:** yes, the broadest of the three (3D, image, audio, music, video, voice), via "Summer Studio" (cloud).
- **Multiplayer:** yes, hosted (since 2026-10-07).
- **Creator monetization:** Summer Games store (70/30); "Grow" analytics (store views, launches, sessions, playtime).
- **Community:** Discord; game jams ("Summer Jam 1", 3 days); a hackathon with Arduino and Antler.
- **Privacy:** "Privacy Mode stops us using your code to train our models, and is **available on paid plans**… off by default" (docs FAQ). **Free users' code may be used for training.**

### 1.6 Quality: what users say
- **note.com (Japanese user, 2026-09-22), positive:**
  - "I was surprised that I could do this much with the free version."
  - The prototype was rough (unclear HP and dash gauges); no asset images.
  - Notes that manual edits are "better" because they don't consume tokens ([link](https://note.com/fond_tabsyo/n/n66a24ed13f46)).
- **Stork.ai review (2026-09-25), complaints summarized from users** (unattributed): "high token consumption for minor changes", "erratic AI behavior and inconsistent responses", and that it is mainly an "AI wrapper for Godot" ([link](https://www.stork.ai/en/summer-engine)).
- **Zekai review, 6.1/10 (updated 2026-08-06):**
  - Sub-scores: Ease 7.0, Accuracy 5.8, Value 5.8, Time saving 5.6.
  - "The main trade-off is the reliance on usage-based AI credits in paid tiers."
  - "Its Godot 4 compatibility is a major strength, preventing vendor lock-in" ([link](https://zekaiwork.com/ai-tools/summer-engine/)).
- **Company testimonials** (self-selected): "This tool has made game making so much more accessible to me." (BJ Games); "This is the tool I have been looking for." (Deulde) ([summerengine.com](https://www.summerengine.com/)).
- **Hacker News:** **not found.** A WebSearch for "Summer Engine" Hacker News returned only Summer's own pages. HN Algolia was not queried (search budget).
- **Reddit:** **no real threads found.** Searched "Summer Engine" reddit godot AI; only Summer's own blog came back.
  - Summer's own account of Reddit: "r/gamedev is skeptical by default. r/godot wants to know if it touches a real engine." It also says r/godot users "trust AI on their GDScript more than they trust an AI operating their scene tree" ([summerengine.com/blog/best-ai-game-maker-reddit](https://www.summerengine.com/blog/best-ai-game-maker-reddit)).

### 1.7 Go-to-market
- **Tagline:** "The AI game engine for people and agents." The title is "The AI Game Engine" (homepage, 2026-10-16). The X tagline is "making it as fun to make games as it is to play them."
- **Audience:**
  - Meta tag: "game developers, indie creators, game studios, beginners, non-coders".
  - In practice, developers with a desktop: the copy targets "the solo dev shipping a serious 3D game over 12 months" as the flagship user (llms-full.txt).
- **Channels:**
  - **Massive SEO and LLM-SEO content.** llms-full.txt is about 2.5 million characters, and there are many "Summer vs X" pages (Ziva, Quasar, Cursor + Godot, Unity), "best AI for Godot" and "best AI game maker according to Reddit" posts, plus per-model pages.
  - MCP distribution inside 26+ agent clients.
  - Discord, game jams, the founder's X.
  - A "Trusted by people from" logo strip (Activision etc.).
- **Partnerships:** Arduino (hackathon), Antler Copenhagen (venue).

### 1.8 Assessment for TypePlay
**Threat: MEDIUM, could become HIGH.** It is the only competitor on the same engine (Godot) with real native exports, and it ships weekly. It is not in TypePlay's lane today:
- Desktop install.
- A Godot-style editor UI.
- The user handles mobile toolchains and signing.
- Its pitch has moved toward serious devs and studios (C++/C#, multiplayer, AAA language).

It becomes HIGH if Summer adds a browser prompt-to-play front door. It already has the pieces: `summer publish-web`, hosted AI, and its own store.

**Copy:**
1. **Visual self-playtest.** The agent runs the game, takes screenshots, reads logs and fixes. TypePlay already test-runs builds; add screenshot-based checks (the "paper plane is black, should be white" fix).
2. **An own play portal with publishing, analytics and a revenue split** (summer.games, 70/30, "Grow" stats). TypePlay's typeplay.dev could become a public gallery with play counts.
3. **SEO/LLM-SEO machine:** comparison pages, an llms.txt, per-genre and per-model pages. This fits TypePlay's Next.js SEO decision.

**Beat:**
1. **Zero install plus cloud store builds.** Summer needs an Apple-silicon Mac or Windows PC, plus local Android/iOS toolchains (a Mac for iOS). TypePlay: type, play in the browser, download an APK/AAB.
2. **Price per complete game.** Summer reserves "complete games" for $60/mo and its free tier is 5 messages/day. Users complain about token burn on small changes. TypePlay's measured Haiku build of $0.07-0.12 and Sonnet build of $0.16 (API cost) leave room for a generous $20 plan.
3. **Trust and privacy.** Summer trains on free users' code unless they pay for Privacy Mode. TypePlay can promise no training on anyone's projects. Summer's consumer marketing is also weak: 0 PH upvotes, 12 YouTube subscribers, and its showcase game has 6 Steam reviews.

---

## 2. Gambo (gambo.ai): shut down 2026-05-01

### 2.1 Identity
- **Product:** Gambo, "The World's First Game Vibe Coding Agent", "Build Games That Earn Revenue from Day One" (Wayback copy of gambo.ai, 2026-04-13).
- **Legal entity: Dora Platform Pte. Ltd., Singapore.** FACT: gambo.ai terms ("developed and operated by Dora"), via search snippet; [sgpgrid.com](https://sgpgrid.com/company-details/dora-platform-pte-ltd).
  - UEN 202238316D, incorporated **2022-10-28**.
  - 60 Paya Lebar Road #12-03, Singapore 409051.
  - Share capital SGD 10,000; directory lists revenue "< 1m" and 5 officers.
- **Team** (per a Qiita post citing Product Hunt; one source, unverified):
  - Will Choo (co-founder and Product Chief), Faye Zheng (Head of Design), Peng Rui (Engineer).
  - Charles Liu (former Head of Product, ex-ByteDance).
  - The post cites Chinese-language media saying the product team is from Beijing.
  - Prior Dora product: "Dora AI" (AI website builder, on Product Hunt) ([qiita.com](https://qiita.com/n_hiraoka/items/029c3f7df2bca3507288), 2025-10-01).
- **Team size:** not found. The sgpgrid directory lists 5 officers.

### 2.2 Age and timeline
- **2025-08-08:** gambo.ai registered (FACT, RDAP Identity Digital; .ai creation dates are preserved, cross-checked with character.ai = 2018).
- **2025-08-26:** Discord server created (FACT, guild snowflake via Discord API).
- **2025-09-23:** public launch on X (search snippet of @gambo_ai_tool) and first full Wayback snapshot. TechPilot says 2025-10-11.
- **Pricing in late 2025 to early 2026:** Free (1 game, 100 credits, preset prompts only); Pro $25/mo.
- **~early April 2026:** shutdown notice. FACT, [Gambo Notion notice](https://dolomite-apartment-b0f.notion.site/Gambo-will-be-shutting-down-on-May-1-2026-33309680815f80aa856ddacdf542e37c), read via Notion's public page API 2026-10-16; archived 2026-04-08. The notice says:
  - "We've made the difficult decision to discontinue Gambo."
  - Editing ends **2026-04-07**; subscriptions auto-cancel with refunds of unused credits.
  - **Accounts and data deleted after 2026-05-01**; an export guide is provided.
  - No reason given.
- **By 2026-10-05:** gambo.ai serves a **GoDaddy parking lander** (FACT, live check 2026-10-16: `window.LANDER_SYSTEM="PW"`, `ap:"parking"`; Wayback 2026-10-05).

### 2.3 Money
- **Funding: not found.** Looked at: WebSearch "Gambo.ai funding" and "Dora Platform Gambo funding" (no results), sgpgrid, and the Qiita post. The SGD 10,000 paid-up capital suggests no large priced round in that entity.
- **Revenue / paying users:** not found.
- **Pricing.** FACT, Wayback of gambo.ai/pricing, 2026-02-25:
  - **Free $0:** "Create 1 game for free", "100 credits for game editing". The free plan allowed only preset prompts (note.com).
  - **Pro $25/mo:** "2000 credits / month" + "1500 extra credits first month". Adds image, VFX/animation, tileset, SFX and BGM generation, custom domains, "Remove the Gambo badge", "**Export the project code**".
  - **Enterprise:** custom (SSO, integrations).
  - Annual billing advertised "2 Month Free".
- **Cost of one game on Pro.** FACT inputs from [note.com/tank_ai](https://note.com/tank_ai/n/na96d1c39a7af), 2025-11-08:
  - A tower-defence game (Standard mode) took about **600 credits** in ~15 minutes.
  - A puzzle game (Professional mode) took about **1,200 credits**.
  - One tileset cost 125 credits; one character image cost 55.
  - **ESTIMATE:** at $25 / 2,000 credits = $0.0125 per credit, a game costs **$7.50 (TD) to $15 (Professional)**. With the first-month bonus (3,500 credits) it is $4.30 to $8.60.

### 2.4 Users and traction
- **Discord: 17,018 members, 523 online, still live on 2026-10-16.** FACT, Discord invite API (invite discord.gg/5RG9WCcGNs from the Gambo site). That is the biggest community of the three, built in about 7 months, and now orphaned.
- **X:** @gambo_ai_tool; follower count not retrievable.
- **Product Hunt:** not found. producthunt.com/products/gambo is an unrelated 2022 betting app.
- User and game counts: not found.
- Example games on the homepage: "Fries at the Dock", "Naruto: Ninja Adventure" (IP-infringing), "Tennis Match" (local multiplayer), "Market Match" (match-3), "Tank Battle", "CEO x Cleaner: Forbidden Love" (dating sim), "Bet You Won't Last a Minute" (roguelike). Each card had **Remix** and **Play Now** buttons.

### 2.5 Product (historical)
- **Browser app.** Prompt, then a playable 2D game, then iterate in chat.
- **Engine: Phaser (JavaScript).** FACT: the client contains agent tool strings "Searching Phaser API…" (Wayback HTML, 2026).
  - Also Supabase-migration and git-commit/restore UI strings, i.e. a bolt.new-style coding agent.
  - Supabase integration for database and login (search snippets).
- **AI models:** not disclosed. Two modes: Standard and Professional (Professional is about 3× the credits, better assets).
- **Assets:** generated animations, VFX, roles, tilesets, maps, objects, BGM and SFX, plus a **map editor**.
- **Exports:** games hosted on Gambo; Pro adds custom domain and **project code export**. No Android/iOS/Steam builds (BeyondPlay: "Games stay on Gambo's own platform", [beyondplay.xyz](https://www.beyondplay.xyz/blog/beyondplay-vs-rosebud-vs-gambo), 2026-03-22).
- **Monetization:** "Insert ads in just one prompt. Built-in ads from top ad networks… Monetize your game from day one."
- **Multiplayer:** no infrastructure, local only (BeyondPlay).

### 2.6 Quality: what users said
- **note.com/tank_ai (2025-11-08):**
  - The TD game was "fully functional" (money, lives, waves), but later waves were "broken" because you can spam units.
  - Enemies first failed to spawn; fixed by pasting console errors into chat.
  - Credits "disappear in no time"; watching them drain was "nerve-wracking".
  - Don't expect "perfect one-shot generation".
- **TechPilot (updated 2026-10-14):** "a perfect prototype, but not a finished product". A football test game had "extremely basic" gameplay with no opposing AI ([techpilot.ai](https://techpilot.ai/tools/gambo-ai/)).
- **Qiita security review (2025-10-01):** rated "1: extremely dangerous" (opinion piece), because prompts and outputs could be used for training and cached responses could leak ideas across users ([qiita.com](https://qiita.com/n_hiraoka/items/029c3f7df2bca3507288)).
- **Reviews (multiple directories):** works best for 2D platformers; weak at RPG/3D; limited customization.

### 2.7 Go-to-market (historical)
- **Positioning:** "World's first Game Vibe Coding Agent" plus "earn revenue from day one".
- **Audience:** non-coders, Japan/Asia-heavy coverage (many Japanese reviews), game jams, classrooms.
- **Channels:** Discord-first (17K), a remix gallery, AI tool directories, X.

### 2.8 Assessment for TypePlay
**Threat: none as a product (dead).** Two uses:
1. **Opportunity:** about 17K Discord members and its paying users lost their tool in April 2026. TypePlay could court them ("export-first, you own a real Godot project, it won't vanish"). Gambo's deletion of all data on shutdown is a fear TypePlay can address by design: users own the git repo and can download the project.
2. **Lesson.** The shutdown reason is not stated. ESTIMATE from the evidence:
   - Web-only Phaser games locked to the platform, so no reason for creators to pay long-term.
   - Expensive asset generation (55-125 credits per image or tileset) eating a $25 plan.
   - IP-infringing showcase games.
   - A thinly capitalised entity.

**Copy:**
1. A **Play / Remix gallery** on the homepage.
2. **Monetization from day one.** Ads via one prompt; for TypePlay, AdMob in Android exports is a natural paid feature.
3. **Discord-led community** that reached 17K fast.

**Beat:** real engine and real store builds; projects that outlive the company (downloadable Godot project with git history); transparent, cheap per-game cost.

---

## 3. Makko AI (makko.ai)

### 3.1 Identity
- **URLs:** makko.ai, blog.makko.ai, play links at makko.ai/play/<token>, support@makko.dev.
- **Legal entity:**
  - "Makko AI, Inc." (FACT, press release 2026-04-20, [Yahoo Finance copy](https://finance.yahoo.com/sectors/technology/articles/makko-launches-ai-powered-2d-070100635.html) / [GlobeNewswire](https://www.globenewswire.com/news-release/2026/04/20/3276723/0/en/makko-launches-ai-powered-2d-game-studio-with-over-40-000-game-assets-created-in-beta.html)).
  - The site's structured data says "**Makko Labs, Inc**", foundingDate "2024" (FACT, makko.ai HTML, 2026-10-16).
- **HQ:** Seattle, WA (FACT, press release dateline; [GeekWire Startup Radar](https://www.geekwire.com/2026/startup-radar-seattle-area-founders-use-ai-for-medical-records-gaming-mortgages-search-and-more/), 2026).
- **Founders** (FACT, [makko.ai/about](https://www.makko.ai/about); [blog team post](https://blog.makko.ai/the-team-behind-makko-ai-amazon-pax-and-a-different-vision-for-game-development/), 2026-03-20):
  - **Jeremy Bird:** CEO and CTO, "10+ year Amazon veteran" (gaming and Prime Video). Previously Founder and CTO of Halogen AI; Amazon MGM Studios, Forevr Games, Evomail (LinkedIn/Crunchbase snippets).
  - **Tony Valcarcel:** co-founder, CMO / Head of Product and Marketing, "15+ years in games & marketing". Ex-marketing lead at Shrapnel; digital marketing director at Convoy.
  - **Mike Fehlauer (Hayes):** co-founder, Head of Ops and BizDev, helped create **PAX (Penny Arcade Expo)**.
  - Crunchbase also lists Kyle McCool and David Reid as co-founders (snippet).
- **Team size: 1-10** (Crunchbase snippet, [crunchbase.com/organization/makko-ai](https://www.crunchbase.com/organization/makko-ai)).

### 3.2 Age and timeline
- **2024:** foundingDate in the site's structured data. But the blog says "founded 2025", and the press release says the team formed ~7 months before April 2026 (about Sep 2025).
- **2025-06-18:** Discord server created (FACT, snowflake).
- **2025-10-06:** makko.ai registered (FACT, RDAP Identity Digital; Name.com).
- **Beta:** 3,000+ people, then "nearly 4,000" (blog, 2026-03-20).
- **~Apr 2026:** a co-founder posted crossing "100+ DAU for the first time" (search-result snippet, likely LinkedIn; not opened, so treat as unverified).
- **2026-04-20:** public launch, press release and **Product Hunt: 105-106 upvotes, #11 of the day, featured** (FACT, [hunted.space](https://hunted.space/dashboard/makko-ai), [producthunt.com/products/makko-ai](https://www.producthunt.com/products/makko-ai), 2026-10-16).
- **2026-10-13:** the subscription tier table was last updated (see pricing).

### 3.3 Money
- **Funding: not found.** Crunchbase has a funding page, but it is paywalled. The press release and blog mention none.
- **Revenue / ARR:** not found.
- **Pricing.** FACT, read from the public tier data that renders [makko.ai/pricing](https://www.makko.ai/pricing) (`subscription_tiers`, updated 2026-10-13) and the top-up plan endpoint, seen 2026-10-16:

  | Plan | $/mo ($/yr) | Weekly AI chat credits | Monthly art credits | Coding models (credits per message) |
  |---|---|---|---|---|
  | Free | 0 | 70 | 150 | GPT-6 Luna (1), Claude **Haiku 5.5 (2)**, Gemini 3.8 Flash (3), MiniMax, Kimi K2.x, Qwen |
  | Starter | **20** (200) | 500 | 1,000 | + GPT-6.1 Sol (6), Kimi K3 (6) |
  | Creator ("Popular") | **50** (500) | 1,500 | 3,000 | + Claude **Sonnet 5.5 (8)**, Sonnet 5 |
  | Hobbyist | 100 (1,000) | 3,000 | 6,000 | + Claude **Opus 5.5 (15)**, Opus 5, GLM |
  | Pro | 200 (2,000) | 6,000 | 13,000 | + Sonnet 4.6, Opus 4.8; "new models first" |

  - All tiers get an "unlimited fallback model" once the weekly budget runs out.
  - Free tier: animations "Lite, 720p" and art generations one at a time. Paid: up to 1080p, unlimited simultaneous generations, and "Export every asset off-platform" (paid only).
  - **Top-up packs, which never expire:** $5 = 200, $10 = 420, $25 = 1,100, $50 = 2,350, $100 = 4,800, $250 = 12,500 credits. About $0.025 per credit at the smallest pack.
  - Action costs: AI coding "from 1 credit per message"; character concept "from 1"; props/backgrounds "from 1"; **sprite animations "from 45 credits"**.
  - Animation models: Veo 3.1 and an "omni" model.
  - **Its $20 / $50 price points are the same as TypePlay's.**
- **Cost of one game on Starter ($20/mo). ESTIMATE**, assuming a small 2D game needs:
  - ~40 coding messages on GPT-6.1 Sol: 40 × 6 = **240 chat credits** (about half of one week's 500).
  - 1 character + 3 animations (≥ 45 each = 135) + ~10 props/backgrounds (≥ 1 each): about **150-250 art credits** of the 1,000 monthly.
  - So the art budget caps out at about 4-6 such games a month: **~$3.50-5 per game at full use, realistically $10-20 per game** at 1-2 games a month.
  - Sonnet 5.5 (the closest to TypePlay's default) needs the **$50 Creator** plan. At top-up prices, one Sonnet message is about $0.20 and one Opus message about $0.375.

### 3.4 Users and traction
- **At launch, 2026-04-20** (FACT, company press release): **4,500+ users**, **40,000+ art assets**, **3,500+ games/prototypes**, **53% 30-day retention**.
- **Discord: 269 members, 63 online** (FACT, Discord invite API, 2026-10-16).
- **YouTube @makkoai: 952 subscribers** (FACT, yt-dlp, 2026-10-16).
- Also has r/Makkoai, TikTok @makkoai, Instagram makko.ai and X @makkoai. Counts not retrievable (blocked).
- **Product Hunt:** 105-106 upvotes, #11 of the day, 167 followers, 1 review (5.0).
- No app store or Steam presence.

### 3.5 Product
- **Browser app** with two studios:
  - **Art Studio:** concept art, characters with 3-view reference sheets, backgrounds, props, sprite animations (Idle/Run/Jump/Attack), up to 8 variations per pass. Styles: HD Pixel, Comic Book, Chibi, Painterly.
  - **Code Studio:** a chat agent builds the game from your own art, with **Plan Mode** (review a plan first) and **Fast Mode** ([blog launch post](https://blog.makko.ai/makko-ai-is-live-make-2d-games-with-ai-no-drawing-no-coding/)).
  - Plus "Sound Studio" (listed in the plan matrix).
- **Key feature: "Collections"** set a visual direction once, and every asset inherits the style.
- **2D only.** Makko's own blog says if you want 3D "look further down this list".
- **Engine:** **Phaser (HTML5/JS)**. FACT from the client code: its game-preview error handler special-cases "phaser is not defined" (makko.ai JS, 2026-10-16).
- **AI models:** multi-vendor, user-picked per message (table above): Claude Haiku/Sonnet/Opus 5.5, GPT-6/6.1, Gemini 3.8 Flash, Kimi, MiniMax, Qwen, GLM. Images via GPT Image (X post, per search); animation via Veo 3.1.
- **Time to first playable:** "playing your first game in minutes" (PH launch post). A testimonial says "2-3 hours" with Makko vs "2-3 days" coding.
- **Exports:** a public **web play link** (makko.ai/play/<token>) with play and view counts; **GitHub connection** (push the project to a repo); art asset export (paid). **No Android/iOS/Steam/desktop builds found.**
- **Multiplayer:** not found. **Creator monetization:** "publish and monetize however you choose", no revenue share. **Community:** published-games list, Discord, quests (in-app quest/claim endpoints).

### 3.6 Quality: what users say
- **PH review (5.0):** "Makko's approach to keeping game art visually consistent across collections is brilliant". The reviewer would "love to see support for more art styles beyond pixel art" ([PH](https://www.producthunt.com/products/makko-ai)).
- **PH comment (Priya K):** pixel art "that actually looks good and isn't just a blurred mess". She asked whether it understands tilesets.
- **PH comment (Dayal Punjabi):** asked how it handles iterative, playtest-driven refinement. No answer visible.
- **Independent Reddit/HN/YouTube reviews: not found.** Search budget exhausted after the first queries. Most coverage is the company's own blog and press release.

### 3.7 Go-to-market
- **Tagline:** "Make 2D game art and playable games. No drawing. No coding." "The AI-powered 2D game studio that starts with art."
- **Audience:** idea people without art or coding skills; indie creators.
- **Channels:** GlobeNewswire press release, Product Hunt (promo code "ProductHunt", 10-15% off), GeekWire, SEO blog ("7 Best No-Code Game Makers in 2026", "Best AI Game Makers (2026)"), Reddit and Google Ads attribution scripts (redditAttribution, googleAdsAttribution bundles), TikTok/YouTube.
- **Partnerships:** PH launch-team logos show AWS, Claude Code and Vercel. PAX network via its co-founder.

### 3.8 Assessment for TypePlay
**Threat: LOW-MEDIUM.**
- Same price points ($20/$50) and the same "pick your model" idea.
- But 2D Phaser web games only, no store builds, art-first workflow.
- Small community: 269 on Discord, ~100 DAU in spring.
- Experienced founders (Amazon, PAX) and good PR craft.

**Copy:**
1. **A transparent per-message model price list** (Haiku 2 / Sonnet 8 / Opus 15 credits) plus an **unlimited fallback model** when the budget runs out, so nobody hits a wall mid-build. This maps directly onto TypePlay's Fast/Smart/Best choice.
2. **Style lock ("Collections")** for TypePlay's code-drawn art: a per-project palette and style spec every edit inherits.
3. **Plan Mode vs Fast Mode,** and **top-up credits that never expire.**

**Beat:**
1. **Native Android (and later iOS/Steam) builds.** Makko has none.
2. **Sonnet on the $20 plan.** Makko gates Sonnet behind $50 and Opus behind $100. TypePlay's measured $0.16 Sonnet build allows it.
3. **No art-credit drain.** Code-drawn art costs nothing extra, while Makko's animations cost 45+ credits each.

---

## 4. GDevelop (gdevelop.io): short section

- **Company:** **GDevelop Ltd** plus **GDevelop France SAS** (FACT, [terms](https://gdevelop.io/page/terms-and-conditions), 2026-10-16). CEO **Florian Rival**, CTO Clément Pasteau; 9 named staff on [about-us](https://gdevelop.io/page/about-us).
- **Age:**
  - GitHub repo 4ian/GDevelop created **2014-06-29** (FACT, GitHub API).
  - gdevelop.io registered **2021-11-18** (FACT, whois.com).
  - Founding date of the company: not found.
- **Funding / revenue:** not found (no searches left).
- **User base:**
  - Total user count not stated on the site.
  - **GitHub 27,616 stars** and **YouTube 144,000 subscribers** (FACT, GitHub API and yt-dlp, 2026-10-16).
  - Jam numbers: BIG Game Jam #9 had **2,200+ participants, 410+ games** (blog, 2026-06-05); jams total "over 2,700 games" (blog, 2026-06-30).
  - Showcase games: SPECTRUM "Played over 5,000,000 times on the web", Vai Juliette! "over 1,000,000 mobile downloads" (homepage).
- **What the AI does today:**
  - An **AI Agent inside the editor** "creates the object, adds the behavior, writes the event logic, and places it in the scene". It is explicitly **not** "an instant 'make my whole game' button" ([blog 2025-10-09](https://gdevelop.io/blog/make-games-with-ai-agent-gdevelop-automated-prompt)).
  - The pricing page says it can "build a feature in your game, answer a question or even start a game from scratch".
  - It also has an AI chat tutor.
  - Models: not named.
  - Positioning against AI-only tools: "Why use GDevelop when you can just use AI?" ([blog 2026-06-30](https://gdevelop.io/blog/why-use-gdevelop-when-you-can-use-ai)).
- **Export targets:**
  - Web (gd.games, unlimited), Android/Google Play, **iOS** (Gold+), desktop (Windows/macOS/Linux), Steam. One-click **cloud builds**.
  - Built-in free multiplayer (lobbies up to 8 players).
  - The editor runs **in the browser** as well as on desktop.
- **Pricing:**
  - AI credits (FACT, [gdevelop.io/pricing](https://gdevelop.io/pricing), 2026-10-16): Free 40/month, Silver 200/week, Gold 1,000/week, Pro 3,000/week.
  - Prices (FACT, GDevelop's public pricing API as served to a Georgian IP, "tier2" regional prices): **Silver $6.49/mo ($43.99/yr), Gold $10.99/mo ($74.99/yr), Pro ("startup") $32.99/mo ($329.99/yr)**, Education $2.29/user/mo.
  - US price: Silver "from $7.99/month" (TechPilot, 2026-10-14).
- **Threat: MEDIUM.**
  - The cheapest path to real store builds (iOS too), a huge community, a browser editor, and an agent that is creeping toward "start a game from scratch".
  - Weakness: event-sheet logic and a teaching-heavy UI. The AI is an assistant inside a full editor, not a "type → play" product.
  - Watch for a prompt-to-game mode.

## 5. Buildbox (buildbox.com): short section

- **Company:** footer "**AppOnboard, Inc**" (FACT, [buildbox.com/portfolio/buildbox-ai-4](https://www.buildbox.com/portfolio/buildbox-ai-4/), ©2025). buildbox.com was registered 1999-08-17 (whois; the company dates from much later).
  - Founding/acquisition dates: not verified in this session.
  - Funding/revenue: not found.
- **Signs of decline:** on 2026-10-16, **www.buildbox.com redirects (302) to signup.buildbox.com** (a bare "Welcome to Buildbox" app shell), and **/pricing/ returns 404**. The "Buildbox AI 4" page is only a video, with a download link pointing to Buildbox 3.
- **User base:** **YouTube 88,300 subscribers** (FACT, yt-dlp, 2026-10-16). Other counts not found.
- **What the AI does:** "AI Assistant", "**AI Code Edit**", "Advance[d] Placement Tools", metered in "AI Tokens". That is assistant-level, not prompt-to-full-game (FACT, plan definitions in the signup app JS, 2026-10-16).
- **Plans in the signup app** (FACT, live JS bundle, 2026-10-16; may include legacy SKUs):
  - Free: 2D+3D, 1 world, 20 scenes.
  - Beginner: $49.98/mo, "Preview Only", 200 AI tokens/week.
  - Basic: $180/yr, 5 worlds, 50 scenes, "Unlimited Exports to Android and PC", 200 AI tokens/month.
  - Pro: $549.98/yr, unlimited worlds/scenes, 350 AI tokens/month, AI Code Edit; also a $219.99/yr upsell price.
  - "You keep 100% of all App Store Revenue."
- **Export targets:** Android and PC listed in the plans. iOS: historically via Xcode, not confirmed in the current plans.
- **Threat: LOW.** A legacy no-code engine with a thin AI layer and a neglected web presence.

---

## 6. Other AI-in-Godot products found

Built from Summer's competitor pages ([best-ai-for-godot](https://www.summerengine.com/blog/best-ai-for-godot), [summer-vs-quasar](https://www.summerengine.com/blog/summer-vs-quasar), both 2026-06-06, updated Sep 2026) plus direct site checks on 2026-10-16. The named searches ("AI Godot game generator", "Godot AI agent", "vibe code Godot") were **not run** (search budget).

| Product | What it is | Notes (FACT unless marked) |
|---|---|---|
| **Ziva** ([ziva.sh](https://ziva.sh/)) | AI agent **plugin inside stock Godot 4.2+** (Unity beta), by **Zivash Inc.** | Hobby free (bring your own Claude Code/Codex or local models); Basic **$20/mo** with hosted models; Pro/Ultra add a "Playtest Agent". ~20 models incl. Claude Haiku/Sonnet/Opus 5.5. Generates sprites, textures, 3D; hosted multiplayer and analytics. Says it doesn't train on your code. |
| **EngineForge** ([engineforge.ai](https://engineforge.ai/)) | **Desktop** app (Mac Apple-silicon/Windows): "start a new Godot game or open your Unity or Godot project" with an AI "Crew" (Maestro, Builder, Juicer, Systems Smith, Playtester) | Desktop builds only; Paddle is merchant of record; v0.0.38+ changelog; pricing not shown. |
| **GDAI MCP** ([gdaimcp.com](https://gdaimcp.com)) | Paid Godot MCP plugin | "$27" appears on the site (not verified as the price). |
| **Open-source Godot MCP servers** | Bridges Claude Code/Cursor to a live Godot editor | [Coding-Solo/godot-mcp](https://github.com/Coding-Solo/godot-mcp) **6,115 stars**; [ee0pdt/Godot-MCP](https://github.com/ee0pdt/Godot-MCP) **620 stars**; bradypp/godot-mcp 90 stars (GitHub API, 2026-10-16). |
| **Godot AI Suite** ([itch.io](https://marcengelgamedevelopment.itch.io/godot-ai-suite)) | Editor add-on that exports the whole project as context for an AI agent | Indie, itch.io. |
| **Nitrode** ([nitrode.com](https://www.nitrode.com/)) | Was an AI game engine (YC W25, CEO Ben Kim, SF) | **Pivoted.** Now "the evaluation, data, and post-training layer for specialized AI systems in game development" (UE5 data and RL environments for labs). Godot not mentioned. Copyright "Inception Technologies", "Backed by Y Combinator". Headline of a profile: "Ben Kim Built an AI Game Engine. Then the Engine Became the Test." ([yespress.io](https://yespress.io/ben-kim)). |
| "Quasar" | Summer's comparison page itself says there is "no single dominant product called Quasar" | Not a real competitor. |

**None of these is a browser prompt-to-game product on Godot.** All are developer tools (plugin, MCP, desktop IDE) or have pivoted.

### Godot community attitude to AI (a risk to manage)
- **Godot's own contribution rules** (FACT, [contributing.godotengine.org](https://contributing.godotengine.org/en/latest/development/contribution_rules.html), 2026-10-16):
  - "Do not use AI to generate substantial pieces of code."
  - "Do not allow an AI agent to submit PRs on your behalf."
  - "Do not use AI to generate user-facing media."
  - "Maintainers are not obliged to review AI-assisted PRs."
  - CONTRIBUTING.md adds a ban for agents that don't self-disclose (commit "Update CONTRIBUTING.md with PR process for bots", 2026-04-21).

  This applies to contributing to the engine, not to making games with it, but it shows the maintainers' mood.
- **Summer's own description of Reddit:** "r/gamedev is skeptical by default"; r/godot prefers AI for GDScript over AI "operating their scene tree".
- **Strong signal:** on 2026-10-09 Summer **removed "Godot" and "GDScript" from its home page and key pages** (PR #21). The engine's closest AI-native user is distancing itself from the Godot brand.
- **Implication for TypePlay:**
  - Market to people who want a game, not to Godot developers. Keep Godot as "real engine, real exports, you own the project" in the FAQ, not the headline.
  - Don't imply endorsement by the Godot Foundation.
  - Expect pushback if TypePlay posts in r/godot.

---

## 7. Cross-competitor takeaways for TypePlay

1. **The lane is open:** browser + real engine + cloud store builds for non-developers.
   - Makko and Gambo (browser, non-dev) are Phaser web-only.
   - Summer (real engine) is a desktop app for developers, and users do their own mobile builds.
   - GDevelop (browser + stores) has an assistant, not prompt-to-game.
2. **Per-game cost is TypePlay's weapon.**

   | Competitor | Cost of one game, cheapest paid plan |
   |---|---|
   | Gambo (dead) | ~$7.50-15 (ESTIMATE) |
   | Makko Starter | ~$10-20 realistic (ESTIMATE) |
   | Summer | "complete games" at $60/mo by its own copy |

   TypePlay's measured API cost is $0.07-0.12 (Haiku) / $0.16 (Sonnet medium) per build. Sonnet on the $20 plan is a concrete, provable differentiator (Makko gates Sonnet at $50).
3. **Durability is a selling point.** Gambo deleted every user's data 2026-05-01 after ~7 months. TypePlay should say plainly: "you get the Godot project and git history; download it anytime."
4. **Orphaned audience:** Gambo's Discord still has 17,018 members (2026-10-16).
5. **Features worth copying, in priority order:**
   - Visual self-playtest with screenshots (Summer).
   - Unlimited fallback model after credits run out (Makko).
   - Per-message credit price shown next to the model picker (Makko).
   - Play/Remix gallery (Gambo).
   - Style lock for code-drawn art (Makko Collections).
   - Ads-in-one-prompt for Android exports (Gambo).
   - SEO comparison pages and llms.txt (Summer).

---

## Sources

All seen 2026-10-16 unless dated otherwise.

**Summer Engine**
- https://www.summerengine.com/ (home), /pricing, /press, /terms, https://www.summerengine.com/llms-full.txt
- https://docs.summerengine.com/knowledge-base/what-is-summer, https://docs.summerengine.com/essentials/faq
- https://github.com/SummerEngine/summer (+ GitHub API: stars, contributors, org), https://github.com/SummerEngine/docs/pull/21, /pull/22
- https://registry.npmjs.org/summer-engine, https://api.npmjs.org/downloads/point/last-month/summer-engine
- https://summer.games/sitemap.xml; Discord invite API discord.com/api/v9/invites/summerengine
- https://www.whois.com/whois/summerengine.com; RDAP summer.games
- https://www.frontrun.vc/blog/yc-f26-companies-full-list (2026-08-19, upd. 09-25); https://www.ycombinator.com/companies/summer-engine (404)
- https://x.com/MathiasHeide/status/2078231589436465199 (2026-07-17); https://github.com/mathias-heide; https://www.linkedin.com/in/mathiasheide/
- https://store.steampowered.com/app/4176260/Dont_Pray/ (+ appreviews/appdetails API)
- https://hunted.space/dashboard/summer-engine; https://peerpush.com/p/summer-engine
- https://zekaiwork.com/ai-tools/summer-engine/ (2026-08-06); https://www.stork.ai/en/summer-engine (2026-09-25); https://note.com/fond_tabsyo/n/n66a24ed13f46 (2026-09-22)
- https://www.summerengine.com/blog/best-ai-for-godot, /blog/summer-vs-quasar, /blog/best-ai-game-maker-reddit

**Gambo**
- gambo.ai live check (GoDaddy parking lander); RDAP https://rdap.identitydigital.services/rdap/domain/gambo.ai
- Wayback: https://web.archive.org/web/20260413065401/https://www.gambo.ai/ and https://web.archive.org/web/20260225140424/https://www.gambo.ai/pricing
- Shutdown notice: https://dolomite-apartment-b0f.notion.site/Gambo-will-be-shutting-down-on-May-1-2026-33309680815f80aa856ddacdf542e37c
- Discord invite API discord.com/api/v9/invites/5RG9WCcGNs
- https://sgpgrid.com/company-details/dora-platform-pte-ltd; https://qiita.com/n_hiraoka/items/029c3f7df2bca3507288 (2025-10-01)
- https://note.com/tank_ai/n/na96d1c39a7af (2025-11-08); https://techpilot.ai/tools/gambo-ai/ (2026-10-14); https://www.beyondplay.xyz/blog/beyondplay-vs-rosebud-vs-gambo (2026-03-22)
- https://x.com/tetumemo/status/1970808418773721526

**Makko**
- https://www.makko.ai/about, https://www.makko.ai/pricing (+ public tier data and https://stripe.makko.ai/checkout/plans), makko.ai JS bundles (Phaser, GitHub, play links)
- https://blog.makko.ai/makko-ai-is-live-make-2d-games-with-ai-no-drawing-no-coding/ (2026-04-20); https://blog.makko.ai/the-team-behind-makko-ai-amazon-pax-and-a-different-vision-for-game-development/ (2026-03-20)
- https://finance.yahoo.com/sectors/technology/articles/makko-launches-ai-powered-2d-070100635.html and https://www.globenewswire.com/news-release/2026/04/20/3276723/0/en/makko-launches-ai-powered-2d-game-studio-with-over-40-000-game-assets-created-in-beta.html (2026-04-20)
- https://www.producthunt.com/products/makko-ai; https://hunted.space/dashboard/makko-ai
- https://www.geekwire.com/2026/startup-radar-seattle-area-founders-use-ai-for-medical-records-gaming-mortgages-search-and-more/; https://www.crunchbase.com/organization/makko-ai; https://www.linkedin.com/in/jerebird/
- RDAP makko.ai; Discord invite API (makko); YouTube @makkoai via yt-dlp

**GDevelop**
- https://gdevelop.io/, /pricing, /page/about-us, /page/terms-and-conditions
- https://api.gdevelop.io/usage/subscription-plan-pricing-system
- https://gdevelop.io/blog/make-games-with-ai-agent-gdevelop-automated-prompt (2025-10-09); https://gdevelop.io/blog/why-use-gdevelop-when-you-can-use-ai (2026-06-30); https://gdevelop.io/blog
- GitHub API 4ian/GDevelop; whois gdevelop.io; YouTube @GDevelopApp

**Buildbox**
- https://www.buildbox.com/ (302 to signup.buildbox.com), https://www.buildbox.com/portfolio/buildbox-ai-4/
- signup.buildbox.com JS bundle; whois buildbox.com; YouTube @Buildbox

**Other Godot AI**
- https://ziva.sh/, https://engineforge.ai/, https://gdaimcp.com, https://www.nitrode.com/, https://yespress.io/ben-kim (title only, 403)
- GitHub API: Coding-Solo/godot-mcp, ee0pdt/Godot-MCP, bradypp/godot-mcp
- https://contributing.godotengine.org/en/latest/development/contribution_rules.html; https://github.com/godotengine/godot/blob/master/CONTRIBUTING.md
