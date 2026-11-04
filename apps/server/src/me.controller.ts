// GET /me, GET /estimate, and the account page: the credit history, the data export, closing the account; PATCH /me for
// what the player sets on their account ("Ask me first", 2026-11-04).
import { Body, Controller, Delete, Get, HttpCode, Patch, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import type { Effort, Estimate, Me, ModelChoice, PlanId, UsagePage } from "@typeplay/shared";
import { AccessService, payerOf } from "./access/access.service.js";
import { AccountService } from "./account/account.service.js";
import { AndroidService } from "./android/android.service.js";
import { CurrentUser } from "./auth/auth.guard.js";
import { AuthService } from "./auth/auth.service.js";
import { NO_SIGNUP_CREDITS_NOTICE } from "./auth/tombstone.js";
import { BillingService } from "./billing/billing.service.js";
import { badRequest } from "./common/api-error.js";
import { EFFORTS, estimate, MODELS, planModels } from "./credits/credits.js";
import { CreditsService } from "./credits/credits.service.js";
import type { User } from "./generated/prisma/client.js";
import { PrismaService } from "./prisma.js";

@Controller()
export class MeController {
  constructor(
    private readonly credits: CreditsService,
    private readonly account: AccountService,
    private readonly auth: AuthService,
    private readonly billing: BillingService,
    private readonly android: AndroidService,
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  @Get("me")
  async me(@CurrentUser() signedIn: User): Promise<Me> {
    // Settled first: an expiry, the Free month or a lapsed plan that fell due shows in this same answer.
    const user = await this.credits.settled(signedIn);
    const plan = user.plan as PlanId;
    const me: Me = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      plan,
      models: planModels(plan),
      credits: await this.credits.balance(user),
      billing: this.billing.meBilling(user),
      features: { android: this.android.enabled },
      askFirst: { new: user.askFirstNew, edit: user.askFirstEdit },
    };
    // A Free account that signed up without the free credits (its email closed an account lately).
    if (plan === "free" && (await this.auth.closedRecently(user.email))) me.notice = NO_SIGNUP_CREDITS_NOTICE;
    return me;
  }

  /** What the player sets on their account: "Ask me first" as they leave the tick (on /create, in a game's chat). */
  @Patch("me")
  @HttpCode(200)
  async update(@CurrentUser() user: User, @Body() body: unknown): Promise<Me> {
    const b = (body && typeof body === "object" ? body : {}) as { askFirst?: unknown };
    const a = b.askFirst && typeof b.askFirst === "object" ? (b.askFirst as Record<string, unknown>) : null;
    if (!a || (a.new === undefined && a.edit === undefined)) throw badRequest("Say what to change: askFirst.new or askFirst.edit.");
    if ((a.new !== undefined && typeof a.new !== "boolean") || (a.edit !== undefined && typeof a.edit !== "boolean")) throw badRequest("askFirst's values are true or false.");
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { ...(a.new !== undefined ? { askFirstNew: a.new as boolean } : {}), ...(a.edit !== undefined ? { askFirstEdit: a.edit as boolean } : {}) },
    });
    return this.me(updated);
  }

  /** `game`: for a message to that game (pair developing): the numbers by its owner's plan, who pays for it. */
  @Get("estimate")
  async estimate(@CurrentUser() user: User, @Query("kind") kind: string, @Query("model") model: string, @Query("effort") effort?: string, @Query("game") game?: string): Promise<Estimate> {
    if (kind !== "new" && kind !== "edit") throw badRequest("kind is new or edit.");
    if (!MODELS.includes(model as ModelChoice)) throw badRequest("model is fast, smart or best.");
    if (effort !== undefined && !EFFORTS.includes(effort as Effort)) throw badRequest("effort is low, medium or high.");
    let plan = user.plan as PlanId;
    if (game !== undefined) {
      const { project } = await this.access.game(user.id, game, "edit");
      plan = (await this.prisma.user.findUniqueOrThrow({ where: { id: payerOf(project) }, select: { plan: true } })).plan as PlanId;
    }
    return estimate(kind, model as ModelChoice, plan, (effort as Effort | undefined) ?? "medium");
  }

  /** Every credit added or spent, newest first, a page at a time. */
  @Get("me/usage")
  usage(@CurrentUser() user: User, @Query("cursor") cursor?: string, @Query("limit") limit?: string): Promise<UsagePage> {
    const n = limit === undefined ? 25 : Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 100) throw badRequest("limit is 1 to 100.");
    return this.credits.history(user, cursor || null, n);
  }

  /** The account's data as a JSON file. */
  @Get("me/export")
  async export(@CurrentUser() user: User, @Res() res: Response) {
    const data = Buffer.from(JSON.stringify(await this.account.export(user), null, 2) + "\n");
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": data.length,
      "Content-Disposition": `attachment; filename="typeplay-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    });
    res.end(data);
  }

  /** Closes the account: every game, the credit history and the sign-in record. */
  @Delete("me")
  @HttpCode(200)
  close(@CurrentUser() user: User, @Body() body: unknown): Promise<{ ok: true }> {
    return this.account.close(user, body);
  }
}
