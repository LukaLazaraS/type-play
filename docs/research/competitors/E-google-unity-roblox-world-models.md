# E. Platform threats, engine AI and world models (TypePlay competitor research)

Researched 2026-10-16. Every figure is tagged:
- **FACT** = stated by the linked source, with that source's date.
- **ESTIMATE** = my calculation, with the method given.
- "not found" = searched and found nothing.

"(secondary)" means a news or blog summary, not the company's own page. The shared web-search budget ran out near the end, so the last checks (Unity Spark, Godot, Poki, Steam counts, Decart, AMD) were done by fetching primary pages directly. A few items stay secondary and are marked.

---

## 0. Summary: ranked threats to TypePlay

| # | Threat | Level | When | Why |
|---|---|---|---|---|
| 1 | **Google Playground + Unity Spark** (launched 2026-10-07) | **HIGH** | Now (US); other countries "coming soon" | The same loop as TypePlay (prompt, play in the browser, edit by chat, share), from Google, free or $4.99/mo. Its starter genres include **Tower Defense and Racing**, two of TypePlay's four launch genres. Gaps: US-only, 18+, browser-only, games live inside Playground; Spark games can't be exported or sold at launch. |
| 2 | **Roblox Build + Roblox Everywhere** | **HIGH** for kids/teens; **MEDIUM** for TypePlay's core | Build alpha since 2026-07-28 (NZ, then Serbia and Singapore); standalone apps "soon" | 123M daily users, a payout economy ($1.7B to creators in 12 months), and a prompt-to-game tab for ages 9+. If "Roblox Everywhere" lets Build games ship as their own store apps, TypePlay's export edge shrinks. |
| 3 | **Astrocade** (hub + AI creation) | MEDIUM | Now | $56M raised, ~5M monthly users, 75K+ games, creators paid. It owns the "make and get played" social loop that TypePlay doesn't have. |
| 4 | **General AI chat** (Claude artifacts, Gemini AI Studio, ChatGPT/Codex, Grok) | MEDIUM | Now | Free or already-paid substitute for simple 2D browser games. No store builds and no real engine. |
| 5 | **Engine AI** (Unity AI, UE 5.8 MCP, UEFN, Epic's "AI pivot") | LOW-MEDIUM | Now; Unity 7 in Q1 2027 | Aimed at developers, not one-prompt consumers. **Godot has no AI plans**, so no first-party competitor on TypePlay's engine. |
| 6 | **World models** (Genie 3, Mirage 2, Decart, Muse, GameCraft, Marble) | LOW to 2028 | ESTIMATE: 2028+ before they matter | 60-second sessions, 720p/24fps, cloud GPU per minute of play, no rules or saves, no store builds, no public API. Google itself says Genie "is not a game engine". |
| 7 | **Moonlake AI** | LOW | — | Pivoted to robotics simulation in 2026. |
| 8 | **Bitmagic** | LOW | — | 7 people, $4M raised; Steam Early Access still "To be announced". |

**What the market is telling TypePlay (Oct 2026):** Google, Roblox and Unity all launched consumer prompt-to-game in the last 3 months. None of them gives the user a native store build they own: Playground and Spark are browser-only and live inside Playground, and Roblox games live inside Roblox. TypePlay's defensible pitch is "a real Godot project you own, built for Play Store, App Store, Steam and web, available worldwide". "Make a game from a prompt" alone is no longer an edge.

---

## 1. Moonlake AI

**What it is / who:** San Francisco "applied research lab". Founders Fan-Yun Sun (CEO, ex-NVIDIA research) and Sharon Lee, both Stanford PhDs ([Forbes profile](https://www.forbes.com/profile/moonlake-ai/), updated 2026-01-01).

**Money**
- **FACT**: $28M seed, announced ~2025-10-01, from AIX Ventures, Threshold and NVIDIA Ventures. Angels include Jeff Dean, Naval Ravikant, Ian Goodfellow, Steve Chen, Guillermo Rauch ([webwire press release](https://www.webwire.com/ViewPressRel.asp?aId=344520), Oct 2025; [Moonlake blog](https://moonlakeai.com/blog/introducing-moonlake-ai)).
- **FACT**: Forbes says $30M seed at a **$120M valuation** ([Forbes](https://www.forbes.com/profile/moonlake-ai/), 2026-01-01).
- **FACT**: PitchBook lists 31 employees and a "Series A" label, but its deal table shows only the $28M seed of 2025-10-04 ([PitchBook](https://pitchbook.com/profiles/company/1084513-24), secondary). No 2026 round found.

**Product history**
- **FACT**: Dec 2025: announced "Reverie", a programmable diffusion model inside its "Generative Game Engine" ([Moonlake blog](https://moonlakeai.com/blog/introducing-reverie)).
- **FACT**: 2026-02-17: open beta of its world-modeling agent ([webwire press release](https://www.webwire.com/ViewPressRel.asp?aId=350675)).
  - Waitlist of **10,000+**, admitted at **100 users/day**.
  - Plans from **$15/month**, scaling with usage.
  - No export targets mentioned.

**Status today (Oct 2026)**
- **FACT**: the homepage now reads **"The simulation and eval layer for robot deployment"**, with only a "Book Demo" call to action. Blog posts from Jul to Sep 2026 are all about robotics ([moonlakeai.com](https://moonlakeai.com/), fetched 2026-10-16).
- **FACT**: named to the CB Insights AI 100 on 2026-05-05 (same page).
- Game users and export targets: not found. The app at app.moonlakeai.com only shows "Loading…".

**Threat: LOW.** Moonlake has moved its 3D-world tech to robotics, where the money is. It does show that "AI-native interactive worlds" didn't find a consumer business fast enough even with $28-30M. **TypePlay action:** none. Use it as a talking point: "coded games beat generated worlds for players".

---

## 2. Bitmagic (Roleverse Ltd, Helsinki)

**Who:** Founded 2021. CEO Jani Penttinen; chairman Samuli Syvähuoko (Sisu Game Ventures) ([PocketGamer.biz](https://www.pocketgamer.biz/finnish-startup-bitmagic-raises-4-million-for-ai-platform-able-to-create-games-from-text-prompts/), Jul 2024).

**Money**
- **FACT**: $4M seed (Jul 2024) led by Korea Investment Partners, with Supercell and Sisu Game Ventures (same source).
- **FACT**: still "$4 million to date" as of 2026-02-03; the company "may raise more to subsidize AI processing costs". **Team of 7** ([GamesBeat](https://gamesbeat.com/bitmagic-unveils-ai-created-version-of-classic-civilization-game/), 2026-02-03).

**Traction**
- **FACT**: earlier consumer versions were tried by **1.2M+ people** (GamesBeat, 2026-02-03).
- **FACT**: Steam page shows "Coming Soon To Early Access", release date "To be announced", **0 user reviews**. It will be free-to-play plus a subscription, and uses GPT-4-turbo with a predefined asset library ([Steam](https://store.steampowered.com/app/2178290/Bitmagic/), fetched 2026-10-16).
- **FACT**: SteamDB's last record update was 2026-04-03 ([SteamDB](https://steamdb.info/app/2178290/), secondary).

**Today vs announced**
- **FACT**: Feb 2026: "Idle Civ", a voxel Civilization-style idle game, "100% prompted". Also recreations of Diablo, GTA2 and Vampire Survivors. "Games Lab" gives professionals up to **$1,000 in AI credits** (GamesBeat, 2026-02-03).

**Export and ownership**
- **FACT**: creators own the IP and can monetize; Bitmagic plans to take a percentage of creator revenue (GamesBeat).
- **FACT**: a third-party comparison says games are hosted on Bitmagic, not exported, and that it was free as of Jul 2026 ([max2dgame](https://max2dgame.com/compare/best-ai-game-makers.html), secondary).

**Threat: LOW.** Small team, little money, no store exports. **TypePlay action:** none.

---

## 3. Roblox's own AI, and Lemonade

### 3a. Roblox Build: prompt-to-game inside the Roblox app

- **FACT**: announced 2026-07-15/16; public alpha in **New Zealand from 2026-07-28** ([The Next Web](https://thenextweb.com/news/roblox-build-mobile-ai-game-creation), 2026-07-16).
  - A creation tab in the Roblox app. One prompt produces a basic playable game with mechanics, environment, characters, sound and visual style.
  - Same back end as Roblox Studio, so a project can be started on a phone and finished on desktop.
  - Age-verified users **9+** can create. The base version is free, with paid options for power users later (no prices).
  - Build games go through the normal Roblox safety review. Discovery ranks by long-term retention, so unplayed games don't reach the homepage.
- **FACT**: RDC 2026 (2026-09-11) ([Roblox IR](https://ir.roblox.com/news/news-details/2026/Roblox-Unveils-New-Ways-to-Play-Build-and-Grow-at-the-Roblox-Developers-Conference-RDC/default.aspx); [Roblox newsroom](https://about.roblox.com/newsroom/2026/09/rdc-2026-the-world-needs-more-play)):
  - **~9,000 games published** with Build since the NZ alpha.
  - **71%** of Build creators had never used Studio (data to 2026-09-01).
  - Expanding to **Serbia and Singapore**; adding desktop access, an asset library, analytics and **monetization** (ads from phones "soon").
- **FACT**: "Scene Generator" (text + reference image to a working layout) is due "later this year" (same sources).
- **FACT (secondary)**: at RDC, Roblox said "entire games in **10-15 minutes** from a single prompt" ([PCGamesN](https://www.pcgamesn.com/roblox/rdc-2026), 2026-09).
- **ESTIMATE**: ~9,000 games from 2026-07-28 to 2026-09-01 (≈5 weeks) is **≈1,800 published games/week from one small alpha market**. Method: 9,000 ÷ 5.

### 3b. Roblox Studio Assistant, Cube 3D and 4D

- **FACT**: 2026-04-15: "Roblox Studio is Going Agentic" ([Roblox newsroom](https://about.roblox.com/newsroom/2026/04/roblox-studio-going-agentic)).
  - Planning Mode, Mesh Generation, Procedural Models ("coming soon") and a Playtesting Agent (beta).
  - Built-in MCP server for **Claude, Cursor and Codex**.
  - **44% of the top 1,000 creators** used Assistant or third-party AI via MCP (2026-03-06 to 04-07).
- **FACT**: 2026-02-04: Cube "4D generation" in open beta, for working objects such as drivable cars made by players from a prompt ([Roblox newsroom](https://about.roblox.com/newsroom/2026/02/accelerating-creation-powered-roblox-cube-foundation-model)).
  - **160,000+ objects** generated in the early-access game Wish Master.
  - Players who used it played **64%** longer on average.
  - Full-scene generation (assets, environments, code, animation) is a stated long-term goal, with no date.

### 3c. Distribution and money (why Roblox is the strongest "squeeze")

- **FACT**: Q2 2026 (to 2026-06-30) ([Roblox Q2 2026 shareholder letter, SEC](https://www.sec.gov/Archives/edgar/data/0001315098/000162828026051059/ex991-robloxq22026earnin.htm); numbers via [Yahoo Finance summary](https://finance.yahoo.com/markets/stocks/articles/roblox-corp-rblx-q2-2026-050249366.html), 2026-07-30, secondary):
  - **123M daily users** (+10% YoY), down from 132M in Q1 2026.
  - Revenue $1.469B; bookings $1.557B.
  - Q3 bookings guidance −14% to −18% YoY.
- **FACT**: creators earned **~$1.7B in the 12 months to 2026-06-30** and **$5B+ since 2013**. Players spent **29B hours** last quarter (Roblox RDC release, 2026-09-11).
- **FACT**: "**Roblox Everywhere**" lets creators publish games "soon" as **standalone apps on mobile, PC and consoles**, with Roblox running underneath. **Browser play** without install arrives in Chrome by end of 2026 (Roblox IR, 2026-09-11). Fees and terms: not found.

### 3d. Lemonade (lemonade.gg): AI agent for Roblox games

- **FACT**: launched 2025-10-04 by Nicolas Vizioli as "the first agent for making #Roblox games" ([X post](https://x.com/nicolasvizi/status/1974506713316565171)). Browser app that syncs with Roblox Studio; it used Sonnet 4.5, Opus and GPT-5 at launch (secondary).
- **FACT**: its site claims "**+500K Creators**" ([lemonade.gg](https://lemonade.gg/), fetched 2026-10-16; company claim, undated).
- **FACT**: Vizioli says one first-time user made **$20,000+ in a month** from a Lemonade-made game ([Naavik podcast](https://naavik.co/podcast/building-ai-tools-for-roblox-creators/), date not stated).
- **FACT**: PitchBook lists "Lemonade Labs", founded 2025, with an **Early Stage VC round dated 2026-09-01**. Investors include F4 Fund; the **amount is not disclosed** ([PitchBook](https://pitchbook.com/profiles/company/1508684-05), secondary).
- **FACT (unverified)**: a bot account says it is backed by Menlo Ventures ([X](https://x.com/StealthCoSpy/status/2085199186866418163)).
- Funding amount: **not found**. Pricing: free Studio plugin plus a paid monthly subscription for more prompts (per its terms, secondary).

**Threat assessment: Roblox HIGH for under-18 "make a game for my friends"; MEDIUM for TypePlay's core.**
- TypePlay can't match Roblox's audience or payouts. A teen who wants friends to play will choose Build.
- Roblox games can't leave Roblox today. If "Roblox Everywhere" opens standalone store apps to Build creators, Roblox matches TypePlay's export pitch with built-in multiplayer and monetization. No date yet, so watch RDC follow-ups.
- **Lemonade shows the pattern:** a third-party copilot found demand, then the platform built the same thing (Assistant, Build) inside its own app. TypePlay runs on an open engine (Godot) that will never ship a first-party AI builder (§4), which protects it from that pattern.

**TypePlay actions**
- Don't target under-16s at launch. Roblox Build, Playground (18+) and Spark (18+) set expectations, and Roblox has the safety machinery.
- Say "your game, your store listing, your revenue" plainly on the pricing page.
- Track "Roblox Everywhere" terms.

---

## 4. Do the engines themselves offer prompt-to-game? (Unity, Unity Spark, Unreal/UEFN, Godot)

### 4a. Unity AI (in-editor)

- **FACT**: 2026-02-16: CEO Matt Bromberg said Unity AI "will enable developers to prompt full casual games into existence with natural language only" ([Game Developer](https://www.gamedeveloper.com/programming/unity-says-its-ai-tech-will-soon-be-able-to-prompt-full-casual-games-into-existence-), 2026-02-16).
- **FACT**: open beta for all Unity 6+ users, announced 2026-05-01 ([Unity Discussions, official](https://discussions.unity.com/t/unity-ai-s-open-beta-now-live-for-unity-6/1718560)).
  - Agentic assistant (Plan Mode, Skills, checkpoints), asset generators, AI Gateway (bring your own key), MCP Server and Figma-to-UI.
  - **Personal plan: one 1,000-credit trial over 14 days, then $10/month for 1,000 credits.** Pro, Enterprise and Industry get credits included.
  - Uses "some Gemini models".
- **FACT (secondary)**: Unity's own explainer says the tools are "less suitable if you're hoping to generate a finished game from a prompt" (via [buildfastwithai](https://www.buildfastwithai.com/blogs/unity-ai-open-beta-guide-2026)).
- **FACT (secondary)**: Unity 7 is due in **Q1 2027** with optional AI tools (via [Shane the Gamer](https://www.shanethegamer.com/news/unity-spark-google-playground/), Oct 2026).

### 4b. Unity Spark: a deep dive (priority item)

**Announcement**
- **FACT**: announced **2026-10-07**, the same day as Google Playground ([Game Developer](https://www.gamedeveloper.com/programming/unity-unveils-unity-spark-an-prompt-based-tool-for-google-s-ai-games-platform), 2026-10-07).
- **FACT**: CEO blog post "Why we built Unity Spark" (Matt Bromberg, ~2026-10-07), covered by [GameFromScratch](https://gamefromscratch.com/unity-announce-unity-spark-game-engine/) and [Vertical Slice](https://www.verticalslice.news/a-perpetually-self-feeding-meat-grinder-will-the-devs-who-adore-unity-and-googles-game-prompting-platforms-please-stand-up/). Announced by blog post with Google, not at a Unite keynote.
- **FACT**: product page [unity.com/spark](https://unity.com/spark) (fetched 2026-10-16).
  - Tagline: "**Prompt it. Perfect it. Publish it.** Inspired games, with artist-created assets, built with Unity."
  - Status "Coming Soon" with a **waitlist**; the page title says "closed beta".
  - Four showcase games: Space Corridor, Horror story, Emberwell, Robot Race. The Space Corridor demo at spark.unity.com only showed a loading screen when fetched.
  - Nine UI languages.

**What it does (describe, then refine in a web editor, then publish)**
- **FACT**:
  - A browser-based tool for **3D games** on the **Unity runtime**, with no download and no coding.
  - Start from a prompt, refine through prompts while AI agents suggest **Unity Asset Store** items and generate backgrounds and tools.
  - Then a **web-based editor** for refining.
  - **Real-time multi-user collaboration** by sharing a link.
  - Publish to **Google Playground** ([PocketGamer.biz](https://www.pocketgamer.biz/unity-unveils-spark-ai-game-maker-with-google-playground-integration/), [daily.dev summary of GamesIndustry.biz](https://daily.dev/posts/unity-spark-a-browser-based-ai-game-tool-launching-in-beta-with-google-s-playground-l2sxxgg6n), Oct 2026, secondary).
- **FACT**: Google describes Spark as unlocking "robust, professional-level mechanics, high-fidelity 3D capabilities, and the flexibility of the Unity runtime" ([Google blog](https://blog.google/innovation-and-ai/technology/ai/playground-experimental-gaming-platform/), 2026-10-07).
- **FACT**: the editor runs **only in desktop browsers**; finished games play in desktop and mobile browsers (via GamesIndustry.biz summaries, secondary).
- **FACT**: Asset Store publishers are **opted in to Spark by default** (Unity, per Vertical Slice and GameFromScratch coverage, Oct 2026).
- Which AI model it uses: not disclosed. Google supplies models; one report says Spark is not locked to Google's models (secondary).

**Who it's for**
- **FACT**: Bromberg says it's for "gamers who have spent a thousand hours inside a genre", graphic artists who can't code, and modders.
- **FACT** (Bromberg quotes): "This isn't about 'one-shotting'". "Asking AI to regurgitate an already invented game does not make you the next Hideo Kojima". "Unity Spark is not going to be for everyone" (Game Developer; GameFromScratch; [bobfm](https://www.bobfm.co.uk/google-and-unity-introduce-ai-game-creation-platforms-as-unity-spark-demo-draws-criticism/) citing a Gamefile interview, Oct 2026).
- **FACT**: "about 3 billion people play a game made with Unity each month" (Bromberg blog, via Vertical Slice).

**Pricing and credits**
- **FACT**: a credit system tied to AI tokens: some free credits, then paid. Details not final. No prices published (GamesIndustry.biz via secondary summaries, 2026-10-07).

**Export, selling and hosting**
- **FACT**: at launch, projects **cannot be downloaded, cannot be exported to desktop Unity, and cannot be sold**. Publishing is **only to Google Playground**.
- **FACT**: both Spark and Playground are **18+** (GamesIndustry.biz via [daily.dev](https://daily.dev/posts/unity-spark-a-browser-based-ai-game-tool-launching-in-beta-with-google-s-playground-l2sxxgg6n) and [KuCoin/CoinDesk](https://www.kucoin.com/news/flash/google-launches-browser-based-ai-game-creation-platform-playground-partners-with-unity), secondary). GameFromScratch notes it "could later produce standalone games" (speculation).
- **FACT**: Game Developer says Spark is "exclusively for use with Google's AI platform".

**Timing and numbers**
- **FACT**: closed beta "later in 2026"; waitlist open.
- Waitlist size: **not found**. Users: none yet (not launched).

**Reaction**
- **FACT**: developers contacted by Vertical Slice had "nothing even remotely kind to say" ([Vertical Slice](https://www.verticalslice.news/a-perpetually-self-feeding-meat-grinder-will-the-devs-who-adore-unity-and-googles-game-prompting-platforms-please-stand-up/), 2026-10-13). Complaints:
  - it mostly picks prefab assets;
  - it offloads level design;
  - it will flood stores with shovelware and clones;
  - "accountability for what you've made is lost".
- **FACT**: Dan Marshall (Size Five Games) mocked the Space Corridor demo on Bluesky. Asked about showing AI carbon cost, Bromberg said "We hadn't considered that" ([bobfm](https://www.bobfm.co.uk/google-and-unity-introduce-ai-game-creation-platforms-as-unity-spark-demo-draws-criticism/), Oct 2026).
- **FACT (secondary)**: Unity stock rose ~1.6-2% on 2026-10-09, to ~$46.6-46.9 (market cap ~$20.2B). Reports for 10-07 conflict ([tech-insider](https://tech-insider.org/unity-spark-google-playground-roblox-2026/), citing MarketBeat).
- **FACT**: Unity Q2 2026 revenue was $546M (+24%) (same source, secondary).

**Unity Spark threat to TypePlay: MEDIUM now, HIGH if it opens up.**
- Overlap: browser 3D games from prompts, edited by chat, with real-time collaboration and Unity Asset Store art. Many users will expect Unity's 3D quality to beat Godot plus CC0 kits.
- Today's limits favor TypePlay:
  - not launched (closed beta later in 2026);
  - **no export, no download, no selling**;
  - **18+**, and Playground is US-only;
  - desktop-browser editor only;
  - output locked in Google's gallery.
- **Watch:** if Unity later allows "export to Unity project" or "publish to stores" (Unity has the 25+ platform pipeline), Spark becomes TypePlay's closest competitor with a far bigger asset library.

**TypePlay actions**
1. Make **ownership and export** the headline: "download the full Godot project; builds for Play Store, App Store, Steam, web; sell it, it's yours". This is exactly what Spark and Playground withhold.
2. Launch **outside the US first**, or at least worldwide on day one, while Playground and Spark are US-only.
3. Keep 2D code-drawn art as a deliberate look: Spark's art is Asset Store prefabs, which critics already call samey.
4. Don't claim "one-shot finished games"; Unity's CEO and developers are hostile to that framing. Lead with "iterate by chat until it's yours".

### 4c. Unreal Engine and UEFN (Fortnite)

- **FACT**: **UE 5.8 (2026-06-17)** ships an **experimental MCP server plugin**, so Claude Code, Cursor, Codex or Gemini can drive the editor. There is no built-in assistant that writes the game. UE6 will let teams "bring your own favorite models" ([Engadget](https://www.engadget.com/2196807/epic-games-details-how-its-embracing-gen-ai-in-unreal-engine/), 2026-06; [cryptobriefing](https://cryptobriefing.com/unreal-engine-5-8-mcp-server-support/), secondary).
- **FACT (secondary, unverified with Epic)**: Unreal MCP runs inside UEFN from 2026-08-20 ([explainx](https://explainx.ai/blog/uefn-unreal-mcp-fortnite-verse-agents-august-2026)).
- **FACT**: UEFN "conversations" AI NPCs became experimental 2026-04-16 ([Fortnite news](https://www.fortnite.com/news/bring-npcs-to-life-with-ai-powered-conversations)).
- **FACT (secondary)**: AI voices for **36** Fortnite characters became publishable on 2026-07-30 ([nosmokesport](https://nosmokesport.com/game-news/epic-games-ai-voices-fortnite-creator-islands-july-2026/)).
- **FACT**: 2026-10-12: Tim Sweeney announced a "**huge pivot**" to AI, "moving developers around to retool for maximum AI acceleration" ([The Star/AFP](https://www.thestar.com.my/tech/tech-news/2026/10/13/fortnite-maker-epic-games-makes-039huge-pivot039-with-ai-ceo-says), 2026-10-13).
- **FACT (secondary)**: Bloomberg reports an "AI first" Disney game with "no more hand-written code", now delayed from Mar 2027 ([GameWorldObserver](https://gameworldobserver.com/2026/10/13/no-more-hand-written-code-epic-games-decides-to-actively-utilize-ai-in-development), 2026-10-13).
- Prompt-to-island generator for Fortnite: **not found**.

### 4d. Godot (TypePlay's engine)

- **FACT**: on **2026-06-30** the Godot Foundation announced it is rewriting its contribution policy ([The Register](https://www.theregister.com/ai-and-ml/2026/07/01/godot-says-bye-bye-ai-bans-vibe-coded-contributions/5265344), 2026-07-01):
  - bans autonomous-agent and vibe-coded contributions (automatic repo ban);
  - AI allowed only for "menial" tasks (completion, regex), and it must be disclosed;
  - "AI cannot take responsibility".
- **FACT (secondary)**: maintainer Rémi Verschelde said Godot "isn't vibe-coded" and has **no plans to build AI features into the engine itself**. AI-disclosed PRs were **1.27%** of merged contributions ([Respawn/Outlook India](https://respawn.outlookindia.com/gaming/gaming-news/godot-draws-clear-line-on-ai-assisted-contributions), Jun 2026).
- **FACT (secondary)**: forum users complain of many LLM-made addons in the Asset Library since 4.7 ([Godot Forum](https://forum.godotengine.org/t/changes-to-godot-contribution-policies-stricter-rules-against-ai-contributions/140986)).
- The policy covers **contributions to the engine**, not games made with AI.

**Engine threat: LOW-MEDIUM.**
- Unity and Epic sell AI to developers inside their editors. The consumer one-prompt products are Spark (no export) and Roblox Build (Roblox-only).
- **Godot will not compete with TypePlay** (good). But its community is openly hostile to AI.

**TypePlay actions**
- Don't imply Godot endorsement. Say "built on the open-source Godot engine" and check Godot's trademark/logo rules before marketing use.
- Don't publish AI-made addons to the Godot Asset Library.
- Consider donating to the Godot Foundation once revenue exists; it's cheap goodwill. This is a suggestion, not a researched fact.

---

## 5. World models: how far from replacing coded games?

### Google DeepMind Genie 3 / Project Genie

- **FACT**: Genie 3 was announced Aug 2025. **Project Genie** launched **2026-01-29** for **Google AI Ultra** subscribers in the US ([9to5Google](https://9to5google.com/2026/01/29/google-project-genie/); [The Register](https://www.theregister.com/2026/01/29/googles_project_genie_ai/), 2026-01-29).
  - **60-second sessions.** Google: the model supports "a few minutes of continuous interaction, rather than extended hours".
  - 720p at **20-24 fps**; memory of about 1 minute.
- **FACT**: Google told The Register that Genie "**is not a game engine and can't create a full game experience**". Other limits: few actions, weak text, lag, and "promptable events" missing.
- **FACT (secondary)**: video-game stocks fell on 2026-01-30 after the launch (Bloomberg, via [Wikipedia](https://en.wikipedia.org/wiki/Project_Genie_(website))). Unity's stock also fell, per [The Game Business](https://www.thegamebusiness.com/p/unity-ceo-the-cost-of-building-a) (2026-08-25).
- **FACT (secondary)**: Street View grounding added 2026-05-19; expanded to **140+ countries** in May 2026; ~30-second world-creation turns ([AI Stack Current](https://www.aistackcurrent.com/models/genie-3/), verified 2026-09-01).
- **Public API: not found.** As of Sep 2026, no developer API ([Cybernews](https://cybernews.com/ai-tools/google-project-genie-review/); AI Stack Current).
- Genie 4: not found.

### Other world models

| Model | Latest status (fact) | Limits |
|---|---|---|
| **Dynamics Lab Mirage 2** | Launched Aug 2025 as a browser demo, image/prompt to playable world. Team says **~200 ms latency**, **10+ min** before drift, runs on **one consumer GPU**, team **<10** ([GIGAZINE](https://gigazine.net/gsc_news/en/20250825-ai-generative-world-mirage-2), 2025-08-25) | Imprecise actions, visual wobble. **No 2026 news found**; site returned empty when fetched |
| **Decart (Oasis / Lucy)** | **$300M** led by Radical Ventures on **2026-05-18**; total **>$450M** ([TNW](https://thenextweb.com/news/decart-300-million-radical-ventures-world-models)). Valuation **~$4B** ([Calcalist](https://www.calcalistech.com/ctechnews/article/sjt9ncukgl), "estimated"). **Oasis repositioned to robotics/physical AI**; Lucy used for virtual try-on and live streaming; Amazon is a strategic customer | No consumer game product |
| **Microsoft Muse / WHAM** | Feb 2025 research model (Ninja Theory, *Bleeding Edge* data). WHAMM Quake II demo in Copilot Labs at **640×360**; WHAM context **0.9 s** ([MS Research](https://www.microsoft.com/en-us/research/articles/whamm-real-time-world-modelling-of-interactive-environments/); [The Decoder](https://the-decoder.com/microsofts-new-ai-model-muse-can-generate-gameplay-and-might-preserve-classic-games/)). An editor's note dated 2026-09-23 says the team "graduated" into the Microsoft AI product group (unconfirmed) ([MS Research WHAM news](https://www.microsoft.com/en-us/research/project/wham/news-and-awards/)) | Research only; no public product |
| **Tencent Hunyuan-GameCraft** | v1 open-sourced **2025-08-14** (weights; quantized version runs on an RTX 4090) ([Tencent X](https://x.com/TencentHunyuan/status/1955839140173631656); [The Decoder](https://the-decoder.com/tencents-hunyuan-gamecraft-transforms-single-images-into-interactive-gaming-videos/)). **GameCraft-2** paper (instruction-following, e.g. "open the door") Nov 2025 ([arXiv 2511.23429](https://arxiv.org/html/2511.23429v1)) | GameCraft-2 public release: not found |
| **World Labs Marble** (3D worlds, not live video) | **$1B** raised 2026-02-18; AMD, Autodesk ($200M), NVIDIA and others ([The AI Insider](https://theaiinsider.tech/2026/02/19/fei-fei-lis-world-labs-raises-1b-in-fresh-funding-to-advance-development-of-world-models/)). **AMD to acquire for ~$8.2B in stock**, announced **2026-09-28**, closing by end of 2026 ([AMD newsroom](https://newsroom.amd.com/news/amd-acquire-world-labs/)). Exports Gaussian splats plus a **GLB collider mesh**, with guides for Unity, Unreal and Blender. API: $1.20 per world, $2.80 per mesh export; app tiers at launch Free (4 worlds), $20 (12), $35 (25), $95 (75) ([invideo](https://invideo.io/blog/world-labs-marble-3d-worlds/), Aug 2026, secondary) | Static scenes, not game logic. A possible future **asset source** for TypePlay 3D, not a rival |
| **Moonlake Reverie** | See §1; pivoted to robotics | — |

### Distance from replacing coded games (TypePlay's output)

- **Session length:** 60 s (Genie product cap) to "10+ min" (Mirage 2 team claim), versus unlimited for a Godot game. FACT, sources above.
- **Consistency:** about 1 minute of memory (Genie 3), 0.9 s (WHAM). No reliable scores, saves, rules or win states. FACT.
- **Cost per minute:**
  - **ESTIMATE (proxy): ~$2.54-3.23 per generated minute** of 720p/24fps video on H100/H200/B200 at June 2026 cloud prices. Method: Spheron's measured throughput for the open NVIDIA Cosmos-Predict 7B ([Spheron](https://www.spheron.network/blog/gpu-infrastructure-world-models-2026/), ~Sep 2026). Cosmos isn't real-time, so this is only an order-of-magnitude guide. Google publishes no Genie cost.
  - **ESTIMATE:** a 10-minute play session at that proxy costs **~$25-32** of GPU, every time, per player.
  - A TypePlay game costs **$0.07-0.16 to build once** (Haiku/Sonnet, measured in `packages/agent/RESULTS.md`), then about $0 per play as static files.
- **Mobile and offline:** world models stream from cloud GPUs, so no offline play and no store build. A Godot build runs natively, offline, on a phone. FACT from the product descriptions; Roblox is adding offline modes in mid-2027 (PCGamesN).
- **ESTIMATE (judgment):** world models won't replace coded, store-shipped games for TypePlay's genres (puzzle, runner, racer, tower defence) **before 2028**. Rules, scores, saves, offline play and per-play cost all favor code. The real near-term risk is **narrative**: investors and users seeing Genie demos and thinking "coded games are obsolete" (see the stock drops).

**Threat: LOW (2026-2027).**

**TypePlay actions**
- Position TypePlay as "real games that run offline on your phone, forever, at no per-play cost".
- Revisit when someone ships a world model that runs **on-device** or costs under ~$0.01/min. Neither was found.
- Watch Marble/AMD as a later 3D asset source; its GLB colliders could feed Godot. This is a suggestion.

---

## 6. General AI chat products that make games

| Product | What exists today (fact) | Numbers |
|---|---|---|
| **Google Gemini / AI Studio "Build"** | Full-stack vibe coding relaunched **2026-03-18** with the Antigravity agent; multiplayer and databases ([Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/full-stack-vibe-coding-google-ai-studio/)). I/O **2026-05-19**: Android apps (Kotlin/Compose), in-browser emulator, one-click publish to a **Play internal test track** ([TechCrunch](https://techcrunch.com/2026/05/19/googles-ai-studio-now-lets-anyone-build-android-apps-in-minutes/); [Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/google-ai-studio-io-2026/)). **2026-10-13**: private vibe-coded apps run on Android via Play (US, 18+), with sharing to "trusted friends" coming ([TechCrunch](https://techcrunch.com/2026/10/13/google-play-now-supports-private-vibe-coded-apps-built-just-for-you/)) | "Millions of builders" (Google, May 2026). Games made with Gemini Canvas or AI Studio: **not found**. Google Play's game community: **1.2B players** (TechCrunch, 2026-10-13) |
| **Google Playground** | See §7; Google's dedicated game product | — |
| **Claude artifacts** | Single-file HTML games with live preview, shareable link, downloadable source. A "Games" category in the Artifacts sidebar, per third-party guides ([ShareDuo](https://www.shareduo.com/blog/claude-artifacts), Oct 2026; [whatshotai](https://whatshotai.com/tools/claude-create-games/), 2026-06-08). Shared AI apps bill the viewer's own plan ([Anthropic](https://anthropic.com/news/claude-powered-artifacts), 2025) | Numbers: not found |
| **Claude Fable 5** (model) | Reported GA **2026-06-09**; **$10/$50 per M** input/output tokens. Ethan Mollick built several playable games from one Claude Code prompt ([ProPakistani](https://propakistani.pk/2026/06/10/anthropics-all-new-claude-fable-5-can-build-playable-games-in-a-single-prompt/); [The Shortcut](https://www.theshortcut.com/p/anthropic-releases-claude-fable-5-an-ai-model-that-can-build-playable-video-games-from-a-single-prompt), 2026-06-10). Secondary only; Anthropic's page wasn't fetched | — |
| **ChatGPT / Codex** | No game-maker product. OpenAI's "Create browser-based games" use case (Codex + ImageGen + Playwright playtesting) ([learn.chatgpt.com](https://learn.chatgpt.com/use-cases/browser-games), ~Sep 2026) and a Games showcase ([developers.openai.com](https://developers.openai.com/showcase/games)). Users asked for an in-ChatGPT "gaming center" on 2026-10-12 ([community](https://community.openai.com/t/a-proposal-for-an-integrated-gaming-center-within-chatgpt/1405787)), so it doesn't exist yet | Not found |
| **Grok / xAI** | Oct 2025: Musk promised "a great AI-generated game before the end of next year" ([VGC](https://www.videogameschronicle.com/news/elon-musk-says-his-xai-company-will-release-a-great-ai-generated-game-by-the-end-of-2026/)). **No such game found as of 2026-10-16.** SpaceX acquired xAI in Feb 2026 (US$250B), renamed SpaceXAI in Jul 2026 ([Wikipedia](https://en.wikipedia.org/wiki/SpaceXAI), secondary). Grok 4.5 launched 2026-07-08 ([Basenor](https://www.basenor.com/blogs/news/can-grok-really-build-video-games-heres-what-we-know), low-reliability blog) | — |
| **Lovable / Replit / Bolt** | General app builders; Replit is the most game-capable ([Zapier](https://zapier.com/blog/lovable-vs-bolt/)). Mar 2026: **Apple blocked App Store updates of Replit and Vibecode** under **Guideline 2.5.2** (no running downloaded code that changes the app) ([9to5Mac](https://9to5mac.com/2026/03/18/apple-pushing-back-on-vibe-coding-iphone-apps-developers-say/), 2026-03-18) | Lovable: **$400M Series C at $13.3B** (Aug 2026), **$500M ARR** (Jun 2026), 8M users (late 2025) ([shipper.now](https://shipper.now/lovable-stats/), secondary). Replit: **50M registered** (Mar 2026, Sacra), ~$525M ARR (Apr 2026) ([getpanto](https://www.getpanto.ai/blog/lovable-statistics), secondary). Game-specific counts: **not found** |
| **Websim** | AI website/game sandbox with tips and credits; daily free credits removed in 2025/26 ([fan wiki](https://newwebsim.fandom.com/wiki/Websim_(website)), low reliability) | **$11M seed** 2025-01-03 (Abstract, South Park Commons, True); 9 employees ([PitchBook](https://pitchbook.com/profiles/company/664288-30)). 2026 users: not found |
| **Vibe-coded game scene** | Vibe Jam (AI writes most code): **2,000+ entries** across 2025-2026 ([awesome-ai-built-games](https://github.com/lappemic/awesome-ai-built-games)) | — |

**Threat: MEDIUM.**
- For "make me a quick Snake/quiz game to share", Claude artifacts and Gemini are free or already paid for, and good enough.
- None of them gives a real engine, persistent project history, test-runs, or Android/iOS/Steam builds.
- Gemini/AI Studio is the one to watch: Google now joins AI-made apps to Play publishing (internal test track, private apps, friend sharing next).

**TypePlay actions**
- Don't sell "make a simple browser game"; that's a commodity.
- Sell **depth** (multi-session projects, genre skills, test-run quality) and **distribution** (store builds).
- **Watch-out for TypePlay's later phone app:** Apple's 2.5.2 stance means an iOS app that downloads and runs freshly generated Godot games inside itself risks rejection. Keep phone preview in the browser, and ship user games as their own native apps (Replit/Vibecode precedent, Mar 2026).

---

## 7. Platforms that host and pay for AI-made games (where TypePlay users can publish)

### AI-native hubs (competitors and distribution)

**Google Playground** (playground.google)
- **FACT**: launched **2026-10-07** ([Google blog](https://blog.google/innovation-and-ai/technology/ai/playground-experimental-gaming-platform/); [9to5Google](https://9to5google.com/2026/10/07/google-labs-playground/)).
  - "Experimental" Labs platform; **US, 18+**, phased rollout.
  - Browser games on phone or laptop; 2D or 3D; single or multiplayer.
  - Private, link-shared, or "Explore" gallery ranked by ratings and play activity; safety-screened.
  - Leaderboards tied to **Play Games profiles**.
  - Models: Gemini, Nano Banana and Lyria plus a custom harness (Google spokesperson via The Verge, per [The Decoder](https://the-decoder.com/google-bets-gemini-can-turn-casual-players-into-game-developers-with-new-playground-feature/)).
- **FACT (secondary: [eesel.ai](https://www.eesel.ai/blog/google-labs-playground), citing Playground Help Center and terms; I couldn't open playground.google, which needs login)**:
  - Starter genres include **Trivia, Tower Defense, Racing**.
  - **Free tier: weekly tokens via waitlist.** Google AI Plus **$4.99/mo** and up raise limits (AI Pro $19.99/mo).
  - Credits refunded on failed compiles.
  - **Export: "Download Zip" (HTML/JS/CSS + assets).**
  - Terms (2026-09-20): Google "will not claim ownership", but users grant Google the right to monetize games with ads, with permission asked first.
  - No gambling mechanics.

**Astrocade**
- **FACT**: **$56M** (Series A led by Sea, Series B led by Sequoia), **2026-05-05**. Investors include Google AI Futures Fund and NVIDIA ([Astrocade blog](https://www.astrocade.com/blog/astrocade-raises-56m-funding); [Fortune](https://fortune.com/2026/05/05/astrocade-raises-56-million-series-b-sequoia-video-games-platform-ali-amir-sadeghian/)).
- **FACT** (Fortune):
  - **~5M monthly active users**, **~140M plays/month**, **75,000+ games** from 80 countries.
  - Top creators earn "thousands of dollars a month".
  - Team of 13 at launch (Aug 2025).
- **FACT**: the company says **20M+** "engaged users" joined in 8 months; Fei-Fei Li is CSO. Total raised **$68M** (Tracxn/CB Insights, secondary). A **$10M creator incentive program** is reported ([PocketGamer.biz](https://www.pocketgamer.biz/astrocade-raises-56m-to-expand-ai-powered-games-creation-platform/), secondary).
- **ESTIMATE**: 140M plays ÷ 75K games ≈ **1,900 plays per game per month on average**, heavily skewed to hits.

**Roblox**
- Build games publish inside Roblox and earn through DevEx ($1.7B to creators in 12 months). See §3.

### Traditional stores and portals: AI rules

**Steam**
- Rule:
  - **FACT**: disclosure was required from Jan 2024.
  - **FACT**: updated ~**2026-01-16/17**: disclosure is about AI content **players consume** (art, audio, text, localization, store assets). "Efficiency gains through the use of AI powered tools" such as code assistants are not the focus. Two categories: pre-generated and live-generated ([TweakTown](https://www.tweaktown.com/news/109743/valve-changes-ai-disclosure-guidelines-ai-powered-tools-are-now-exempt/index.html), Jan 2026, secondary).
- Counts:
  - **FACT**: **7,818** titles (~7% of ~114,126), with just under 20% of 2025 releases ([Totally Human](https://www.totallyhuman.io/blog/the-surprising-new-number-of-genai-games-on-steam), ~2025-07-13).
  - **FACT**: **10,258** titles (8%), with an estimated **$660M** combined gross (Boxleiter method). 12 titles at 8 figures, 33 at 7 figures ([Totally Human](https://www.totallyhuman.io/blog/games-with-ai-disclosures-have-grossed-an-estimated-660m-on-steam), ~2025-11-06).
  - **FACT**: **25,867** public Steam products with AI disclosures **as of 2026-10-16**. Art 19,761; text 7,114; audio 6,746; **code 3,313** ([AI Transparency Index](https://aitransparencyindex.com/stats), third-party tracker, fetched 2026-10-16).
  - **FACT**: share of new releases with a disclosure: **10.9% (2024), 19.9% (2025), 30.8% (2026 to July)**. About **530 AI-flagged launches/month**. AI-disclosed games make **10-27%** of recent estimated sales. Census of 53,597 releases by Sulka Haro ([Cinevva summary](https://app.cinevva.com/news/2026-07-20-steam-ai-disclosure-study), 2026-07-20; [PC Gamer](https://www.pcgamer.com/gaming-industry/steam-week-in-review-take-cover-because-it-looks-like-more-than-half-of-steam-games-will-have-an-ai-disclosure-by-2027-2028/) projects >50% by 2027-28).
  - **FACT (secondary)**: another sample found 1,670 of 4,766 Jan-Aug 2026 releases (≈35%). AI-disclosed games had **68.4%** positive reviews against 86.3% for a procedural-generation group ([Medium](https://medium.com/@funvoke/is-ai-really-killing-the-gaming-industry-90060a53914b), Oct 2026).
  - **ESTIMATE**: 10,258 (Nov 2025) to 25,867 (Oct 2026) is **~2.5× in ~11 months**. Different trackers, so the growth rate is approximate.

**itch.io**
- **FACT**: an AI Disclosure field (Nov 2024) gives "AI Generated" or "No AI" tags plus sub-tags (Graphics, Sound, Text, Code). It's **strictly enforced for asset pages** (untagged pages can be delisted) and requested for games.
- **FACT**: games "made mostly by algorithms or AI with little human involvement" or mass-produced near-identical pages are treated as **spam and may be removed from browse/search** ([itch.io quality guidelines](https://itch.io/docs/creators/quality-guidelines), fetched 2026-10-16). No 2025-26 change found.

**Poki**
- **FACT**: curated. "Games that rely too heavily on AI-generated content… may not meet our standards." Poki may decline games lacking originality.
- **FACT**: games "**solely created with AI** can raise IP ownership issues". Developers must be able to show tools, process, prompts and iterations on request. No untested AI levels or code ([Poki developer guide](https://developers.poki.com/guide/content-player-safety), fetched 2026-10-16; undated).
- **FACT (secondary)**: revenue is 100% on your own traffic and 50/50 on Poki traffic, in exchange for web exclusivity ([Poki SDK, via search](https://sdk.poki.com/)).
- **FACT (secondary)**: Poki passed 1B monthly plays ([Dealroom](https://app.dealroom.co/news/feed/poki-hits-1b-monthly-plays-as-developer-first-model-boosts-top-studio-revenues-tenfold-1)).

**CrazyGames**
- **FACT (secondary)**: no AI-specific rule in its requirements, FAQ or terms (terms dated 2025-08-18). Usual originality rules apply. **Initial download <50 MB, <1,500 files, PEGI 12** ([PortalReady](https://portalready.world/portals/crazygames/), checked 2026-09-30; [CrazyGames docs](https://docs.crazygames.com/requirements/intro/)).

**Apple App Store**
- **FACT**: Apple has "no rules specifically against vibe coding apps". It enforces **2.5.2** and DPLA **3.3.1(B)** against apps that run generated code inside themselves ([9to5Mac](https://9to5mac.com/2026/03/18/apple-pushing-back-on-vibe-coding-iphone-apps-developers-say/), 2026-03-18).
- **FACT (secondary)**: Guidelines last updated **2026-06-08**; **4.3(b)** spam rule updated in June 2026.
- **FACT (secondary)**: in 2025 Apple reviewed **9,100,620** submissions and rejected **2,093,244**, with 415,532 rejections under Design (spam, copycats, minimum function).
- **FACT (secondary)**: new apps roughly doubled year on year (NYT, 2026-07-20). Sources for the last three points: Apple 2025 Transparency Report via [search summary](https://www.appetiteui.com/blog/app-store-vibe-coding-statistics).

**Google Play**
- **FACT**: Android developer verification took effect **2026-09-30**. A **2026-07-15** policy clarification says User Data rules apply to third-party AI integrations, and unrated apps are not allowed ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/17134731?hl=en)).
- **FACT**: the Developer Policy Center has an "AI-Generated Content" section ([play.google](https://play.google/developer-content-policy/)).
- **FACT (secondary)**: 1.75M policy-violating apps blocked and 80K developer accounts banned in 2025 ([TechRepublic](https://www.techrepublic.com/article/news-google-ai-blocked-1-75-million-apps-2025/), Feb 2026).
- **FACT (secondary, commercial blog)**: new personal accounts need a **closed test with 12 testers for 14 days** ([testerscommunity](https://www.testerscommunity.com/blog/low-quality-apps-2026-data)).

**What this means for TypePlay users**
- Everywhere accepts AI-made games, but the bar is **originality plus disclosure**. Steam and itch.io label them. Poki curates hard and asks for process evidence. Apple and Google filter "spam" and near-duplicates.

**TypePlay actions**
1. **Auto-write the disclosure.** Generate Steam and itch.io AI-disclosure text per game ("code and code-drawn art generated by AI under the creator's direction; CC0 3D assets from Kenney/Quaternius").
2. **Keep a process log.** Export the chat history and prompts as a "making-of" file per project, which answers Poki's IP request.
3. **Fight sameness.** Two users asking for "tower defence" must not get near-identical apps, or Apple's 4.3 and Play's spam rules will bite. Vary structure and code-drawn art per project; track a similarity check later.
4. **Play Store guide.** Tell Android users about the 12-tester/14-day rule early. It's the first wall a new user hits.
5. **Web portals.** Keep web exports under CrazyGames' 50 MB / 1,500-file limits; check Godot's web export size.
6. **A hub of its own.** A TypePlay gallery on typeplay.dev with link sharing is the minimum. Astrocade, Playground and Roblox all win on "someone plays my game".

---

## 8. Overall recommendations (lean)

1. **Reposition the headline now.** "Make a game from a prompt" is now Google's, Roblox's and Unity's pitch. TypePlay's unique claim, which none of them offers today: **"a real Godot project you own, built for Play Store, App Store, Steam and web, available worldwide."**
2. **Move Android export earlier if possible.** Store builds are the clearest gap in Playground, Spark and Roblox Build. Launch genres overlap Playground's starters (Tower Defense, Racing), so the gap has to be visible at launch, not after the paid beta.
3. **Launch outside the US first or worldwide.** Playground and Spark are US-only and 18+; Roblox Build is NZ, Serbia and Singapore.
4. **Don't fight the free tier on simple web games.** Claude artifacts, Gemini and Playground are free. Keep TypePlay's free tier as a taste and make the paid tier about exports and depth.
5. **Watch list (quarterly):**
   - Roblox Everywhere terms for Build games;
   - Unity Spark export/selling policy after the closed beta;
   - Playground countries and export terms;
   - an on-device or <$0.01/min world model (none today).

---

## Sources

**Moonlake**
- https://moonlakeai.com/ (fetched 2026-10-16)
- https://moonlakeai.com/blog/introducing-moonlake-ai
- https://moonlakeai.com/blog/introducing-reverie
- https://www.webwire.com/ViewPressRel.asp?aId=344520 (Oct 2025)
- https://www.webwire.com/ViewPressRel.asp?aId=350675 (2026-02-17)
- https://www.forbes.com/profile/moonlake-ai/ (2026-01-01)
- https://pitchbook.com/profiles/company/1084513-24

**Bitmagic**
- https://gamesbeat.com/bitmagic-unveils-ai-created-version-of-classic-civilization-game/ (2026-02-03)
- https://store.steampowered.com/app/2178290/Bitmagic/ (fetched 2026-10-16)
- https://steamdb.info/app/2178290/
- https://www.pocketgamer.biz/finnish-startup-bitmagic-raises-4-million-for-ai-platform-able-to-create-games-from-text-prompts/ (Jul 2024)
- https://max2dgame.com/compare/best-ai-game-makers.html

**Roblox and Lemonade**
- https://thenextweb.com/news/roblox-build-mobile-ai-game-creation (2026-07-16)
- https://ir.roblox.com/news/news-details/2026/Roblox-Unveils-New-Ways-to-Play-Build-and-Grow-at-the-Roblox-Developers-Conference-RDC/default.aspx (2026-09-11)
- https://about.roblox.com/newsroom/2026/09/rdc-2026-the-world-needs-more-play (2026-09-11)
- https://techcrunch.com/2026/09/11/roblox-is-making-it-easier-to-build-games-with-ai-and-play-them-outside-roblox/
- https://www.pcgamesn.com/roblox/rdc-2026
- https://about.roblox.com/newsroom/2026/04/roblox-studio-going-agentic (2026-04-15)
- https://techcrunch.com/2026/04/16/robloxs-ai-assistant-gets-new-agentic-tools-to-plan-build-and-test-games/
- https://about.roblox.com/newsroom/2026/02/accelerating-creation-powered-roblox-cube-foundation-model (2026-02-04)
- https://www.sec.gov/Archives/edgar/data/0001315098/000162828026051059/ex991-robloxq22026earnin.htm (Q2 2026)
- https://finance.yahoo.com/markets/stocks/articles/roblox-corp-rblx-q2-2026-050249366.html
- https://lemonade.gg/ (fetched 2026-10-16)
- https://x.com/nicolasvizi/status/1974506713316565171 (2025-10-04)
- https://naavik.co/podcast/building-ai-tools-for-roblox-creators/
- https://pitchbook.com/profiles/company/1508684-05
- https://x.com/StealthCoSpy/status/2085199186866418163

**Engines: Unity, Unity Spark, Unreal/UEFN, Godot**
- https://unity.com/spark (fetched 2026-10-16)
- https://www.gamedeveloper.com/programming/unity-unveils-unity-spark-an-prompt-based-tool-for-google-s-ai-games-platform (2026-10-07)
- https://gamefromscratch.com/unity-announce-unity-spark-game-engine/
- https://www.verticalslice.news/a-perpetually-self-feeding-meat-grinder-will-the-devs-who-adore-unity-and-googles-game-prompting-platforms-please-stand-up/ (2026-10-13)
- https://www.bobfm.co.uk/google-and-unity-introduce-ai-game-creation-platforms-as-unity-spark-demo-draws-criticism/
- https://daily.dev/posts/unity-spark-a-browser-based-ai-game-tool-launching-in-beta-with-google-s-playground-l2sxxgg6n
- https://www.pocketgamer.biz/unity-unveils-spark-ai-game-maker-with-google-playground-integration/
- https://www.kucoin.com/news/flash/google-launches-browser-based-ai-game-creation-platform-playground-partners-with-unity
- https://www.shanethegamer.com/news/unity-spark-google-playground/
- https://tech-insider.org/unity-spark-google-playground-roblox-2026/
- https://www.thegamebusiness.com/p/unity-ceo-the-cost-of-building-a (2026-08-25)
- https://discussions.unity.com/t/unity-ai-s-open-beta-now-live-for-unity-6/1718560 (2026-05-01)
- https://www.gamedeveloper.com/programming/unity-says-its-ai-tech-will-soon-be-able-to-prompt-full-casual-games-into-existence- (2026-02-16)
- https://www.buildfastwithai.com/blogs/unity-ai-open-beta-guide-2026
- https://www.engadget.com/2196807/epic-games-details-how-its-embracing-gen-ai-in-unreal-engine/
- https://cryptobriefing.com/unreal-engine-5-8-mcp-server-support/
- https://explainx.ai/blog/uefn-unreal-mcp-fortnite-verse-agents-august-2026
- https://www.fortnite.com/news/bring-npcs-to-life-with-ai-powered-conversations
- https://nosmokesport.com/game-news/epic-games-ai-voices-fortnite-creator-islands-july-2026/
- https://www.thestar.com.my/tech/tech-news/2026/10/13/fortnite-maker-epic-games-makes-039huge-pivot039-with-ai-ceo-says (2026-10-13)
- https://gameworldobserver.com/2026/10/13/no-more-hand-written-code-epic-games-decides-to-actively-utilize-ai-in-development
- https://www.theregister.com/ai-and-ml/2026/07/01/godot-says-bye-bye-ai-bans-vibe-coded-contributions/5265344 (2026-07-01)
- https://respawn.outlookindia.com/gaming/gaming-news/godot-draws-clear-line-on-ai-assisted-contributions
- https://forum.godotengine.org/t/changes-to-godot-contribution-policies-stricter-rules-against-ai-contributions/140986

**World models**
- https://9to5google.com/2026/01/29/google-project-genie/
- https://www.theregister.com/2026/01/29/googles_project_genie_ai/ (2026-01-29)
- https://en.wikipedia.org/wiki/Project_Genie_(website)
- https://www.aistackcurrent.com/models/genie-3/ (verified 2026-09-01)
- https://cybernews.com/ai-tools/google-project-genie-review/
- https://www.spheron.network/blog/gpu-infrastructure-world-models-2026/
- https://gigazine.net/gsc_news/en/20250825-ai-generative-world-mirage-2
- https://thenextweb.com/news/decart-300-million-radical-ventures-world-models (2026-05-18)
- https://www.calcalistech.com/ctechnews/article/sjt9ncukgl
- https://www.microsoft.com/en-us/research/articles/whamm-real-time-world-modelling-of-interactive-environments/
- https://www.microsoft.com/en-us/research/project/wham/news-and-awards/
- https://the-decoder.com/microsofts-new-ai-model-muse-can-generate-gameplay-and-might-preserve-classic-games/
- https://x.com/TencentHunyuan/status/1955839140173631656
- https://the-decoder.com/tencents-hunyuan-gamecraft-transforms-single-images-into-interactive-gaming-videos/
- https://arxiv.org/html/2511.23429v1
- https://newsroom.amd.com/news/amd-acquire-world-labs/ (2026-09-28)
- https://theaiinsider.tech/2026/02/19/fei-fei-lis-world-labs-raises-1b-in-fresh-funding-to-advance-development-of-world-models/
- https://invideo.io/blog/world-labs-marble-3d-worlds/

**General AI chat**
- https://blog.google/innovation-and-ai/technology/developers-tools/full-stack-vibe-coding-google-ai-studio/ (2026-03-18)
- https://blog.google/innovation-and-ai/technology/developers-tools/google-ai-studio-io-2026/ (2026-05-19)
- https://techcrunch.com/2026/05/19/googles-ai-studio-now-lets-anyone-build-android-apps-in-minutes/
- https://techcrunch.com/2026/10/13/google-play-now-supports-private-vibe-coded-apps-built-just-for-you/ (2026-10-13)
- https://www.shareduo.com/blog/claude-artifacts
- https://whatshotai.com/tools/claude-create-games/
- https://anthropic.com/news/claude-powered-artifacts
- https://propakistani.pk/2026/06/10/anthropics-all-new-claude-fable-5-can-build-playable-games-in-a-single-prompt/
- https://www.theshortcut.com/p/anthropic-releases-claude-fable-5-an-ai-model-that-can-build-playable-video-games-from-a-single-prompt
- https://learn.chatgpt.com/use-cases/browser-games
- https://developers.openai.com/showcase/games
- https://community.openai.com/t/a-proposal-for-an-integrated-gaming-center-within-chatgpt/1405787
- https://www.videogameschronicle.com/news/elon-musk-says-his-xai-company-will-release-a-great-ai-generated-game-by-the-end-of-2026/
- https://en.wikipedia.org/wiki/SpaceXAI
- https://www.basenor.com/blogs/news/can-grok-really-build-video-games-heres-what-we-know
- https://9to5mac.com/2026/03/18/apple-pushing-back-on-vibe-coding-iphone-apps-developers-say/ (2026-03-18)
- https://shipper.now/lovable-stats/
- https://www.getpanto.ai/blog/lovable-statistics
- https://zapier.com/blog/lovable-vs-bolt/
- https://pitchbook.com/profiles/company/664288-30
- https://newwebsim.fandom.com/wiki/Websim_(website)
- https://github.com/lappemic/awesome-ai-built-games

**Hubs, stores, portals**
- https://blog.google/innovation-and-ai/technology/ai/playground-experimental-gaming-platform/ (2026-10-07)
- https://9to5google.com/2026/10/07/google-labs-playground/
- https://the-decoder.com/google-bets-gemini-can-turn-casual-players-into-game-developers-with-new-playground-feature/
- https://www.eesel.ai/blog/google-labs-playground
- https://www.astrocade.com/blog/astrocade-raises-56m-funding (2026-05-05)
- https://fortune.com/2026/05/05/astrocade-raises-56-million-series-b-sequoia-video-games-platform-ali-amir-sadeghian/
- https://www.pocketgamer.biz/astrocade-raises-56m-to-expand-ai-powered-games-creation-platform/
- https://www.tweaktown.com/news/109743/valve-changes-ai-disclosure-guidelines-ai-powered-tools-are-now-exempt/index.html
- https://www.totallyhuman.io/blog/the-surprising-new-number-of-genai-games-on-steam
- https://www.totallyhuman.io/blog/games-with-ai-disclosures-have-grossed-an-estimated-660m-on-steam
- https://aitransparencyindex.com/stats (2026-10-16)
- https://app.cinevva.com/news/2026-07-20-steam-ai-disclosure-study
- https://www.pcgamer.com/gaming-industry/steam-week-in-review-take-cover-because-it-looks-like-more-than-half-of-steam-games-will-have-an-ai-disclosure-by-2027-2028/
- https://medium.com/@funvoke/is-ai-really-killing-the-gaming-industry-90060a53914b
- https://itch.io/docs/creators/quality-guidelines
- https://www.pcgamer.com/software/platforms/indie-distribution-platform-itch-io-now-requires-asset-creators-to-disclose-the-use-of-generative-ai-in-their-work/
- https://developers.poki.com/guide/content-player-safety
- https://app.dealroom.co/news/feed/poki-hits-1b-monthly-plays-as-developer-first-model-boosts-top-studio-revenues-tenfold-1
- https://portalready.world/portals/crazygames/
- https://docs.crazygames.com/requirements/intro/
- https://www.appetiteui.com/blog/app-store-vibe-coding-statistics
- https://support.google.com/googleplay/android-developer/answer/17134731?hl=en
- https://play.google/developer-content-policy/
- https://www.techrepublic.com/article/news-google-ai-blocked-1-75-million-apps-2025/
- https://www.testerscommunity.com/blog/low-quality-apps-2026-data
