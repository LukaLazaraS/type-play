# Competitors A: Rosebud AI, Astrocade, Upit

Research date: **2026-10-16**. Every figure is tagged **FACT** (source link + the source's date) or
**ESTIMATE** (method shown). "Read 2026-10-16" means I loaded the live page that day. Pricing is kept
short because `docs/research/competitor-pricing.md` (read 2026-10-14) already covers Rosebud and Astrocade.

**Limits of this pass.** The shared web-search budget (200 searches across all agents) ran out partway
through, so after that I only fetched known pages directly (company sites, app stores, Discord invite
API, YouTube, LinkedIn, Instagram, Trustpilot). Not collected:
- **X follower counts.** X needs a login, and Nitter shut down after X sent it cease-and-desist letters
  in Aug and Sep 2026.
- **Reddit.** Reddit now needs a login for its JSON and its pages.
- **Similarweb.** Left to the main researcher.

**Two products share the Rosebud name.** rosebud.app is an AI journaling app. Many reviews and
databases mix the two up; everything below is about rosebud.ai, the game maker.

## Summary

| | Rosebud AI | Astrocade | Upit (FRVR) |
|---|---|---|---|
| Status | Active, ~10-13 people, founder left (Apr 2026) | Active, fast growth, well funded | **Dormant** (site live, product stalled since mid-2025) |
| Money raised | ~$8.8-9.9M confirmed (+ unverified $15M A, undisclosed Oct 2025 round) | $68M ($12M seed + $56M A/B) | Parent FRVR ~$92-94M total; none Upit-specific |
| Users | 2.5M+ games created | 10M MAU, 220M sessions/mo, 100K+ games | No current numbers; Discord 2,083 |
| Price | Free / $15 / $30 / $50 / $100 credits | Free (no paid plan) | Free (gated beta, ~10 AI turns/day) |
| Export | Code download + Windows build (Pro $50) | None (walled garden) | None (web link) |
| Mobile store builds | No | No (their own Android app hosts games) | No |
| Threat to TypePlay | **High** (closest product) | **Medium-high** (mindshare, free anchor) | **Low** |

---

## 1. Rosebud AI (rosebud.ai)

### 1.1 Identity
- **URLs:** https://rosebud.ai (app and marketing), https://lab.rosebud.ai (blog and education).
  Older products: TokkingHeads (AI avatars), PixelVibe (AI assets), AI Storybook.
- **Legal name:** Rosebud AI, Inc. FACT: [Terms of Service](https://rosebud.ai/terms-of-service), revised
  2025-08-02. Governed by Delaware law. Copyright agent address: 101A Clay St #139, San Francisco.
- **HQ:** San Francisco. FACT: [rosebud.ai/company](https://rosebud.ai/company), read 2026-10-16.
- **Founder:** Lisha Li.
  - Background: PhD (ML / math and AI) from UC Berkeley; previously a principal at Amplify Partners and
    in data science at Pinterest and Stitch Fix. FACT: [Forbes profile](https://www.forbes.com/companies/rosebud-ai/)
    (2024-04-11); her X bio, via search snippet.
  - **Stepped down as CEO in April 2026** to become an a16z partner (infra and AI). She stays on the
    board. FACT: [rosebud.ai/company](https://rosebud.ai/company), read 2026-10-16; her
    [X post](https://x.com/lishali88/status/2047344892108771519), dated 2026-04-23 by decoding the post ID.
- **CEO since April 2026:** Vladimir Glazachev, previously Rosebud's ML technology lead (ZoomInfo, via
  search snippet). FACT: [rosebud.ai/company](https://rosebud.ai/company).
- **Team size:**
  - 13 employees listed on LinkedIn (company size band 2-10). FACT: [LinkedIn](https://www.linkedin.com/company/rosebud-ai/), read 2026-10-16.
  - 10 per YC (Jul 2026). FACT: [Getlatka](https://getlatka.com/companies/rosebud.ai), updated 2026-10-07.
  - 12 in Apr 2024. FACT: [Forbes](https://www.forbes.com/companies/rosebud-ai/).

### 1.2 Age and timeline
- **Domain:** rosebud.ai registered **2018-06-17** (NameCheap). FACT: RDAP at rdap.identitydigital.services, read 2026-10-16.
- **Founded:** 2019, Y Combinator **S19**. FACT: [rosebud.ai/company](https://rosebud.ai/company).

Timeline:
- **2019:** Y Combinator and Soma Capital round, 2019-08-19 (Crunchbase, via search snippet).
- **2020:** Seed round (amounts conflict, see 1.3). Press in the NYT and Washington Post about
  AI-generated people. TokkingHeads iOS app released 2020-11-20. FACT: iTunes lookup API.
- **Dec 2021 / Jan 2022:** $6.6M round.
- **2022-23:** PixelVibe AI asset generator.
- **Mar 2023:** Li prototypes the first text-to-game version (her farewell post, via search snippet).
- **2023-07-12:** Game maker in **alpha**, waitlist, Discord members first. FACT: [itch.io post](https://itch.io/blog/559716/first-look-at-rosebud-ai-game-maker-type-create-play).
- **Apr 2024:** Forbes says the full launch is set for mid-2024. Forbes AI 50 (2024) and CB Insights
  AI 100 (2024) (company page).
- **2025:** Repositioned around "vibe coding" and Three.js 3D. Terms revised 2025-08-02.
- **2025-10-25:** Crunchbase lists a funding round, details hidden. Most recent investors named there:
  Sahin Boydas and Jeff Dean (search snippet of [Crunchbase](https://www.crunchbase.com/organization/rosebud-ai)).
- **Mar-Apr 2026:** Engineering posts on porting Wesnoth, OpenRA, GZDoom and Unciv to the browser with
  AI agents. FACT: [rosebud.ai/engineering](https://rosebud.ai/engineering).
- **Apr 2026:** CEO change (above).
- **2026-07-28:** "Prompt Atlas", a map of what users ask for. FACT: [post](https://rosebud.ai/engineering/the-prompt-atlas).
- **~Sep 2026:** Integration with Reactor real-time video world models (blog; YouTube video "1 month ago").
- **2026-10-10:** **X Playables**: Rosebud games playable inside X posts. FACT: [engineering post](https://rosebud.ai/engineering/making-rosebud-games-playable-in-x-posts), [product page](https://rosebud.ai/x-playables).

### 1.3 Money

**Funding** (databases disagree):

| Date | Round | Amount | Investors | Source |
|---|---|---|---|---|
| 2019-08-19 | Pre-seed (YC) | not disclosed | Y Combinator, Soma Capital | Crunchbase snippet |
| Mar 2020 | Seed | $1.5M (Seedtable) or $2.2M (Latka) | Seedtable: lead David Carrico; Amplify Partners, Ilya Sutskever | [Seedtable](https://seedtable.com/companies/rosebud-ai) snippet; [Getlatka](https://getlatka.com/companies/rosebud.ai) |
| 2020-08-18 | not stated | not disclosed | Foothill Ventures, XRM Media | Crunchbase snippet |
| 2021-12-21 / Jan 2022 | Early-stage VC / seed | **$6.6M** | Adam D'Angelo + 4 others (Crunchbase); a16z listed (PitchBook) | [PitchBook](https://pitchbook.com/profiles/company/343168-12) snippet; Crunchbase snippet |
| 2024-10-24 | "Series A" | $15M | not named | [Signalbase](https://www.trysignalbase.com/news/funding/breaking-boundaries-rosebud-ai-secures-15m-in-series-a-funding-for-game-changing-ai-platform). **Unverified**: no press release, no investors, no other outlet. Treat as doubtful. |
| 2025-10-25 | not stated | hidden | Sahin Boydas, Jeff Dean | Crunchbase snippet |

- **Confirmed total:** $9.9M as of Apr 2024. FACT: [Forbes](https://www.forbes.com/companies/rosebud-ai/).
  Latka says $8.8M across two rounds (2026-10-07).
- **Named angels:** Karpathy, Sutskever, Balaji Srinivasan, Jeff Dean, Kevin Lin, Adam D'Angelo. FACT: [company page](https://rosebud.ai/company).
- **Valuation:** not found (Crunchbase, PitchBook and Latka don't show one).
- **Revenue:** ~$2.7M a year as of Dec 2024. This is **Latka's estimate**; the page says
  "Rosebud AI has not published its revenue". [Getlatka](https://getlatka.com/companies/rosebud.ai), updated 2026-10-07.
  No founder-stated revenue, ARR or paying-user count found.

**Pricing** (FACT: [rosebud.ai/pricing](https://rosebud.ai/pricing), read 2026-10-16; same as the 2026-10-14 study):

| Plan | Price | Credits | Key unlocks |
|---|---|---|---|
| Free | $0 | 8,000 a week | hosted, remix, branding, non-commercial |
| Indie Dev | $15/mo | 100K/mo | private projects, code tab in browser |
| 10x Dev | $30/mo | 300K/mo | commercial rights, no branding |
| Pro | $50/mo | 1M/mo | **code download + Windows build for Steam** |
| Scale | $100/mo | 2M/mo | auto-scaling hosting |

- All paid plans currently add 10K "refresh" credits a day ("Back to School bonus").
- Rough credit costs: Rosie (the default AI) edit ~2,000; premium-model edit ~20,000; image or sprite
  200-2,000; sound ~1,000; skybox ~2,000; 3D model ~1,000.
- Referrals: $10 to the friend and $10 to you, up to 5 friends. No refunds on subscriptions (ToS §20).

**One complete game on the cheapest paid plan (Indie Dev, $15): ESTIMATE**

Assumed small game: 20 Rosie turns + 10 images + 5 sounds.
- Credits: 20 × 2,000 + 10 × ~1,000 + 5 × 1,000 = **55,000 credits**.
- That is 55% of Indie's 100K a month, about **$8.25** at Indie's $0.15 per 1,000 credits (about 1.8
  games a month from monthly credits). Daily refresh credits stretch this; the cap per billing period
  isn't published.
- With the premium model: 20 × 20,000 = 400,000 credits, which is 4× Indie's month. On Pro that is
  ~$20 of credits ($0.05 per 1,000).
- **To sell it** you need 10x Dev ($30/mo). **To download the code or ship a Windows/Steam build** you
  need Pro ($50/mo).
- For comparison, TypePlay measured $0.16 of API for a Sonnet build.

### 1.4 Users and traction

| Metric | Value | Source and date |
|---|---|---|
| Games created | **2.5M+** | FACT: [rosebud.ai/company](https://rosebud.ai/company), read 2026-10-16. An older Rosebud kids' page said 700K+. |
| Discord | **17,218 members** (1,090 online) | FACT: Discord invite API `discord.com/invite/rosebud-ai`, read 2026-10-16 |
| YouTube | **4.89K subscribers**, 347 videos; recent videos get 279-2.1K views | FACT: [@rosebud-ai](https://www.youtube.com/@rosebud-ai), read 2026-10-16 |
| Instagram | 6,379 followers; last post Dec 19, 2022 (dormant) | FACT: [@rosebud_ai](https://www.instagram.com/rosebud_ai/), read 2026-10-16 |
| LinkedIn | 4,585 followers | FACT: [LinkedIn](https://www.linkedin.com/company/rosebud-ai/), read 2026-10-16 |
| X ([@Rosebud_AI](https://x.com/Rosebud_AI)) | not found (login wall) | |
| Reddit ([r/RosebudAI](https://www.reddit.com/r/RosebudAI/)) | not found (login wall) | |
| Product Hunt | product page exists ("Vibe Code Video Games With AI"), 0 followers, no launches | FACT: [PH](https://www.producthunt.com/products/rosebud-ai), read 2026-10-16 |
| App stores | **No game-maker app.** Legacy TokkingHeads (iOS): 4.69★, 26,300 US ratings, last update 2024-08-12 | FACT: iTunes lookup API, read 2026-10-16 |
| Trustpilot | 2.9 from 2 reviews, both 1★ | FACT: [Trustpilot](https://www.trustpilot.com/review/rosebud.ai), read 2026-10-16 |
| Creators shipping | 100 "success stories" listed, incl. Steam releases *Hollow Signal* and *Quantum Agent*, an MMORPG on the Epic store, and 40+ health games in 20+ pediatric clinics (vendor claims) | FACT: [lab.rosebud.ai success stories](https://lab.rosebud.ai/blog-category/success-stories), read 2026-10-16 |

### 1.5 Product
- **Input:** a chat prompt, **capped at 500 characters** (median prompt 152 characters; ~9% get cut
  off). FACT: Rosebud's own [Prompt Atlas](https://rosebud.ai/engineering/the-prompt-atlas), 2026-07-28.
  Users can start from templates (story, multiplayer obby, RPG, city builder) or remix a game.
- **Output:** a browser game in **real JavaScript on Three.js** (3D, voxel) and Phaser (2D, per
  third-party reviews), with generated art and sound, live preview beside the chat. FACT: [vibe-coding page](https://rosebud.ai/vibe-coding-tool),
  [AI game creator page](https://rosebud.ai/ai-game-creator), read 2026-10-16.
- **2D and 3D:** both, plus voxel.
- **AI models:**
  - The default model ("Rosie") isn't disclosed. A "premium model" costs 10× the credits.
  - Their YouTube channel tests Gemini 3 Pro, Gemini 3 Flash and "Gemini vs Claude" (videos about 9
    months old), so these are likely among the premium options. **ESTIMATE**, not confirmed.
  - Image assets use Google's Gemini image model, with BiRefNet for background removal. FACT: [asset pipeline post](https://rosebud.ai/engineering/building-ai-asset-pipeline), 2026-03-20.
- **Time to first playable:** "a playable game in minutes" (marketing). No measured figure found.
- **Iteration:** chat turns; a code tab from Indie Dev up; the editor shows the credits each turn used.
- **Exports:**
  - Hosted web link on rosebud.ai (all plans).
  - X Playables: an inline game card in X posts.
  - **Code download and Windows desktop build** ("publish on Steam") on Pro ($50) and up.
  - **No Android, iOS or Mac/Linux builds.**
- **Assets:** 2D sprites and sprite animation, 3D models, 360° skyboxes, sound, music (credit table).
  AI NPCs with memory and dialogue.
- **Multiplayer:** "Networking is already set up", co-op and PvP "without server setup". Third-party
  sources note it has no authoritative server.
- **Creator monetization:** no payouts or revenue share from Rosebud. Paid users keep "100% of profits"
  from games they sell elsewhere.
- **IP caveats in the ToS:**
  - §4(b): "Rosebud shall own and have all right and title to any data, content, code, artwork, or
    other materials" generated from prompts, even though paid users get commercial rights (§2(a), §4(c)).
  - Free-tier creations are non-commercial.
  - §4(d): user data trains models and may be licensed to third parties, **with no opt-out**.
- **Community:** remixing, a play gallery, hackathons ("No Slop Hackathon", parent-and-kid hackathons),
  the Discord.

### 1.6 Quality: what users say
- 1★, Trustpilot, 2026-09-23: "the actual hands-on experience has been incredibly frustrating and
  disappointing". Free credits run out fast and cloud saves are unreliable. [Trustpilot](https://www.trustpilot.com/review/rosebud.ai)
- 1★, Trustpilot, 2025-09-03: "It gives me barley any prompts per week before I have to pay to get
  more"; frequent bugs. [Trustpilot](https://www.trustpilot.com/review/rosebud.ai)
- Reddit sentiment as summarised by a competitor (Summer Engine, 2026-06-06): the prompt-to-playable
  loop is called "magic"; good for jams, classrooms and quick concepts; the recurring complaint is
  "great until I wanted to actually ship it" (no native export, limited 3D, no project file for a normal
  engine). [summerengine.com](https://www.summerengine.com/blog/best-ai-game-maker-reddit). Biased source.
- Another competitor (Nilo, 2026-09-09, updated 10-03) says the most common complaint is "The AI
  doesn't understand what I want", and cites a ~2,500-line code ceiling where the AI loses track.
  [nilo.io](https://nilo.io/articles/rosebud-ai-reviews-reddit). Biased; not verified.
- Rosebud's own video "Stop making games with one prompt" (~2026-09) shows the team pushing users
  toward multi-step building, i.e. one-shot results disappoint. [YouTube](https://www.youtube.com/@rosebud-ai/videos)

### 1.7 Go-to-market
- **Taglines:** "Creation is the new play"; "Build Games at the Speed of Thought"; "Vibe Code Video
  Games With AI".
- **Audience:** hobbyists and aspiring indie devs, kids and educators, and vibe coders generally
  (it also builds websites and web apps).
- **Channels:**
  - **SEO at scale.** About 365 blog posts (73 pages × 5): "alternative to Lovable/Bolt/v0/Cursor"
    pages, "games like ..." explainers, and genre landing pages (RPG maker, visual novel maker, 3D
    game maker, tower-defence style).
  - **Education:** an official Hour of Code activity, coding-for-kids pages
    ([lab.rosebud.ai/coding-for-kids](https://lab.rosebud.ai/coding-for-kids)), lab.rosebud.ai/education.
  - YouTube "Can AI make Fortnite / Roblox / Megabonk?" series.
  - Discord, hackathons, an itch.io profile, the referral program, and X Playables for viral sharing.
- **Partnerships:** none major found beyond the Reactor world-model integration.

### 1.8 Assessment for TypePlay
**Threat: HIGH.** It is the closest product to TypePlay: prompt → game → chat iteration, a credit
subscription priced like ours ($15-50), code export and a Windows/Steam build. It is also the incumbent
for searches like "AI game maker".

It is fragile, though:
- a team of ~10-13;
- the founder left for a16z in April 2026;
- funding is small and unclear (~$10M confirmed);
- Trustpilot complaints about credits and bugs.

**Copy:**
1. **Credit cost shown per turn** in the editor, plus a published credit-cost table (what an edit,
   image or sound costs).
2. **Proof-of-shipping stories** (Steam and itch releases by named creators). TypePlay should collect
   "shipped to Play Store / App Store" stories from beta 1.
3. **Programmatic SEO pages** per genre and per "alternative to X", plus a school/Hour of Code channel
   and social cards where the game plays inline (X Playables).

**Beat:**
1. **Native mobile builds.** Rosebud has no Android or iOS export, and its desktop export is gated at
   $50. TypePlay's Godot exports to the APK/AAB and iOS stores are the clearest gap.
2. **Ownership and trust.** Rosebud's ToS §4(b) claims ownership of generated output and trains on user
   data with no opt-out. TypePlay can promise "you own your game, full stop" in plain words.
3. **Quality and limits.** A 500-character prompt cap, browser-JS games, and reports of credit burn and
   bugs. TypePlay can win with test-run builds (every build is played and checked), longer briefs and
   cheap Haiku edits.

---

## 2. Astrocade (astrocade.com)

### 2.1 Identity
- **URL:** https://www.astrocade.com (web), plus an Android app.
- **Legal name:** **Astroblox, Inc.** FACT: [Terms](https://www.astrocade.com/terms-of-service) (updated
  2025-04-08; address 265 Mount Hamilton, Los Altos, CA; California law); [Google Play developer info](https://play.google.com/store/apps/details?id=com.astrocade.app)
  (300 Hamilton Ave, Palo Alto, CA 94301), read 2026-10-16.
- **HQ:** Palo Alto, CA (site JSON-LD and GamesBeat, Oct 2026); earlier Los Altos (seed coverage, 2024).
- **Founders** (FACT: [GamesBeat seed article](https://gamesbeat.com/astrocade-raises-12m-for-ai-based-social-gaming-platform/), 2024-06-11; [Astrocade blog](https://www.astrocade.com/blog/astrocade-raises-56m-funding), 2026-05-05):
  - **Amir Sadeghian, CEO.** Stanford PhD (Stanford AI Lab); previously founding director of AI/R&D at Aibee.
  - **Ali Sadeghian, CTO.** PhD; ex-Google Research. The two are brothers, Iranian-American, and both
    math/informatics Olympiad medalists.
  - **Fei-Fei Li,** co-founder. Titles vary between sources: "Chief Strategy Officer" or "Chief
    Scientific Officer". Co-director of Stanford HAI.
- **Team size:**
  - 43 employees on LinkedIn (band 11-50). FACT: [LinkedIn](https://www.linkedin.com/company/astrocade/), read 2026-10-16.
  - "A few dozen". FACT: [GamesBeat](https://gamesbeat.com/astrocade-hits-10m-monthly-players-for-its-ai-assisted-ugc-casual-games-platform/), 2026-10-07.
  - 13 at launch. FACT: [Fortune](https://fortune.com/2026/05/05/astrocade-raises-56-million-series-b-sequoia-video-games-platform-ali-amir-sadeghian/), 2026-05-05.
  - 18 including contractors in Jun 2024 (GamesBeat).
  - 9 open roles in Palo Alto (frontend, infra, RecSys, ML, product engineering, growth). FACT: [careers](https://www.astrocade.com/careers), read 2026-10-16.

### 2.2 Age and timeline
- **Domain:** astrocade.com registered **2008-07-21** (Squarespace Domains), last changed 2026-07-07.
  FACT: Verisign RDAP, read 2026-10-16. This is an older aftermarket domain; the name echoes the 1978
  Bally Astrocade console.
- **Founded:** 2022 (summer 2022 per Sequoia's David Cahn).

Timeline:
- **2023:** GamesBeat Next 2023 "Game Changers" top 25.
- **2024-06-11:** $12M seed. Product in **closed alpha** in a few countries, casual 2D games from text.
- **2025-04-08:** ToS lists subscriptions, "a la carte" billing and 7-day trials, though none is sold today.
- **Aug 2025:** public launch (Fortune). Listed on AlternativeTo on 2025-08-17. YouTube videos
  "Introducing Astrocade" (9.9M views) and "Introducing Astrocade 2.0" (1.5M views), both ~1 year old.
- **2025-09-22:** Ambassador program. **2025-10-27:** creator cash post ($100 when a game is featured).
- **Nov 2025:** CEO tells Sequoia it is "working"; term sheet the next day (Cahn).
- **2026-04:** Android app (Naavik). 2026-04-06: followers/following. 2026-04-14: Astro Academy.
- **2026-05-05:** $56M Series A + B. **$10M creator fund.**
- **2026-10-07:** 10M MAU reported. **iOS app "being prepared"**, and the first deliberate US push is still ahead.

### 2.3 Money

**Funding**

| Date | Round | Amount | Leads / investors | Source |
|---|---|---|---|---|
| 2024-06-11 | Seed | **$12M** | AME Cloud Ventures, Nvidia Ventures, Venture Reality Fund; angels Eric Schmidt, John Riccitiello, David Baszucki (Roblox CEO), Jerry Yang, Niccolo De Masi, Mike Abbott | FACT: [GamesBeat](https://gamesbeat.com/astrocade-raises-12m-for-ai-based-social-gaming-platform/) |
| 2026-05-05 | Series A + Series B (combined) | **$56M** | B led by **Sequoia**, A led by **Sea**; Google AI Futures Fund, NVIDIA, LG Technology Ventures, Dentsu Ventures, Conviction Embed, Chaac Ventures, Rogue VC | FACT: [Astrocade blog](https://www.astrocade.com/blog/astrocade-raises-56m-funding), [Fortune](https://fortune.com/2026/05/05/astrocade-raises-56-million-series-b-sequoia-video-games-platform-ali-amir-sadeghian/), 2026-05-05 |

- **Total:** $68M over 3 rounds. FACT: [Tracxn](https://tracxn.com/d/companies/astrocade/__t69tbE9q7gh0hwUSnmOw-0M1iyCjs5tL31Yn9xDNOT8) snippet.
- **Valuation:** not disclosed (Fortune).
- **Revenue:** **none disclosed, and no revenue model live yet.** CEO: "sometime next year we're going to
  start prioritizing the revenue" (GamesBeat, 2026-10-07). Google Play shows **no ads and no in-app
  purchases** (read 2026-10-16).
- **Pricing:** **free to create and play.** No paid plan. /pricing returns 404 (read 2026-10-16).
  - A "more powerful premium AI model" is offered only to selected Discord members. FACT: [Naavik](https://naavik.co/ai-gaming/astrocades-56m-raise-and-ugc-platforms-ai-enabled-future/), 2026-05-12.
- **Cost of one complete game: $0.** FACT: free, per Google Play FAQ "Yes, playing and making games on
  Astrocade is free". There is no paid plan to price.

### 2.4 Users and traction

| Metric | Value | Source and date |
|---|---|---|
| Plays (Dec 2025) | ~6M plays/month | FACT: [Cahn, Sequoia](https://dcahn.substack.com/p/investing-in-astrocade), 2026-05-05 ("up from 6M five months ago") |
| MAU (May 2026) | **5M MAU**, 140M plays/month, 75K+ games, creators in 80 countries | FACT: [Fortune](https://fortune.com/2026/05/05/astrocade-raises-56-million-series-b-sequoia-video-games-platform-ali-amir-sadeghian/), 2026-05-05 |
| "Engaged users" (May 2026) | **20M+** in 8 months since launch (company's own wider metric) | FACT: [Astrocade blog](https://www.astrocade.com/blog/astrocade-raises-56m-funding), 2026-05-05 |
| MAU (Oct 2026) | **10M MAU** (doubled in ~4 months), **220M sessions/month**, 100K+ "playables", "hundreds of thousands" of creators in 191 of 193 UN countries | FACT: [GamesBeat](https://gamesbeat.com/astrocade-hits-10m-monthly-players-for-its-ai-assisted-ugc-casual-games-platform/), 2026-10-07. Company data, not independently verified. |
| Users (careers page) | "Over 30 million users within months of launch" | FACT: [careers](https://www.astrocade.com/careers), read 2026-10-16 |
| Daily use and output | "Over 1 million people every day"; "over 1,000 free games published every day" | FACT: [Google Play listing](https://play.google.com/store/apps/details?id=com.astrocade.app), read 2026-10-16 |
| Android app | **4.4★, 10.1K reviews, 1M+ downloads**, updated 2026-10-14, rated Teen | FACT: [Google Play](https://play.google.com/store/apps/details?id=com.astrocade.app), read 2026-10-16 |
| iOS app | not live (in preparation) | GamesBeat, 2026-10-07 |
| Creator payouts | $10M creator fund; **$50K distributed** by May 2026; games need ≥100K significant plays in 30 days to qualify | FACT: [Naavik](https://naavik.co/ai-gaming/astrocades-56m-raise-and-ugc-platforms-ai-enabled-future/), 2026-05-12 |
| Payout rate | after 100K valid sessions, **$0.10 per 1,000 valid sessions** + "5x bonus" | FACT (secondary): [BigGo Finance](https://finance.biggo.com/news/73d3dd9a-795e-44aa-afba-187cfe88c93c), 2026-10-10 |
| Top-earner claims | Oct 2025: some creators "over $700" that month; $100 when a game is featured ([blog](https://www.astrocade.com/blog/how-game-creators-are-turning-creativity-into-cash-on-astrocade), 2025-10-27). May 2026: "thousands of dollars a month" (Fortune) | |
| Discord | **65,288 members** (2,821 online), server "Astrocade AI" | FACT: Discord invite API `discord.gg/astrocade`, read 2026-10-16. The invite linked on the site has expired. |
| YouTube | **309K subscribers**, 57 videos. Views: 76M (a remix video), 9.9M ("Introducing Astrocade"), 35K (funding video) | FACT: [@PlayAstrocade](https://www.youtube.com/@PlayAstrocade), read 2026-10-16. **ESTIMATE:** the 76M / 9.9M views on a 57-video channel look like paid ads, not organic reach. |
| Instagram | 44.2K followers | FACT: [@playastrocade](https://www.instagram.com/playastrocade/), read 2026-10-16 |
| LinkedIn | 3,227 followers | FACT: [LinkedIn](https://www.linkedin.com/company/astrocade/), read 2026-10-16 |
| X ([@PlayAstrocade](https://x.com/PlayAstrocade)), TikTok ([@PlayAstrocade](https://tiktok.com/@PlayAstrocade)) | not found (login and JS walls) | |
| Product Hunt | one unfeatured post on 2026-10-05: 1 upvote, daily rank #336, 0 reviews. Not an official launch. | FACT: [PH](https://www.producthunt.com/products/astrocade), read 2026-10-16 |
| Trustpilot | 2.9 from 4 reviews | FACT: [Trustpilot](https://www.trustpilot.com/review/astrocade.com), read 2026-10-16 |
| Example game | "Omnitrix City" (a Ben 10 remix): 740,762 plays; its creator has 4.3M total plays | FACT: astrocade.com home-page data, read 2026-10-16 |
| Audience | "Women between 20 and 40 are the best users" (Sequoia's Cahn, Fortune, May 2026); ~50/50 male/female, ages 18-45+ (GamesBeat, Oct 2026) | |

### 2.5 Product
- **Input:** describe a game in your own words (text, or a screenshot); remix an existing game; tweak
  exposed parameters. FACT: [Naavik](https://naavik.co/ai-gaming/astrocades-56m-raise-and-ugc-platforms-ai-enabled-future/); [blog](https://www.astrocade.com/blog/all-you-need-for-game-creation), 2025-10-09.
- **Pipeline:** "AstroBrain", their own orchestrator, coordinates specialist agents for visuals, UI,
  gameplay logic, animation, music and sound (Naavik).
- **AI models:** underlying LLMs not disclosed. The careers page talks about training on platform data,
  "world models" and RecSys.
- **Engine:** web JavaScript. I sampled a top game's published package: `isJsGame: true`, it loads
  **three.js 0.169** from jsDelivr, and it ships a `game_config` JSON of tunable values (timers,
  difficulty, audio) and a `persistent_storage_config` for leaderboards. FACT: own inspection, 2026-10-16.
  Both **2D and 3D (voxel)** games appear on the feed.
- **Time to first playable:** **~10 minutes** to generate, **~2 minutes** per edit (Naavik, 2026-05-12;
  BigGo, 2026-10-10). Publishing to the feed can take **up to a week** of review (Naavik).
- **Exports:** **none.**
  - Games live on Astrocade (web plus the Android app) and are shared by link.
  - No code download, APK, iOS or Steam build.
  - ToS §7 limits use of the Services to personal, non-commercial purposes.
  - On ownership, the ToS says "You own Your Content and your UGC", but Astrocade gets a perpetual,
    sublicensable license.
- **Assets:** art, animation, music, sound effects and thumbnails are all generated (Naavik; Google
  Play: "with the art, sound, and gameplay included").
- **Multiplayer:** leaderboards, challenges and score comparisons. No real-time multiplayer found.
- **Creator monetization:** paid by plays (see 2.4), the $10M fund, biweekly competitions with 100+
  creators, weekly game jams with cash for the top 5, and an Ambassador program with paid referrals.
  FACT: [creators page](https://www.astrocade.com/creators), [ambassador post](https://www.astrocade.com/blog/join-the-creative-revolution-astrocade-ambassador-program), 2025-09-22.
- **Community:** a TikTok-style personalised feed, followers, comments, likes, remix, leaderboards,
  creator analytics, and Astro Academy (8 free lessons).

### 2.6 Quality: what users say
- 5★-ish, Google Play, "Melissa", 2026-07-21 (91 found it helpful): "Games take more than a few prompts
  to make so don't get discouraged at a game looking bad at first ... It took me three months to become
  monetized." [Google Play](https://play.google.com/store/apps/details?id=com.astrocade.app)
- Google Play, "Aubrey Lagasca", 2026-07-22: only one game succeeded; on harder ideas "the ai just
  creates something bad. and sometimes it's so trash". [Google Play](https://play.google.com/store/apps/details?id=com.astrocade.app)
- Google Play, "Woodbooger _YT", 2026-08-24: "a masterpiece Ai game engine ... better then the others
  that you have to pay for"; wants offline play. [Google Play](https://play.google.com/store/apps/details?id=com.astrocade.app)
- Trustpilot, 2026-10-09, 1★: "Heavy amount of copyright infringement, very predatory system!" Same
  day, 1★: "just pure ai slop". 2026-05-26, 1★: "get impeded by guardrails". 2026-07-07, 5★: "the best
  website ever like i can do a game by just saying one prompt". [Trustpilot](https://www.trustpilot.com/review/astrocade.com)
- Press: Kotaku (2026-10-07) says it is "filled with AI slop"; top games are Minecraft clones,
  copyrighted characters and *Steal a Brainrot* knock-offs; "millions of people don't seem to care".
  [Kotaku](https://kotaku.com/ai-generated-games-platform-already-has-10-million-monthly-users-2000741894).
  Amplified on X by [Pirat_Nation](https://x.com/Pirat_Nation/status/2108091020286337358) (2026-10-08).

### 2.7 Go-to-market
- **Taglines:** "Where the Internet comes to play"; "Play Free Online Games or Create Your Own with AI".
  The CEO calls it "more like a new kind of YouTube", not Roblox, and prefers "playables" to "games".
- **Audience:** casual mobile players first (adults, ~50/50 gender, strong with women 20-40), then
  non-coder creators who want an audience and payouts.
- **Channels:**
  - The feed and app themselves.
  - Creator cash: payouts, the fund, jams, ambassadors.
  - YouTube video ads (ESTIMATE, from view counts).
  - Instagram, TikTok and Discord.
  - Trend-chasing content: World Cup, Halloween, "67" TikTok slang, TV/movie-inspired games.
  - Android first; iOS and a deliberate US push next.
- **Partnerships:** investors bring reach: Sea (Garena/Shopee, Southeast Asia), Google AI Futures Fund,
  NVIDIA, Dentsu (advertising), LG. Fei-Fei Li gives it credibility.

### 2.8 Assessment for TypePlay
**Threat: MEDIUM-HIGH.**
- **Direct overlap is limited.** Astrocade is a walled-garden consumer platform: no export, no code,
  no store builds, no ownership outside its feed. Someone who wants "my game on the Play Store" can't
  get it there.
- **But it owns the mindshare** for "make a game with AI". It anchors the price at **free**, has
  $68M, 10M MAU, a 65K Discord and 1M+ Android installs, and could add a paid pro tier or an export
  later. Its ToS already provides for subscriptions.
- Expect TypePlay's free tier to be compared to it directly.

**Copy:**
1. **Distribution for creators:** a public gallery/feed with play counts, analytics from day one, and
   remix. Show TypePlay games' plays on typeplay.dev and give creators stats.
2. **Tunable parameters** (a `game_config` with lives, costs, speed) exposed as sliders. Edits that
   need no AI call fit TypePlay's credit economics perfectly.
3. **Creator programs:** weekly jams with small cash prizes, an academy of short lessons, an ambassador
   referral program. Cheap ways to fill a community and a gallery.

**Beat:**
1. **Export and ownership:** APK/AAB, iOS and desktop builds the user owns and can sell. Astrocade can't
   offer this without breaking its platform model.
2. **Quality over slop:** "AI slop", IP clones and guardrail complaints are its public reputation.
   TypePlay can position on **original, test-run, polished** games (code-drawn art that is unique per
   game) and avoid clone-bait.
3. **Speed and control:** ~10 min generation, ~2 min edits, up to a week to reach the feed. TypePlay's
   instant preview, real code and model choice per message (Fast/Smart/Best) serve makers who care
   about the result, not the feed.

---

## 3. Upit (upit.com, by FRVR)

**Status: an AI game builder, but dormant.** The site is live and users still post, e.g. a post on
2026-10-16 with 1 view (home-page data). The signs of a stalled product:
- iOS app last updated **2025-05-29**;
- Instagram last post **2025-07-24**;
- an App Store reviewer (2026-01-29) says monthly challenges stopped and "no one from upit has posted a
  single update publicly since" summer 2025;
- the founder moved on to a "reverse incubator" (~Feb 2026);
- creation still needs a manually approved application.

I kept this section short and spent the time on Rosebud and Astrocade.

### 3.1 Identity
- **URL:** https://upit.com (renamed from FRVR.ai / beta.frvr.ai; earlier "FRVR Forge").
- **Legal name:** **FRVR Limited** (App Store seller). FACT: [App Store](https://apps.apple.com/us/app/upit-ai-game-maker/id6741482135), read 2026-10-16.
- **HQ:** FRVR's registered office is in Valletta, Malta; its core team is in Lisbon. FACT: [frvr.com/about](https://frvr.com/about/), read 2026-10-16. Tracxn says Copenhagen.
- **Founders:** Chris Benjaminsen, FRVR founder in 2014 (earlier Player.IO, 2010-13), and Brian Meidell,
  co-founder and CEO from 2016. FRVR's current CEO is **Joshua Chittick** (CTO → CEO in 2025).
  Benjaminsen announced a new "AI-Powered Reverse Incubator" ~8 months before 2026-10-16. FACT:
  [frvr.com/about](https://frvr.com/about/); [LinkedIn](https://dk.linkedin.com/in/chrisbenjaminsen) ("8md ago").
- **Team:**
  - FRVR shows 45 employees on LinkedIn (band 51-200) ([LinkedIn](https://www.linkedin.com/company/frvr/), read 2026-10-16).
  - "60+ co-workers, ~€10M turnover" per an FRVR job ad posted 6+ months ago ([Accel jobs](https://jobs.accel.com/companies/frvr-2/jobs/47100701-senior-software-engineer-upit)).
  - Upit's own team size: not found.

### 3.2 Age and timeline
- **Domain:** upit.com registered **1997-01-03** (GoDaddy), an aftermarket domain. FACT: Verisign RDAP, read 2026-10-16.

Timeline:
- **2023-06-29:** "FRVR Forge" announced. FACT: [Benjaminsen Substack](https://benjaminsen.substack.com/p/introducing-frvr-forge).
- **2023-11-13:** FRVR AI public beta. FACT: [LinkedIn post](https://www.linkedin.com/posts/frvr_frvr-ai-games-creator-public-beta-is-live-activity-7129895497489596417-jP_V), date decoded from the post ID.
- **2024-07-04:** press coverage; beta at beta.frvr.ai with 1,000+ creators. FACT: [AI News](https://www.artificialintelligence-news.com/news/frvr-ai-makes-game-creation-available-to-anyone/).
- **2024:** "launch of Upit" ([frvr.com/about](https://frvr.com/about/)).
- **2025-02-10:** iOS app 1.0.0; last update **1.0.12 on 2025-05-29**. FACT: iTunes lookup API.
- **~May 2025:** credits introduced, max ~10 AI interactions a day. **ESTIMATE** of the date, from an
  App Store review on 2026-01-29 that says "8 months ago".
- **2026:** FRVR's games expand to YouTube Playables and Huawei. Nothing new for Upit.

### 3.3 Money
- **Upit-specific funding:** none. **FRVR (parent):**
  - $76M in 2022 (Hiro Capital lead, Accel, Makers Fund; debt + equity).
  - **$12.7M on 2024-08-13** (lead Iberis Capital; Hiro, Indico, Lince), partly to build Forge/AI
    creation. FACT: [PocketGamer.biz](https://www.pocketgamer.biz/frvr-raises-127-million-towards-ai-engine-and-games-democratisation/). FRVR's own site says $13.2M.
  - Total $92.4M (PitchBook) or $94.3M (Tracxn, data as of 2026-02-28), via search snippets.
- **Revenue:** FRVR ~€10M turnover (job ad). Upit revenue: none (no paid product).
- **Pricing:** free. Creating needs an approved creator application ("typically 1-7 days"; users report
  waits of weeks). Credits cap AI use at ~10 interactions a day (user report).
- **One complete game: $0**, but rate-limited. **ESTIMATE:** a small game at 20-40 AI turns ÷ ~10 a day
  = **2-4 days** of quota.

### 3.4 Users and traction

| Metric | Value | Source |
|---|---|---|
| Discord | **2,083 members** (129 online), "Upit Creators" | FACT: Discord invite API `discord.gg/nP3TfGEXjX`, read 2026-10-16 |
| iOS app | **3.1★ from 13 US ratings** (UK: 4.0 from 5) | FACT: iTunes lookup API, read 2026-10-16 |
| Google Play | not found on FRVR's developer page (20 FRVR apps, none Upit) | read 2026-10-16 |
| YouTube | 45 subscribers, 2 videos | FACT: [@UpitCreators](https://www.youtube.com/@UpitCreators), read 2026-10-16 |
| Instagram | 48 followers, last post 2025-07-24 | FACT: [@upitcreators](https://www.instagram.com/upitcreators/), read 2026-10-16 |
| X ([@UpitCreators](https://x.com/UpitCreators)) | not found; the last activity seen in snippets is Jul 2025 | |
| Product Hunt, Trustpilot | not found (no PH product for upit/upit-ai/frvr-ai; Trustpilot 404) | |
| Plays | Top home-page game "Bubble Shooter" (by benjaminsen): 636,509 plays. The 85 games listed sum to 4.49M plays. Featured games date from 2024-03 to 2025-07. | FACT: upit.com home-page data, read 2026-10-16 |
| Parent reach | FRVR claims 2B+ lifetime players, 55+ distribution channels | FACT: [frvr.com/about](https://frvr.com/about/) |

### 3.5 Product
- **Input:**
  - a prompt or voice, a theme template (platformer, puzzle, obstacle course), or a remix;
  - **AVA**, an assistant that generates code, graphics and sound;
  - a "magic wand" that picks the next step for you;
  - full version history with revert;
  - **FaceKit**: control games with face, voice and movement.
- **Output:** **2D casual web games only**, in JavaScript on FRVR's HTML5 engine (`engineType: "LK"` in
  site data).
- **AI models:** "a set of commercial and open-source models" plus an "FRVR AI Model" (DailyAI,
  2024-05-17; Accel job ad). Not named.
- **Exports:** a web link on Upit only. FRVR's platform can push games to 30-55+ channels (Microsoft
  Start, Discord, YouTube Playables), but no self-serve export for users was found.
- **Monetization for creators:** contests with a $2,500 prize pool (now reportedly stopped). A creator
  economy was announced but is not live.
- **Multiplayer and 3D:** "on the roadmap" (App Store text).

### 3.6 Quality: what users say (App Store US, [reviews feed](https://itunes.apple.com/us/rss/customerreviews/id=6741482135/sortBy=mostRecent/json), read 2026-10-16)
- 1★, 2026-01-29: "they introduced credits, allowing for a max of 10 interactions with the ai a day
  (which is untenable ... while the ai loops trying to error correct your initial prompt)"; "monthly
  challenges ... left for summer break and never returned"; "it's sad to see such a formerly rad
  platform ruined and then abandoned".
- 2★, 2026-05-20: the wand button said "applied and wait so I waited for a month!"
- 5★, 2025-12-17: "After a week, I'm still 'pending' for approval."
- 5★, 2025-04-10: "it amazes me how I can tell an AI to make me a game just like that and snap its done."
- 5★, 2025-04-25: first game "amazing", but the editor crashes on every project.

### 3.7 Go-to-market
- **Taglines:** "Build games with AI"; "Roblox meets TikTok" (job ad); "the YouTube of games" (Benjaminsen).
- **Audience:** casual creators and teens (app rated 13+).
- **Channels:** FRVR's network, monthly contests, Discord, the iOS app. Today, effectively no active
  marketing.

### 3.8 Assessment for TypePlay
**Threat: LOW.** Dormant, gated, 2D-casual only, no export, and a tiny community. Its decline is a
lesson:
- capping AI use hard (10 turns a day) while the AI wastes turns fixing its own errors;
- stopping the contests;
- leaving the app un-updated.

These killed engagement.

**Copy:**
1. **FaceKit-style novelty controls** (camera, voice) as a later genre hook.
2. **The "magic wand" next-step suggestion** and **one-click revert** to any version (TypePlay already
   keeps git history per project; surface it).

**Beat:**
1. Native exports and 3D, which they never shipped.
2. Never charge the user for the agent fixing its own mistakes. TypePlay test-runs every build, so make
   failed or auto-fix turns free or cheap. This was Upit's #1 complaint.

---

## Cross-competitor takeaways for TypePlay

1. **Nobody in this set ships native mobile store builds.**
   - Rosebud: web + Windows only.
   - Astrocade: walled garden.
   - Upit: web link.

   "Your game on Google Play and the App Store" is TypePlay's open lane. Lead with it on the landing page.
2. **Price anchors:**
   - Astrocade: free and unlimited (VC-subsidised, no revenue yet).
   - Rosebud: $15-100 credits; commercial rights at $30, export at $50.
   - TypePlay's ~$20 plan with export included undercuts Rosebud's $50 export gate.
   - Free users will compare TypePlay to Astrocade: the free tier needs a clear "why pay": you own it
     and can export it.
3. **The recurring complaints are credits burned on AI errors, buggy results, and "can't ship it".**
   Test-run builds, cheap Haiku edits and honest per-turn cost display address all three.
4. **Reputation risk:** "AI slop" and IP clones (Kotaku on Astrocade). TypePlay's code-drawn,
   original-art policy is a marketable difference. Moderate clone prompts early.

---

## Sources

All read 2026-10-16 unless a date is given.

**Rosebud AI**
- https://rosebud.ai/company
- https://rosebud.ai/pricing
- https://rosebud.ai/terms-of-service (revised 2025-08-02)
- https://rosebud.ai/x-playables
- https://rosebud.ai/engineering
- https://rosebud.ai/engineering/the-prompt-atlas (2026-07-28)
- https://rosebud.ai/engineering/building-ai-asset-pipeline (2026-03-20)
- https://rosebud.ai/engineering/making-rosebud-games-playable-in-x-posts (2026-10-10)
- https://rosebud.ai/vibe-coding-tool
- https://rosebud.ai/ai-game-creator
- https://rosebud.ai/3d-game-maker
- https://lab.rosebud.ai/blog-category/success-stories
- https://lab.rosebud.ai/blog
- https://lab.rosebud.ai/coding-for-kids
- https://itch.io/blog/559716/first-look-at-rosebud-ai-game-maker-type-create-play (2023-07-12)
- https://www.forbes.com/companies/rosebud-ai/ (2024-04-11)
- https://getlatka.com/companies/rosebud.ai (updated 2026-10-07)
- https://www.crunchbase.com/organization/rosebud-ai (search snippet)
- https://pitchbook.com/profiles/company/343168-12 (search snippet)
- https://seedtable.com/companies/rosebud-ai (search snippet)
- https://www.trysignalbase.com/news/funding/breaking-boundaries-rosebud-ai-secures-15m-in-series-a-funding-for-game-changing-ai-platform (2024-10-24, unverified)
- https://x.com/lishali88/status/2047344892108771519 (2026-04-23)
- https://www.linkedin.com/company/rosebud-ai/
- https://www.youtube.com/@rosebud-ai
- https://www.instagram.com/rosebud_ai/
- https://www.producthunt.com/products/rosebud-ai
- https://www.trustpilot.com/review/rosebud.ai
- https://www.summerengine.com/blog/best-ai-game-maker-reddit (2026-06-06, competitor)
- https://nilo.io/articles/rosebud-ai-reviews-reddit (2026-09-09, competitor)
- Discord invite API: discord.com/invite/rosebud-ai
- RDAP: rdap.identitydigital.services/rdap/domain/rosebud.ai
- iTunes lookup id=1536511845

**Astrocade**
- https://www.astrocade.com
- https://www.astrocade.com/terms-of-service (2025-04-08)
- https://www.astrocade.com/careers
- https://www.astrocade.com/creators
- https://www.astrocade.com/blog
- https://www.astrocade.com/blog/astrocade-raises-56m-funding (2026-05-05)
- https://www.astrocade.com/blog/how-game-creators-are-turning-creativity-into-cash-on-astrocade (2025-10-27)
- https://www.astrocade.com/blog/all-you-need-for-game-creation (2025-10-09)
- https://www.astrocade.com/blog/join-the-creative-revolution-astrocade-ambassador-program (2025-09-22)
- https://fortune.com/2026/05/05/astrocade-raises-56-million-series-b-sequoia-video-games-platform-ali-amir-sadeghian/ (2026-05-05)
- https://dcahn.substack.com/p/investing-in-astrocade (2026-05-05)
- https://naavik.co/ai-gaming/astrocades-56m-raise-and-ugc-platforms-ai-enabled-future/ (2026-05-12)
- https://www.pocketgamer.biz/astrocade-raises-56m-to-expand-ai-powered-games-creation-platform/ (2026-05-07)
- https://gamesbeat.com/astrocade-raises-12m-for-ai-based-social-gaming-platform/ (2024-06-11)
- https://gamesbeat.com/astrocade-hits-10m-monthly-players-for-its-ai-assisted-ugc-casual-games-platform/ (2026-10-07)
- https://kotaku.com/ai-generated-games-platform-already-has-10-million-monthly-users-2000741894 (2026-10-07)
- https://finance.biggo.com/news/73d3dd9a-795e-44aa-afba-187cfe88c93c (2026-10-10)
- https://x.com/Pirat_Nation/status/2108091020286337358 (2026-10-08)
- https://x.com/PlayAstrocade/status/2051695066780221811 (2026-05-05)
- https://tracxn.com/d/companies/astrocade/__t69tbE9q7gh0hwUSnmOw-0M1iyCjs5tL31Yn9xDNOT8 (search snippet)
- https://play.google.com/store/apps/details?id=com.astrocade.app
- https://www.youtube.com/@PlayAstrocade
- https://www.instagram.com/playastrocade/
- https://www.linkedin.com/company/astrocade/
- https://www.producthunt.com/products/astrocade
- https://www.trustpilot.com/review/astrocade.com
- https://alternativeto.net/software/astrocade/about/
- Discord invite API: discord.gg/astrocade
- RDAP: rdap.verisign.com/com/v1/domain/astrocade.com

**Upit / FRVR**
- https://upit.com
- https://upit.com/learn/about
- https://apps.apple.com/us/app/upit-ai-game-maker/id6741482135
- https://itunes.apple.com/us/rss/customerreviews/id=6741482135/sortBy=mostRecent/json
- https://frvr.com/about/
- https://benjaminsen.substack.com/p/introducing-frvr-forge (2023-06-29)
- https://www.linkedin.com/posts/frvr_frvr-ai-games-creator-public-beta-is-live-activity-7129895497489596417-jP_V (2023-11-13)
- https://www.artificialintelligence-news.com/news/frvr-ai-makes-game-creation-available-to-anyone/ (2024-07-04)
- https://dailyai.com/2024/05/interview-chris-benjaminsen-co-founder-and-director-of-channels-at-frvr/ (2024-05-17)
- https://www.pocketgamer.biz/frvr-raises-127-million-towards-ai-engine-and-games-democratisation/ (2024-08-13)
- https://jobs.accel.com/companies/frvr-2/jobs/47100701-senior-software-engineer-upit
- https://dk.linkedin.com/in/chrisbenjaminsen
- https://www.linkedin.com/company/frvr/
- https://www.seeles.ai/compare/seele-vs-upit (Jul 2026, competitor)
- https://www.youtube.com/@UpitCreators
- https://www.instagram.com/upitcreators/
- https://pitchbook.com/profiles/company/231090-67 (search snippet)
- https://tracxn.com/d/companies/frvr/__z7L8pQyOYq7wo4yS3aqfWF4JCooYvIwQ7Hktz50UC8A (search snippet)
- Discord invite API: discord.gg/nP3TfGEXjX
- RDAP: rdap.verisign.com/com/v1/domain/upit.com

**Internal**
- `docs/research/competitor-pricing.md` (2026-10-14)
