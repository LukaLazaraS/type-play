# Night 2026-11-04 (questions): the builder asks before it builds

Started by HQ for Luka, 10:15 GST. Worktree `.claude/worktrees/questions`, branch `questions` (from `night-features`
`86fd94d`). Resume point after any stop: read this file, continue from the first open step. (Named `_questions`: other
sessions write their own logs for the same date.) Another night runs (`hq-typeplay-features.running`), so the normal
free threads stay free (cpu.mjs, at most 12 of 16 cores, below normal).

## Morning report

**Built:** "Ask me first", a tick by the AI picker (on by default on /create, off by default in a game's chat;
remembered for the account). With it on, before anything is built, one cheap Haiku call decides whether the idea leaves
a real gap that changes the game (what you play, the goal, the controls, the look) and writes up to 3 short questions
with 2-4 tap answers each, in the player's language. A clear idea gets none and builds at once, as before. The
questions arrive in the game's chat as the AI's message (a new game's too: /create opens the game page as today); each
question has its tap answers, **You decide** (picked at first) and **Type my own**; one hot **Build it** builds with the
answers on the AI and effort the idea was sent with. A message typed in the box instead also answers them. The AI asks
once per request; during the build it decides by itself and says in its answer what it picked (`rules/ANSWERS.md`, one
line in BASE.md).

**Money:** a clear idea: the call (~$0.0006) is part of the build's charge, one line. Questions: that answer is charged
at once like the size check's stop (0.1 credit, its own line "Questions before a new game on Fast"); the build after the
answers is charged on its own; an unanswered question costs nothing more. Never charged twice: the build after answers
never asks again, and a change answered on the same AI skips its size check.

**Tested:** root `npm run check` 5 of 5; the full API e2e on the final build 716 checks, 0 failed (63 for questions);
the walk-through 53 of 53, with screenshots at 1440, 390 and 320 plus a worst case (three long questions in German and
Japanese), looked at; real Haiku calls on this PC: 18 requests, 18 of 18 as wanted on every run (vague ideas ask 1-2
questions, clear ideas and clear changes none; Georgian and Russian in their own language), ~$0.0006 and 4-9 s a call.

**Review:** impeccable's critique (a design review and the detector, independent) and my own look found three P1s (a
game played while waiting said "didn't build" when the AI asked; the questions arrived silently for screen readers and on
a phone's Play tab; the full composer beside the card gave two AI pickers and two prices and dropped the card's taps),
fixed with the P2s and the cheap P3s (step 9).

**Look at:** `.impeccable/review/questions/` (create-tick, chat-questions, chat-answering, chat-after, composer-tick,
chat-change-question at 1440 and 390; stage-questions-390; worst-questions at 320 and 1440).

## The task (HQ's brief, Luka's answers)

Luka: the builder never asks questions; maybe it has none, maybe we lack the function; maybe a tick so the player chooses
whether the AI may ask, or it decides by itself. HQ decided yes, with this design to start from:

- First, check what the competitors do, with sources: Lovable (Chat mode, plan), Bolt (Discuss, plan), Replit Agent
  (plan, clarifying questions), v0, Rosebud AI, coding agents' plan modes. Keep what they agree on; log any change to
  HQ's design and why.
- Questions only before a build starts, never during it (the player has left the tab; a waiting build sits idle). During
  the build the agent decides by itself and says in its answer what it chose.
- At most 3 short questions, each with 2-4 tap answers plus You decide (a short typed answer allowed too), in the
  player's language; only when the idea leaves a real gap that changes the game (what you play, the goal, the controls,
  the look's direction), never for details the AI can pick well. A clear idea gets no question and builds at once.
- An Ask me first tick by the AI picker: on by default for a new game (/create), off by default for chat changes; the
  player's choice remembered for their account.
- One cheap call before the build decides whether to ask and writes the questions (sees the idea, the picks, the
  attached images). The answers go into the build with the idea. Money (Luka): every AI call the player causes is on the
  player's credits, the metered cost wins, nothing free on us; shown in the credit history like the size check's stop
  and the build's extra calls. Decide the cleanest way (folded into the build's charge when answered; what an unanswered
  question costs) and log it.
