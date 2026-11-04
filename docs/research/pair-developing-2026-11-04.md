# Pair developing: how the big builders let two people build one project (2026-11-04)

Research for the night task "share a game as editable" (`docs/overnight/2026-11-04_pairdev.md`). Sources: each
product's own current docs (Lovable, Replit, Bolt and v0 docs read on 2026-11-04 from their docs sites; Figma and
Google from their help centres). No video or forum post was needed: every answer below has an official page.

## Decision: CLEAR

**Lovable and Replit give the same answer to all three gate questions, and it fits our credits:**

| Gate question | Lovable | Replit | Same? |
|---|---|---|---|
| Who pays for a collaborator's AI message | The owner's workspace: "Collaborators will use credits from the project owner's workspace." | The owner: "their work counts toward your credits." | Yes: **the owner pays** |
| How inviting works | By email (an email with a link to join; a Lovable account is needed) or an invite link | By email (accept) or a "private join link"; a Replit account is needed | Yes: **email or link, an account, an accept step** |
| Roles | Viewer (paid plans), Editor, Admin (paid plans), Owner; the default invite is Can edit | Owner, Publisher, Editor, Read-only; a personal project's guests get edit access | Yes: **owner + editor on the base tier**, a viewer role only on paid tiers |

It fits our pattern ("every AI call the player causes is on someone's credits, nothing free on us"): a collaborator's
message is charged to the game owner's credits, under the owner's plan (its AIs, its daily cap, its kill switch),
exactly as if the owner had sent it. Nothing new is free on us.

Where the two differ, or one is silent, the night picks the stricter or the more common way and logs it
(`docs/overnight/2026-11-04_pairdev.md`, "Decisions"): editors can't share the game publicly, invite, delete or export
to Android; no "anyone with the link can edit" link; invitations last 7 days; every plan may invite.

**Not the same everywhere:** Bolt, v0 and Figma bill the person who sends (Bolt: "tokens from the prompter's account
rather than from the project owner's"; v0: each seat's own monthly credits; Figma: credits from the plan where you are
a member). Luka asked to copy Lovable and Replit, and they agree, so the owner pays. Switching to "the sender pays"
later is one function in our code (`payerOf`, `docs/design/pair-developing.md`).

