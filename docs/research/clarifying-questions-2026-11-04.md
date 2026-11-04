# Clarifying questions before a build: what comparable products do (2026-11-04)

Research for TypePlay's pre-build questions. Sources are official docs, changelogs and help centers unless marked
"third-party"; checked 2026-11-04. "Not found in docs" means the official page was read and does not say.

## What they agree on

1. **The AI decides when to ask; a clear prompt goes straight to work.** Lovable shows a question card "instead of guessing", v0's models "ask clarifying questions when they need them", Rosebud ("If Rosebud asks follow-up questions"), Replit (a detailed slide-deck prompt builds "with no clarifying questions"), Devin (asks only below green confidence), Copilot (straightforward requests get a plan "immediately"), ChatGPT Deep Research ("may ask").
2. **The answer UI has converged:** one card of up to 4 questions, each with 2-4 tap options, plus a typed answer ("write your own", "Other", "inline custom answers"), multi-select where it fits, and Skip (Lovable, v0, Claude Code, Codex, Windsurf; Rosebud shows options).
3. **Skip means "carry on with sensible defaults", never "cancel":** Lovable continues "with reasonable defaults for the work you already asked for"; Claude Code's optional timeout lets Claude proceed "on its own judgment".
4. **2026 trend: fewer up-front steps.** v0 removed its Enhance Prompt button (2026-06-19) "since the models ask clarifying questions when they need them"; Lovable removed its three design directions before the first build (2026-10-08) but kept the design questions.
5. **A separate, user-picked Plan mode exists almost everywhere** (Lovable, Bolt, Replit, Cursor, Claude Code, Codex, Copilot, Windsurf, Kiro, Manus). It asks more, ends with one explicit go button (Approve, Implement this plan, Start building, Build, Implement, Confirm, Start research), and builds nothing until it is pressed. Whether the Plan choice is remembered is mostly undocumented; Claude Code's Desktop app deliberately forgets it ("applies to the current session only"), while its CLI can make it the default.
6. **Long autonomous runs don't stop to ask.** Lovable's /goal works "without pausing to ask you questions" (up to 10 h); Claude Code's auto mode keeps working "without stopping for clarifying questions"; Devin proceeds when confident and takes async feedback. Exceptions: Lovable's cards can steer a running build; Cursor 2.4's agent keeps working while it waits for an answer.
7. **Cost: the question or plan turn is billed like any agent turn; nobody makes it free by rule.** Lovable: 1 credit per Plan message whether it ends in "a plan, a clarifying question, or an answer"; skipping a plan adds no charge; Chat mode is a fraction of a credit (a free daily allowance was "temporary", to 2026-10-31). Replit charges "all Agent work in Plan mode". Bolt and v0 bill tokens per message. An abandoned plan costs what its planning messages cost, nothing more.
8. **Where they differ:** Lovable, v0, Rosebud and Devin (Replit by implication) ask during normal building; Bolt asks only when the user opens "Enhance prompt" or Plan mode; Claude Code, Codex, Cursor, Copilot and Windsurf ask mainly in Plan mode. For long research jobs, Gemini always shows a plan and waits for "Start research", Manus won't start "until you confirm or dismiss the plan", ChatGPT may ask questions, shows an editable plan and can be interrupted mid-run.

## App and game builders

### Lovable

