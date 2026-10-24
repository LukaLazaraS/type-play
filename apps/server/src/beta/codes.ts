// Beta codes (Luka, 2026-10-24): six digits a tester types on the closed-beta page instead of being invited by address.
// A right code works like an invite for the signed-in email (an Invite row with the code; the account is made then, as
// at any first sign-in, with the Free plan's credits) and adds the code's credits once. Wrong codes are limited per email
// and in all (config.betaCodeTriesPerHour, betaCodeTriesPerHourAll), so six digits can't be guessed from one account or
// from many. `admin code add | list | remove` (admin-codes.ts); `admin invite add` works as before.
import { Injectable } from "@nestjs/common";
import type { BetaCodeResult } from "@typeplay/shared";
import { AuthService, type Identity } from "../auth/auth.service.js";
import { ApiException, badRequest } from "../common/api-error.js";
import { toTenths } from "../credits/credits.js";
import { LedgerService } from "../credits/ledger.service.js";
import { config } from "../env.js";
import { PrismaService } from "../prisma.js";
import { InviteService, inviteMatch } from "./invites.js";

const HOUR = 3_600_000;
/** What a ledger row and the account's credit history call these credits. */
export const BETA_CODE_NOTE = "Beta code";

const wrongCode = (message: string) => new ApiException(403, "code_wrong", message);
const minutes = (n: number) => `${n} minute${n === 1 ? "" : "s"}`;

@Injectable()
export class BetaCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly auth: AuthService,
    private readonly invites: InviteService,
  ) {}

  /** POST /beta/code: 200 with the credits it added; 400 not six digits, 403 code_wrong, 429 too_many. */
  async redeem(who: Identity, body: unknown): Promise<BetaCodeResult> {
    const raw = (body as { code?: unknown } | null)?.code;
    const code = typeof raw === "string" ? raw.replace(/[\s-]+/g, "") : "";
    if (!/^\d{6}$/.test(code)) throw badRequest("Type the 6 digits from your invitation.");
    const match = inviteMatch(who.email);

    // Already in (the closed beta is off, an admin, invited): nothing is used up; credits a failed request left are added.
    if (await this.invites.allowed(who.email)) return { credits: await this.grantDue(who, match) };

    const now = Date.now();
    const mine = await this.prisma.betaCodeTry.findMany({ where: { match, at: { gt: new Date(now - HOUR) } }, orderBy: { at: "asc" }, select: { at: true } });
    const limit = config.betaCodeTriesPerHour;
    if (mine.length >= limit) {
      const frees = mine[mine.length - limit].at.getTime() + HOUR;
      throw new ApiException(429, "too_many", `Too many wrong codes. Try again in ${minutes(Math.max(1, Math.ceil((frees - now) / 60_000)))}.`);
    }
    if ((await this.prisma.betaCodeTry.count({ where: { at: { gt: new Date(now - HOUR) } } })) >= config.betaCodeTriesPerHourAll) {
      throw new ApiException(429, "too_many", "It's not you: too many wrong codes were typed on TypePlay this hour. Please try again in an hour.");
    }
    const left = limit - mine.length - 1;
    // After the last try: when the oldest of this hour's tries stops counting (this one, when it is the only one).
    const nextTry = minutes(Math.max(1, Math.ceil(((mine[0]?.at.getTime() ?? now) + HOUR - now) / 60_000)));
    const wrong = async (message: string) => {
      await this.prisma.betaCodeTry.deleteMany({ where: { at: { lt: new Date(now - 24 * HOUR) } } });
      await this.prisma.betaCodeTry.create({ data: { match } });
      return wrongCode(message);
    };

    const row = await this.prisma.betaCode.findUnique({ where: { code } });
    if (!row || row.removedAt) {
      throw await wrong(
        left > 0
          ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left this hour.`
          : `That code isn't right, and that was the last try for now. Try again in ${nextTry}.`,
      );
    }
    if (await this.prisma.betaCodeUse.findUnique({ where: { code_match: { code, match } } })) {
      throw wrongCode("This account has used that code already. Write to hello@typeplay.app for a new one.");
    }
    if (row.used >= row.uses) throw await wrong("That code has been used up. Write to hello@typeplay.app for a new one.");

    // One statement checks and raises the count, so the last use can't go to two people at once.
    let taken = false;
    try {
      taken = await this.prisma.$transaction(async (tx) => {
        const n = await tx.$executeRaw`UPDATE "BetaCode" SET used = used + 1 WHERE code = ${code} AND "removedAt" IS NULL AND used < uses`;
        if (n !== 1) return false;
        await tx.betaCodeUse.create({ data: { code, match, credits: row.credits } });
        await tx.invite.upsert({
          where: { match },
          create: { email: who.email, match, note: `code ${code}`, code, usedAt: new Date() },
          update: { code, usedAt: new Date() },
        });
        return true;
      });
    } catch (e) {
      // The same account sent the code twice at once: the other request let it in.
      if ((e as { code?: string }).code !== "P2002") throw e;
      return { credits: await this.grantDue(who, match) };
    }
    if (!taken) throw await wrong("That code has been used up. Write to hello@typeplay.app for a new one.");
    return { credits: await this.grantDue(who, match) };
  }

  /** The account (made now if new, as at any first sign-in) gets the credits of its codes that weren't added yet. */
  private async grantDue(who: Identity, match: string): Promise<number> {
    const due = await this.prisma.betaCodeUse.findMany({ where: { match, grantedAt: null } });
    if (!due.length) return 0;
    const user = await this.auth.ensureUser(who);
    let added = 0;
    for (const use of due) {
      await this.ledger.withUser(user.id, async (tx) => {
        const claimed = await tx.betaCodeUse.updateMany({ where: { id: use.id, grantedAt: null }, data: { grantedAt: new Date() } });
        if (claimed.count !== 1) return;
        if (use.credits > 0) await this.ledger.grantIn(tx, user.id, { source: "admin", tenths: toTenths(use.credits), expiresAt: null, note: BETA_CODE_NOTE });
        await this.ledger.audit(tx, { actor: "user", userId: user.id, action: "beta_code", details: { code: use.code, credits: use.credits } });
        added += use.credits;
      });
    }
    return added;
  }
}
