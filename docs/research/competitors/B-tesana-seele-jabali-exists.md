# Competitor research B: SEELE, Jabali, Tesana, Exists

Research date: **2026-10-16**. Every figure below is tagged **FACT** (source and date given) or **ESTIMATE** (method given). Social, Discord, App Store, RDAP and LinkedIn numbers were read directly on 2026-10-16 unless another date is stated.

**Method limit:** the shared WebSearch budget ran out partway through. After that, everything came from direct fetches of the companies' own sites and docs, RDAP, the Discord invite API, the iTunes lookup API, X's embed timeline, YouTube and LinkedIn public pages, Product Hunt, Trustpilot and named articles. The things this left unsearched are listed at the end.

## At a glance

| | **Tesana** | **SEELE** | **Jabali** | **Exists** |
|---|---|---|---|---|
| What it is | "Lovable for games": chat → browser game, export, store | AI game agent with its own 3D models; Unity / Three.js / Unreal | Templates on the web + Jabali Studio (a desktop app, Godot + web) | 3D multiplayer shooters/racers from text, streamed from the cloud |
| Engine now | TypeScript + Three.js (3D) / Phaser (2D); **left Godot on 2026-09-28** | Three.js, Unity, Unreal 5 (Godot listed in the guide) | **Godot** (main engine) + web (Phaser, Three.js, R3F...) | Probably Unreal with cloud Pixel Streaming (ESTIMATE) |
| AI | Third-party frontier models chosen by its "Director"; markets **Claude Opus 5.5** | Its own models (Seele02 Flash/Pro/Ultra) | User picks the model (GPT 6 / 6.1, Gemini 3.x, GLM, Kimi, Grok) | Its own models (claimed) |
| Paid tiers | $25 / $50 / $200 | $20 / $50 (Free: 200 Koin) | $9.99 / $24.99 / $99.99 | not found |
| Exports | Web build, Win .exe, macOS .app, source; paid managed Steam ($200) / App Store ($99) publishing | Play link; .unitypackage / Unreal .uproject / WebGL for subscribers | Publish to jabali.ai only; standalone export "not available yet" | None found |
| Traction claim | 350K+ creators, 200K+ games; ~10K paying users in its first weeks | "3M+ creators" (homepage) / 366.1K active creators, 200K+ games (AWS) | "thousands of users" (Oct 2025) | not found |
| Discord | 1,321 | 17,836 | 4,229 | 6,945 |
| Threat to TypePlay | **HIGH** | **MEDIUM-HIGH** | **MEDIUM-LOW** | **LOW** |

---

## 1. Tesana (tesana.com / tesana.ai)

