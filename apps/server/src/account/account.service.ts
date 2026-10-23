// The account page's server side: the data export and closing the account (privacy policy:
// "You can see, export or delete your data from your account").
import { Injectable, Logger } from "@nestjs/common";
import type { AccountExport, PlanId } from "@typeplay/shared";
import { AndroidService } from "../android/android.service.js";
import { AuthService } from "../auth/auth.service.js";
import { BillingService } from "../billing/billing.service.js";
import { badRequest } from "../common/api-error.js";
import { CreditsService } from "../credits/credits.service.js";
import type { User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { ProjectsService } from "../projects/projects.service.js";
import { ProjectViews } from "../projects/views.js";

/** Supabase user ids are UUIDs; dev-only test users ("dev-<slug>") have no sign-in record there. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AccountService {
  private readonly log = new Logger("account");

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly credits: CreditsService,
    private readonly projects: ProjectsService,
    private readonly views: ProjectViews,
    private readonly billing: BillingService,
    private readonly android: AndroidService,
  ) {}

  /** Everything we keep about the account, for the "Download my data" file. */
  async export(user: User): Promise<AccountExport> {
    const ids = await this.prisma.project.findMany({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
    const games: AccountExport["games"] = [];
    for (const { id } of ids) {
      const android = await this.android.exportFor(id);
      games.push({ ...(await this.views.full(id)), ...(android ? { android } : {}) });
    }
    const feedback = await this.prisma.feedback.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        plan: user.plan as PlanId,
        createdAt: user.createdAt.toISOString(),
      },
      credits: { available: (await this.credits.balance(user)).available, entries: await this.credits.all(user) },
      games,
      payments: await this.billing.exportPayments(user.id),
      billing: user.paddleSubscriptionId
        ? { subscriptionStatus: user.subscriptionStatus, periodEndsAt: user.periodEndsAt?.toISOString() ?? null, cancelsAt: user.cancelsAt?.toISOString() ?? null, paymentMethod: user.paymentMethod }
        : null,
      feedback: feedback.map((f) => ({
        id: f.id,
        at: f.createdAt.toISOString(),
        page: f.page,
        text: f.text,
        expected: f.expected,
        gameId: f.projectId,
        messageId: f.messageId,
        browser: f.browser,
        done: !!f.doneAt,
      })),
      notes: [
        "Your games' files (code, scenes and art) are not in this file: download each game as a .zip from its page on typeplay.app.",
        "Your name, email and picture come from your Google sign-in.",
        "payments: our record of each payment, with the tick box you ticked at that checkout (its wording version and the time). Invoices and receipts are kept by Paddle, our reseller: the billing page links to them, or write to hello@typeplay.app.",
        "Server logs (kept up to 90 days) are not in this file. Write to hello@typeplay.app if you want them.",
        "Your Android signing keys are not in this file: download each one from its game's Android page. We keep an encrypted copy to build your app; Google holds the app signing key.",
      ],
    };
  }

  /**
   * Closes the account for good: stops its builds, deletes every game (rows, files, published
   * builds, share pages, run logs), the credit ledger, the user row and the Google sign-in record
   * in Supabase. What stays is the tombstone (auth/tombstone.ts: the old id for 2 hours, the email
   * scrambled for 90 days); payment records live at Paddle (the merchant of record).
   */
  async close(user: User, body: unknown): Promise<{ ok: true }> {
    if ((body as { confirm?: unknown } | null)?.confirm !== "DELETE") throw badRequest("Type DELETE to confirm.");
    // A live subscription is cancelled at Paddle first (at once); when that can't be done now (Paddle's
    // lock before a renewal, Paddle not answering) the close is refused and nothing has changed.
    await this.billing.cancelForClose(user);
    // From here on the account's old sign-in tokens are refused (and a second tab can't start a game).
    await this.auth.forget(user);
    try {
      const ids = await this.prisma.project.findMany({ where: { ownerId: user.id }, select: { id: true } });
      for (const { id } of ids) await this.projects.removeGame(id);
      // The user row last: its credit entries go with it (cascade), and any game started meanwhile.
      // Payments, adjustments and events stay (cards are refundable for months; records kept by law)
      // with no user on them: Payment and Adjustment by their SetNull relation, PaddleEvent here.
      await this.prisma.paddleEvent.updateMany({ where: { userId: user.id }, data: { userId: null } });
      await this.prisma.user.delete({ where: { id: user.id } });
    } catch (e) {
      await this.auth.remember(user.id).catch(() => {}); // not closed: the account works again (games already deleted stay deleted)
      throw e;
    }
    if (UUID.test(user.id)) {
      // The sign-in record (auth.users, with its Google identity and sessions: cascade). Same
      // database, so no Supabase secret key is needed on the API server.
      await this.prisma.$executeRaw`DELETE FROM auth.users WHERE id = ${user.id}::uuid`.catch((e: unknown) =>
        this.log.error(`account ${user.id} closed, but its Supabase sign-in record is left (delete it in Supabase > Authentication): ${e}`),
      );
    }
    this.log.log(`account ${user.id} closed`);
    return { ok: true };
  }
}
