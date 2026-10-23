# Anthropic question: the game agent on the Agent SDK, paid by our API key

Parked #4. Pages fetched 2026-10-17; quotes are exact.

**The docs don't settle it, so send the email.** The Agent SDK docs describe our exact setup as normal (own API key, many users, one container each). But the Claude Code legal page bars anyone "running Claude Code ... in hosted sandboxes or other agent infrastructure" from paying for its users' Claude usage, and the SDK "runs the Claude Code binary".
**Safe either way:** our own API key on the server (never Max), no Claude login for users. If the answer is no: our own loop on the Messages API (~2 days, `PLAN.md`) or Claude Managed Agents (an API product, beta), neither of which runs Claude Code.
**Send Mon 10-19** through the support messenger on Luka's Max account (it reaches the human team) and the sales chat (see "Where to send"). We need the answer by Thu 10-22.

## What the pages say

**Claude Code: Legal and compliance**: https://code.claude.com/docs/en/legal-and-compliance

- Section "Can customers offer Claude Code in their products?": "Unless we've mutually agreed otherwise, preinstalling or running Claude Code in your products or services (e.g. in hosted sandboxes or other agent infrastructure) requires agreeing to our Commercial Terms of Service and complying with the conditions below:"
- "**The Claude Code binary must not be modified.** Claude Code must be installed and run as published by Anthropic, and customers may not remove, disable, or restrict any authentication method built into it (including methods that permit signing in with a Claude account or the user's own API key)."
- "**Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf.** Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential (Amazon Bedrock, Google Cloud's Agent Platform, Microsoft Foundry). That usage is billed directly to the end user under their own agreement with Anthropic or, for third-party inference providers, with the applicable provider."
- Section "Authentication and credential use": "**Developers** building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider. Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users."
- "This does not restrict how customers provision and manage their own API keys or third-party inference provider credentials — for example, configuring an API key in a development environment, secrets manager, or machine image for use by the customer's own authorized users — provided the resulting usage is billed to the key owner under their agreement with Anthropic (or the applicable provider) and is not resold or intermediated as described above."
- "For questions about permitted authentication methods for your use case, please contact sales."

**Agent SDK overview**: https://code.claude.com/docs/en/agent-sdk/overview

- What it is: "A library that runs the Claude Code binary, with Claude Code's capabilities, such as built-in tools, permissions, sessions, and hooks."
- "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Use the API key authentication methods described in the Quickstart instead."
- Section "License and terms": "Use of the Claude Agent SDK is governed by Anthropic's Commercial Terms of Service, including when you use it to power products and services that you make available to your own customers and end users, except to the extent a specific component or dependency is covered by a different license as indicated in that component's LICENSE file."
- Branding: "Claude Code" or "Claude Code Agent" are "Not permitted" as names for our agent (we don't use either).

**Hosting the Agent SDK**: https://code.claude.com/docs/en/agent-sdk/hosting (treats multi-user hosting as the normal case)

- "Example workloads include an email agent that triages and responds to incoming mail, a site builder that hosts a per-user editable site through container ports, and a chat bot that handles continuous traffic from a platform like Slack."
- "the subprocess reads `ANTHROPIC_API_KEY` from its environment. Supply it from your secret manager, or set `ANTHROPIC_BASE_URL` to route model calls through a proxy that injects the key outside the container."

**Commercial Terms** (effective June 17, 2025): https://www.anthropic.com/legal/commercial-terms

- A.1: "Subject to these Terms, Anthropic gives Customer permission to use the Services, including to power products and services Customer makes available to its own customers and end users ("Users")."
- D.4: "Customer may not and must not attempt to (a) access the Services to build a competing product or service, including to train competing AI models or resell the Services except as expressly approved by Anthropic; …"

**Claude Managed Agents** (the API route, if the SDK is a no): https://platform.claude.com/docs/en/managed-agents/overview

- "Pre-built, configurable agent harness that runs in managed infrastructure." Sessions run in "an Anthropic-managed cloud sandbox, or a self-hosted sandbox on your own infrastructure". "Claude Managed Agents is in beta." Pricing not checked.

**Claude's reading:** the legal-page rule seems aimed at platforms that hand Claude Code itself to their users. We sell a game builder, and users never touch Claude Code. But the wording ("running Claude Code … in hosted sandboxes or other agent infrastructure") covers us literally, and credits that pay for model usage could count as "intermediate". So get a written answer.

## Where to send

1. **Support messenger, logged in with Luka's Max account:** https://support.claude.com → message icon (bottom right) → "Send us a message" → paste the email. Per "How to get support" (https://support.claude.com/en/articles/9015913-how-to-get-support), Max plans get "further help from the Product Support team" (a human; the reply also arrives by email).
2. **Sales chat:** https://claude.com/contact-sales (the legal page's "contact sales" link redirects here). It has no form, only "Chat now" (a buying agent that can pass you to sales). The page says sales "can only support complex deals, like 500+ seat deployments and BAAs", so expect a hand-off.
3. After the API account exists (parked #6, Wed 10-21): https://platform.claude.com → your initials (bottom left) → "Get help". That ties the question to the account that will pay.

## The email

**Subject:** Agent SDK in our product, paid with our own API key: is this allowed?

Hello,

I'm building TypePlay (typeplay.app), a website where people describe a small game in one sentence, an AI agent builds it in Godot, and they play it in the browser right away and can export it to the app stores.

Our setup:
- The game agent runs on our own server, built with the Claude Agent SDK (TypeScript). Its tools are file edit, bash and our Godot export/check tools. Each project runs in its own container.
- Every model call uses our own API key under the Commercial Terms. The key is added by a proxy outside the containers, and we pay Anthropic per token.
- Users buy credits from us and spend them on game builds and edits. They never get a Claude login, an API key or direct model access. The model, settings and auth all stay on our server. We don't call the agent "Claude Code" anywhere.

My question: is this allowed?

The Agent SDK overview says the SDK can power "products and services that you make available to your own customers and end users" under the Commercial Terms. But the Claude Code legal page ("Can customers offer Claude Code in their products?") says that a product running Claude Code "in hosted sandboxes or other agent infrastructure" may not pay for its end users' Claude usage, and each end user must sign in with their own credentials. The Agent SDK runs the Claude Code binary, so I'm not sure which rule applies to us.

If the Agent SDK is not allowed for this, what is the right way: Claude Managed Agents with a self-hosted sandbox, or our own agent loop on the Messages API?

We start a small closed beta on October 23, so a short answer before then would help a lot.

Thank you,
Luka Lazarashvili
TypePlay, https://typeplay.app
hello@typeplay.app
