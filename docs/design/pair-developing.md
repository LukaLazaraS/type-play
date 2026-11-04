# Pair developing: two people build one game (2026-11-04)

The owner invites a friend into the game's editor; both chat with the AI on the same game. Research and sources:
`docs/research/pair-developing-2026-11-04.md` (CLEAR: Lovable and Replit agree). Built on branch `pairdev` the night of
2026-11-04 (`docs/overnight/2026-11-04_pairdev.md`).

## The rules (from the research)

| Question | Rule | Why |
|---|---|---|
| Who pays | **The game's owner.** Every AI call a member causes is charged to the owner's credits, under the owner's plan (its AIs, the Free daily cap, the kill switch, builds at once, the queue's lane) | Lovable: "Collaborators will use credits from the project owner's workspace"; Replit: "their work counts toward your credits" |
| Who may be in | The owner (`Project.ownerId`) and **editors** (`ProjectMember`). Up to 10 people besides the owner, invitations waiting included | Both: owner + editor on the base tier; a viewer role only on paid tiers (later) |
| How in | An **invitation for one email**: a link the owner sends (copy, or the phone's share sheet) and the invitee's My games; works only signed in with that address (Gmail dots and +tags ignored); Accept or Decline; **7 days**; a new link replaces the old one; the owner takes it back any time | Lovable and Replit: email or link, an account, accept; 7 days (Lovable's link, Replit's email); Bolt: "signed in with a different email" |
| Out | The owner removes anyone at once; an editor leaves; a build they asked for that is still going or waiting stops (nothing charged); their messages stay in the game | Lovable: removed people "lose … access immediately", "work they created stays" |
| Two at once | One build per game (as today): the second sender is told who is building; of two sends at the same moment exactly one starts | Bolt "one prompt at a time", Replit Core "1 background task", Lovable's queue |

What each may do:

| | Owner | Editor | Outsider, invitation not accepted yet, removed, left |
|---|---|---|---|
| Open the game page, play, read the whole chat and the versions, see the pictures and the Assets tab | yes | yes | 404 |
| Send a change (paid by the owner), answer questions the AI asked them, attach pictures | yes | yes | 404 |
| Stop a build | any | the ones they asked for (403 otherwise) | 404 |
| Restore a version, rename, download the project | yes | yes | 404 |
| See who is in | yes, with emails, invitations and each editor's credits this month | names only | 404 |
| Invite, take an invitation back, remove someone | yes | 403 | 404 |
| Share the play link, the gallery, Android export (setup, builds, the upload key), delete | yes | 403 | 404 |
| Leave | (deletes the game instead) | yes | 404 |

An outsider always gets 404, the same as a game that isn't there (no telling which games exist). A member asking for
the owner's part gets 403 `owner_only`, one plain sentence.

## Data (migration `20261104180000_pair_developing`, additive)

- `enum MemberRole { editor }`.
- `ProjectMember (projectId, userId) @id, role, createdAt`: cascades with the game and with the account.
- `ProjectInvite (id uuid, projectId, email, match, role, tokenHash @unique, createdAt, sentAt, expiresAt, acceptedAt?)`,
  `@@unique([projectId, match])`: one invitation per game and address; deleted when declined, taken back, or with the
  game. Accepted, it is marked (`acceptedAt`; the member row is made in the same transaction) and kept while its person
  is in the game, so its link opens the game instead of a dead end (critique, 2026-11-04); it goes when they are out
  (removed, left, account closed). The link's secret (32 random bytes, base64url) is returned once and stored only as
  its SHA-256; only owners invite, so no "invited by" column.
- `Message.authorId` (SetNull): who sent a player message, and whose message an agent answer answers (the notice goes
  to them, they may stop it, only they answer its questions). The migration fills it with the game's owner on every
  existing message; null afterwards means a member who closed their account ("a former member").

No other table changes: a member's build is the owner's in the ledger, the queue (`QueuedRun.userId` is the payer) and
the registry; the sender rides on the messages.

## The API

**One place for access**: `src/access/access.service.ts` `AccessService.game(userId, id, need)` with need `view`,
`edit` or `owner`, one query (`ownerId = me OR a member row for me`). Every game route calls it; `ProjectViews.owned` is
gone. `payerOf(project)` (the owner) is the one line that says who pays.

| Route | Need |
|---|---|
| `GET /projects/:id`, `GET /projects/:id/events` (SSE), `GET /projects/:id/people`, `GET /projects/:id/assets/…`, `GET /attachments/:id[/thumb]` (a picture of a message in the game), `POST /feedback` with `gameId` | view |
| `POST /projects/:id/messages`, `POST /projects/:id/restore`, `POST /projects/:id/cancel` (own builds; the owner any), `PATCH /projects/:id` `name`, `GET /projects/:id/download`, `GET /estimate?game=`, `POST /projects/:id/leave` (editors) | edit |
| `PATCH /projects/:id` `shared` / `listed`, `DELETE /projects/:id`, everything under `/projects/:id/android`, `POST/DELETE /projects/:id/invites…`, `DELETE /projects/:id/members/:userId` | owner |
| `GET /projects` | the account's own games (unchanged) |
| `GET /shared` | the games the account is an editor of, with their owners |
| `GET /invites`, `GET /invites/link/:token`, `POST /invites/:id/accept`, `POST /invites/:id/decline` | the invitation's email must be the signed-in one (403 `wrong_account` with the address half hidden; 404 for one that ended) |

New in the contract (`packages/shared`): `Person`, `GameRole`, `Project.access` (role, owner, members, the plan and
AIs every message there goes by), `Message.by`, `SharedGame`, `Invitation`, `GamePeople`, `UsageEntry.by`,
`AccountExport.shared`, run events `people` and `removed`, error codes `owner_only` and `wrong_account`; `credits` on
`done` / `failed` only on the owner's streams (a member's stream never carries the owner's balance).

**Sending as an editor** (`projects.service send`): the owner's row (settled) is checked and held
(`credits.assertCanRun(payer, …, { by })`, the messages in the owner's terms: "Luka's credits can't pay for this…"),
the run is claimed for the owner (`claimRun(id, payer)`), the queue row and the agent message carry the owner's plan,
the messages carry `authorId` = the editor; `runs.start({ userId: payer, senderId })`. A build's end is told to the
sender (`ended`): the game stream, their notice and their devices. A 409 while someone else's build goes says whose.

**Pictures**: a member may see every picture sent in the game; may send again a picture any member sent there (copied
as theirs); staged pictures are their own only. A closed account's pictures go with it, from every game.

**Live**: the SSE stream of a member who is removed or leaves gets `{ type: "removed" }` and closes; the others get
`{ type: "people" }` and fetch the game again. A change to an invitation alone (made, renewed, taken back, declined)
is `{ type: "people", invites: true }`: who is in is the same, so only an open people list reads again.

## The screens

- **The people button**: on a computer at the end of the chat's header (the others' faces, and for the owner the plus
  and **Invite**); on a phone, where that header is hidden, an ink pill at the end of the page's tab bar (the plus, or
  the people, and how many are in).
