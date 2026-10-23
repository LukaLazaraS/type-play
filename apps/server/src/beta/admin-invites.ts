// `admin invite …` (src/admin.ts): the closed beta's invite list, by hand. Every command writes a BillingAudit row
// (actor "admin:<name>") with the address scrambled as the tombstone does it (auth/tombstone.ts; the matched form, so
// every spelling of one Gmail address is one hash), so the audit keeps no address after an invite is removed.
//   invite add <email> [note]   on the list (a note for yourself: who it is); again with a note changes the note
//   invite list                 every invite: when it was sent, the first sign-in, the account's plan and credits
//   invite remove <email>       off the list: the account stays (games, credits) but gets 403 invite_only until invited again
import { emailHash } from "../auth/tombstone.js";
import type { LedgerService } from "../credits/ledger.service.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { inviteMatch } from "./invites.js";

export const INVITE_USAGE = "admin invite add <email> [note] | invite list | invite remove <email>";
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "-");
/** Words safe to print in a terminal: one line, no control characters, cut short. */
const safe = (s: string, max = 120) => s.replace(/[\p{Cc}\p{Cf}]+/gu, " ").slice(0, max);

function addressOf(raw: string | undefined): string {
  const email = (raw ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new Error(`usage: ${INVITE_USAGE} (an email like name@gmail.com)`);
  return email;
}

/** The account an invite lets in (matched as the sign-in check matches), if it has signed in. */
async function accountOf(prisma: PrismaClient, match: string) {
  const users = await prisma.user.findMany({ select: { id: true, email: true, plan: true } });
  return users.find((u) => inviteMatch(u.email) === match) ?? null;
}

export async function inviteAdmin(prisma: PrismaClient, ledger: LedgerService, args: string[], actor: string): Promise<void> {
  const [what, raw, ...rest] = args;
  if (what === "list") {
    const invites = await prisma.invite.findMany({ orderBy: { invitedAt: "asc" } });
    const users = await prisma.user.findMany({ select: { id: true, email: true, plan: true } });
    const byMatch = new Map(users.map((u) => [inviteMatch(u.email), u]));
    if (!invites.length) console.log("no invites yet (admin invite add <email> [note])");
    for (const i of invites) {
      const u = byMatch.get(i.match);
      const b = u ? await ledger.balance(await prisma.user.findUniqueOrThrow({ where: { id: u.id } })) : null;
      const account = u ? `, ${u.email === i.email ? "" : `signs in as ${u.email}, `}${u.plan}, ${b?.available} credits` : "";
      console.log(`${i.email.padEnd(36)} invited ${day(i.invitedAt)}, ${i.usedAt ? `first sign-in ${day(i.usedAt)}` : "not signed in yet"}${account}${i.note ? `  "${safe(i.note)}"` : ""}`);
    }
    if (invites.length) console.log(`${invites.length} invite${invites.length === 1 ? "" : "s"}, ${invites.filter((i) => i.usedAt).length} signed in`);
    await ledger.audit(prisma, { actor, userId: null, action: "invite_list", details: { invites: invites.length } });
    return;
  }
  if (what !== "add" && what !== "remove") throw new Error(`usage: ${INVITE_USAGE}`);
  const email = addressOf(raw);
  const match = inviteMatch(email);
  const user = await accountOf(prisma, match);
  if (what === "add") {
    const note = safe(rest.join(" ").trim(), 200) || null;
    const had = await prisma.invite.findUnique({ where: { match } });
    if (had) {
      if (note) await prisma.invite.update({ where: { match }, data: { note } });
      console.log(`${email}: already invited${had.email === email ? "" : ` (as ${had.email})`} since ${day(had.invitedAt)}${note ? "; note changed" : ""}`);
    } else {
      await prisma.invite.create({ data: { email, match, note } });
      console.log(`${email}: invited${note ? ` ("${note}")` : ""}. They sign in with Google at https://typeplay.app/create${user ? ` (they have an account already: ${user.email}, ${user.plan})` : "; their account appears at the first sign-in, with the Free plan's 20 credits"}`);
    }
    await ledger.audit(prisma, { actor, userId: user?.id ?? null, action: "invite_add", details: { emailHash: emailHash(match), already: !!had } });
    return;
  }
  const had = await prisma.invite.findUnique({ where: { match } });
  if (!had) throw new Error(`${email} is not on the invite list`);
  await prisma.invite.delete({ where: { match } });
  await ledger.audit(prisma, { actor, userId: user?.id ?? null, action: "invite_remove", details: { emailHash: emailHash(match), used: !!had.usedAt } });
  console.log(`${had.email}: removed from the invite list; ${user ? "the account stays (games, credits), but the app answers 403 invite_only until they are invited again" : "they never signed in"}`);
}
