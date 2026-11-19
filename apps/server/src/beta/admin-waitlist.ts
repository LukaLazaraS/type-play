// `admin waitlist …` (src/admin.ts): the closed beta's waitlist (waitlist.ts), the people to tell when TypePlay opens to
// everyone (docs/beta/runbook.md "Opening the app to everyone later"). Every command writes a BillingAudit row (actor
// "admin:<name>"); a removal keeps the address only as the tombstone's salted hash of its matched form, as invites do.
//   waitlist list             everyone on it, oldest first: the address as signed in, the day they asked
//   waitlist remove <email>   off the list (told, or asked by mail to be taken off)
import { emailHash } from "../auth/tombstone.js";
import type { LedgerService } from "../credits/ledger.service.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { addressOf } from "./admin-invites.js";
import { inviteMatch } from "./invites.js";

export const WAITLIST_USAGE = "admin waitlist list | waitlist remove <email>";
const day = (d: Date) => d.toISOString().slice(0, 10);

export async function waitlistAdmin(prisma: PrismaClient, ledger: LedgerService, args: string[], actor: string): Promise<void> {
  const [what, raw] = args;
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
