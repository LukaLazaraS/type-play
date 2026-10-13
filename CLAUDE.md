# GameForge (working name, folder `projects/game-forge`): prompt → playable game → app stores

Luka's product: a website where a user types what game they want, an AI agent builds it,
they play it in the browser straight away, iterate by chat, and export it to Android, iOS,
Steam (desktop) and the web. "Lovable, but for games." Started 2026-10-11 after a week of
thinking; decided in the Satisfying 2D Sims session of 2026-10-02 → 10-11.

"GameForge" is only the folder name: Gameforge AG (Karlsruhe) is a game publisher with game
software trademarks. The product name is picked before the domain and the landing page.

Luka owns the product and decides; Claude Code builds. Luka has shipped games before
(`../../BlackHoleGalaxy`: Unity, Play Store + App Store, see its `IOS_RELEASE.md`), so store
publishing is known ground; he has both developer accounts (used to test our exports). He has
made games with Opus + Unity + Blender before, so "can Claude make games" is proven; what's
left is Godot, from one short prompt, with no developer steering. He works 8+ h/day on this;
Claude Code runs on his Max 20x plan.

## Decisions (settled, don't re-open)

- **Engine: Godot 4** (4.7.2 is current stable, 2026-08). Free, open source, runs headless on
  a server, exports to web (seconds, used for the live preview), Android, iOS,
  Windows/Mac/Linux. Scenes and scripts are plain text (GDScript, `.tscn`), which the agent
  writes well. Not Unity (server licensing, slow builds), not three.js/Phaser (browser-only; a
  store build would be a wrapper).
- **Two Claudes, two names.** **Builder** = Claude Code building this repo: always Luka's Max.
  **Game agent** = the agent inside the product's chat that builds users' games.