- Order with today's steps (the price question before sending, the size check on Fast and Smart changes): never charge
  twice, never ask after the price was agreed with a different request; log it.
- The questions show in the chat as the AI's message with tap answers and one Build it button (on /create too if that is
  where the first build starts: decide where they appear for a new game, the standard way). Shared pieces in
  `apps/web/src/components/ui`, the design system; 320, 390, 1440 px; keyboard and screen reader.
- The agent's own rules (`packages/agent/rules`) say how to read the answers and You decide.
- Tests: `npm run check`; the e2e through `scripts/test-run.mjs` (fake builds; a fake question case): a vague idea asks,
  a clear one doesn't, the tick off never asks, answers reach the build, You decide, the charges in the credit history,
  an unanswered question. One or two real question calls on this PC (vague and clear idea). Screenshots of the questions
  on /create or the game page and in the chat at 390 and 1440 px, looked at.
- Rules: in ChatLog touch only the question message and its answers (the `assets` session works on an Assets tab: its
  tab, its API listing, the build's asset manifest). No ux-fixes / night-perf, no `local-site.mjs update`, no deploy, no
  merge: commit and push branch `questions`; HQ merges into night-features. Tonight's decisions are not written into
  CLAUDE.md or PLAN.md as rules.

## Steps

- [x] 1. Competitors, with sources (`docs/research/clarifying-questions-2026-11-04.md`, 120 lines; the first research
  agent died with HQ's restart, the second finished). What they agree on, and what we kept: the AI decides when to ask
  and a clear prompt builds at once (Lovable, v0, Rosebud, Devin, Copilot, Deep Research): kept; one card of short
  questions with 2-4 tap answers and a typed one (Lovable up to 4, Claude Code 1-4 with "Other", v0, Codex, Windsurf):
  kept, at most 3 (HQ); skip = carry on with defaults, never cancel (Lovable, Claude Code): our You decide, picked at
  first, and Build it; long runs never stop to ask (Lovable /goal, Claude Code auto mode): kept, questions only before;
  the question turn is billed like any turn, nobody makes it free (Lovable: 1 credit per Plan message "whether it ends in
  a plan, a clarifying question, or an answer"): kept, the questions answer is charged like any answer. Not taken: a
  separate Plan mode (everyone has one; HQ's tick plays that part, and v0 dropped its pre-step in 2026 because the models
  ask when they need to)
- [x] 2. Read the code: create flow, chat send, price question, size check, credits ledger, runs, fake agent, ChatLog,
  composer, ui pieces, agent rules, run.mjs side calls
- [x] 3. Design: where questions live (data model), money flow, order with price question and size check; log decisions
- [x] 4. Agent: the question call (`tools/questions.mjs`: Haiku low, JSON answer), `run.mjs --ask/--answered/--sized`,
  `rules/ANSWERS.md`, BASE.md's last-message line, `tests/questions.mjs` (no model call) and `tests/questions-eval.mjs`
  (real calls: 18 of 18 as wanted, ~$0.0007 and 4-8 s a call; Russian "You decide" fixed)
- [x] 5. Server: migration `20261104120000_questions` (additive: Message.questions, QueuedRun ask/answered/sized/label,
  User.askFirstNew/askFirstEdit), `projects/questions.ts` (clean, parse answers, compose the reply), runs.service
  `stopAsked`, the question call in `sideUsd`, the queue's flags, send() turning a message into the answer, `PATCH /me`,
  the credit line, notice kind `asked`, the fake agent's `VAGUE` / `ASKUSD:<n>`; tsc and eslint clean
- [x] 6. Web: `ui/ChipChoice` (new: answers as pill radios), `ui/Checkbox` `size="small"`, `app/QuestionsCard`, ChatLog's
  question message only, GameClient (Build it, the stage's way to the chat), Composer (the tick, typed answers), /create
  (the tick), Stage, BuildPill, Notices; tsc, eslint and ui-only clean
- [x] 7. Tests: root `npm run check` 5 of 5 (the agent package now runs `tests/questions.mjs` too); the full API e2e
  713 checks, 0 failed, 60 new in "questions before a build" (vague asks, clear builds with the call in its charge, the
  tick off never asks, answers and You decide reach the build, the charges and credit lines, unanswered costs nothing
  more, a typed reply, a change answered on the same AI skips its size check, the size check's stop wins, the agreed price
  holds, builds in line keep their flags, PATCH /me); a database made from the migrations diffs empty against the schema
- [x] 8. Real question calls on this PC (vague + clear), results logged: `tests/questions-eval.mjs` 18 of 18 as wanted on
  two runs ($0.0112 for 18, 4-9 s a call); `run.mjs --ask` end to end on "a game about space" (asked 2, nothing built,
  $0.0012 with the genre call); `packages/agent/RESULTS.md` "questions before a build"
- [x] 9. Screenshots 320 / 390 / 1440 looked at; design-skill review passes; fixes. Walk-through
  `apps/web/scripts/shot-questions.mjs` (its own stack and database). Review: impeccable critique as two independent
  assessments (the detector: 0 findings on the 7 files, the 7 CSS advisories all documented literals; the design review:
  25/40, three P1s) plus my own look, then one batch of fixes:
  - a game played while waiting said "Your game didn't build" when the AI asked (P1): now "Your game has questions";
  - the questions arrived silently for screen readers and on a phone's Play tab for a change (P1): the page's announcer
    says they came; a change's line over the game says "A question before version 2" (Answer it on a phone);
  - the full composer competed with the card (two AI pickers, two prices) and typed words dropped the card's taps (P1):
    while questions are open the composer is the box and Send on the questions' AI and effort, and Send carries the taps
    with the words (`answers` with `text`, both in the player's message and the build's request);
  - Enter in Type my own built at once and the one-line box hid the answer (P2): a growing box, Enter moves to the next
    question or Build it, never builds;
  - the stage's note read like an auto-build and its hot button beside the chat outranked Build it (P2): "Tap your
    answers in the chat, or keep You decide, then press Build it. Nothing more is charged until it builds.", the still sky
    and ground above it (paused), the button on phones only; "You can leave this page" waits until the build is under way;
  - two price lines under Build it read alike (P2): the answer's own line under the AI's bubble without a build time,
    Build it says "Builds on Smart · about 6.7 credits" and is described by it for screen readers;
  - /create's note cut on phones, no way to credits on refusal, focus lost after Build it, the small tick's touch area over
    its box (the walk-through's one failure), You decide and Type my own moving around, the closed list's missing bullets,
    the version label run together, "Type my own" in English beside localized answers, no `lang`, no "Question 1 of 2":
    all fixed.
  Not taken: "Surprise me" for You decide and "Change it" for a change's button (HQ named them), asking after version 1
  (HQ: before the build only), the checkbox's hot accent on /create (the shared piece's, the checkout's too), a dot on
  the Chat tab (the stage line covers a phone, and the tabs are the assets session's ground tonight), and the second
  wait in a busy queue (logged above). Confirm rounds: the walk-through 52 of 53 (the stored questions dropped the new
  fields: fixed), then 52 of 53 (the arrival check timed against the fake's 1.5 s answer on a page still compiling: moved
  to a question that arrives while the page is open; and the composer's placeholder, cut at 320, became "Or type your
  answer"), then **53 of 53**
- [x] 10. Docs (pricing line, contract, both READMEs, DESIGN.md, RESULTS.md), commit, push `questions`; morning report;
  final reply. After the review the e2e again on the final build: 716 checks, 0 failed (63 for questions)

## Decisions (taken tonight, the standard way; Luka can change any)

- **The question call runs inside the build's run, first** (`run.mjs --ask`, `packages/agent/tools/questions.mjs`), the
  way the size check does: same isolation (the runner live, a child process here), same key-proxy meter, same hold,
  queue, events and notifications. A clear idea goes straight on into the build in the same run (no second hop, no
  second wait in line). Alternative not taken: a separate quick job at send time (questions before the line, but a
  new path for an AI call outside the runner, its own hold and charge).
  - New game: the question call and the genre call go at once (in parallel), before the game folder is made.
  - Change: the size check and the question call go at once; a size-check stop wins (no questions about a request
    that is too big anyway).
- **Model:** Haiku 5.5, low effort, no tools, one turn; it sees the idea, the picks (genre, tags, screens), the
  pictures themselves (image blocks, as the build's first message) and, for a change, the game's notes (NOTES.md,
  first 3,000 letters). Answer format: one JSON object. Never throws: a failed or malformed call builds.
- **Where the questions appear: the game's chat**, also for a new game. /create creates the game and opens its page as
  today; the questions come a few seconds later as the AI's first answer (Lovable, Bolt, Replit and v0 all move from
  the home prompt into the project's chat; ChatGPT's Deep Research asks in the thread). The stage says "A few
  questions first" with the way to the chat on a phone. A build pill and the notifications say it too (notice kind
  `asked`), since the player may have left.
- **The questions answer**: the AI's message (an intro line in the player's language) with 1-3 questions, each with
  2-4 tap answers, You decide (preselected, in the player's language), and its own short typed answer; one hot
  **Build it**. Answered or not, the card closes when anything else is sent; a message typed in the box while the
  questions are open counts as the reply (Deep Research's way). The AI asks at most once per request: a reply never
  asks again.
- **Money**: a clear idea: the question call is part of the build's charge (like the genre call), one line. Questions
  asked: that answer is charged at once like the size check's stop (the calls it made, metered wins, at least 0.1
  credit), its own line "Questions before a new game on Fast" with the idea as its prompt; an unanswered question
  costs exactly that, nothing later. The build after the answers is its own answer and charge, and it never asks or
  size-checks again on the same AI, so no call is paid twice. HQ suggested folding the question call into the build's
  charge when answered: not taken, because the unanswered case then needs a pending charge settled later (a sweep, or
  at deletion: a line appearing a day after) and leaves an abandoned question free on us. The price of the 0.1
  minimum: about $0.02 once per question round.
- **Order with today's steps**: the price question stays before sending (the estimate depends on the AI, the effort
  and new-or-change, never on the words, so the answers don't change it). Build it builds with the AI and effort the
  idea was sent with: the price agreed then holds and is not asked again (the API takes it as confirmed). A reply
  typed on another AI or effort is a new request: its own price question, as any send. The size check runs before
  the questions (with them), never after the answers on the same AI.
- **The tick**: "Ask me first", a checkbox by the AI picker: on /create under the AI rows (on by default), in the
  composer's foot beside Effort (off by default for changes); remembered per account (`User.askFirstNew`,
  `askFirstEdit`; `PATCH /me`). A send says `ask: true|false` itself; an old site that sends nothing never asks.

## Notes on the way

- ~11:00 a shell heredoc that edited `apps/server/src/runs/agent.ts` stopped at a permission prompt; HQ restarted the
  session. The edit had landed (checked). From then on every source edit goes through the Edit and Write tools.
- The worktree got its own `node_modules` (`npm ci`, as the other worktrees have): without it the workspace links
  pointed at the main checkout's `packages/shared`.

## For Luka

- Try it once on your phone and in Georgian: /create, a short idea ("თამაში მანქანებზე"), Build; answer on the game page
  (tap answers, You decide, Type my own), then Build it. The questions' words come from Haiku in the idea's language; the
  buttons around them (Build it, Type my own, Ask me first) are the site's English, as everywhere.
- Nothing to decide tonight: HQ settled the design. Two calls taken in its place, in the decisions above, that you may
  want to look at: the questions answer costs 0.1 credit at once (not folded into the build), and a busy queue makes the
  player wait for their turn before the questions come.

## Deploy notes (for HQ)

API first (`deploy.mjs api`): the migration `20261104120000_questions` is additive (Message.questions, QueuedRun's four
flags, User's two ticks) and runs at the API container's start; the runner (same image) gets `run.mjs --ask/--answered/
--sized` with it. Then `deploy.mjs site`. No new setting. An old site against the new API never sends `ask`, so nothing
asks until the site is deployed.