- **Asks before building?** Yes, automatically, in every mode. Changelog 2025-11-26: "Lovable can now ask clarifying questions before building", picking "from multiple-choice options or add your own input" when a request "has multiple ways forward". Project chat: Lovable can "pause and show a question card instead of guessing". Plan mode "often asks clarifying questions"; Chat mode "may ask a clarifying question when your message could mean several things". Design questions "about color, typography, and layout" when the prompt leaves the look open (changelog 2026-10-08; the three design-direction previews shown before the first build were removed that day).
- **Before or during?** Both: answers "steer the current run directly", and messages sent while a card waits stay grayed out. A /goal message runs "without pausing to ask you questions", up to 10 hours (changelog 2026-08-30).
- **How many, what UI:** up to four questions per card; each has options, or you write your own answer; move between questions and change earlier answers before submitting; **Skip** (one) or **Skip all**; drafts kept in the browser across a refresh. Since 2026-09-16 skipping "continues with reasonable defaults for the work you already asked for" and no longer approves extra work Lovable suggested.
- **Plan / go button:** three modes in a picker: Build (default), Chat (discuss, no code changes), Plan. A plan card offers **Approve** (switches to Build, "implementation begins immediately"), **Skip**, edit, comment on a section, earlier versions. Chat mode offers a **Start building** card (Build / Skip). "A Plan mode conversation can still end without a plan" when the questions show the change isn't worth making.
- **Toggle remembered?** Not found in docs for Plan/Chat. After /goal the picker switches to Build and "stays on Build until you change it".
- **Cost:** a Plan message is "one credit, plus the cost of any subagent research", the same "whether the message ends in a plan, a clarifying question, or an answer"; skipping a plan "does not add a charge"; the approved build is billed as Build work. Chat mode: "typically a fraction of a credit", first covered by a daily free allowance labelled "Temporary offering, subject to change", through 2026-10-31. Cost of a question card inside a Build run: not found in docs (Build messages are priced on the work done).
- **Sources:** [Plan mode](https://docs.lovable.dev/features/plan-mode), [Project chat (question cards)](https://docs.lovable.dev/features/projects/chat), [Chat mode](https://docs.lovable.dev/features/chat-mode), [Changelog](https://docs.lovable.dev/changelog), [Blog: Chat mode and follow-up questions, 2025-12-05](https://lovable.dev/blog/chat-mode-and-questions)

### Bolt (bolt.new)

- **Asks before building?** Not automatically: by default it builds at once. Two user-picked routes: **Enhance prompt** (plus icon, then "Enhance prompt") opens "Help us enhance your prompt", where you "answer each question"; Bolt then writes a recommended prompt you can edit. **Plan Mode** (click Plan before submitting; "highlights blue when active"; click again to turn off) lets you "plan and ask questions without making changes to your code". From the home page Plan Mode still "starts by creating the base structure of your app", then shares a plan in the chat.
- **Before or during?** Before; Plan Mode can be switched on at any point in a project.
- **How many, what UI:** not found in docs (number of questions, options vs free text, skip). Plan ends with an **Implement this plan** quick-action button that "auto-switches to Build Mode"; buttons appear only when relevant.
- **Toggle remembered?** Not found in docs.
- **Cost:** tokens. Plan Mode helps you "use fewer tokens overall" (no figure). The legacy Discussion Mode (v1 agent, replaced by Plan Mode; v1 closed to new projects since 2026-04-13) was announced with "up to 90% reduction in token usage". Enhance prompt cost: not found in docs.
- **Sources:** [Plan Mode](https://support.bolt.new/prompting/plan-mode), [Project lifecycle (Enhance prompt)](https://support.bolt.new/building/build-your-first-app), [Start a project](https://support.bolt.new/building/start-project), [Switch v1 projects to Bolt Agent](https://support.bolt.new/building/switch-v1-projects), [Discussion Mode announcement on X (2025)](https://x.com/boltdotnew/status/1904936200940482842)

### Replit Agent

- **Asks before building?** Implied, AI-decided: "Specify the length and visual style up front and Agent builds the deck right away, with no clarifying questions" (Slide Decks doc). Third-party 2026 tests (G2, Zapier) say Agent now asks clarifying questions before building in some cases. A general rule for when it asks: not found in docs.
- **Plan mode:** a **Plan** toggle at the bottom right of the chat input (off = Build). Agent writes a task plan (what it will build, success criteria, out of scope, steps); buttons: **Start building** before the first checkpoint, later **Build here** / **Build in background**, plus **Revise** / **Cancel**. Agent 4 (2026-03) adds a Design Canvas for mockups before code, and planning in a new chat while a build runs.
- **Before or during?** Before (Plan); not found in docs for mid-build questions.
- **How many, what UI:** not found in docs.
- **Toggle remembered?** Not found in docs.
- **Cost:** "You are charged for all Agent work in Plan mode, including answering questions, providing guidance, and generating task lists"; "All Agent interactions are billable", so a cancelled plan still costs its planning work. Plan Mode needs a paid plan (third-party).
- **Sources:** [Plan Mode](https://docs.replit.com/features/agent/plan-mode), [Plan vs. Build Mode](https://docs.replit.com/learn/plan-vs-build-mode), [Slide Decks](https://docs.replit.com/features/artifact-types/slide-decks), [Agent 4 changelog 2026-03-13](https://docs.replit.com/updates/2026/03/13/changelog), third-party: [G2](https://learn.g2.com/replit-vs-lovable), [Zapier](https://zapier.com/blog/replit-alternatives/)

### v0 (Vercel)

- **Asks before building?** Yes, automatically. Changelog 2025-12-17: "v0 can now ask clarifying questions before it starts generating". 2026-06-19: "Removed the Enhance Prompt button from the composer, since the models ask clarifying questions when they need them." Vercel's own demo notes a vague prompt ("build me an app") gets a question by default. An optional "Plan Mode" preset instruction (2025-10-06) makes it plan and wait for approval; users report the preset missing in 2026 (community thread).
- **Before or during?** Mainly before; plan approvals and questions are also agent prompts that can come mid-task (MCP `resolveTask` answers "plan approvals, questions, permission requests", 2026-07-07).
- **How many, what UI:** 2026-06-19: "v0's clarifying questions now appear in the prompt form, with single-select, multi-select, skip, and inline custom answers." 2026-01-19 fix: multi-select allows "Other" alongside other options. Number per card: not found in docs.
- **Toggle remembered?** Plan Mode is a custom instruction, so it presumably stays on until removed (inferred; not stated in docs). The automatic questions need no toggle.
- **Cost:** token-based credits per message (input + output, project context included); a question turn is an ordinary message. Exact charge for a question: not found in docs.
- **Sources:** [v0 changelog](https://v0.app/changelog), [Vercel Community: From Prompt to Plan](https://community.vercel.com/t/from-prompt-to-plan-building-with-intention-in-v0/31022), [Vercel Community: Plan mode not available in instructions](https://community.vercel.com/t/plan-mode-is-not-available-in-instructions/37736), [Vercel field-engineering demo](https://github.com/vercel-fieldeng/demo-v0-planning-mode/blob/main/README.md), [v0 usage pricing on X](https://x.com/v0/status/1922458017297268971)

### Rosebud AI (game maker)

- **Asks before building?** Sometimes, AI-decided. Official tutorial step 1: "If Rosebud asks follow-up questions, choose the options that fit your idea" (its example keeps the game "3D, desktop, and single-player", which suggests the options cover dimension, platform and players). Then "wait for generation to finish".
- **Before or during?** Before the first version; no plan or confirm step found.
- **How many, what UI:** options to choose; count, free text and skip not found in docs.
- **Vague prompts:** its advice is to give "instructions in different steps"; third-party guides: say what the player does, the controls and what ends the game.
- **Cost:** "Generation uses credits"; cost of the question step not found in docs.
- **Sources:** [Rosebud tutorial](https://rosebud.ai/tutorial) (the older blog tutorial URL redirects here), [3D game maker FAQ](https://rosebud.ai/3d-game-maker)

## Coding agents

### Claude Code (and the Claude Agent SDK)

- **Asks:** AI-decided via the `AskUserQuestion` tool, available by default in any session: it "Asks multiple-choice questions to gather requirements or clarify ambiguity"; "especially common in plan mode".
- **UI:** 1-4 questions per call, 2-4 options each (label + description), a header of at most 12 characters, optional multi-select, optional visual previews per option (SDK). Answer by picking an option "or type your own text through the `Other` row or the notes field". SDK apps should show an "Other" choice that takes text, and can accept a free-form `response` instead of per-question answers.
- **Walk-away behaviour:** questions stay open until answered by default. Optional `askUserQuestionTimeout` (60s, 5m, 10m): the dialog then "submits any options you'd already selected and tells Claude you may be away from your keyboard, so Claude proceeds on its own judgment and can re-ask later". Plan approval "never auto-resolve[s] on idle". In the SDK the callback "can stay pending indefinitely"; a `PreToolUse` hook can return `defer` "so the process can exit and resume later from the persisted session".
- **Plan mode:** Shift+Tab, `/plan`, or `defaultMode: "plan"` to make it the default; in Desktop "Plan is the exception: picking it applies to the current session only". Approval: "Yes, and use auto mode", "Yes, manually approve edits", "No, keep planning"; Ctrl+G edits the plan. Auto mode "nudges Claude to keep working without stopping for clarifying questions".
- **Cost:** ordinary tokens of the same session; no separate charge.
- **Sources:** [Tools reference: AskUserQuestion](https://code.claude.com/docs/en/tools-reference), [Agent SDK: approvals and user input](https://code.claude.com/docs/en/agent-sdk/user-input), [Permission modes: plan mode](https://code.claude.com/docs/en/permission-modes)

### Cursor

Plan Mode (Shift+Tab or the mode picker; Cursor "suggests it automatically when you type keywords that indicate complex tasks"): the agent "asks clarifying questions to understand your requirements", researches, writes an editable plan, then you click **Build**. Cursor 2.1 (2025-11-21) "shows an interactive UI to easily answer questions"; 2.4 lets agents ask in any conversation and keep working while waiting. Cost: not found in docs. Sources: [Plan Mode docs](https://cursor.com/docs/agent/plan-mode), [Help: plan mode](https://cursor.com/help/ai-features/plan-mode), [Changelog 2.1](https://cursor.com/changelog/2-1), [Changelog 2.4](https://cursor.com/changelog/2-4)

### OpenAI Codex

Plan mode (`/plan` or Shift+Tab) lets Codex "gather context, ask clarifying questions, and build a stronger plan before implementation"; the docs also suggest asking Codex "to question you first". Questions use a `request_user_input` tool with multiple-choice options (GitHub issues and a maintainer draft allowing up to four questions; not in official docs). Sources: [Codex best practices](https://developers.openai.com/codex/learn/best-practices), [GitHub issue #18611](https://github.com/openai/codex/issues/18611), [Discussion #7355](https://github.com/openai/codex/discussions/7355)

### GitHub Copilot

The Plan agent (`/plan`) "researches your project, asks clarifying questions, and creates a plan for you to review before implementation", then hands off to an implementation agent. Visual Studio docs: it asks only "If the task is ambiguous"; "For straightforward requests, Copilot might draft the plan immediately". Sources: [VS Code: Plan work with agents](https://code.visualstudio.com/docs/agents/run/planning), [Visual Studio: plan agent](https://learn.microsoft.com/en-us/visualstudio/ide/copilot-plan-agent?view=visualstudio)

### Windsurf (now Devin Desktop)

Plan mode will "Ask clarifying questions to ensure the plan aligns with your goals", writes a Markdown plan, then an **Implement** button. The keywords megaplan, ultraplan or masterplan force "at least one clarifying question before it writes the plan"; an older docs copy says it "often asks multiple choice questions". Sources: [Modes docs](https://docs.windsurf.com/windsurf/cascade/modes), [Devin docs copy](https://docs.devin.ai/desktop/cascade/modes), [Changelog](https://windsurf.com/changelog)

### Kiro

Specs: requirements.md (EARS acceptance criteria), then design.md, then tasks.md, with an approval gate before each next file. Quick Spec asks "a set of clarifying questions up front" (scope, constraints, edge cases), then writes all three files "with no approval gates between phases". Sources: [Specs](https://kiro.dev/docs/specs/), [Quick Spec](https://kiro.dev/docs/specs/quick-spec/)

### Devin

Devin rates its confidence green, yellow or red; below green it "will ask clarifying questions" and "will wait for user approval when it is unsure about its plan. Otherwise, it will proceed automatically and accept async feedback". To force a wait: "Simply tell Devin to wait for approval" (2025-05-15). Sources: [Devin 2.1](https://cognition.com/blog/devin-2-1), [Release notes 2025](https://docs.devin.ai/release-notes/2025)

## Long jobs the user walks away from (closest analogue)

### ChatGPT Deep Research

- **Asks:** AI-decided: "Before research begins, ChatGPT may ask clarifying questions to confirm your goals." It then shows a proposed research plan you can "review and modify" before it starts, and you can "interrupt at any time to refine the focus" (editable plans and mid-run updates since February 2026, per third-party write-ups). A newer copy of the help article says that in Work or Codex "ChatGPT asks clarifying questions once you provide the initial prompt".
- **UI:** questions arrive as a normal chat turn. A skip button or "just start" option: not found in docs. Whether the plan auto-starts: not found in docs (third-party: you approve it).
- **Cost:** per-plan usage limits for deep research (not verified: the help page blocked my fetcher); whether a clarifying turn counts against them: not found.
- **Sources:** [OpenAI Help: Deep research in ChatGPT](https://help.openai.com/en/articles/10500283-deep-research-in-chatgpt) (blocked to my fetcher; quotes from the search index), third-party: [CU tech tip](https://www.cu.edu/blog/tech-tips/utilize-deep-research-chatgpt), [AI Quick Tips 296](https://thoughtsbrewing.com/blog/ai-quick-tips-296-chatgpts-deep-research-upgrade)

### Gemini Deep Research

Always plans first: "Gemini will create a research plan"; **Edit plan** to change it; **Start research** is a separate click (auto-start not mentioned). Clarifying questions: not found in docs. Takes "about 5-10 minutes"; you can leave, and get a notice (web) or device notification (mobile) when done. Daily and concurrent caps. Source: [Gemini Apps Help: Use Deep Research](https://support.google.com/gemini/answer/15719111?hl=en)

### Claude Research

Turned on per chat (plus button, Research; a blue indicator). The help article says nothing about clarifying questions or a plan; a third-party guide says "Claude may ask follow-up questions to refine the scope" when a prompt lacks detail (not verified). Same limits as chat, but "research sessions can use up your limits faster". Sources: [Using Research on Claude](https://support.claude.com/en/articles/11088861-using-research-on-claude), third-party: [DEV Community guide](https://dev.to/theairabbit/mastering-claudes-research-tool-a-practical-guide-465d)

### Manus

Plan Mode (2026-07-22) is manual: type `/` and pick Plan. "If context is missing, it asks clarifying questions", then shows an editable plan; "Manus will not start building until you confirm or dismiss the plan". Credits for planning: not found in docs; Manus's docs point to Chat mode for quick questions to save credits. Sources: [Introducing Plan Mode](https://manus.im/blog/manus-plan-mode), [Plans and Pricing](https://manus.im/docs/introduction/plans)