### 1. Identity
- **URLs:** https://tesana.com (site, studio and store), https://tesana.ai (blog, privacy, pricing), https://docs.tesana.ai (docs). FACT ([tesana.com](https://tesana.com/), [docs](https://docs.tesana.ai/), fetched 2026-10-16)
- **Legal entity:** Dreamsands Inc., a Delaware corporation. Mailing address 1111B S Governor Ave, Dover, DE 19904, which is a registered-agent style address. FACT ([tesana.com/terms](https://tesana.com/terms), [tesana.ai/en/privacy](https://tesana.ai/en/privacy), via search snippets 2026-10-16). The App Store seller is "Dreamsands Inc." FACT ([iTunes lookup](https://itunes.apple.com/lookup?id=6747117832&country=us), 2026-10-16)
- **HQ:** Los Angeles, CA. FACT ([Caplight](https://www.caplight.com/company/tesana), 2026-10-16)
- **Founders:**
  - Johannes Vermandois (CEO) and Eric (Erik) Heimer (CTO). FACT ([earninfos review, 2026-08-08](https://earninfos.com/article/tesana-ai-review-ai-game-maker))
  - Vermandois "has previously founded a skincare company and an AI marketing platform." FACT ([PC Gamer, 2026-04-03](https://www.pcgamer.com/software/ai/this-ai-startup-envisions-100-million-new-people-making-videogames/), [Yahoo syndication](https://tech.yahoo.com/gaming/articles/ai-startup-envisions-100-million-215753709.html))
  - Vermandois and Heimer founded Musicboard, a music app with ~462K downloads that was having outages in Feb 2026, and Dreamsands also publishes Frank AI and Helm. A planned acquisition of Frank AI by Freedom Holdings fell through in Sep 2024. FACT ([TechCrunch, 2026-02-09](https://techcrunch.com/2026/02/09/so-whats-going-on-with-musicboard/))
  - Read: serial consumer-app founders with no games background.
- **Team size:**
  - 4 employees as of Aug 2026. FACT ([Tracxn](https://tracxn.com/d/companies/tesana-ai/__NNmB8Fwhhrvp33PgbtDZr4tspHb01Ofilj-ZQJpE3Cw), updated 2026-09-27)
  - Employee range "4". FACT ([Caplight](https://www.caplight.com/company/tesana))
  - Dreamsands: 5 employees. FACT ([PitchBook snippet](https://pitchbook.com/profiles/company/539213-95), via search 2026-10-16)

### 2. Age
- **Company:** Dreamsands was founded in 2023. FACT (PitchBook snippet above). Tracxn says Tesana AI was "founded in 2026". FACT ([Tracxn](https://tracxn.com/d/companies/tesana-ai/__NNmB8Fwhhrvp33PgbtDZr4tspHb01Ofilj-ZQJpE3Cw))
- **Domains:**
  - tesana.ai registered **2026-02-22**. FACT (RDAP rdap.identitydigital.services, 2026-10-16)
  - tesana.com registered **1999-09-07** (GoDaddy), last changed 2026-06-24. FACT ([Verisign RDAP](https://rdap.verisign.com/com/v1/domain/tesana.com))
  - ESTIMATE: tesana.com is an aged domain bought around Jun 2026, judging by the last-changed date and the move of the product to tesana.com.
- **Timeline** (all FACT from [tesana.com/blog](https://tesana.com/blog) unless noted):
  - 2026-02-01 → 02-06: first blog posts (SEO articles: "vibe code games", "Lovable for games").
  - 2026-02-09: X account @TesanaAI created. FACT ([X embed timeline](https://syndication.twitter.com/srv/timeline-profile/screen-name/TesanaAI))
  - 2026-02-16: iOS app "AI Game Maker - Tesana" released. FACT ([iTunes lookup](https://itunes.apple.com/lookup?id=6747117832&country=us))
  - Mar 2026: shown at GDC. FACT (PC Gamer)
  - 2026-05-17: "Muranyi-3", sold as "our most powerful AI game model". It claimed ~70% faster generation and "90% of the most common errors" fixed. A desktop app for Mac/Windows was teased. FACT ([blog](https://tesana.com/blog/introducing-muranyi-3))
  - ~2026-05-31: "Studio refresh and credit fixes". It promised credits "will not get 'eaten'" and that you "only pay for work that actually completes." FACT ([blog html](https://tesana.com/blogs/studio-refresh-and-credit-fixes.html))
  - 2026-06-24: "Atomos" engine with a model picker (Atomos / Muranyi 3.2 / Muranyi Fast). FACT ([blog](https://tesana.com/blog/introducing-atomos))
  - 2026-07-23: "Loop" mode, which builds, plays, judges and rebuilds within a credit budget. FACT ([blog](https://tesana.com/blog/introducing-loop))
  - ~2026-08-18: Show HN. 16 points, 12 comments, claimed "250,000 builders". FACT ([HN](https://news.ycombinator.com/item?id=49334754), shown as "59 days ago" on 2026-10-16)
  - 2026-09-12: Image to Game. FACT ([blog](https://tesana.com/blog/introducing-image-to-game))
  - 2026-09-22: "Tesana Quality Index", their own game-building benchmark. The **model picker was removed**, Muranyi and Atomos were retired, and a "Director" now routes each part of a build to the best third-party model. FACT ([blog](https://tesana.com/blog/tesana-quality-index-and-ending-the-model-picker))
  - **2026-09-28: "From Godot to Three.js"** (details under 5. Product). FACT ([blog](https://tesana.com/blog/from-godot-to-three-js-faster-better-games-on-tesana))
  - Oct 2026: marketing on X is built around **"Opus 5.5 & @threejs on Tesana"** and viral user games. FACT ([X timeline](https://syndication.twitter.com/srv/timeline-profile/screen-name/TesanaAI), 2026-10-05 → 10-15)

### 3. Money
- **Funding:** unclear.
  - PitchBook says Dreamsands' latest deal is "Early Stage VC" with 3 investors; amount not shown. FACT (PitchBook snippet via search, 2026-10-16)
  - Tracxn says "has not raised any funding rounds". FACT (Tracxn, 2026-09-27)
  - Caplight's last-funding field is blank.
  - A "$20M valuation" appears on theresanaiforthat.com with no source, so it is **not reliable**.
  - No press release found.
- **Revenue / paying users:** "around **10,000 paying customers** in its first couple weeks", per Vermandois. FACT ([PC Gamer, 2026-04-03](https://www.pcgamer.com/software/ai/this-ai-startup-envisions-100-million-new-people-making-videogames/))
  - ESTIMATE: if most paid for Pro at $25, the first weeks' run-rate was ~$250K/month. This assumes all monthly Pro and no churn, and is unverified. No ARR figure found.
- **Pricing (FACT, [docs: plans & top-ups](https://docs.tesana.ai/credits/plans-and-topups), 2026-10-16):**

| Plan | Monthly | Annual | Credits / month | Notes |
|---|---|---|---|---|
| Free | $0 | – | **none** (plans only, daily limit) | Tesana branding |
| Pro | $25 | $240 | 2,500 | commercial rights, exports, no branding, sell on store |
| Max | $50 | $480 | 5,250 | + Loop, custom assets |
| Ultra | $200 | $1,920 | 22,000 | + highest limits, desktop app |

  - Top-ups: $10 / 1,000 credits (needs a plan), $25 / 2,500, $50 / 5,150, $100 / 10,500.
  - Credits are billed after the work for actual AI compute. Monthly credits reset each cycle.
  - SoonLab adds 250 daily bonus credits on Pro and multiplayer limits of Pro 10, Max 100 and Ultra unlimited concurrent players. FACT ([SoonLab, 2026-09-16](https://www.soonlab.ai/blog/tesana-ai-review/), a competitor's blog)
  - Store revenue split: **70/30**, $0.50 minimum price, payouts through Stripe Connect. Selling elsewhere after export has no fee. FACT ([docs: monetization](https://docs.tesana.ai/publishing/game-monetization))
  - Managed store publishing: **Steam $200 per game, App Store $99 per game** (Tesana's fee; you still need your own developer account). FACT ([docs](https://docs.tesana.ai/publishing/steam-and-app-store))
- **Cost of one complete game on Pro ($25 = 2,500 credits, $0.01/credit):**
  - A reviewer put it at "**$20-25 in token spend per project**", which is ≈2,000-2,500 credits, i.e. about one full Pro month per project. FACT, but Godot era ([daily.dev summary of a YouTube review, 2026-08-25](https://daily.dev/posts/this-is-the-best-ai-tool-for-making-indie-games-tesana-ai-z3inbnuqz))
  - A heavy user: "I built the first version of Aestra… in a weekend for **around $100**" and "spent my last **$1,400**" on the game overall. FACT, user claim ([X @M__Houser, 2026-10-09](https://x.com/M__Houser/status/2108432503128354890); [2026-10-15](https://x.com/M__Houser/status/2110750857528803516))
  - **ESTIMATE:** a simple complete game costs **$20-100 (2,000-10,000 credits)**. The cheapest Pro month covers roughly one simple game.

### 4. Users and traction
- **Platform claims:**
  - Homepage: **200,000+ games built, 350,000+ creators, 100,000,000+ minutes played, 150+ countries**. FACT, own claim ([tesana.com](https://tesana.com/), 2026-10-16)
  - The homepage's "built on Tesana today" counter read 703 games shipped and 13,805 new builders at fetch time. It is unverified and looks like marketing.
  - "Join 300k+ builders" on X. FACT, own claim (X, Oct 2026)
- **Social and app numbers (all 2026-10-16):**
  - **X @TesanaAI: 11,841 followers**, 1,284 posts, posting daily. FACT ([X embed](https://syndication.twitter.com/srv/timeline-profile/screen-name/TesanaAI))
  - **Discord: 1,321 members** (171 online). FACT ([Discord invite API](https://discord.com/api/v10/invites/6uqbFsdhSM?with_counts=true))
  - **YouTube @TesanaAI: 200 subscribers**, 37 videos. FACT ([YouTube](https://www.youtube.com/@TesanaAI))
  - **iOS app: 2.65★ from 26 ratings (US)**. Version 2.1, last updated **2026-04-22**, so not updated for ~6 months. FACT ([iTunes lookup](https://itunes.apple.com/lookup?id=6747117832&country=us))
  - No Android app found (guessed Play package ids returned 404).
- **Product Hunt:** no product page found (`/products/tesana` and `tesana-ai` return 404).
- **Viral user games, as amplified by Tesana:**
  - A space-exploration game reached "3M+ views and 12,000+ unique players". FACT ([X @Rubzem, 2026-10-07](https://x.com/Rubzem/status/2107828818165833976))
  - Tesana said "over 16,000 unique players". FACT ([X @TesanaAI, 2026-10-13](https://x.com/TesanaAI/status/2109853468358009022))
  - "Aestra" ARPG: "over 17,000 of you have played". FACT ([X, 2026-10-15](https://x.com/M__Houser/status/2110750857528803516))
- **Traffic:** left to the main researcher (Similarweb).

### 5. Product
- **Input and output:** the user types a prompt, optionally with reference images, and gets a playable browser game.
  - Choices: 2D pixel, 2D modern or 3D; top-down, side-on or first-person; desktop or phone with touch controls, portrait or landscape.
  - Modes: **Agent** (build now), **Plan** (approve a plan first, costs little) and **Loop** (autonomous build → play → judge → rebuild within a credit budget, can run "while you sleep").
  - Other features: version history with instant revert and preview of old versions, inline diffs, a code editor, an assets page with regenerate/delete, image references, voice mode, a prompt queue, collaborators and remix ("make a copy"). FACT ([docs](https://docs.tesana.ai/), [How Tesana works](https://docs.tesana.ai/how-tesana-works))
- **Engine:** TypeScript + **Three.js** (3D, with real-time physics) and **Phaser** (2D), bundled with Vite. Older games stay on **Godot** as "legacy". FACT ([docs](https://docs.tesana.ai/how-tesana-works))
  - **Why they left Godot (2026-09-28):**
    - "Godot is built for people working inside an editor… every generation had to pass through an engine-specific project format and a full export before anyone could play it."
    - "a small error in a scene file or an export setting could break a game."
    - "Average generation time… dropped from around **60 minutes to under 5**."
    - "Most of that hour wasn't spent writing the game. It was spent moving the game through Godot: building the project structure, exporting it for the web, and retrying when a build failed."
    - FACT ([blog html](https://tesana.com/blogs/from-godot-to-three-js-faster-better-games-on-tesana.html))
- **AI models:**
  - Third-party frontier models routed by the "Director", per part of the build (logic, assets, world, sound, UI), scored on its own TQI benchmark. FACT ([TQI post](https://tesana.com/blog/tesana-quality-index-and-ending-the-model-picker))
  - Marketing names **Claude Opus 5.5** ("Powered by Opus 5.5 & @threejs on Tesana"). FACT ([X, 2026-10-05](https://x.com/TesanaAI/status/2107244988090462268))
  - Users also mention Fable 5.5. FACT ([X @Thomas_jorgen, 2026-10-06](https://x.com/Thomas_jorgen/status/2107273424884408349))
- **Time to first playable:** "several minutes to a few tens of minutes", average under 5 minutes since the Three.js switch. FACT (docs; blog)
- **Exports** (paid plans only):
  - Web build (HTML), **Windows .exe**, **macOS .app** and full **source** (Vite + TS; a Godot project for legacy games). Only original games can export source. FACT ([docs: exports](https://docs.tesana.ai/building/exports))
  - **No Android APK/AAB and no iOS build export.** App Store and Steam are a paid managed service (above).
  - ESTIMATE: since games are now web code, the desktop and App Store builds must be web wrappers. Tesana's own desktop app is built on Tauri (a "Tauri desktop bundle" comment in their site HTML).
- **Assets:** AI-generated visuals, effects and audio. Custom asset import on Max and above. FACT (docs)
- **Multiplayer:** hosted rooms, guests allowed, no servers to run. Each game gets a `yourgame.tesana.com` subdomain. FACT ([docs: multiplayer](https://docs.tesana.ai/publishing/multiplayer))
  - Users show 10v10 FPS and "1000-player" worlds. FACT ([X @Rubzem](https://x.com/Rubzem/status/2109678375975706743))
- **Creator monetization:** paid or pay-what-you-want games on the Tesana store, 70/30 split. FACT (docs)
- **Community:** store with genre charts (most played, highest rated, trending), remix, referrals, Discord. FACT ([tesana.com](https://tesana.com/))

### 6. Quality: what users say
- **Praise:** "makes beautiful and playable games" ("Love it but", App Store AU, Mar 2026). FACT ([App Store AU](https://apps.apple.com/au/app/ai-game-maker-tesana/id6747117832))
- **Praise:** "Surprisingly Amazing… better than other AI game generators" (App Store US, May 1). FACT ([App Store reviews](https://apps.apple.com/us/app/ai-game-maker-tesana/id6747117832?see-all=reviews&platform=iphone))
- **Complaint (credits):** "you think you're getting one amount and end up with a lesser amount"; tokens spent with no demo produced ("Potential but misses the mark", Jul 12). FACT (same page)
- **Complaint (results):** "Scam": bought Pro and tokens, and two attempts gave unplayable or grey-screen games; the Terms link was broken (May 31). FACT (same page)
- **Complaint (quality, originality):** "janky and shallow, often plagiarised"; screenshots look like Balatro and Cuphead copies; the landing prompt asks for payment after sign-up. FACT ([Show HN thread, ~2026-08-18](https://news.ycombinator.com/item?id=49334754))
- **Press:** PC Gamer said one user game looked like "Skyrim if you took it out of the computer, stomped on it, and then smushed some of the pieces back in", and that the first games "have nothing to offer" outside the people making them. FACT ([PC Gamer, 2026-04-03](https://www.pcgamer.com/software/ai/this-ai-startup-envisions-100-million-new-people-making-videogames/))

### 7. Go-to-market
- **Taglines:** "Create your own games with AI from a simple text prompt - no coding required"; "the world's most popular AI game builder"; "Unity for AI Games, 3D Worlds" (App Store). FACT
- **Audience:** non-coders and wannabe indie developers.
- **Channels:**
  - **X creator amplification:** retweets of users' viral games, "I quit my job" stories, and Opus 5.5 / three.js tagging to ride model-launch hype.
  - Embedded TikTok, Instagram and Facebook reels from third-party creators (@coma.tv, @aiwithwendie) on the homepage.
  - SEO blog posts ("Can I make games with Lovable?").
  - GDC (Mar 2026), Show HN, iOS app, referral program.
  - Meta pixel and Mixpanel in the site HTML, so they likely run paid social (ESTIMATE).
  - FACT unless marked.
- **Partnerships:** none found.

### 8. Assessment for TypePlay: **HIGH threat**
They are the closest copy of TypePlay's pitch: "Lovable for games", chat iteration, instant browser play, credits at $25/$50, exports, and Claude Opus 5.5 underneath. They ship fast (a major release roughly every 2-4 weeks) and run a working X virality engine.

**Copy:**
1. **Plan / Agent / Loop modes, with a per-prompt Usage ledger and "pay only for work done".** Their failed-generation policy bills only the work done before a failure. This answers the #1 complaint across this market (credits eaten).
2. **The creator-success loop:** a subdomain per game, a store with charts and a 70/30 split, hosted multiplayer, and loud amplification of users' viral games on X.
3. **Instant revert and preview of old versions, inline diffs, and an assets page with "regenerate".**

**Beat them on:**
1. **Native mobile export.** They have no Android APK/AAB and no iOS export (App Store only as a $99 managed service), and they gave up Godot, so they no longer have a native build path. TypePlay's Godot export to Android/iOS/Steam is the gap.
2. **Price per game and a free tier.** Their Free plan has **no credits** (the paywall at the first prompt is an HN complaint), and a game costs ~$20-100. TypePlay measured $0.07-0.16 per Haiku/Sonnet build (`packages/agent/RESULTS.md`).
3. **Reliability and trust.** 2.65★ iOS with credit complaints, a broken Terms link, and "plagiarised / janky" output. TypePlay test-runs every build, and could add an originality guard (refuse "clone Cuphead" prompts).

**Note for TypePlay's Godot choice:** Tesana's stated pain was ~60 min per build from Godot project structure, web export and failed-build retries. TypePlay already measured a Sonnet build at 1.6 min and Haiku at 8-12 min on Godot. The lesson is to keep export and scene-file failures out of the loop (generate scenes in code, cache the web export template), not to change engine.

---

## 2. SEELE (seeles.ai), Chinese name 全灵

### 1. Identity
- **URLs:** https://www.seeles.ai (product: SeeleAgent workspace, guide, API), seele.tv (AI video studio). FACT ([about-us](https://www.seeles.ai/about-us))
  - seele.ai is a different, older registration (2020-04-09) and is **not** shown as SEELE's.
  - Several crypto "SEELE" tokens are unrelated.
- **Legal entity:** **SEELE Technology Limited**, Room B3, 19/F Tung Le Commercial Building, 91-97 Jervois Street, Sheung Wan, **Hong Kong**. Hong Kong law. FACT ([Terms](https://www.seeles.ai/terms-of-service), last updated 2026-07-28)
  - Other names in use: "SEELE AI, Inc." (Terms section 7, and LinkedIn with a Shenzhen Nanshan address) and "Seele Inc." (Bloomberg).
- **HQ:** Shenzhen + Hangzhou, China. FACT ([about-us](https://www.seeles.ai/about-us); [LinkedIn](https://www.linkedin.com/company/seeleai))
- **Founders:**
  - **Wang Shimu (王诗沐)**, co-founder and CEO. He founded **NetEase Cloud Music** (the page claims growth to 60M DAU and a $3B valuation), was GM of Tencent NBase innovation and head of Tencent News, and left Tencent in 2022.
  - Co-founders **Guo Zhengdong** (who named the company) and **Wu Mingran**.
  - FACT ([about-us](https://www.seeles.ai/about-us); [FounderPark/163 interview, 2024-11-18](https://www.163.com/dy/article/JH9A4CQ305566TJ2.html))
- **Team:**
  - "30+ people plus interns", from Tencent, ByteDance and Alibaba. FACT ([about-us](https://www.seeles.ai/about-us), 2026-10-16)
  - LinkedIn: 6 associated members, 36 followers. FACT ([LinkedIn](https://www.linkedin.com/company/seeleai))
  - Caplight: "grew 60% QoQ from 5 to 8 employees" (2025-11-16 signal). FACT ([Caplight](https://www.caplight.com/company/seeles))
  - LinkedIn undercounts Chinese teams. Use 30+.

### 2. Age
- **Founded:** late 2022. FACT (163 interview, 2024-11-18; Caplight "2022")
- **Domain:** seeles.ai registered **2023-04-07**. FACT (RDAP rdap.identitydigital.services, 2026-10-16)
- **Timeline:**
  - 2024: first overseas consumer product. It was a 3D AI-companion / character app, **KOKO AI**; their X account posted #KOKOAI in Mar 2025. Claimed "nearly one million users in half a year". FACT ([163 interview](https://www.163.com/dy/article/JH9A4CQ305566TJ2.html); [AIHub, 2024-11-20](https://www.aihub.cn/news/seele-koko-ai/))
  - 2024-11-17/18: Pre-A round (below).
  - 2025-02-17: X account @SEELE_AI1125 created. FACT ([X embed](https://syndication.twitter.com/srv/timeline-profile/screen-name/SEELE_AI1125))
  - **2025-05-20/21: pivot to games.** "SEELE LMM: the first end to end infinite gaming large multimodal… generate and edit 3D interactive game content." FACT (X post 2025-05-20; [Sohu/智东西, May 2025](https://zhidx.com/p/483171.html))
  - 2025-05-28: Bloomberg reports SEELE seeking new funding "at a valuation of several hundred million dollars". FACT ([Bloomberg](https://www.bloomberg.com/news/articles/2025-05-28/baidu-backed-ai-3d-game-creator-seele-seeks-new-funding))
  - ~Feb 2026: Show HN (2 points; engines Three.js + Unity WebGL; "basic demo-level games"). FACT ([HN](https://news.ycombinator.com/item?id=46897381), "8 months ago")
  - 2026-02-08: Product Hunt launch, **#194 of the day**, not featured. FACT ([Product Hunt](https://www.producthunt.com/products/seele-ai))
  - 2026-06-05: Seele 3DLMM + SeeleAgent premiered in Shanghai (Jing'an "Model World" zone). FACT, third-party ([Baidu Baike EN](https://baike.baidu.com/en/item/Seele%203DLMM/1759600))
  - ~2026-08-05: **Seele02** released. FACT, third-party directory ([TAAFT](https://theresanaiforthat.com/model/seele02/))
  - Seele02 is a Mixture-of-Transformers model in Flash/Pro tiers, with Ultra "now live". FACT ([seeles.ai](https://www.seeles.ai/))
  - **PEGA world model planned for Q3 2026**; eva01 to be open-sourced "SOON". FACT ([about-us](https://www.seeles.ai/about-us))

### 3. Money
- **Pre-A round:** "tens of millions of USD" (千万美元); English press says **$10M**, Nov 2024.
  - Led by **Baidu Ventures / Baidu strategic investment**, with Meitu, 富坤创投 (Fukun / Richland Equities) and existing shareholder Webtime Information S&T.
  - FACT ([Sina/36Kr, 2024-11-18](https://finance.sina.com.cn/stock/hkstock/hkzmt/2024-11-18/doc-incwpcef0073586.shtml); [Dealroom](https://app.dealroom.co/news/feed/seele-raises-10m-for-3d-platform); PitchBook date 2024-11-17 via search)
- **Total raised:** $12.9M. FACT ([Caplight](https://www.caplight.com/company/seeles), 2026-10-16; investors Baidu Ventures and Baidu Strategic Investment)
- **Next round:** sought in May 2025 at "several hundred million dollars". FACT (Bloomberg 2025-05-28)
  - **Whether it closed: not found** (no report of an A round in Chinese or English results).
  - A "$300M valuation" on TAAFT is unsourced.
- **Revenue / paying users:** no figures.
  - About-us says revenue today is "subscriptions and Koin purchases", with "paying creators in the US, UK, Australia, and Canada". FACT
  - AWS case study: they use **Claude via Amazon Bedrock** for internal "end-to-end automation", with prompt caching tuned with AWS. FACT ([AWS](https://aws.amazon.com/solutions/case-studies/seele/))
  - Their compare page says games are built on their own models, not Anthropic's. FACT ([compare](https://www.seeles.ai/compare/seele-vs-claude-code))
- **Pricing** (FACT, [seeles.ai/upgrade](https://www.seeles.ai/upgrade) as indexed by search 2026-10-16 and [compare page](https://www.seeles.ai/compare/seele-vs-claude-code)):

| Plan | Price | Koin / month | Notes |
|---|---|---|---|
| Free | $0 | 200 | |
| Standard | **$20** ($17 annual, save 22%) | 2,000 | Seele02-Pro model, unlimited 3D/asset downloads, 20 GB, 10 parallel tasks |
| Pro | **$50** | 6,000 | + Seedance 2.5 video, 50 GB |
| Enterprise | contact | – | |

  - One-time Koin packs are also sold. The API is $10.90 per 1,000 Koin. FACT ([AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-3vuhpvnyladaq))
  - **Commercial rights need "Pro tier or above"** (ToS 4.2(a)).
  - Subscription Koin does **not** roll over per the ToS, which contradicts the upgrade page.
  - Earlier prices (~Apr 2026): Standard $16.9, Pro $36.9, Ultra $149 (50,000 Koin). FACT ([PickAITool](https://pickaitool.com/ai-tool/seele-ai/))
- **Koin costs** (FACT, [Guide](https://www.seeles.ai/guide), "estimated averages from real usage"):

| Action | Flash | Pro |
|---|---|---|
| Playable game | ~120-140 | ~1,400-1,500 |
| Iterate / revise | ~77-81 | ~520-710 |
| Image | ~20 | |
| Video | ~186 | |
| 3D asset or scene | ~18 | |

- **One complete game on Standard ($20 / 2,000 Koin = $0.01/Koin), ESTIMATE:**
  - Flash: 1 generation + 10 iterations ≈ 130 + 10 × 79 = **~920 Koin ≈ $9.20**, so ~2 games a month.
  - Pro: 1 generation + 3 iterations ≈ 1,450 + 3 × 615 = **~3,300 Koin ≈ $33**, which doesn't fit in Standard and needs the $50 plan.
  - Selling the game also needs Pro.

### 4. Users and traction
- **Claims, inconsistent:**
  - "Trusted by **3M+ creators** as of 2026". FACT, own claim ([homepage](https://www.seeles.ai/), 2026-10-16)
  - "**366.1K active creators**… more than **200,000 games**". FACT ([AWS case study](https://aws.amazon.com/solutions/case-studies/seele/), ~late Sep 2026)
  - "50,000+ games created, 2.5M+ assets, 78% 7-day return". FACT, own claim ([blog, 2026-02-06](https://www.seeles.ai/resources/blogs/ai-game-development-beyond-lovable-seele))
  - ESTIMATE: the 3M likely counts all sign-ups, including the earlier companion app; 366K active is the more credible figure.
- **Discord: 17,836 members**. FACT ([Discord API](https://discord.com/api/v10/invites/7C84WdttGM?with_counts=true), 2026-10-16). Their main community and support channel.
- **X @SEELE_AI1125: 742 followers**, 171 posts; newest post in the embed is **2025-09-26**, so X is dormant. FACT ([X embed](https://syndication.twitter.com/srv/timeline-profile/screen-name/SEELE_AI1125))
- **YouTube @SEELE-AI1125: 76 subscribers**, 9 videos. FACT ([YouTube](https://www.youtube.com/@SEELE-AI1125))
- **TikTok @seele_ai:** exists; count **not retrieved** (TikTok blocks logged-out fetches).
- **LinkedIn:** 36 followers. FACT
- **Trustpilot: 4.8 from 102 reviews** (87% 5-star). Trustpilot notes the company "has not replied to negative reviews". FACT ([Trustpilot](https://www.trustpilot.com/review/seeles.ai), 2026-10-16)
- **Product Hunt:** 2026-02-08, #194 daily, #1,689 weekly. FACT
- **Apps:** none found on the site (no store links in the HTML). The App Store search couldn't be run, so this is not fully checked.

### 5. Product
- **Input and output:** the user types a prompt to SeeleAgent, a "game-native harness agent", and gets a hosted, browser-playable **2D or 3D game**. The same agent also makes images, video, 3D assets (FBX/GLTF/OBJ, auto-rigging, a "5M+" animation preset library) and web pages. Plan mode gives milestones. FACT ([homepage](https://www.seeles.ai/), [guide](https://www.seeles.ai/guide))
- **Engines:**
  - **Three.js** (browser), **Unity** (Unity 6 / 2022 LTS+, C# in a **.unitypackage**) and **Unreal 5** (C++ / Blueprints **.uproject**, Pro model only).
  - The guide also lists **Godot** ("light 2D or simple 3D").
  - FACT ([API page](https://www.seeles.ai/features/api); [guide](https://www.seeles.ai/guide))
- **Models:** their own Seele02 (Flash, Pro, Ultra) and eva01 (3D-native mesh model).
  - They claim #1 on "GameCraft-Bench" (65.3% vs GPT-5.6 Sol 60.7%) and "GameDevBench Pass@1" (65.8%). FACT, vendor-reported ([homepage](https://www.seeles.ai/))
- **Time to first playable:** Flash 2-10 min, Pro 10-20 min (API); "2-30 minutes" overall. FACT ([API page](https://www.seeles.ai/features/api))
- **Iteration:** chat revisions (~77-81 Koin Flash, ~520-710 Koin Pro each).
- **Exports:**
  - Play link (all users); artifact downloads (subscribers): WebGL / Three.js source, .unitypackage, .uproject. FACT (API page)
  - They claim Unity export reaches Windows, Mac, Linux, iOS, Android and consoles "with appropriate dev licenses", i.e. the user builds them in Unity. FACT, own claim ([blog](https://www.seeles.ai/resources/blogs/ai-game-development-beyond-lovable-seele))
  - The homepage's structured data says export "is not direct publishing to external stores". **No direct APK/AAB or iOS build.**
- **Assets:** 3D models, textures, sprites, audio (BGM/SFX), video. FACT
- **Multiplayer:** not documented. Not found.
- **Creator monetization:**
  - "Creator Program": monthly revenue share "based on playtime, ad revenue, and in-game purchases". A graphic shows "creator 80%". Ads via AdSense, AppLovin and AdinPlay; payouts via Stripe, PayPal and Alipay.
  - Users can ask the agent to add ads or IAP; revenue is "withdrawable".
  - FACT ([homepage](https://www.seeles.ai/), [guide](https://www.seeles.ai/guide))
- **Community:** Seele Community (discover, remix); Koin earned by sharing games and from plays. FACT ([guide](https://www.seeles.ai/guide))

### 6. Quality: what users say
- **Complaint:** "It doesn't make anything workable. You need the $300 subscription in order to sell your game"; refunds only via Discord (1★, 2026-06-16). FACT ([Trustpilot](https://www.trustpilot.com/review/seeles.ai?stars=1&stars=2&stars=3))
- **Complaint:** "runs for 10 minutes and then tells me I have to buy more credits… Worthless" (1/5, 2026-05-30). FACT ([SourceForge](https://sourceforge.net/software/product/SEELE-AI/))
- **Mixed:** "the only problem it takes a while for it to get it how u want it" (5★, 2026-08-19). FACT (Trustpilot)
- **Praise:** "Took very little information and began to create a usable game!" (5★, Oct 2026); "has come a long way from when I purchased this product" (5★, 2026-10-06). FACT (Trustpilot)
- **Praise (HN):** an RPG test "did much better" than the commenter's earlier attempt with Claude Code. The founder admits "basic demo-level games" and weak "complex 3D spatial relationships". FACT ([HN](https://news.ycombinator.com/item?id=46897381))

### 7. Go-to-market
- **Taglines:** "Build an AI Game Studio"; "The First game-native harness agent"; "Best No-Code AI Game Maker for 2D/3D Games". FACT
- **Audience:** no-code creators in the US, UK, AU and CA, plus developers through the API. FACT
- **Channels:**
  - **Massive SEO**: dozens of "/features/create/…" and "/compare/seele-vs-…" pages, including **"Lovable.dev Alternative for Game Development"** and "SEELE vs Claude Code".
  - Discord community, TikTok, YouTube Shorts, Xiaohongshu.
  - AWS Marketplace API listing; Product Hunt; Shanghai launch event.
  - An OpenAI ads SDK script (`oaiq.min.js`) in the site HTML, so they likely advertise in ChatGPT (ESTIMATE).
- **Partnerships:** AWS (case study, Marketplace); Baidu (investor; models "include some from Baidu" per [SourceForge/Slashdot listing](https://sourceforge.net/software/product/SEELE-AI/)). FACT

### 8. Assessment for TypePlay: **MEDIUM-HIGH threat**
Same price points as TypePlay ($20/$50), real money ($12.9M), their own 3D models, Unity/Unreal export, a strong SEO machine and Discord (17.8K). Their weak spots are trust, inconsistent claims, and quality that remains "demo-level" by their own founder's words.

**Copy:**
1. **A public, per-action cost table** (game, iteration, image, 3D, in Flash vs Pro). This maps directly onto TypePlay's Fast/Smart/Best and builds trust.
2. **Export the editable engine project** as a paid perk (theirs: .unitypackage). TypePlay can offer the Godot project zip.
3. **SEO comparison pages** ("TypePlay vs SEELE / Tesana / Rosebud", "Lovable alternative for games") and a creator revenue-share program with ads/IAP the agent can add.

**Beat them on:**
1. **One-click native builds.** SEELE hands you a Unity package and you need Unity, licences and a Mac for iOS. TypePlay outputs an APK/AAB directly.
2. **Cost per finished game.** A Pro build is ~$15, plus $5-7 per Pro iteration (ESTIMATE from their table), vs TypePlay's measured cents. Selling also requires their $50 plan.
3. **Trust and clarity.** Hong Kong/Shenzhen entity, contradictory rollover rules and user counts (3M vs 366K), no replies to bad reviews. TypePlay can be plain-spoken with one set of numbers.

---

## 3. Jabali (jabali.ai)

### 1. Identity
- **URLs:** https://www.jabali.ai (Jabali Web: prompt + templates), /jabalistudio (**Jabali Studio**, a desktop app for Windows and Mac), /explore (Jabali Play), friendjam.jabali.ai (FriendJam, social creation), docs at https://jaabaali.github.io/docs/. FACT ([jabali.ai](https://www.jabali.ai/))
- **Legal entity:** **Jaabaali Inc.** Disputes go to arbitration or the courts of Santa Clara County, California. FACT ([Terms](https://www.jabali.ai/terms-and-conditions/), last updated 2026-09-21)
- **HQ:**
  - Los Altos, CA 94024. FACT ([LinkedIn](https://www.linkedin.com/company/jabali-ai), 2026-10-16)
  - The press release was datelined "San Francisco and Raleigh, N.C." FACT ([PR Newswire, 2024-03-06](https://www.prnewswire.com/news-releases/jabali-raises-5m-to-build-a-generative-ai-powered-game-engine-of-the-future-302082177.html))
- **Founder:** **Vatsal Bhardwaj**, CEO. Ex-CPO at Skillz; led game tech at AWS (GameLift, Lumberyard); earlier at Meta and Zynga. FACT ([GamesBeat, 2025-10-29](https://gamesbeat.com/jabali-creates-ai-platform-to-democratize-game-creation/); [about](https://www.jabali.ai/about/))
- **Team:**
  - ~8 people plus contractors, starting around San Francisco and expanding to North Carolina. FACT (GamesBeat, Oct 2025)
  - LinkedIn: 20 associated members, 3,025 followers. FACT (LinkedIn, 2026-10-16)

### 2. Age
- **Founded:** 2022. FACT (GamesBeat). Tracxn says 2023.
- **Domain:** jabali.ai registered **2023-08-09**, transferred between registrars 2025-11-26. FACT (RDAP, 2026-10-16)
- **Timeline:**
  - 2024-03-06: $5M seed announced. FACT (PR Newswire)
  - 2024: closed beta through Discord (with a Discord bot). FACT ([GamesPress](https://www.gamespress.com/en-US/Introducing-Jabali-the-AI-Engine-for-Aspiring-Game-Developers); [jabali FAQ](https://www.jabali.ai/faqs/) mentions "/upload command on Discord")
  - Early summer 2025: light web version with 2 game styles, 20 after ~4 months; "thousands of users". FACT (GamesBeat)
  - 2025-11-05: AI Game Jam India with the Game Developers Association of India (IGDC 2025). FACT ([blog](https://www.jabali.ai/blog/jabali-studio-announcement/))
  - **2025-11-15: Jabali Studio early access**: desktop app, Vibe Code / Design modes, Godot + Phaser, choice of Gemini / Claude / others. FACT (same)
  - 2026-04-16: v0.23.0, **Sparks replace fixed message limits**. FACT ([What's new](https://jaabaali.github.io/docs/studio/whats-new/))
  - 2026-05-11: Agent Skills; "most waitlisted users now have access". FACT (same)
  - 2026-06-02: web game projects (Phaser, Three.js, R3F, Babylon.js, PlayCanvas). FACT (same)
  - 2026-08-04: "Sparks efficiency update", up to 75% fewer Sparks. FACT (same)
  - 2026-08-07: "The Harness Behind the One-Person Game Studio". Gen-5 autonomous agents on their own agent SDK, a browser QA harness, and "never marry a model". FACT ([blog](https://www.jabali.ai/blog/one-person-game-studio/))
  - 2026-08-31: video generation, 3D rigging and animation. 2026-10-02: v0.27.4-beta (GPT 6.1 Sol, new image models). FACT ([What's new](https://jaabaali.github.io/docs/studio/whats-new/))

### 3. Money
- **Funding:** **$5M seed**, announced 2024-03-06.
  - Led by **BITKRAFT Ventures**, with Sapphire Sport / Sapphire Ventures, **Sony Innovation Fund**, Canonical Ventures, and angels from Amazon, Google AI, OpenAI and Pinterest.
  - FACT ([PR Newswire](https://www.prnewswire.com/news-releases/jabali-raises-5m-to-build-a-generative-ai-powered-game-engine-of-the-future-302082177.html))
  - No later round found. Valuation: not found.
- **Revenue / users:** not found.
- **Pricing** (FACT, [jabali.ai/pricing](https://www.jabali.ai/pricing/), 2026-10-16). Unused Sparks don't roll over; Stripe billing; "free to use during our early access phase" ([FAQ](https://www.jabali.ai/faqs/)).

| Plan | Monthly | Annual (per month) | Sparks / month | Limits |
|---|---|---|---|---|
| Premium | $9.99 | $8.00 | 1,000 | create or remix up to 10 games or AI characters; 300 AI tweaks; 1,000 AI-character chat messages |
| Ultra | $24.99 | $20.00 | 3,000 | 25 games; 900 tweaks; unlimited chat |
| Pro | $99.99 | $83.00 | 15,000 | 150 games; 3,000 tweaks |

- **One complete game on Premium ($9.99), ESTIMATE:**
  - The cap is 10 games and 300 tweaks a month, so at most ≈ **$1.00 per game** with ~30 tweaks each.
  - The Spark cost per action isn't published and depends on the chosen model (docs: [Sparks](https://jaabaali.github.io/docs/studio/sparks/)), so heavy Studio use may hit the 1,000-Spark limit first.

### 4. Users and traction
- **Users:** "thousands of users" and "thousands of games" in the 2025 web phase. FACT (GamesBeat, Oct 2025). No newer number found; the homepage shows none.
- **Discord: 4,229 members**. FACT ([Discord API](https://discord.com/api/v10/invites/jabali?with_counts=true), 2026-10-16)
- **YouTube @jabali-ai: 745 subscribers, 177 videos**. FACT ([YouTube](https://www.youtube.com/@jabali-ai))
- **LinkedIn: 3,025 followers**. FACT
- **Instagram @jabali.ai:** count not retrieved (Instagram blocks logged-out fetches). **X:** no account linked from the site; not found.
- **Product Hunt:** not found (`/products/jabali`, `jabali-ai` and `jabali-studio` return 404).
- **Apps:** the FAQ says "Not yet [a mobile app]… coming soon". The Terms mention Google Play, but no listing was found (guessed package ids 404).
- **AlternativeTo:** 0 likes, 0 reviews. FACT ([AlternativeTo](https://alternativeto.net/software/jabali-ai/about/))

### 5. Product
- **Jabali Web (casual):**
  - The user types a prompt and either picks one of **22 genre templates** or lets the AI recommend one. Templates include Match 3, Grid-Based Puzzle, Trivia, Idle RPG, 3D Racing, 3D Open World, Strategic Defense Arcade, Rhythm Platformer, Branching Interactive Story, Character Life Sim and Slots Casino.
  - The result is a game playable on desktop and mobile browsers at jabali.ai/explore.
  - It also has chat-enabled "AI Characters" (NPCs that remember) and FriendJam social creation.
  - FACT ([homepage](https://www.jabali.ai/), [pricing](https://www.jabali.ai/pricing/))
- **Jabali Studio (semi-pro, desktop):**
  - "Bali", the AI producer, works from a project plan card (Concept → First Playable → Improve → Publish).
  - Modes: Autonomous, Collaborative, Cautious, Creative. Tools: MCP servers, Agent Skills, a shell tool with approval.
  - Engines: **Godot (GDScript, editable `.tscn` scenes in a Layouts tab, Godot plugins including GDExtension)** or **Web** (Phaser, Three.js, R3F, custom).
  - The templates are Godot games.
  - FACT ([docs: engines](https://jaabaali.github.io/docs/studio/engines/), [create a game](https://jaabaali.github.io/docs/studio/create-a-game/), [whats-new](https://jaabaali.github.io/docs/studio/whats-new/))
- **Models:** the user picks per project. Listed: GPT 6 Astra, GPT 6.1 Sol, GPT-5.6, Gemini 3.x, GLM 5.x, Kimi K3, Grok 4.6, plus image models (GPT Image 2.5, Nano Banana 2, MAI Image 2.6). Claude is named in the Nov 2025 announcement but not in the 2026 changelog. FACT (whats-new; [Studio announcement](https://www.jabali.ai/blog/jabali-studio-announcement/))
- **Time to first playable:** "under 10 minutes" (claim, GamesBeat); "First Playable Game in 15 Minutes" (blog, 2026-01-10). FACT
- **Exports:**
  - **Publish to jabali.ai only** (a shareable link). "Exporting as a standalone file is not available yet." FACT ([Studio FAQ](https://jaabaali.github.io/docs/studio/faq/))
  - The Studio has full source on disk.
  - The ToS **forbids** distributing or selling games outside Jabali unless under "Export Terms", which may be tier-limited, and may require "Made with Jabali" attribution. FACT ([Terms](https://www.jabali.ai/terms-and-conditions/))
- **Assets:** images, sprites, video, music, SFX, speech, rigged and animated 3D characters, skybox library. FACT ([docs](https://jaabaali.github.io/docs/))
- **Multiplayer:** the Studio page claims "Create multiplayer, 2D and 3D games". FACT, no details.
- **Creator monetization:** a revenue share of Net Revenue under "Program Terms" (percentage not published); remixes allowed; ads may be shown. FACT (Terms)
- **Age gate:** **18+** to create, and even to play. FACT (Terms)

### 6. Quality: what users say
- **Not found.**
  - Searched: Trustpilot (no page, 404), AlternativeTo (0 reviews), Product Hunt (no page).
  - Could not run Reddit or X searches after the search budget ran out.
- **Only third-party view:** GamesBeat's write-up, which is positive and based on the company's claims.

### 7. Go-to-market
- **Taglines:** "The Fastest Way to Start Building Games"; "From prompt to playable game"; LinkedIn: "Your Imagination, Our Engine"; "the next great game studio isn't a company – it's YOU". FACT
- **Audience:** hobbyists, students, educators and indie developers (FAQ); Studio aimed at "creators who want to go further". FACT
- **Channels:**
  - **Game competitions** with prizes (iPhone, consoles, gift cards); **AI Game Jam India** with GDAI.
  - YouTube tutorials (177 videos); SEO blog; Discord.
  - AppsFlyer SDK on the site, so they track mobile or ad attribution (ESTIMATE).
- **Partnerships:** Game Developers Association of India; investors Sony and BITKRAFT. FACT

### 8. Assessment for TypePlay: **MEDIUM-LOW threat**
Credible team and investors, and technically the **closest twin**: an AI agent writing **Godot** projects. But they split into a casual template site plus a desktop app for semi-pros, keep games locked to jabali.ai, require users to be 18+, and show weak traction signals.

**Copy:**
1. **Genre templates as starting points** (22 on the homepage). TypePlay's launch genres (puzzle, runner, racer, tower defence) could be visible one-click starters.
2. **Game jams and contests** with partners (developer associations, schools) as a cheap acquisition channel.
3. **A public, dated changelog** (their "What's new" is a strong trust signal) and a visible project-progress card (Concept → First Playable → Publish).

**Beat them on:**
1. **Export and ownership.** TypePlay exports native Android/iOS/desktop builds the user owns. Jabali has no standalone export and a ToS that bans off-platform distribution by default.
2. **Zero-setup web flow.** Their serious tool is a 16 GB-RAM desktop download with a model picker, which is too much for non-coders. TypePlay is browser-only with honest Fast/Smart/Best tips.
3. **Audience reach.** The 18+ gate excludes teens, the core of the "make a game" crowd, though TypePlay's own terms should set a sensible age, e.g. 13+ with consent.

---

## 4. Exists (exists.ai)

### 1. Identity
- **URLs:** https://exists.ai (landing page), https://app.exists.ai ("Exists Editor"). FACT ([exists.ai](https://exists.ai/), 2026-10-16)
- **Legal entity:** not found. exists.ai/terms, /privacy, /terms-of-service and /privacy-policy all return 404; the landing page shows only "© 2026".
- **HQ:** Tel Aviv, Israel. FACT ([CB Insights](https://www.cbinsights.com/company/exists); [LinkedIn](https://www.linkedin.com/company/exists-ai))
- **Founders:** **Yotam Hechtlinger**, CEO, PhD in machine learning and statistics from Carnegie Mellon. FACT ([GamesBeat, 2024-08-15](https://gamesbeat.com/exists-launches-genai-platform-to-create-3d-games-from-text-prompts/)). Other founders: not found.
- **Team:** 7 LinkedIn-associated members; 1,614 followers. FACT ([LinkedIn](https://www.linkedin.com/company/exists-ai), 2026-10-16)

### 2. Age
- **Founded:** 2022. FACT ([CB Insights](https://www.cbinsights.com/company/exists))
- **Domain:** exists.ai registered **2022-03-12** (Porkbun), last changed 2026-08-12. FACT (RDAP, 2026-10-16)
- **Timeline:**
  - 2024-08-15/20: public announcement of a **closed beta** text-to-3D-game platform. FACT ([GamesBeat](https://gamesbeat.com/exists-launches-genai-platform-to-create-3d-games-from-text-prompts/); [AIbase, 2024-08-19](https://www.aibase.com/news/11135))
  - 2024-08-21→25: Gamescom Business Area booth. FACT (GamesBeat)
  - "Working with leading gaming studios" on UGC and modding integrations. FACT (GamesBeat)
  - Since then: no press found. The YouTube channel's newest video is "1 year ago". FACT ([YouTube](https://www.youtube.com/@existsai))
  - A LinkedIn logo update in ~Jun 2026 (from the image timestamp; ESTIMATE) and the "© 2026" footer suggest it's alive.

### 3. Money
- **Funding:** **not found**. CB Insights lists none; Crunchbase and PitchBook were not reachable (403); later searches couldn't be run.
- **Revenue / users:** not found.
- **Pricing:** **not found.** No pricing page (app.exists.ai/pricing returns 404).
  - The app shows session-based free access: "You have run out of session time", "You're in the queue", "All Servers Are Busy". FACT (strings in the [app.exists.ai](https://app.exists.ai/) JavaScript, 2026-10-16)
- **Cost of one complete game:** not possible to compute.

### 4. Users and traction
- **Discord: 6,945 members**. FACT ([Discord API](https://discord.com/api/v10/invites/SZZqByaYqF?with_counts=true), 2026-10-16)
- **YouTube @existsai: 493 subscribers, 3 videos**, newest ~1 year old. FACT
- **LinkedIn: 1,614 followers**. FACT
- **X @ExistsAI:** follower count **not retrieved** (embed endpoint returned no data). **Instagram:** not retrieved.
- **Product Hunt:** not found.
- **Apps:** none found.
- **User counts:** not found.

### 5. Product
- **Input and output:**
  - Text prompt → a **3D multiplayer game** in four modes: FPS, third-person shooter, top-down or racing.
  - The user can then edit teams, vehicles, characters, weather and sky.
  - Games are played online with friends. A "Games meet cinema" tool renders gameplay into shareable movies. The app also has "Video To Video" ("Reimagine your video's style with AI").
  - FACT ([exists.ai](https://exists.ai/); app JS strings)
- **Tech:**
  - "Proprietary generative AI models" plus a "novel neural network architecture" combined with game-engine capabilities. FACT (GamesBeat)
  - The editor runs on per-user cloud instances, with a `pixelstreamHost`, EC2 flags, region pings on Google Cloud Run (US, EU, Asia), queues and session time. **"This app is designed for desktop devices."** FACT (app JS, 2026-10-16)
  - **ESTIMATE:** Unreal Engine streamed through Pixel Streaming (the name of Unreal's feature), so each session costs a cloud GPU.
- **Time to first playable:** "minutes" (claim). Not measured.
- **Iteration:** a template + prompt editor ("Choose Template", "Enter your prompt", image or silhouette upload). FACT (app JS)
- **Exports:** none found (cloud-hosted only).
- **Multiplayer:** yes, the core pitch ("Battle Royale or Team Deathmatch"). FACT ([LinkedIn](https://www.linkedin.com/company/exists-ai))
- **Monetization / community:** a gallery and featured games; share links to X, WhatsApp and Facebook. No creator monetization found.

### 6. Quality: what users say
- **Not found.** Trustpilot (403/404), Product Hunt (404) and AlternativeTo were checked; Reddit and X searches could not be run after the search budget ran out.
- The only hands-on content found was 2024 Medium and YouTube explainers (e.g. [YouTube "Exists AI: Create Stunning 3D Games…"](https://www.youtube.com/watch?v=2_t2t9aFPHE)), which are descriptive and not reviews.

### 7. Go-to-market
- **Tagline:** "GAMES FROM TEXT JUST LIKE THAT"; "anyone can create multiplayer video games in moments". FACT
- **Audience:** gamers who want instant multiplayer matches, plus **B2B/UGC deals with studios**. FACT (GamesBeat)
- **Channels:** Gamescom 2024, Discord, Instagram, a little YouTube. FACT

### 8. Assessment for TypePlay: **LOW threat**
Not dead: the app is live, the footer says © 2026, and the Discord has 6.9K members. But it is quiet: no news since 2024, 3 YouTube videos, 7 LinkedIn members, no pricing and no exports. Cloud-streamed, desktop-only, queue-limited play is the opposite of TypePlay's light, phone-ready Godot builds.

**Copy:**
1. **"Games meet cinema": one click turns gameplay into a shareable trailer clip** for TikTok and Shorts.
2. **Instant "play with friends" multiplayer** as a later genre or feature: a hook that makes people share links.

**Beat them on:**
1. **Runs everywhere, no queue.** TypePlay games are small exports that run on phones; Exists needs a desktop and a free server slot.
2. **Ownership and export.** Exists has nothing to download or publish.
3. **Genre breadth.** Four shooter/racer modes vs TypePlay's puzzle, runner, racer and tower defence, growing over time.

---

## Cross-cutting takeaways for TypePlay
1. **Nobody in this group exports a native Android APK/AAB or iOS build in one click.**
   - Tesana: web + Windows/macOS + a paid managed App Store/Steam service.
   - SEELE: a Unity/Unreal project you build yourself.
   - Jabali and Exists: platform-locked.
   - This is TypePlay's clearest gap to own. Say it on the landing page.
2. **Price per game is TypePlay's second edge.** Tesana's users report $20-100+ per game (one spent $1,400 on a single game), and a SEELE Pro build is ~$15 before revisions. TypePlay's measured Haiku/Sonnet builds cost $0.07-0.16 (API price). Keep a real free tier: Tesana's Free plan gives 0 credits.
3. **Credits anxiety is the top complaint across this market** (Tesana App Store reviews; SEELE on Trustpilot and SourceForge). Ship a per-prompt usage ledger, "charged only for work done", and refunds for platform failures from day one.
4. **The Godot warning from Tesana is real but specific.** Their pain was ~60-minute builds, web-export failures and scene-file breakage. TypePlay's measured Godot builds are already 1.6-12 min. Keep `.tscn` failure points out of the agent's path and keep the web export step fast and cached.
5. **The same model shows up everywhere:** Tesana markets Claude Opus 5.5, and SEELE uses Claude on Bedrock internally. Model quality isn't a moat. Exports, price, reliability and the creator loop are.

## Not found / not checked (search budget ran out)
- Exists: funding, legal entity, user feedback, X follower count.
- Jabali: user reviews, Instagram and X counts, mobile app listings.
- SEELE: App Store / Google Play apps, TikTok counts, whether the 2025 round closed.
- Tesana: investors and amount (PitchBook shows an undisclosed "Early Stage VC" deal).
- Reddit threads for all four.

## Sources
- Tesana:
  - https://tesana.com/
  - https://tesana.com/blog
  - https://tesana.com/blog/from-godot-to-three-js-faster-better-games-on-tesana (text: https://tesana.com/blogs/from-godot-to-three-js-faster-better-games-on-tesana.html)
  - https://tesana.com/blog/tesana-quality-index-and-ending-the-model-picker
  - https://tesana.com/blog/introducing-muranyi-3
  - https://tesana.com/blog/introducing-atomos
  - https://tesana.com/blog/introducing-loop
  - https://tesana.com/blogs/studio-refresh-and-credit-fixes.html
  - https://docs.tesana.ai/
  - https://docs.tesana.ai/how-tesana-works
  - https://docs.tesana.ai/building/exports
  - https://docs.tesana.ai/building/mobile-games
  - https://docs.tesana.ai/credits/plans-and-topups
  - https://docs.tesana.ai/credits/how-credits-work
  - https://docs.tesana.ai/credits/failed-generations
  - https://docs.tesana.ai/publishing/steam-and-app-store
  - https://docs.tesana.ai/publishing/game-monetization
  - https://docs.tesana.ai/publishing/multiplayer
  - https://docs.tesana.ai/support/faq
  - https://www.pcgamer.com/software/ai/this-ai-startup-envisions-100-million-new-people-making-videogames/
  - https://tech.yahoo.com/gaming/articles/ai-startup-envisions-100-million-215753709.html
  - https://techcrunch.com/2026/02/09/so-whats-going-on-with-musicboard/
  - https://news.ycombinator.com/item?id=49334754
  - https://apps.apple.com/us/app/ai-game-maker-tesana/id6747117832?see-all=reviews&platform=iphone
  - https://apps.apple.com/au/app/ai-game-maker-tesana/id6747117832
  - https://itunes.apple.com/lookup?id=6747117832&country=us
  - https://earninfos.com/article/tesana-ai-review-ai-game-maker
  - https://www.soonlab.ai/blog/tesana-ai-review/
  - https://daily.dev/posts/this-is-the-best-ai-tool-for-making-indie-games-tesana-ai-z3inbnuqz
  - https://tracxn.com/d/companies/tesana-ai/__NNmB8Fwhhrvp33PgbtDZr4tspHb01Ofilj-ZQJpE3Cw
  - https://www.caplight.com/company/tesana
  - https://pitchbook.com/profiles/company/539213-95
  - https://syndication.twitter.com/srv/timeline-profile/screen-name/TesanaAI
  - https://x.com/TesanaAI/status/2107244988090462268
  - https://x.com/TesanaAI/status/2109853468358009022
  - https://x.com/M__Houser/status/2108432503128354890
  - https://x.com/M__Houser/status/2110750857528803516
  - https://x.com/Rubzem/status/2107828818165833976
  - https://x.com/Rubzem/status/2109678375975706743
  - https://x.com/Thomas_jorgen/status/2107273424884408349
  - https://discord.com/api/v10/invites/6uqbFsdhSM?with_counts=true
  - https://www.youtube.com/@TesanaAI
  - https://rdap.verisign.com/com/v1/domain/tesana.com
  - https://rdap.identitydigital.services/rdap/domain/tesana.ai
- SEELE:
  - https://www.seeles.ai/
  - https://www.seeles.ai/about-us
  - https://www.seeles.ai/upgrade
  - https://www.seeles.ai/guide
  - https://www.seeles.ai/terms-of-service
  - https://www.seeles.ai/features/api
  - https://www.seeles.ai/compare/seele-vs-claude-code
  - https://www.seeles.ai/resources/blogs/ai-game-development-beyond-lovable-seele
  - https://aws.amazon.com/solutions/case-studies/seele/
  - https://aws.amazon.com/marketplace/pp/prodview-3vuhpvnyladaq
  - https://www.bloomberg.com/news/articles/2025-05-28/baidu-backed-ai-3d-game-creator-seele-seeks-new-funding
  - https://finance.sina.com.cn/stock/hkstock/hkzmt/2024-11-18/doc-incwpcef0073586.shtml
  - https://www.163.com/dy/article/JH9A4CQ305566TJ2.html
  - https://www.aihub.cn/news/seele-koko-ai/
  - https://zhidx.com/p/483171.html
  - https://app.dealroom.co/news/feed/seele-raises-10m-for-3d-platform
  - https://www.caplight.com/company/seeles
  - https://baike.baidu.com/en/item/Seele%203DLMM/1759600
  - https://theresanaiforthat.com/model/seele02/
  - https://news.ycombinator.com/item?id=46897381
  - https://www.producthunt.com/products/seele-ai
  - https://www.trustpilot.com/review/seeles.ai
  - https://sourceforge.net/software/product/SEELE-AI/
  - https://pickaitool.com/ai-tool/seele-ai/
  - https://www.linkedin.com/company/seeleai
  - https://syndication.twitter.com/srv/timeline-profile/screen-name/SEELE_AI1125
  - https://discord.com/api/v10/invites/7C84WdttGM?with_counts=true
  - https://www.youtube.com/@SEELE-AI1125
  - https://rdap.identitydigital.services/rdap/domain/seeles.ai
- Jabali:
  - https://www.jabali.ai/
  - https://www.jabali.ai/pricing/
  - https://www.jabali.ai/faqs/
  - https://www.jabali.ai/about/
  - https://www.jabali.ai/jabalistudio/
  - https://www.jabali.ai/terms-and-conditions/
  - https://www.jabali.ai/blog/
  - https://www.jabali.ai/blog/jabali-studio-announcement/
  - https://www.jabali.ai/blog/one-person-game-studio/
  - https://jaabaali.github.io/docs/
  - https://jaabaali.github.io/docs/studio/whats-new/
  - https://jaabaali.github.io/docs/studio/faq/
  - https://jaabaali.github.io/docs/studio/engines/
  - https://jaabaali.github.io/docs/studio/sparks/
  - https://jaabaali.github.io/docs/studio/publish/
  - https://jaabaali.github.io/docs/studio/create-a-game/
  - https://www.prnewswire.com/news-releases/jabali-raises-5m-to-build-a-generative-ai-powered-game-engine-of-the-future-302082177.html
  - https://gamesbeat.com/jabali-creates-ai-platform-to-democratize-game-creation/
  - https://www.gamespress.com/en-US/Introducing-Jabali-the-AI-Engine-for-Aspiring-Game-Developers
  - https://alternativeto.net/software/jabali-ai/about/
  - https://www.linkedin.com/company/jabali-ai
  - https://discord.com/api/v10/invites/jabali?with_counts=true
  - https://www.youtube.com/@jabali-ai
  - https://rdap.identitydigital.services/rdap/domain/jabali.ai
- Exists:
  - https://exists.ai/
  - https://app.exists.ai/
  - https://gamesbeat.com/exists-launches-genai-platform-to-create-3d-games-from-text-prompts/
  - https://www.aibase.com/news/11135
  - https://www.cbinsights.com/company/exists
  - https://www.linkedin.com/company/exists-ai
  - https://discord.com/api/v10/invites/SZZqByaYqF?with_counts=true
  - https://www.youtube.com/@existsai
  - https://www.youtube.com/watch?v=2_t2t9aFPHE
  - https://rdap.identitydigital.services/rdap/domain/exists.ai