- **People** (a popover that dims the page behind it, as it opens over paper): the owner types an email and Invite;
  then the link with Copy link and Share…, "works only for ana@example.com, for 7 days"; the list: the owner, each
  editor (their email, their credits this month, Remove after a question), each invitation waiting (when it ends, New
  link, Take back). An editor sees the names and Leave this game. During the closed beta: one line that the friend needs
  a beta code too.
- **/invite/<token>**: who invites you, to which game (its picture), "Changes you send are paid from Luka's credits",
  Accept and open / No thanks; signed out: sign in; the wrong account: which address it is for, which one you're signed
  in as, and Use another account; ended: ask for a new link; accepted already: the game opens.
- **My games**: Invitations at the top (a quiet Accept and the words No thanks: the page keeps its one hot button, New
  game), then the own games, then **Shared with you** (each tile says whose game it is).
- **Chat**: in a game with more than one person, every player message has its sender's name above it ("You" for your
  own); a build going for someone else says for whom; the AI's questions take answers only from the one who asked.
- **Composer for an editor**: the owner's plan's AIs and estimates, "about 0.3 credits · Luka pays", no balance; an
  out-of-credits answer says to ask the owner (no checkout); Stop only on their own build (the owner may stop anyone's,
  after a question).
- **Owner-only controls hidden for editors**: Share, Android, Delete (More has Leave this game instead).

## Not in this version

A viewer role (Lovable and Replit sell it on paid tiers); a per-member monthly credit cap (Lovable's paid plans: the
owner sees each editor's credits this month and can remove them); an open "anyone with the link can edit" link (Bolt
removed theirs; the owner pays for every change); invitation emails (no sending service yet: `docs/research`); handing a
game to another owner; a per-game queue or drafts for two builds at once.
