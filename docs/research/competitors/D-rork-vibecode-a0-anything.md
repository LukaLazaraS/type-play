# D. Rork and the prompt-to-mobile-app builders (a0.dev, Vibecode, Anything, Bolt/Expo)

Research date: **2026-10-16**. Every figure is tagged **FACT** (source + date) or **ESTIMATE** (method shown). "Fetched" = I loaded the page/API on 2026-10-16.

**Method and limits.** I ran about 25 WebSearch queries, then the session's shared search budget ran out (200 per turn across all agents). After that I fetched only known URLs: company sites, Mintlify docs (`/llms.txt` + `.md` pages), the App Store's iTunes lookup API, Google Play pages, the Discord invite API, YouTube channel pages, Product Hunt, Apple Newsroom, the Google blog, MacRumors and TechCrunch. I read X posts through the api.fxtwitter.com mirror; the follower counts and two tweets fetched after the budget ran out came through that mirror, and I stopped using it after that. Reddit blocked scripted access, so **I found no Reddit quotes**. Things I could not find are marked "not found".

---

## 0. Summary for TypePlay

| | Rork | Vibecode | a0.dev | Anything | Bolt (Expo) |
|---|---|---|---|---|---|
| Output today | Native **Swift** (iPhone), **Kotlin** (Android), React (web); Expo dropped for new projects | Native **Swift** (iOS) or **React Native/Expo**, or web | React Native / Expo | React Native / Expo | React Native / Expo |
| Game tech | **SpriteKit** 2D / **RealityKit** 3D (iPhone), **three.js + R3F + Rapier** / canvas (web) | Swift templates incl. a 3D tower-defence game | RN (engine not documented) | none game-specific | none game-specific |
| Store publishing | In-app: Apple ID + 2FA → cloud-Mac build → upload/TestFlight; Google Play AAB → internal track | Cloud-Mac build, sign, upload (ASC API key); RN via Expo | "Generate & Submit" via ASC API key; IPA/APK | Apple ID + 2FA → build → TestFlight (~30 min); Play in beta | **Manual**: download code, run `eas build` locally |
| Cheapest plan that can ship a **native store game** | **$200/mo** (Max), iOS only | $20/mo (Plus) | $20/mo (Pro) | $24/mo (Pro 20k) | $25/mo + local tooling |
| Money | $2.8M (May 2025) + $15M seed (Apr 2026); ARR "millions" | not found | ~$0.5M (YC W25) | $11M at $100M (Sep 2025) | $105.5M Series B (Jan 2025, ~$700M val.) |
| Threat to TypePlay | **High** | **Medium** | Low–medium | Low | Low |

**Main findings**
1. **Rork now sells games directly** (rork.com/games and the docs page "Build a game with Rork"): "You do not need Unity, Unreal, or any game engine." But **native iPhone games are gated behind Rork Max ($200/mo)**, and "Android games are not a documented path today". TypePlay's "$20 plan, one project → Android + iOS + desktop + web" story sits exactly where Rork is weak.
2. **No competitor ships to Steam/desktop.** None of them uses a real game engine, so a game cannot go to every platform from one project.
3. **Apple is pushing back on builder *apps*, not on AI-built apps.** In March 2026 Apple held updates for the Replit and Vibecode iOS apps under guideline 2.5.2. Rork's own iPhone app "can't live on the App Store" and is sideloaded over USB. Anything's iOS app no longer appears in the store. Apps built *with* these tools still pass review when they are complete and original. Apple says AI tools "drive a surge in app submissions": 9.1M reviewed in 2025 vs 7.7M in 2024, and spam/copycat rejections rose to 371K. TypePlay should keep the builder on the web and submit under the user's own developer account (guideline 4.2.6).

---

## 1. Rork (in depth)