**One gap on our side, not in the research:** every competitor sends the invitation by email. TypePlay has no
email-sending service yet (hello@typeplay.app only receives). Until it has one, the owner sends the invite link
themselves (copy, or the phone's share sheet), and an invited person who already has an account also finds the
invitation in My games. For Luka: pick a sending service (Resend, Postmark or Amazon SES), then the same link goes out by
email.

## 1. Who pays for an AI message a collaborator sends

| Product | Who pays | Limits the owner can set | Source |
|---|---|---|---|
| **Lovable** | **The owner's workspace.** "Collaborators will use credits from the project owner's workspace." "Every prompt draws from that workspace's credit pool, regardless of who is prompting. External collaborators always consume **your workspace's** credits, not their own." | Owners and admins set a default monthly credit limit per member and per-member overrides (paid plans); "When a member reaches their limit, they cannot use more build credits until the 1st of the next month UTC." | [Collaboration](https://docs.lovable.dev/features/collaboration), [People](https://docs.lovable.dev/features/people), [Workspace](https://docs.lovable.dev/features/workspace) |
| **Replit** | **The owner.** "Collaborators can access the project's chat history and memories, and their work counts toward your credits." A Team Workspace on Pro: "Pooled credits from the admin's account". Each person keeps their own Agent mode, model and effort. | Usage alerts and budget limits on the account | [Invite teammates](https://docs.replit.com/build/invite-teammates), [Personal & Team Workspaces](https://docs.replit.com/features/collaboration/team-workspaces), [Agent modes](https://docs.replit.com/features/agent/agent-modes), [Billing](https://docs.replit.com/category/billing) |
| Bolt | The sender. "When collaborators prompt in a project, Bolt uses tokens from the prompter's account rather than from the project owner's." | (not needed) | [Share your project](https://support.bolt.new/collaboration/sharing), [Collaborate](https://support.bolt.new/collaboration/collaborate) |
| v0 | The sender's seat: "Each team member receives their own monthly credits"; a team's Shared Credit Pool is used after them | Owners see usage per member | [v0 Teams](https://v0.app/docs/teams) |
| Figma | The plan where the person is a member: "Your AI credits come from the plan where you have the higher membership level. Members rank higher than guests." | Seats and admins' approval | [Connected folders](https://help.figma.com/hc/en-us/articles/30124855491863-Guide-to-connected-folders), [AI credits](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) |

**For TypePlay:** the game's owner pays (Lovable, Replit). The owner's plan decides what a collaborator may send (Free:
Fast only, 5 credits a day), as Lovable's workspace plan does.

## 2. How inviting works

| Product | Ways in | Account needed | Accept step | Expiry | Other | Source |
|---|---|---|---|---|---|---|
| **Lovable** | Share → "Invite by email" (one or more), or an invite link: "Anyone who opens it is automatically added to the project as a collaborator with the role you set." | Yes: "If they already have a Lovable account, the project also appears in their **Shared with me** section. If they don't, they can create an account and join through the invitation." | Workspace invites: "an invite to their email that they then can accept" | Project invite links: "expire automatically **7 days** after they are created"; one active link, changing it kills the old one. Workspace email invites: 30 days. | Free workspaces: "**5** email invitations per day" | [Share a project](https://docs.lovable.dev/features/share-project), [People](https://docs.lovable.dev/features/people) |
| **Replit** | Invite → an email address (or a username), or "Copy link" under **Private join link**: "The private join link grants edit access to anyone who has it." | Yes: "Non-Replit members join the organization after creating an account." | "Teammates accept the email invitation or open the private join link" | Workspace email invitations: "expires after seven days" (project links: not stated) | Collaborators "don't need a paid plan to edit your project" | [Invite teammates](https://docs.replit.com/build/invite-teammates), [Managing members](https://docs.replit.com/teams/identity-and-access-management/managing-members), [Projects and files FAQ](https://docs.replit.com/help/projects-and-files) |
| Bolt | Share → email only. Link sharing was removed: "Bolt no longer lets you share your project with anyone who has the link." | Yes, signed in **with the invited address**: otherwise "You're signed in with a different email" (then Request access) | Status `Pending` until they accept (an email with Accept Invitation) | "Invite expired" exists (days not stated); Resend invite | Found again under **Shared with you** | [Share your project](https://support.bolt.new/collaboration/sharing), [Sharing issues](https://support.bolt.new/troubleshooting/sharing-issues) |
| v0 | Invite dialog: team members by name or email; visibility "Anyone with the link" | Yes (a Vercel team) | (team members) | (not stated) | Recommends "Can View" then Duplicate | [v0 Sharing](https://v0.app/docs/sharing) |
| Figma | Email invite to a file, folder, team or plan; or send a link | Yes | "they just need to accept the invitation" | (not stated) | Editing needs a seat | [Sharing and permissions](https://help.figma.com/hc/en-us/articles/1500007609322-Guide-to-sharing-and-permissions) |
| Google Docs | Share with people by email; general access by link | A Google account for named people | None (a notification) | Access expiry dates on work and school accounts | Owner can stop editors sharing | [Share files](https://support.google.com/docs/answer/2494822), [Stop, limit, or change sharing](https://support.google.com/docs/answer/2494893) |

**For TypePlay:** an invite is addressed to one email; it works only for the account signed in with that address
(Bolt; Gmail dots and +tags ignored, as our beta invites already match); the friend opens the link, signs in with Google,
sees who invited them, to which game and who pays, and taps Accept or Decline; 7 days (Lovable's link, Replit's email);
the owner can make a new link (Bolt's Resend) or take the invitation back. No open "anyone with the link can edit" link:
the owner pays for every change, and Bolt removed such links.

## 3. Roles and what each may do

Lovable's project roles ([Collaboration](https://docs.lovable.dev/features/collaboration), [Share a project](https://docs.lovable.dev/features/share-project)):

| Can … | Viewer (paid plans) | Editor | Admin (paid plans) | Owner |
|---|---|---|---|---|
| Open, remix (copy) | yes | yes | yes | yes |
| Edit the project (chat with the AI) | no | yes | yes | yes |
| Publish | no | yes | yes | yes |
| Change project access; add or remove editors and viewers | add/remove viewers | yes | yes (+ admins) | yes |
| Project settings, GitHub | no | yes | yes | yes |
| Transfer, delete, restore a deleted project | no | no | no | yes |

"Please note that free plans do not have admin roles." On Free the Share menu offers Can edit only.

Replit's access levels per app ([Roles, Groups and Access](https://docs.replit.com/teams/identity-and-access-management/groups-and-permissions), [Access Management](https://docs.replit.com/teams/identity-and-access-management/repl-access-management)):

| Level | What it may do |
|---|---|
| Owner | "Full permissions, including deleting the app"; manages who has access ("Users with the **Owner** role on an app can manage its access") |
| Publisher | "Can edit and publish the app" |
| Editor | "Can edit the app, but can't publish it" |
| Read-only | "Can view the published app, but can't open its workspace" |

A personal project's guests (email or join link) get edit access; "All users with access to the Project Editor can see
who has access to the Replit App, even if they can't manage it."

Others:

| Product | Roles | Notes | Source |
|---|---|---|---|
| Bolt | Viewer (open, duplicate, see preview and code, comment), Editor (+ prompt and edit code, publish), Co-owner (team members only; + invite outsiders) | Personal plans: Viewer and Editor only; only the owner connects GitHub | [Share your project](https://support.bolt.new/collaboration/sharing) |
| v0 | Can View ("see the entire chat history but cannot make any changes"), Can Edit ("send and edit prompts, … rename the chat, change visibility and sharing settings, and archive or delete it") | | [v0 Sharing](https://v0.app/docs/sharing) |
| Google Docs | Viewer, Commenter, Editor, Owner | Editors may share by default; the owner can switch that off; an editor can't change the owner | [Share files](https://support.google.com/docs/answer/2494822) |

**For TypePlay (the base tier both agree on): Owner and Editor.** The editor builds (chat with the AI, answer its
questions, attach pictures, restore a version, rename, see assets, download the project, stop their own build) and sees
who is in. Only the owner invites and removes, shares the game publicly and puts it in the gallery (Replit's Editor
can't publish; Lovable's and Bolt's can: the stricter one, as the owner's name and credits are on it), exports to
Android (the upload key is the owner's store identity), deletes, and stops anyone's build. A viewer role: later, as
both sell it on paid tiers only.

## 4. Two people sending at once

| Product | What happens | Source |
|---|---|---|
| **Lovable** | Follow-ups: "You don't have to wait for Lovable to finish before sending your next message"; Lovable picks it up at its next natural stopping point. The older message queue ran messages "one at a time, in order". For parallel work, each person opens a **draft** (its own chat and preview); "If several drafts are accepted around the same time, Lovable processes them one at a time." | [Project chat](https://docs.lovable.dev/features/projects/chat), [Drafts](https://docs.lovable.dev/features/drafts) |
| **Replit** | Each person starts their own Agent threads; tasks run in isolated copies and are applied back. "On Core, only 1 background task can run at a time across the project. On Pro, up to 10 tasks can run in parallel." | [Invite teammates](https://docs.replit.com/build/invite-teammates) |
| Bolt | "Every project has a single shared chat thread. To prevent conflicting edits, Bolt processes one prompt at a time. If you or a collaborator sends a prompt while Bolt is still working on another one, it's added to a queue." | [Collaborate](https://support.bolt.new/collaboration/collaborate) |
| v0 | Recommends each collaborator duplicates the chat ("too many cooks in the kitchen") | [v0 Sharing](https://v0.app/docs/sharing) |

**For TypePlay:** one build per game at a time already (two exports writing one folder corrupt it), like Bolt, Replit
Core and Lovable's queue. The second sender is told who is building and waits for that build to end; exactly one of two
sends at the same moment starts. A per-game queue (Bolt) or drafts (Lovable) can come later.

## 5. What a collaborator sees of the owner's credits and of the history

| Product | Credits | History | Source |
|---|---|---|---|
| **Lovable** | External collaborators "Open the **Plans & credit usage** tab to see the current plan, credit balance, and usage, but every **billing control is disabled** for them"; other members' usage is for admins and owners only | The project's "source code, project chat history, work in progress, and changes that have not yet been published" | [People](https://docs.lovable.dev/features/people), [Project access](https://docs.lovable.dev/features/project-visibility), [Plans and credits](https://docs.lovable.dev/introduction/plans-and-credits) |
| **Replit** | Not stated for guests | "Collaborators can access the project's chat history and memories"; "Checkpoints are visible to all project collaborators" | [Invite teammates](https://docs.replit.com/build/invite-teammates), [Checkpoints](https://docs.replit.com/features/version-control/checkpoints-and-rollbacks) |
| v0 | Members see their own consumption; owners see it per member | Can View sees the entire chat history | [v0 Teams](https://v0.app/docs/teams) |

**For TypePlay:** a collaborator sees the whole chat (with who sent each message), the versions and the pictures; each
answer's price as today; and "Paid from Luka's credits" by the send button. Not the owner's balance (less than
Lovable shows; when the credits run out the message says so). The owner sees, per collaborator, the credits their
changes cost this month (Lovable's People column).

## 6. Leaving, removing, and what happens to the project

| Product | Removing | Leaving | The project and the work | Source |
|---|---|---|---|---|
| **Lovable** | From the Share menu (editors can remove editors and viewers); "No one can remove the project owner." Removed people "lose workspace and project access immediately"; they get an email | "Any workspace member can leave"; external collaborators leave from workspace settings | "Any work they created stays in the workspace, they just can't open or edit it." The owner can transfer ownership | [Share a project](https://docs.lovable.dev/features/share-project), [People](https://docs.lovable.dev/features/people), [Workspace](https://docs.lovable.dev/features/workspace) |
| **Replit** | "Project owners can manage team members and revoke access at any time." | (not stated for project guests) | The project stays the owner's | [Invite teammates](https://docs.replit.com/build/invite-teammates) |
| Bolt | Share → Remove; change role; resend invite | | | [Share your project](https://support.bolt.new/collaboration/sharing) |

**For TypePlay:** the owner removes anyone at once; a collaborator can leave; their messages stay in the game's chat
(the game is the owner's); a game deleted by its owner is gone for everyone; an account closed by a collaborator takes
their memberships with it and leaves their messages as "a former member". No ownership transfer in this version.

## 7. Plan limits (how many collaborators)

| Product | Free tier | Paid tiers | Source |
|---|---|---|---|
| **Lovable** | Can invite (Can edit only); "Free workspaces can send **5** email invitations per day" | No daily limit; "Free and Pro workspaces hold up to **200 members** with an owner, admin, or editor role. Viewers and external collaborators don't count toward that." "Plans are priced by credits, not seats, so adding members doesn't increase your subscription cost." | [People](https://docs.lovable.dev/features/people), [Workspace](https://docs.lovable.dev/features/workspace) |
| **Replit** | Starter: 0 collaboration seats | Core: 5; Pro: 15 ("no per-seat fees") | [Invite teammates](https://docs.replit.com/build/invite-teammates), [Replit Core](https://docs.replit.com/billing/plans/replit-core), [Replit Pro](https://docs.replit.com/billing/plans/replit-pro) |
| Bolt | "Sharing is available on all plans." | | [Share your project](https://support.bolt.new/collaboration/sharing) |
| v0 | Inviting individuals: Plus, Business and Enterprise only | | [v0 Sharing](https://v0.app/docs/sharing) |

**For TypePlay:** Lovable's way, because it matches how we sell ("Tiers sell credits, never unlimited use"; every paid
plan has the same AI): every plan may invite, the owner's credits pay, so more people only spend them faster. Up to 10
people per game besides the owner (invitations waiting included), and at most 30 new invitation links a day per owner
(a guard; Lovable's "5 email invitations per day" on Free is about the emails it sends, and we send none). One table in
the code; Luka can turn Free off (Replit's way) in a word.

## Pages read

Lovable: [collaboration](https://docs.lovable.dev/features/collaboration), [share-project](https://docs.lovable.dev/features/share-project),
[people](https://docs.lovable.dev/features/people), [workspace](https://docs.lovable.dev/features/workspace),
[drafts](https://docs.lovable.dev/features/drafts), [project chat](https://docs.lovable.dev/features/projects/chat),
[project access](https://docs.lovable.dev/features/project-visibility), [plans and credits](https://docs.lovable.dev/introduction/plans-and-credits).
Replit: [invite teammates](https://docs.replit.com/build/invite-teammates), [team workspaces](https://docs.replit.com/features/collaboration/team-workspaces),
[workspaces](https://docs.replit.com/features/collaboration/workspaces), [billing](https://docs.replit.com/category/billing),
[AI billing](https://docs.replit.com/billing/ai-billing), [Core](https://docs.replit.com/billing/plans/replit-core), [Pro](https://docs.replit.com/billing/plans/replit-pro),
[roles](https://docs.replit.com/teams/identity-and-access-management/groups-and-permissions), [managing members](https://docs.replit.com/teams/identity-and-access-management/managing-members),
[access management](https://docs.replit.com/teams/identity-and-access-management/repl-access-management), [agent modes](https://docs.replit.com/features/agent/agent-modes),
[projects and files FAQ](https://docs.replit.com/help/projects-and-files).
Bolt: [sharing](https://support.bolt.new/collaboration/sharing), [collaborate](https://support.bolt.new/collaboration/collaborate), [sharing issues](https://support.bolt.new/troubleshooting/sharing-issues).
v0: [sharing](https://v0.app/docs/sharing), [teams](https://v0.app/docs/teams).
Figma: [sharing and permissions](https://help.figma.com/hc/en-us/articles/1500007609322-Guide-to-sharing-and-permissions), [connected folders](https://help.figma.com/hc/en-us/articles/30124855491863-Guide-to-connected-folders), [AI credits](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work).
Google: [share files](https://support.google.com/docs/answer/2494822), [stop, limit, or change sharing](https://support.google.com/docs/answer/2494893).

One older third-party tutorial (rapidevelopers.com) says Replit collaborators pay for their own Agent use; Replit's
own current invite page says the opposite ("their work counts toward your credits"), so the official page is used.