- **The game agent: Claude Agent SDK** (the Claude Code harness as a library, with file edit
  + bash + our Godot tools). The model is a config setting so a better model is a one-day swap.
  - **On Luka's PC (dev): Luka's Max login**, before launch and for every later update.
    Only Luka uses it, which Anthropic allows ("ordinary, individual usage of Claude Code
    and the Agent SDK"). Runs still report tokens and API-equivalent $.
  - **On the live server (beta and launch): our API key, for everyone, Luka included.** The
    Max token never goes on that server. Routing other people's requests through Max breaks
    Anthropic's rules and would put the Max account (the Builder) at risk.
  - Same code; one setting (`AGENT_AUTH=max|api`). Guards: the live server won't start with a
    Max token present; the dev build accepts only Luka's login and runs only on his PC.
- **Stack: Next.js 16 (React, frontend) + NestJS (backend) + Postgres via Prisma on
  Supabase.** Claude writes all the code, so the pick is what builds fastest and best, not
  what Luka knows: React has the most training data (fewer fix loops), ready-made AI chat
  parts (assistant-ui, AI Elements on shadcn/ui), and Next.js has the strongest SEO tooling
  (per-page metadata, sitemaps, static pages, per-game share pages with link previews).
  Next.js only renders pages; all business logic, agent sessions and jobs live in Nest.
  **One website, one domain**: the public pages (home, pricing, terms, privacy, refund) and
  the logged-in app are the same Next.js project; public pages are built first so Paddle can
  review them early. Only game previews live on a separate domain (security).
  Self-hosted (`next start`), not tied to Vercel. Relational because credits and payments
  need transactions. Game files live in folders with git history per project, not in the DB.
- **Tiers sell credits, never unlimited use** (Lovable's model). Free: Haiku 5.5, 3-5 builds a
  month, no export, badge. Paid ~$20/month: Sonnet 5.5 by default, Opus 5.5 costs more
  credits. ~$50: more credits. **The user picks the model per message** (Fast = Haiku, Smart
  = Sonnet, Best = Opus; effort changeable) with honest tips; defaults: new games on Sonnet
  medium, edits on Haiku (Sonnet if Haiku's change fails). Output is partly luck, so the
  choice is the user's; credits protect the budget. Credits are priced so $20 buys ~$9 of API (Paddle takes
  ~$1.50; one Opus project with 20 edits is ~$9.50). The Godot check measures the real cost.
- **Genres first, "any game" later.** Launch with 3-4 small genres (2D puzzle, endless runner,
  racer, tower defence). Open-world 3D is possible but slow and expensive today; it arrives as
  models improve, not by us pushing now.
- **Assets, in this order:** CC0 libraries (Kenney, Quaternius, Poly Haven) catalogued for
  the agent, at launch. **Luka's library: `E:\3D models`**: `Kenney\` (50 3D packs, each with
  a CC0 `License.txt`, incl. racing-kit, tower-defense-kit, car-kit, city kits, platformer-kit)
  and `All in One - Quaternius\` (CC0 per its `License.txt`); ~4,400 `.glb` among ~46K files.
  The agent copies only the files a game uses into it; the library stays outside the repo → after launch: Blender scripted headless by the agent (Blender 5.1 is
  on this PC) → text-to-3D API (Meshy / Tripo; or self-hosted Hunyuan3D / TRELLIS).
- **Store publishing is the user's own account** (Google $25 once, Apple $99/yr): we produce
  the build, they upload. iOS builds need a cloud Mac (Codemagic / MacStadium, ~$0.10/min).
- **Payments: Paddle first** (merchant of record: handles worldwide VAT/sales tax; no Stripe
  in Georgia). Fallback: Dodo Payments, then Whop. Georgian bank gateways (BOG, TBC) maybe
  later for GEL buyers, not at launch: we'd owe EU/UK VAT from the first sale and build
  subscription renewals ourselves. Luka sells as a Georgian Individual Entrepreneur (Small
  Business Status) with the same name on the Paddle account and our terms. Apply once the
  landing page is live (review ~3-7 business days); build against Paddle's sandbox meanwhile.
- **Launch order:** Godot check → landing page + Paddle application → agent core (2 genres)
  → web app → server → closed beta 1 (free) → genres 3-4, Android export, payments → paid
  beta → launch. iOS, Steam, Blender, text-to-3D after launch. Details in `PLAN.md`.

## Numbers that drive the design (Anthropic prices, 2026-10-06)

| Model | In $/M | Out $/M | Cached in $/M | One game build (measured 2026-10-12) | One edit |
|---|---|---|---|---|---|
| Opus 5.5 `claude-opus-5-5` | 4 | 20 | 0.20 | v1: $0.82 medium, $1.46 high | not measured |
| Sonnet 5.5 `claude-sonnet-5-5` | 2 | 10 | 0.20 | **$0.16** medium isolated (1.6 min); v1 high $0.42-0.54, 3D $0.76 | v1 resumed session $0.62 |
| Haiku 5.5 `claude-haiku-5-5` | 0.10 | 0.50 | ~0.01 | **$0.07-0.12** with genre skill, built in 2 short steps (8-12 min; core playable at ~5-7) | **$0.003-0.03** (4 edits with tests: $0.069) |

Measured in `proof/RESULTS.md` (v1) and `agent/RESULTS.md` (v2 isolated, the current setup):
API-price estimates, one short prompt each. Prompt caching is what keeps input cheap: the
agent re-reads the project every turn. Haiku 5.5 costs 5× more above 100K input tokens, so
keep the context the agent sees small. API spend tiers go by credits bought ($40 → tier 2);
open the API account just before beta 1.

## Known traps

- Keep the web export single-threaded (Godot's default since 4.3): then no COOP/COEP headers
  are needed and it runs better on iPhone Safari. Turning on "Use Threads" brings the headers
  back. Cost: web audio has no effects (reverb, doppler).
- Serve previews from a separate domain from the main site: a game can run JavaScript, so it
  must not be able to read the main site's login cookies.
- Models sometimes write Godot 3 code (`KinematicBody2D`, `export var`, `yield`): the agent's
  rules say Godot 4.7 (`CharacterBody2D`, `@export`, `await`), and every build is test-run.
- Godot web preview is strong in desktop browsers, weaker on phones: the native build is the
  real phone experience; say so in the UI.
- Opus 5.5 / Sonnet 5.5 can refuse a prompt (safety classifiers, `stop_reason: refusal`):
  show a clear message, use the API's fallback setting.
- Two exports writing the same output path corrupt it: one build per project at a time.
- An edit that resumes the build session re-reads the whole build history: it cost more than
  the build. Edits start a fresh session with the project's notes instead.
- The Agent SDK loads `CLAUDE.md` and user settings by default, and on a claude.ai login it
  also loads that account's connectors (Luka's Google Drive, vidIQ/YouTube, Docs: 84 tools,
  +89K tokens on every call, with write access). The game agent always runs isolated
  (`agent/run.mjs` `ISOLATED`: 7 tools, `settingSources: []`, `disableClaudeAiConnectors`,
  `strictMcpConfig`, no skills); `agent/tests/isolation.mjs` checks it (first call ~9K tokens).

## Working with Luka

- He dictates long briefs in non-native English; read for intent, ask only what blocks the
  next step. Correct him when he's wrong, with the number that shows it.
- Once he decides, build lean: no risk lists, no re-opening settled points.
- Every file handed over is a clickable link. End every reply with a short overview; he may
  read only that.
- No git commit or push unless asked; no AI co-author trailer. API keys in a git-ignored
  `.env`, never printed.
- Knowledge lives in this repo (`CLAUDE.md`, `PLAN.md`, `docs/`), not in memory.
- **At the start of every session, read `docs/parked.md`** and open the reply with a short
  list of parked items that are due or overdue. Luka parks non-technical steps on purpose
  while the core is proven, and relies on these reminders.

## Layout (grows as built)

```
game-forge/
  CLAUDE.md  PLAN.md  .gitignore
  docs/           decisions, parked steps (reminders), name candidates, research, logs
  proof/          Godot check: the agent builds a Godot game from one prompt (this PC)
  agent/          the game-building agent: skills, genre templates, tools
  web/            the site: chat, preview, projects, credits
  server/         export workers: Godot headless, Blender, queue
```