### 1.1 Identity
- **URLs:** rork.com (marketing + app), rork.app (published web apps, `*.rork.app`), docs.rork.com. FACT (fetched).
- **Legal name and HQ:** **Rork, Inc.**, 2261 Market Street, Suite 22999, San Francisco, CA 94114 (Terms of Service, last updated Aug 27, 2026). FACT, [rork.com/terms](https://rork.com/terms). The address is a mailbox-style suite. The press release datelines San Francisco. FACT, [PR Newswire, Apr 9, 2026](https://www.prnewswire.com/news-releases/rork-raises-15m-to-power-the-next-generation-of-app-store-entrepreneurs-302736638.html).
- **Founders**
  - **Daniel Dhawan**, co-founder & CEO. A 3x founder, built mobile apps from age 21 and reached #2 on the App Store ([a16z speedrun profile](https://speedrun.a16z.com/companies/rork)). He writes that he "dropped out of the best Physics university in Russia" ([X, Jan 5, 2026](https://x.com/daniel_dhawan/status/2008304778091409627)), was "rejected by Y Combinator 8 times" and "failed with 4+ startups" ([X, Mar 17, 2026](https://x.com/daniel_dhawan/status/2034004426998849585)). In 2025 he was 27 and based in San Francisco ([TechCrunch, May 5, 2025](https://techcrunch.com/2025/05/05/rorks-founders-were-almost-broke-when-a-viral-tweet-led-to-2-8m-and-a16z/)).
  - **Levan Kvirkvelia**, co-founder & CTO. A 3x founder who built "Russia's largest educational timetable and Q&A app" at 17 (2M+ users) (PR Newswire; speedrun profile). He was 25 in 2025 and **"stayed in Georgia to build the product"** (TechCrunch, May 5, 2025). ZoomInfo lists him in Tbilisi (secondary source). **Rork's CTO builds from Georgia, Luka's country.**
- **Team size:** **not found** (current). "4 people" when Rork reached $1M ARR. FACT, [Dhawan on X, Jun 16, 2025](https://x.com/daniel_dhawan/status/1934749637577199850). Rork acquired **Paperline** (macOS AI Swift builder; founders Evgenii Mozharovskii and Maksim Konstantinov) after the seed round. FACT, PR Newswire, Apr 9, 2026.

### 1.2 Age and timeline
- **rork.app registered 2024-12-17.** FACT, [rdap.org](https://rdap.org/domain/rork.app). **rork.com registered 2000-01-12, last changed 2025-04-10.** FACT, Verisign RDAP. ESTIMATE: the .com was bought on the aftermarket around April 2025.
- Before Rork, the founders built a Cursor-like coder for non-technical users, then a Lovable-style web builder. When Lovable took off they pivoted to mobile (TechCrunch, May 5, 2025).
- **2025-02-12:** public launch with React Native/Expo, "on the birthday of Steve Jobs" ([Dhawan, Feb 25, 2026](https://x.com/daniel_dhawan/status/2026485351447937107)). The same day Bolt launched its Expo mobile product (TechCrunch).
- **2025-02-24:** Matt Shumer's viral video post (1M+ views). Rork made **$100K revenue in 5 days** and **~$350K came in on day one**; Austen Allred invested $100K about 15 minutes after the tweet. FACT, TechCrunch, May 5, 2025.
- **2025-03-16:** "Rork grew to **$200K ARR** in 2 weeks since launch". FACT, [X](https://x.com/daniel_dhawan/status/1901082824138178805) (post dated Mar 16, 2025).
- **2025-05 (≈May 6):** **$2.8M seed led by a16z speedrun**, with Hustle Fund, ChapterOne, Founders Inc., Austen Allred, Expo's Charlie Cheever and Evan Bacon, Siqi Chen and Matt Shumer. ARR was then **$550K**. FACT, TechCrunch, May 5, 2025; Tracxn dates the round May 6, 2025.
- **2025-06-16:** "0 → **$1M ARR** in ~3 months with 4 people". FACT, X.
- **2025-09-03:** Rork iOS app launched. Product Hunt #5 of the day. FACT, [Product Hunt](https://www.producthunt.com/products/rork-app-for-ios). Rork says the app ranked top-2 worldwide in App Store "Developer Tools" (PR Newswire). The listing id6746410361 no longer resolves in the US/UK/FR/GE stores. FACT, iTunes lookup API, fetched. Rork's docs now say the Rork Max iPhone app "can't live on the App Store" because it runs the apps users build as native code inside itself; it installs over USB via Rork Companion. FACT, [docs: Rork Max app](https://docs.rork.com/rork-max/rork-max-app.md).
- **2026-01-05:** "Rork 1.5": agent "based on Claude Code & Opus 4.5", paywalls, analytics, the "Rork Stars" founder community. Dhawan wrote "We raised tens of millions of dollars". FACT, [X](https://x.com/daniel_dhawan/status/2008304778091409627).
- **2026-02-19:** **Rork Max**, "the first website that builds Swift iOS apps", "Powered by Claude Code & Opus 4.6". FACT, [X](https://x.com/daniel_dhawan/status/2024577947668222233). Product Hunt **#1 of the day and week (Feb 21), #2 of the month**. FACT, Product Hunt.
- **2026-02-25:** "We've crossed **1.5M+ apps built** on Rork – Rork Max went viral on X with **8M+ views**, adding **$1.5M ARR every 3 days**". FACT, [X](https://x.com/daniel_dhawan/status/2026485351447937107). Note this is a *rate* during launch week, not total ARR. Third-party sites misquote it as "$1.5M ARR in 3 days".
- **2026-04-09:** **$15M seed led by Left Lane Capital**, with Peak XV, True Ventures, Goodwater and a16z speedrun. Rork Max "doubled the company's annual revenue within two weeks". FACT, [PR Newswire](https://www.prnewswire.com/news-releases/rork-raises-15m-to-power-the-next-generation-of-app-store-entrepreneurs-302736638.html); [Rork on X, Apr 10, 2026](https://x.com/rork/status/2042697770230772158) (220K views); [Axios Pro, Apr 9, 2026](https://www.axios.com/pro/enterprise-software-deals/2026/04/09/rork-seed-mobile-apps-enterprise) (paywalled; search snippet confirms the Paperline deal and "will remain acquisitive").
- **By Sep–Oct 2026:** "You can no longer create Expo (React Native) projects in Rork. New apps are native iPhone (Swift), native Android (Kotlin), or web." The stated reason: "Internal benchmarks showed the agent writes better Swift apps". FACT, [docs: What happened to Expo?](https://docs.rork.com/expo.md). The guides say "Capabilities checked ... on September 22, 2026". FACT, [rork.com/guides](https://rork.com/guides/best-no-code-mobile-app-builder). A search summary of Rork's X feed reported Sonnet 5.5 added Sep 28 and GPT-6.1 Sol added Sep 29, 2026 (secondary; not opened directly).

### 1.3 Money
- **Funding:** $2.8M seed (May 2025) + $15M seed (Apr 2026) = **$17.8M**. FACT, [Tracxn](https://tracxn.com/d/companies/rork/__xQADkBdlxRXTtVbA9k0jVII7b3TDjPBA7DURfurw8yY/funding-and-investors) and the press releases. **Valuation: not disclosed / not found.** A third-party site (rorklab.net) claims "$28M from Salesforce and a16z" and "743,000 monthly users"; nothing confirms this, so treat it as unreliable.
- **ARR, reported:** $200K (Mar 2025) → $550K (May 2025) → $1M (Jun 2025) → "millions in ARR in under a year" (Mar 17, 2026) → doubled within 2 weeks of the Max launch (Apr 2026 PR). All FACT, sources above. GetLatka's "$440K est. ARR, 2025" ([getlatka](https://getlatka.com/companies/rork.com)) conflicts with the founder's own $1M figure, so it is unreliable.
- **ESTIMATE, current ARR ≈ $6–14M (low confidence).** Method: Max added ~$1.5M per 3 days in launch week. Over the 14 days in which ARR "doubled", that is at most ~$7M added if the rate held, which implies a pre-Max base of ≤ ~$7M. With "millions" as the lower bound (≥ ~$3M base), post-doubling ARR is ~$6–14M as of March 2026.
- **Pricing, current** (FACT, [docs: Plans & Subscriptions](https://docs.rork.com/introduction/subscriptions.md), fetched):
  - **Free:** $0, Design mode only (no building). 5 design credits/day; **35 credits/month in major markets, 5/month elsewhere**.
  - **Rork Start:** ₹649/mo, **India only**, 40 credits, light models.
  - **Rork Pro:** **$20/mo, 100 credits**. iPhone (SwiftUI), Android (Kotlin + Compose), web. **No native games.**
  - **Rork Max:** **$200/mo for 1,000 credits; $500/2,500; $900/5,000; $1,800/10,000.** Adds iPad, Watch and Vision Pro, **"Games with native performance"**, widgets and priority chat.
  - A credit is "roughly one request". iOS builds and cloud-simulator time are charged on top; the **simulator costs 0.2 credits/min**. Asset costs: 3D model ~3 credits, low-poly ~1.5, rigging ~0.5, each animation clip ~0.3. FACT, [docs: Build a game](https://docs.rork.com/games/build-a-game.md).
  - Paid "Cloud credits" (USD balance, $1 free) cover AI features inside the user's finished app. FACT, [docs](https://docs.rork.com/billing/build-credits-vs-cloud-credits.md).
  - The AI App Store Reviewer needs a paid subscription. FACT, docs.
  - **Older ladder, still on public pages:** rork.com/faq says "$25 to $200+ per month" and "Rork Pro uses React Native and Expo" (fetched; out of date). French App Store in-app prices: Junior €34.99, Middle €59.99, Senior €129.99, Scale 1k €249.99 (search snippet of apps.apple.com).
- **What ONE complete mobile game costs on Rork's cheapest plan:**
  - **Native store game (iPhone):** requires **Max, $200/month** + Apple $99/yr. ESTIMATE of credits for a small 2D game: ~40–60 build messages (~40–60 credits), ~60 min of simulator (12 credits), a few iOS builds (rate not published), sprites and sound (variable), or 3–5 low-poly 3D models with rigs and clips (~5–15 credits). That is **~70–120 credits, well inside 1,000**, so the binding cost is the **$200 subscription**.
  - **Browser game:** works on **Pro, $20** (100 credits). It may need a second month or a plan bump if it exceeds 100 messages, so **$20–40**. It is not a store build.
  - **Android game:** "not a documented path today" (docs).

### 1.4 Users and traction
- **1.5M+ apps built** (Feb 25, 2026; FACT, X). "Thousands of apps have been published to the App Store and Google Play" (FACT, [rork.com/faq](https://rork.com/faq), undated, fetched). No exact published-app count found.
- **Rork Stars leaderboard** (MRR live from RevenueCat; fetched): #1 Wrestle AI **$19,023 MRR**; #2 3AK Track $14,875 MRR ($109,562 total); #3 Flowfy $5,429 MRR; 18 entries, **none of them a game**. FACT, [rork.com/rorkstarsleaderboard](https://rork.com/rorkstarsleaderboard). Rork says it is "the number one referring website to RevenueCat" and "the largest AI platform for building mobile apps by web traffic". FACT (company claim), PR Newswire, Apr 2026.
- **Social** (all fetched 2026-10-16):
  - X **@rork 59,191 followers** (joined Mar 2025); @daniel_dhawan 13,224; @levan 6,631.
  - YouTube **@rork-app 92K subscribers, 16 videos** ([youtube.com/@rork-app](https://www.youtube.com/@rork-app)).
  - Discord **6,847 members** (526 online) (Discord invite API, [discord.gg/rxBHytVKaT](https://discord.gg/rxBHytVKaT)). The site says "Join 6,000+ founders".
- **Ratings:**
  - Product Hunt 4.4/5 (25 reviews), 2.8K followers. FACT, [PH](https://www.producthunt.com/products/rork-app-for-ios).
  - **Trustpilot TrustScore 1.7, 25 reviews, 84% one-star.** FACT, [Trustpilot](https://www.trustpilot.com/review/rork.com), fetched.
  - The old iOS app showed 4.7 from 3.3K ratings (search snippet of apps.apple.com, date unknown; the listing is gone now).

### 1.5 Product (what the user gets; games; publishing)
- **Stack:** a cloud Mac fleet runs Xcode, the agent writes SwiftUI, compiles, reads errors, and streams a real iOS Simulator to the browser (FACT, [rork.com/max](https://rork.com/max)). Android projects are Kotlin + Compose on a cloud Android emulator; web projects are Vite + React. One project can hold the iPhone, Android and web apps as **separate codebases that the agent keeps in sync** ("The two apps can still drift"). FACT, docs (Expo page).
- **Model picker:** "Auto" by default, with many models (Claude, GPT, Gemini, Kimi, Qwen, DeepSeek...). FACT, docs (agent modes, credits).
- **Games** (FACT, [rork.com/games](https://rork.com/games), [docs: Build a game](https://docs.rork.com/games/build-a-game.md)):
  - **Engines:** "Rork writes a native Swift project: SpriteKit for 2D games and RealityKit for 3D games." In the browser it uses "HTML canvas" (2D) or "three.js with React Three Fiber, physics with Rapier" (3D).
  - **Genres listed:** 2D platformers, match-3, puzzles, top-down shooters, endless runners, card games. 3D racing, FPS/TPS, arena combat, flight, open worlds.
  - **Generated assets:** rigged 3D characters with walk/run/attack clips (USDZ on iPhone, GLB on web), 2D sprites, music, SFX and voices.
  - **Multiplayer:** Game Center on iPhone; Cloudflare Workers + Durable Objects over WebSockets in the browser. Also Game Center leaderboards and achievements, gamepad support, haptics.
  - **Showcase:** lane runner, Pokémon-Go-style AR catcher, AR boxing, Doodle Jump. rork.com/max also lists Minecraft-style and Subway Surfers clones.
  - **Limits stated by Rork:** "roughly a thousand moving things, a few hundred thousand triangles"; "No Unity or Unreal, and no importing a project from them"; "Android games are not a documented path today".
  - The home prompt box has "Create a 3D Game" and "Create a Multiplayer Game" shortcuts that **default to web**, "because a browser game is the fastest way to see something playable".
  - The docs page notes "Games get read carefully in review" and advise running the AI App Store Reviewer first, and to "be careful with anything that looks like gambling, loot boxes, or a copied character".
- **App Store publishing flow** (FACT, [docs: publish](https://docs.rork.com/store-guides/publish-app-store.md), [publishing](https://docs.rork.com/publishing.md), [FAQ publishing](https://docs.rork.com/faq/publishing.md)):
  1. The user creates their own Apple Developer account ($99/yr).
  2. In Rork: set name, bundle ID and icon (Rork can generate the icon).
  3. Press **Publish → App Store**, **sign in with the Apple Developer account inside Rork, then enter Apple's 2FA code**.
  4. "Rork builds and uploads the app on its own machines, so no Mac, Xcode, or extra build account is needed."
  5. The build appears in App Store Connect; the user finishes the listing (screenshots, pricing, privacy) there and submits for review.
  - Extras: a **TestFlight** link for testers; an **AI App Store Reviewer** that "reads your iOS build against the App Store Review Guidelines ... reports each rejection risk with its guideline number, the evidence ... and a suggested fix" (paid plans); **Screenshot Studio**; App Store **reviews arrive in the project and the agent drafts replies**; RevenueCat paywalls and an analytics tab with MRR. The Max page markets this as "Two clicks to App Store"; later submissions are one click once signed in.
- **Google Play flow** (FACT, [docs](https://docs.rork.com/store-guides/google-play-developer-account.md)):
  1. "Build AAB for Play" (Rork signs it with a stable upload key).
  2. "Connect Google Play" (the account that manages the app).
  3. "Send to Google Play", which goes to the **internal testing** track only.
  4. The user creates the app record, fills in the listing and policy forms, and promotes to production in Play Console.
  - The docs warn about Google's rule for **new personal accounts (created after 13 Nov 2023): a closed test with ≥12 testers opted in for 14 days** before production access. They suggest swapping testers in the Rork Discord.
- **Device install:** Swift apps install over USB with the free Rork Companion (Windows/Mac) or a browser installer. A free Apple account allows 3 sideloaded apps; a paid one has no limit (FACT, docs).
- **Quality of games:** no independent review of a shipped Rork game found. Rork's own leaderboard has no games among its earners.

### 1.6 Quality: user opinions (praise and complaints)
- 1★, Trustpilot, **Sep 7, 2026** (robert s): "Charged me thousands of dollars for tiny fixes. No rhyme or reason for the charges." [Trustpilot](https://www.trustpilot.com/review/rork.com)
- 1★, Trustpilot, **Jul 15, 2026**: "Upon cancellation, the platform completely blocked my access, preventing me from downloading or exporting my own code." (same link)
- 2★, Trustpilot, **Sep 3, 2026**: "I accidentally spend over 85 Euro's while I've had it for just 2 days." Another reviewer complains that Rork "abandon[ed] the original Rork platform for their new Rork Max", which stopped them updating their App Store app (Trustpilot summary via search).
- Product Hunt (~9 months before Oct 2026, Jonas Shaik): "Great for non critical internal business tools." A review from ~5 months ago: "The product is horrible at its best" (support didn't respond). [Product Hunt](https://www.producthunt.com/products/rork-app-for-ios)
- **Games, positive (Rork-curated):** "I made several apps and games using Rork and I'm super happy with the results. Very fast MVP building, great quality from a single detailed prompt..." [rork.com/reviews](https://rork.com/reviews)
- **Games, sponsored:** a NoCode MBA YouTube tutorial (Rork-sponsored, ~Jul 2026) says it built "a fully playable 3D Flappy Bird game with one prompt". [YouTube](https://www.youtube.com/watch?v=rs6wq0xHAV8)
- **Older Expo era (mid-2025):** a Medium round-up of Reddit complaints says the "Publish" button "might as well be fake", with crashes and previews not loading. [Medium](https://aibenchmarked.medium.com/my-honest-thoughts-on-rork-app-ai-app-builder-worth-the-hype-9749015eb503)

### 1.7 Go-to-market
- **Positioning:** "Create mobile apps by chatting with AI, ship to App Store and start making money" (rork.com). The pitch is "App Store entrepreneurs" and "Rork turns consumers into entrepreneurs" (PR). The audience is non-technical consumer-app founders, often teens or young people (Rork Stars stories: an 18-year-old with Wrestle AI, "14 and 17 – $1K/month in 25 days").
- **Channels:**
  - **X virality:** Shumer's post (1M+ views); the Max launch (8M+ views); the seed video (220K views).
  - **Founder stories** with live RevenueCat MRR.
  - YouTube (92K subs) and sponsored creator tutorials (NoCode MBA).
  - Discord (6.8K) with closed founder streams.
  - An affiliate program; credits for written guides.
  - **Up to 1,000 free credits for connecting RevenueCat** (based on app revenue).
  - An India-priced plan (₹649) and region-based free credits.
  - A "Rork Playbook" in the docs (influencer marketing, paywalls, "scale to $50k+/month").
  - SEO guides and competitor-import pages ("Convert your Lovable app", "Move from Bolt, v0, Replit, FlutterFlow...").
- **Partnerships:** RevenueCat (deep integration, top referrer); Expo founders as angels (2025); Anthropic models are central ("Powered by Claude Code & Opus 4.6").

### 1.8 Assessment for TypePlay
- **Threat: HIGH.** Rork owns the "AI → App Store" mindshare. It is Claude-based like TypePlay, well funded ($17.8M), and already markets "Build native games without a game engine" with generated 3D models and Game Center. A TypePlay visitor will compare the two.
- **Where Rork is weak, and TypePlay should aim:**
  1. **Price gate:** native games need **$200/mo** Max. TypePlay offers store builds at ~$20.
  2. **Platforms:** native games are **iPhone-only**; Android games are undocumented; there is no desktop/Steam. Separate Swift and Kotlin codebases "can drift". Godot gives one project for all targets.
  3. **No engine:** there are no scenes, an editor or a stable game runtime. SpriteKit/RealityKit only, and the stated ceilings are "a thousand moving things".
  4. **Iteration cost:** the iPhone simulator is billed per minute (0.2 credits/min). TypePlay's instant Godot web preview is free to play.
  5. **Trust:** Trustpilot 1.7, with billing surprises and blocked export. TypePlay can win with transparent per-message $ and always-available export.
  6. **Focus:** games are a side product. All 18 leaderboard earners are utility or AI apps.
- **What to copy:**
  - The **publish wizard**: sign in with Apple ID + 2FA inside the product, cloud-Mac build and upload, TestFlight link.
  - An **AI App Store Reviewer** (guideline-numbered risks + fixes) before submission.
  - **Screenshot Studio** and agent-drafted review replies.
  - The **Google Play** flow (signed AAB → internal track, plus clear coaching on the 12-tester/14-day rule and a tester-swap community).
  - The leaderboard of real MRR as social proof.
  - Per-message "⋯ → model, credits, context size" transparency.
  - The **"Start in the browser to find out whether the game is fun. Move to native when it is."** message, which is exactly TypePlay's flow.

---

## 2. Vibecode (vibecodeapp.com)

- **Identity:** **Not A Number Labs Incorporated, a Delaware corporation**. Arbitration seat in San Francisco; DMCA address 2261 Market St Suite 85126, SF. FACT, [Terms](https://www.vibecodeapp.com/terms) (last updated Jun 5, 2025). [notanumber.com](https://notanumber.com): "We are currently building VibeCode". X @vibecodeapp shows "San Francisco, CA".
  - **Founders: not confirmed** (search budget exhausted). The company is commonly associated with creator **Riley Brown** (X @rileybrown, 255,499 followers, fetched), but I did not verify this. His X bio now reads "Building an @agentnative_ company".
  - **Team size:** not found. Careers lists one contract role.
- **Age:** **vibecode.dev registered 2025-02-05; vibecodeapp.com registered 2025-03-03.** FACT, RDAP. X account joined Mar 1, 2025. **iOS app on the App Store since Jun 17, 2025.** FACT, iTunes API + [App Store status page](https://www.vibecodeapp.com/app-store-status) (reviewed Oct 11, 2026).
  - **Apple episode:** in early 2026 Apple held updates under **guideline 2.5.2**. Per The Information via MacRumors, Apple indicated Vibecode "would likely be approved if it removed the ability to generate software for Apple devices". Apple approved v1.2.11 on **Mar 18, 2026**. Latest version v1.2.20 is dated Oct 8, 2026. FACT, [MacRumors, Mar 18, 2026](https://www.macrumors.com/2026/03/18/apple-blocks-updates-for-vibe-coding-apps/) and the Vibecode status page.
- **Money:** funding, ARR and valuation **not found** (search budget exhausted; no funding post on their site or blog).
  - **Pricing** (FACT, [docs: Plans and Credits](https://www.vibecodeapp.com/docs/getting-started/plans-and-credits.md), fetched):
    - **Free:** first app build free; no App Store submission.
    - **Plus $20/mo:** $20 credits, App Store submission, image/sound generation, database/auth.
    - **Pro $50/mo:** $55 credits, code download, SSH.
    - **Max $200/mo:** $220 credits.
    - Annual plans: $200 / $500 / $2,000 per year.
    - **"$1 in credits = $1 in AI usage ... No markup."** Credits roll over and never expire. Auto-reload minimum is $20. Free credits for posting about Vibecode on social media.
    - Vibecode's own estimates: **new app $0.50–2.00; iterate $0.10–0.50; image ~$0.05; sound ~$0.05.**
  - **One complete game on Plus ($20):** ESTIMATE. 1 new build ($2) + 40 iterations × $0.30 ($12) + ~20 images/sounds ($1) ≈ **$15**, which fits the **$20/mo Plus** plan (it includes App Store submission). Add Apple $99/yr. Code download needs Pro ($50).
- **Users and traction** (fetched 2026-10-16):
  - App Store **4.65★ from 3,325 ratings** (id6742912146; iTunes API).
  - Google Play **10K+ downloads, 3.6★, 786 reviews** (com.vibecodeapp.app).
  - X **72,610 followers**.
  - Discord **4,458 members**.
  - User and published-app counts: not found.
- **Product:**
  - Per project the user picks **native Swift/SwiftUI iOS** (compiled on cloud Macs; the simulator is streamed as video "so no code runs on your device"), **React Native + Expo** (iOS + Android), or **web**.
  - **Publishing:** native iOS → "connect an App Store Connect API key. Vibecode builds, signs, and uploads your Swift app to Apple for you". RN → Apple + free Expo account. Device install needs a paid Apple membership and device registration.
  - **App Clips** for sharing without the store. FACT, [FAQ](https://www.vibecodeapp.com/faq).
  - **Games:** the template gallery on the home page includes **"Hearthguard – A 3D tower defense game where your hero cuts through hordes of hundreds, grabs their gold and builds towers"** (one of TypePlay's launch genres), plus "Cat Collector – Pokemon GO for street cats", and trivia/habit-game starters. FACT, [vibecodeapp.com](https://www.vibecodeapp.com/). There is no dedicated games page or engine.
  - A `/appstore-preflight` command checks guidelines 5.1, 3.1.1, 2.1, 4.2, 4.1 and 4.3 before submission. FACT, [docs](https://www.vibecodeapp.com/docs/guides/app-store-review-guidelines.md).
- **Quality (quotes):**
  - Google Play, **Sep 15, 2026**: "With this app, I could make any kind of game I want... racing, card games, puzzles, space shooters...the possibilities are (almost) ENDLESS!" (expectation, not a result).
  - Google Play, **Jul 31, 2026**: "I got charged $54 and now I'm trying to get a hold of customer service ... there's no customer service anywhere to be found."
  - App Store (curated on vibecodereviews.com, Jan 2026): "the best one for non technical people ... I'm about to publish 2 new apps the the App Store."
  - [Play listing](https://play.google.com/store/apps/details?id=com.vibecodeapp.app); [vibecodereviews.com](https://vibecodereviews.com/)
- **Go-to-market:** a creator-led launch (strong X presence) and "the first ever app that builds apps" on the phone. Clone templates (Instagram, Netflix, Tinder, Uber) for SEO, many comparison pages (vs Rork, Lovable, Bolt...), a referral program, a contest, social-post credits, and a CLI that gives "your own AI agent the Vibecode environment".
- **Assessment: MEDIUM.**
  - It is cheap ($20 with store submission) and native, and it already shows a **3D tower-defence game** template.
  - But Swift games run on iPhone only, there is no Android build for Swift projects, no engine and no Steam. Play-store rating is weak (3.6).
  - **Copy:** at-cost credit transparency, "first app free", and a preflight check before submission.

## 3. a0.dev

- **Identity:** a0.dev. The company is "a0.dev (YC W25)", founded 2025, **team size 3**, San Francisco. FACT, [YC company page](https://www.ycombinator.com/companies/a0-dev), fetched.
  - **Founders:** **Seth Setse** (CEO; CMU '23, "serial app developer") and **Ayomide Omolewa** (CTO; previously Nvidia, Paramount, Google, Lockheed Martin). FACT, YC page.
  - **Legal name:** not found on the site. The App Store listing a0.dev links to (id6759644922) is "a0.dev Analytics" by **TeeHee Tech LLC** (released Mar 11, 2026, 0 ratings). FACT, iTunes API. ESTIMATE: TeeHee Tech LLC is likely the operating entity.
- **Age:** **a0.dev registered 2024-11-09** (FACT, RDAP). Product Hunt launches **Feb 5, 2025 (#3 of the day)** and **Jul 3, 2025 ("Phase 1": iOS builds, payments)**. FACT, [Product Hunt](https://www.producthunt.com/products/a0-dev); [a0 blog](https://a0.dev/blog). X @a0_dev joined Jan 15, 2025.
- **Money:**
  - **Funding:** pre-seed/seed Mar 2025 led by Y Combinator, with Pioneer Fund, Collab Capital, Team Ignite, Karman Ventures and Ryan Merket. FACT, [Crunchbase round](https://www.crunchbase.com/funding_round/a0-dev-pre-seed--2c03ecfd) via search snippet. Total **≈$500K** (PitchBook via search snippet, [pitchbook](https://pitchbook.com/profiles/company/739928-98)). No later round found.
  - **Revenue:** GetLatka "$770K est. ARR (2025)" ([getlatka](https://getlatka.com/companies/a0.dev)). It is unreliable, because the same page says "bootstrapped".
  - **Pricing** (FACT, plan data embedded in [a0.dev/pricing](https://a0.dev/pricing), fetched 2026-10-16):
    - **Pro $20/mo (100/mo; $204/yr)**, Pro 250 $50, Pro 500 $100, Pro 1000 $200, Pro 1500 $290, Pro 2500 $450, Pro 5000 $800.
    - **Max $200/mo (1,250/mo; $2,040/yr)**, created Feb 10, 2026.
    - The unit is "credits"; a Play reviewer mentions plans "like $20, $50, $100".
  - **One complete game:** ESTIMATE. ~40–80 messages (taking 1 credit ≈ 1 message) fits **Pro $20/mo**, plus Apple $99/yr and/or Google $25.
- **Users and traction:**
  - Homepage: **"200k+ users building apps", "300k+ apps created on a0"**, "Thousands of apps ... deployed to the App Store, Google Play Store, and web". FACT (company claim), [a0.dev](https://a0.dev), fetched.
  - Google Play builder app **50K+ downloads, 4.5★, 5.62K reviews** (dev.a0.android.app).
  - X @a0_dev **10,438**; @sethsetse 7,556.
  - Discord **3,931**.
  - Product Hunt 686 followers, no reviews.
- **Product:**
  - "Customized React Native projects". Previews with react-native-web, Expo Go or the a0 app. Convex or Supabase backends.
  - **One-click publishing:** "We'll handle the build, create your App Store Connect listing, and upload it for you". The user connects their **App Store Connect API key** (Admin rights, Team API keys enabled), picks bundle ID and team, then **Generate & Submit**. FACT, [docs](https://docs.a0.dev/publishing/ios/deploying-on-a0.md).
  - IPA/APK builds, OTA updates, payments and analytics.
  - **Games:** the showcase leads with games made by the founders: **Flappy Bird, Panda Run, Tap Beat Live**. A testimonial from co-founder Ayo: "wow my game is blowing up". Game tech is not documented.
- **Quality (quotes):**
  - Google Play, **Jan 22, 2026**: "I asked it to make me a tattoo image generator app and it generated an app that doesn't generate pictures! it fails every time."
  - Google Play, **Nov 8, 2025**: complains that credits don't regenerate unless you buy "a proper plan like $20,$50,$100".
  - [Play listing](https://play.google.com/store/apps/details?id=dev.a0.android.app)
- **Go-to-market:** founder "vibeposting" on X, YC network, a Facebook ad (mentioned in a Play review), Discord/Reddit communities.
- **Assessment: LOW–MEDIUM.** It is tiny (3 people, ~$0.5M raised) and RN-based, with no engine. It is credible on store publishing for both stores, and its founders clearly like making games. **Copy:** the API-key-based App Store Connect setup that creates the store listing automatically.

## 4. Anything (anything.com, formerly Create / createanything.com)

- **Identity:** legal entity **Create, Inc.** (FACT, [Terms page title](https://www.anything.com/tos)).
  - **Founders:** **Dhruv Amin** and **Marcus Lowe**, who "met at Google". Dhruv's X bio: "prev youtubetv, stanford ai". FACT, [blog "$11m to build Anything", Sep 29, 2025](https://www.anything.com/blog/anything-series-a); X @dhruvamin (8,444 followers).
  - **HQ:** "come help ... in SF" (same post). **Team size:** not found.
- **Age and timeline** (FACT, same blog post unless noted):
  - **2021:** codegen system + developer marketplace.
  - **2022:** bootstrapped to **$1M revenue**, raised from Uncork.
  - **2023:** **$2M revenue**, shut the marketplace down.
  - **2024:** launched Create (create.xyz), raised from Bessemer.
  - **May 1, 2025:** "1-click App Store submit". Their first AI app "Draw Daily" was live on day 6 with 351+ downloads ([blog](https://www.anything.com/blog/introducing-1-click-app-store-submit)).
  - **Aug 7, 2025:** **Anything launched** (same day as GPT-5). About **450,000 people** had tried Create ([launch post, Aug 8, 2025](https://www.anything.com/blog/anything-launch)). "2 weeks later, **$2m in run rate**."
  - **Sep 26, 2025:** Anything Max.
  - **Nov 24, 2025:** iPhone app ([blog](https://www.anything.com/blog/anything-ios)).
  - **Dec 11, 2025:** moved to anything.com ([blog](https://www.anything.com/blog/anything-com)).
  - **Domains:** createanything.com registered 2009-02-06; anything.com registered 1997-09-15, last changed 2025-11-03 (bought). FACT, RDAP.
- **Money:**
  - **$11M at a $100M valuation led by Footwork** (Sep 29, 2025; "Footwork preempts Series A"). FACT, blog. Earlier Uncork and Bessemer amounts: not found.
  - **Pricing** (FACT, [docs: Subscriptions](https://www.anything.com/docs/account/subscriptions.md), fetched):
    - **Building requires a paid plan.**
    - **Pro 20k: $24/mo monthly ($19/mo annual)**.
    - Max 200k: $239/mo ($199 annual), up to Max 900k at $1,079/mo.
    - Top-offs: $12 per 10k credits. "**1k credits ~= $1**" ([Apr 15, 2025 post](https://www.anything.com/blog/credits-pricing)).
    - **Instant self-serve credit refund for generations that didn't work.**
  - **One complete game:** ESTIMATE. ~$10–20 of AI usage (comparable to Vibecode's at-cost figures) ≈ 10k–20k credits, which fits **Pro 20k at $24/mo**, possibly plus one $12 top-off. Add Apple $99/yr.
- **Users and traction:**
  - X **@anything 60,329 followers**. The bio now promotes **@getskydive** ("AI coworkers that actually get work done", X account joined May 12, 2026, 667 followers). ESTIMATE: the team's attention is partly on a new product.
  - **The Anything iOS app (id6751247034, linked from their blog) no longer resolves in the US/UK App Store.** FACT, iTunes lookup, fetched. The cause is not stated; ESTIMATE that 2.5.2 is likely, given what happened to Vibecode and Replit.
- **Product:**
  - **Expo** apps for iOS + Android, previewed through Expo Go (the user pastes an Expo token).
  - **App Store:** "Enter your Apple ID credentials, then complete verification ... Anything handles the build and uploads it to App Store Connect. This usually takes 30 minutes or less". TestFlight first, then the user completes the listing. FACT, [docs](https://www.anything.com/docs/launch/app-store.md).
  - **Google Play: beta**, uploads to the internal testing track via a service account ([docs](https://www.anything.com/docs/apps/mobile/publishing-android.md)).
  - **Games:** no game features. Only SEO articles, e.g. "How to build a game app" (May 30, 2026).
- **Quality:** no game-specific opinions found.
- **Go-to-market:** an X launch timed to GPT-5; PLG/consumer (Footwork); stories of non-technical founders making money ("Finance professional in Japan ... $34k in revenue"); affiliates; a hackathon.
- **Assessment: LOW** for games. It has a strong store-publishing flow but no game angle and an Expo-only stack. **Copy:** the **instant credit refund for failed generations**. It fits TypePlay's "output is partly luck" stance.

## 5. Bolt (bolt.new, StackBlitz): Expo/mobile only

- **Mobile support:** "Expo for mobile apps". The user includes "mobile app" in the first prompt and previews in Expo Go. **Publishing is manual:** "download the code", install Node + Git, `npm install -g eas-cli`, `eas login`, `eas build --platform ios --auto-submit`, `eas build --platform android`, then upload to Play Console by hand. Updates mean re-downloading and rebuilding. FACT, [support.bolt.new/integrations/expo](https://support.bolt.new/integrations/expo.md), fetched.
  - Expo's free tier: "15 Android and 15 iOS builds"; Starter $19/mo with $45 build credit. FACT, [expo.dev/pricing](https://expo.dev/pricing).
  - **No game features** found.
  - Bolt launched mobile/Expo on **Feb 12, 2025**, the same day as Rork (TechCrunch, May 5, 2025).
- **Pricing:** Free 1M tokens/mo (300K/day cap); **Pro $25/mo from 10M tokens** (Pro 50 = 26M, Pro 100 = 55M); Teams $30/member. FACT, [bolt.new/pricing](https://bolt.new/pricing), [docs](https://support.bolt.new/account/billing.md).
  - **One game:** ESTIMATE. 30–50 messages × ~150–300K tokens each ≈ 5–15M tokens, so **$25–50/mo**, plus local tooling and the free EAS tier.
- **Business:** Sacra estimates **$40M ARR (Mar 2025)**, ~40% gross margin, **$105.5M Series B (Jan 2025, led by Emergence and GV, ~$700M valuation)**, and **7M+ users (Dec 2025)**. These are secondary estimates without source links ([Sacra](https://sacra.com/c/bolt-new/)).
  - bolt.new registered 2024-07-09 (RDAP).
  - First acquisition **Dokai** (enterprise sales agents), **Sep 29, 2026** ([Bolt blog](https://bolt.new/blog/tag/announcements)). The site now pitches "AI for Small Business".
  - X @boltdotnew 123,221; @EricSimons (CEO) 28,786.
- **Assessment: LOW.** Mobile is an Expo side-path with a CLI publish flow and no games. Bolt is moving toward business and enterprise apps.

---

## 6. AI-built apps in the stores and platform pushback (2025–2026)

**Volumes**
- **Apple:** in 2025 App Review evaluated **>9.1M submissions** and rejected **>2M**: 1.2M new apps and ~800K updates. Of those, **>371,000** were spam, copycat or misleading, **>443,000** were privacy violations and **>22,000** had hidden features; ~59,000 bait-and-switch apps were removed and 193,000 developer accounts terminated. Apple's wording: **"As powerful AI development tools drive a surge in app submissions, Apple's App Review process has seamlessly scaled..."** FACT, [Apple Newsroom, May 20, 2026](https://www.apple.com/newsroom/2026/05/the-app-store-stopped-over-2-point-2-billion-usd-in-fraudulent-transactions-in-2025/).
  - The 2024 figures were **>7.7M reviewed, >1.9M rejected, >320,000 spam/copycat/misleading**. FACT, [Apple Newsroom, May 27, 2025](https://www.apple.com/newsroom/2025/05/the-app-store-prevented-more-than-9-billion-usd-in-fraudulent-transactions/).
  - **ESTIMATE:** submissions **+18%** year on year (9.1/7.7) and spam/copycat rejections **+16%** (371K/320K).
- **Google Play:** in 2025 Google prevented **>1.75M policy-violating apps** from being published and **banned >80,000 developer accounts**. It "integrated Google's latest generative AI models into our review process". Developer verification opens to all developers in 2026. FACT, [Google blog, Feb 19, 2026](https://blog.google/security/keeping-google-play-android-app-ecosystem-safe-2025/).
- **Builder-reported counts:**
  - Rork: **1.5M+ apps built** (Feb 2026) and "thousands" published.
  - a0: **300k+ apps created**, "thousands" deployed.
  - Create/Anything: ~450,000 people tried Create (Aug 2025).
  - No independent count of AI-built apps in the stores was found. Appfigures blocked access (403).

**Pushback**
- **Builder apps (guideline 2.5.2, "may not download, install, or execute code which introduces or changes features"):** in March 2026 Apple held updates for **Replit and Vibecode**. Apple expected Replit to open generated apps in an external browser, and said Vibecode would likely be approved if it removed generating software for Apple devices. Apple says it has "no rules specifically against vibe coding apps". FACT, [MacRumors, Mar 18, 2026](https://www.macrumors.com/2026/03/18/apple-blocks-updates-for-vibe-coding-apps/).
  - Rork's iPhone app is **sideload-only** ("can't live on the App Store").
  - **Anything's** and **a0's** builder apps are not listed on the US App Store today (iTunes lookup, fetched 2026-10-16).
- **AI-built apps themselves:** no rule targets them. The rules that bite:
  - **Guideline 4.3 Spam:** "Don't submit apps that are indistinguishable from what's already widely available. Opportunistically creating variants of existing app categories or popular apps degrades App Store discovery". **4.2 Minimum Functionality.** **4.1 Copycats.**
  - **Guideline 4.2.6:** "Apps created from a commercialized template or app generation service will be rejected unless they are submitted directly by the provider of the app's content. These services should not submit apps on behalf of their clients". FACT, [App Review Guidelines, last updated Jun 8, 2026](https://developer.apple.com/app-store/review/guidelines/). All the builders above therefore submit **under the user's own Apple account**.
  - Vibecode's docs: "The guidelines judge the app you submit, not the tool you built it with."
- **Google Play:**
  - The Spam policy bans "apps that are repetitive or low-quality". "Repetitive Content": "We don't allow apps that merely provide the same experience as other apps already on Google Play"; this includes copying content without adding value and "Creating multiple apps with highly similar functionality". FACT, [Play Spam policy](https://support.google.com/googleplay/android-developer/answer/9899034).
  - "Functionality": "We do not allow apps that only have limited functionality and content". FACT, [Play policy](https://support.google.com/googleplay/android-developer/answer/9898783).
  - The **AI-Generated Content** policy covers apps that *generate* AI content (in-app reporting required), not AI-*built* apps ([Play policy](https://support.google.com/googleplay/android-developer/answer/13985936)).
  - **New personal developer accounts (after Nov 13, 2023) need a 12-tester, 14-day closed test** before production (as stated in [Rork docs](https://docs.rork.com/store-guides/google-play-developer-account.md)).
- **Implications for TypePlay's store-export promise:**
  1. Keep the builder on the web; never ship an iOS app that runs generated games inside it (2.5.2).
  2. Always submit under the user's own account (4.2.6). This is already decided.
  3. Genre games such as endless runners and Flappy-likes are exactly what 4.3 and "Repetitive Content" target. Add a **preflight** (AI review against 4.1/4.2/4.3 and Play spam) and push uniqueness: code-drawn art helps.
  4. Explain Google's 12-tester/14-day rule in the Android export flow; Rork and Anything both target the internal track first.

---

## Sources
- Rork: [rork.com/games](https://rork.com/games) · [rork.com/max](https://rork.com/max) · [rork.com/faq](https://rork.com/faq) · [rork.com/terms](https://rork.com/terms) · [rork.com/reviews](https://rork.com/reviews) · [Rork Stars leaderboard](https://rork.com/rorkstarsleaderboard) · [rork.com/guides](https://rork.com/guides/best-no-code-mobile-app-builder) · [docs llms.txt](https://docs.rork.com/llms.txt) · [docs: Build a game](https://docs.rork.com/games/build-a-game.md) · [docs: Plans](https://docs.rork.com/introduction/subscriptions.md) · [docs: Credits](https://docs.rork.com/billing/build-credits-vs-cloud-credits.md) · [docs: Expo](https://docs.rork.com/expo.md) · [docs: Publish App Store](https://docs.rork.com/store-guides/publish-app-store.md) · [docs: Publishing FAQ](https://docs.rork.com/faq/publishing.md) · [docs: Google Play account](https://docs.rork.com/store-guides/google-play-developer-account.md) · [docs: AI App Store Reviewer](https://docs.rork.com/ai-app-store-reviewer.md) · [docs: Rork Max app](https://docs.rork.com/rork-max/rork-max-app.md) · [docs: Companion](https://docs.rork.com/rork-max-swift.md) · [PR Newswire, Apr 9 2026](https://www.prnewswire.com/news-releases/rork-raises-15m-to-power-the-next-generation-of-app-store-entrepreneurs-302736638.html) · [Axios Pro, Apr 9 2026](https://www.axios.com/pro/enterprise-software-deals/2026/04/09/rork-seed-mobile-apps-enterprise) · [TechCrunch, May 5 2025](https://techcrunch.com/2025/05/05/rorks-founders-were-almost-broke-when-a-viral-tweet-led-to-2-8m-and-a16z/) · [a16z speedrun profile](https://speedrun.a16z.com/companies/rork) · [Tracxn](https://tracxn.com/d/companies/rork/__xQADkBdlxRXTtVbA9k0jVII7b3TDjPBA7DURfurw8yY/funding-and-investors) · [GetLatka](https://getlatka.com/companies/rork.com) · X posts: [Mar 16 2025](https://x.com/daniel_dhawan/status/1901082824138178805), [Jun 16 2025](https://x.com/daniel_dhawan/status/1934749637577199850), [Jan 5 2026](https://x.com/daniel_dhawan/status/2008304778091409627), [Feb 19 2026](https://x.com/daniel_dhawan/status/2024577947668222233), [Feb 25 2026](https://x.com/daniel_dhawan/status/2026485351447937107), [Mar 17 2026](https://x.com/daniel_dhawan/status/2034004426998849585), [Apr 10 2026](https://x.com/rork/status/2042697770230772158) · [Product Hunt](https://www.producthunt.com/products/rork-app-for-ios) · [Trustpilot](https://www.trustpilot.com/review/rork.com) · [YouTube @rork-app](https://www.youtube.com/@rork-app) · [Discord](https://discord.gg/rxBHytVKaT) · [NoCode MBA game tutorial](https://www.youtube.com/watch?v=rs6wq0xHAV8) · [Medium review](https://aibenchmarked.medium.com/my-honest-thoughts-on-rork-app-ai-app-builder-worth-the-hype-9749015eb503) · [rdap rork.app](https://rdap.org/domain/rork.app)
- Vibecode: [vibecodeapp.com](https://www.vibecodeapp.com/) · [App Store status](https://www.vibecodeapp.com/app-store-status) · [FAQ](https://www.vibecodeapp.com/faq) · [Terms](https://www.vibecodeapp.com/terms) · [docs: Plans and Credits](https://www.vibecodeapp.com/docs/getting-started/plans-and-credits.md) · [docs: Review guidelines](https://www.vibecodeapp.com/docs/guides/app-store-review-guidelines.md) · [llms.txt](https://www.vibecodeapp.com/llms.txt) · [notanumber.com](https://notanumber.com) · [App Store listing](https://apps.apple.com/us/app/vibecode-ai-app-builder/id6742912146) · [Google Play](https://play.google.com/store/apps/details?id=com.vibecodeapp.app) · [vibecodereviews.com](https://vibecodereviews.com/) · [MacRumors, Mar 18 2026](https://www.macrumors.com/2026/03/18/apple-blocks-updates-for-vibe-coding-apps/)
- a0.dev: [a0.dev](https://a0.dev) · [a0.dev/pricing](https://a0.dev/pricing) · [YC page](https://www.ycombinator.com/companies/a0-dev) · [docs: Deploying](https://docs.a0.dev/publishing/ios/deploying-on-a0.md) · [docs: Apple Developer Program](https://docs.a0.dev/publishing/ios/apple-developer-program.md) · [Crunchbase round](https://www.crunchbase.com/funding_round/a0-dev-pre-seed--2c03ecfd) · [PitchBook](https://pitchbook.com/profiles/company/739928-98) · [GetLatka](https://getlatka.com/companies/a0.dev) · [Product Hunt](https://www.producthunt.com/products/a0-dev) · [Google Play](https://play.google.com/store/apps/details?id=dev.a0.android.app) · [Discord](https://discord.gg/gKWx2vB5NU)
- Anything: [anything.com](https://www.anything.com/) · [pricing](https://www.anything.com/pricing) · [docs: Subscriptions](https://www.anything.com/docs/account/subscriptions.md) · [docs: Credits](https://www.anything.com/docs/account/credits.md) · [docs: Mobile](https://www.anything.com/docs/apps/mobile.md) · [docs: App Store](https://www.anything.com/docs/launch/app-store.md) · [docs: Play Store](https://www.anything.com/docs/apps/mobile/publishing-android.md) · [$11m post, Sep 29 2025](https://www.anything.com/blog/anything-series-a) · [launch, Aug 8 2025](https://www.anything.com/blog/anything-launch) · [1-click submit, May 1 2025](https://www.anything.com/blog/introducing-1-click-app-store-submit) · [credits pricing, Apr 15 2025](https://www.anything.com/blog/credits-pricing) · [iOS app post, Nov 24 2025](https://www.anything.com/blog/anything-ios) · [anything.com post, Dec 11 2025](https://www.anything.com/blog/anything-com) · [ToS](https://www.anything.com/tos)
- Bolt: [support: Expo](https://support.bolt.new/integrations/expo.md) · [support: Billing](https://support.bolt.new/account/billing.md) · [support: Tokens](https://support.bolt.new/account/tokens.md) · [bolt.new/pricing](https://bolt.new/pricing) · [Bolt blog announcements](https://bolt.new/blog/tag/announcements) · [Sacra](https://sacra.com/c/bolt-new/) · [expo.dev/pricing](https://expo.dev/pricing)
- Platforms: [Apple App Review Guidelines (Jun 8 2026)](https://developer.apple.com/app-store/review/guidelines/) · [Apple Newsroom, May 20 2026](https://www.apple.com/newsroom/2026/05/the-app-store-stopped-over-2-point-2-billion-usd-in-fraudulent-transactions-in-2025/) · [Apple Newsroom, May 27 2025](https://www.apple.com/newsroom/2025/05/the-app-store-prevented-more-than-9-billion-usd-in-fraudulent-transactions/) · [Google blog, Feb 19 2026](https://blog.google/security/keeping-google-play-android-app-ecosystem-safe-2025/) · [Play Spam policy](https://support.google.com/googleplay/android-developer/answer/9899034) · [Play Functionality policy](https://support.google.com/googleplay/android-developer/answer/9898783) · [Play AI-Generated Content policy](https://support.google.com/googleplay/android-developer/answer/13985936) · [a16z speedrun: 8 Hot Takes on Vibe-Coding Games](https://speedrun.substack.com/p/8-hot-takes-on-vibe-coding-games)
- Social counts (all fetched 2026-10-16): X profiles via api.fxtwitter.com; Discord via `discord.com/api/v9/invites/<code>?with_counts=true`; App Store via `itunes.apple.com/lookup`; domains via rdap.org and rdap.verisign.com.
