// The closed beta's waitlist (2026-11-19; beta 1's findings: 14 of 22 Google sign-ins stopped at the closed-beta page,
// which had no way to ask in): someone signed in whose email isn't invited asks to be told when TypePlay opens to
// everyone, or takes it back. One row per email (WaitlistEntry, keyed by the email as invites match it): the address as
// signed in, which the email goes to, and when they asked. Joining and leaving are idempotent. A beta code or an invite
// that lets the email in takes its row away (codes.ts, admin-invites.ts); the beta's end is told to everyone left on it
// (docs/beta/runbook.md). No user row is made: the routes are @IdentityOnly() like POST /beta/code (waitlist.controller.ts).
// `admin waitlist list | remove` (admin-waitlist.ts).
import { Injectable } from "@nestjs/common";
import type { WaitlistState } from "@typeplay/shared";
import type { Identity } from "../auth/auth.service.js";
import { ApiException, badRequest } from "../common/api-error.js";
import { Limit } from "../gallery/limits.js";
import { PrismaService } from "../prisma.js";
import { InviteService, inviteMatch } from "./invites.js";

/** Joins and leaves an email may make in an hour (held in this process's memory, as the gallery's limits are). */
export const WAITLIST_CHANGES_PER_HOUR = 10;

@Injectable()
export class WaitlistService {
  private readonly changes = new Limit(WAITLIST_CHANGES_PER_HOUR, 3_600_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invites: InviteService,
  ) {}

  /** GET /beta/waitlist: whether this email is on the list. */
  async state(who: Identity): Promise<WaitlistState> {
    const row = await this.prisma.waitlistEntry.findUnique({ where: { match: inviteMatch(who.email) } });
    return row ? { on: true, email: row.email, askedAt: row.askedAt.toISOString() } : { on: false, email: who.email, askedAt: null };
  }

  /** POST /beta/waitlist: on the list (again: as it was, its first ask kept). 400 when the email gets in already. */
  async join(who: Identity): Promise<WaitlistState> {
    this.count(who);
    // Invited, an admin, or the closed beta off: there is nothing to wait for.
    if (await this.invites.allowed(who.email)) throw badRequest("You can make games already. Reload the page to start.");
    const match = inviteMatch(who.email);
    try {
      await this.prisma.waitlistEntry.upsert({ where: { match }, create: { match, email: who.email }, update: {} });
    } catch (e) {
      // The same email asked twice at once: the other request made the row.
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
    return this.state(who);
  }

  /** DELETE /beta/waitlist: off the list (again: as it was). */
  async leave(who: Identity): Promise<WaitlistState> {
    this.count(who);
    await this.prisma.waitlistEntry.deleteMany({ where: { match: inviteMatch(who.email) } });
    return { on: false, email: who.email, askedAt: null };
  }

  /** 429 past the hour's changes for this email; otherwise counts this one. */
  private count(who: Identity) {
    const key = inviteMatch(who.email);
    if (!this.changes.has(key)) throw new ApiException(429, "too_many", "That's a lot of changes to the list in an hour. Try again later.");
    this.changes.take(key);
  }
}
