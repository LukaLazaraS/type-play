// `admin waitlist …` (src/admin.ts): the closed beta's waitlist (waitlist.ts), the people to tell when TypePlay opens to
// everyone (docs/beta/runbook.md "Opening the app to everyone later"). Every command writes a BillingAudit row (actor
// "admin:<name>"); a removal keeps the address only as the tombstone's salted hash of its matched form, as invites do.
//   waitlist list             everyone on it, oldest first: the address as signed in, the day they asked
//   waitlist remove <email>   off the list (told, or asked by mail to be taken off)
//   waitlist stopped          the Google sign-ins that never got an account (the closed-beta page stopped them), oldest
//                             first: the address, Google's name for it, the first and last sign-in, and whether invited or on the list since.
//                             From Supabase's own sign-in table (auth.users, the live database); none on this PC's.
//                             Beta 2 (2026-11-19) invited beta 1's 14 from it: docs/beta/beta2-2026-11-19.md
import { emailHash } from "../auth/tombstone.js";
import type { LedgerService } from "../credits/ledger.service.js";
import { config } from "../env.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { addressOf } from "./admin-invites.js";
import { inviteMatch } from "./invites.js";

export const WAITLIST_USAGE = "admin waitlist list | waitlist remove <email> | waitlist stopped";
const day = (d: Date) => d.toISOString().slice(0, 10);
const when = (d: Date) => `${d.toISOString().replace("T", " ").slice(0, 16)} UTC`;

export async function waitlistAdmin(prisma: PrismaClient, ledger: LedgerService, args: string[], actor: string): Promise<void> {
  const [what, raw] = args;
  if (what === "stopped") {
    let rows: { email: string | null; name: string | null; created_at: Date; last_sign_in_at: Date | null }[];
    try {
      rows = await prisma.$queryRaw`
        SELECT a.email, coalesce(a.raw_user_meta_data->>'full_name', a.raw_user_meta_data->>'name') AS name, a.created_at, a.last_sign_in_at
        FROM auth.users a
        WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = a.id::text)
        ORDER BY a.created_at ASC, a.email ASC`;
    } catch {
      console.log("no sign-in table here (auth.users is Supabase's: the live database, npm run admin:live)");
      await ledger.audit(prisma, { actor, userId: null, action: "waitlist_stopped", details: { signIns: null } });
      return;
    }
    // An invite, a waitlist row or an account matched as the sign-in check matches (one Gmail spelled two ways is one).
    const invites = new Map((await prisma.invite.findMany()).map((i) => [i.match, i]));
    const waiting = new Map((await prisma.waitlistEntry.findMany()).map((w) => [w.match, w]));
    const accounts = new Map((await prisma.user.findMany({ select: { email: true } })).map((u) => [inviteMatch(u.email), u.email]));
    let invited = 0;
    for (const r of rows) {
      const email = r.email ?? "(no address)";
      const match = inviteMatch(email);
      const inv = invites.get(match);
      const wait = waiting.get(match);
      const other = accounts.get(match);
      if (inv) invited++;
      const notes = [
        inv ? `invited ${day(inv.invitedAt)}${inv.note ? ` ("${inv.note.replace(/[\p{Cc}\p{Cf}]+/gu, " ").slice(0, 60)}")` : ""}` : "",
        wait ? `on the waitlist since ${day(wait.askedAt)}` : "",
        other ? `has an account as ${other}` : "",
        config.adminEmails.includes(email.toLowerCase()) ? "an admin address" : "",
      ].filter(Boolean);
      const name = r.name ? ` "${r.name.replace(/[\p{Cc}\p{Cf}]+/gu, " ").slice(0, 60)}"` : "";
      console.log(`${email.padEnd(36)}${name} first sign-in ${when(r.created_at)}, last ${r.last_sign_in_at ? day(r.last_sign_in_at) : "-"}${notes.length ? `; ${notes.join("; ")}` : ""}`);
    }
    console.log(rows.length ? `${rows.length} sign-in${rows.length === 1 ? "" : "s"} with no account, ${invited} invited since` : "every sign-in has an account");
    await ledger.audit(prisma, { actor, userId: null, action: "waitlist_stopped", details: { signIns: rows.length, invited } });
    return;
  }
  if (what === "list") {
    const rows = await prisma.waitlistEntry.findMany({ orderBy: [{ askedAt: "asc" }, { match: "asc" }] });
    if (!rows.length) console.log("nobody on the waitlist");
    for (const r of rows) console.log(`${r.email.padEnd(36)} asked ${day(r.askedAt)}`);
    if (rows.length) console.log(`${rows.length} on the waitlist`);
    await ledger.audit(prisma, { actor, userId: null, action: "waitlist_list", details: { entries: rows.length } });
    return;
  }
  if (what !== "remove") throw new Error(`usage: ${WAITLIST_USAGE}`);
  const match = inviteMatch(addressOf(raw, WAITLIST_USAGE));
  const had = await prisma.waitlistEntry.findUnique({ where: { match } });
  if (!had) throw new Error(`${raw?.trim()} is not on the waitlist`);
  await prisma.waitlistEntry.delete({ where: { match } });
  await ledger.audit(prisma, { actor, userId: null, action: "waitlist_remove", details: { emailHash: emailHash(match) } });
  console.log(`${had.email}: off the waitlist`);
}
