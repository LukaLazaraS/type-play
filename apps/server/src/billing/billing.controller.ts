// The billing routes of the contract (packages/shared/src/index.ts, payments part 3): each one maps
// onto billing.service.ts. The service answers 503 billing_off when payments are off for this user
// (no keys, or sandbox billing on the live site for someone not in ADMIN_EMAILS) and 403
// billing_hold after a chargeback; bodies and query strings are checked here, with plain 400s.
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import type { BillingInfo, CheckoutStatus, PlanChangePreview, PortalLinks } from "@typeplay/shared";
import { CurrentUser } from "../auth/auth.guard.js";
import { CreditsService } from "../credits/credits.service.js";
import type { User } from "../generated/prisma/client.js";
import { BillingService, parseCheckout, parsePlan } from "./billing.service.js";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly credits: CreditsService,
  ) {}

  /** The plan, the subscription, the credits by part, the payments and the consent record. */
  @Get()
  async info(@CurrentUser() signedIn: User): Promise<BillingInfo> {
    // Settled first, like GET /me: an expiry or a lapsed plan that fell due shows in this same answer.
    return this.billing.info(await this.credits.settled(signedIn));
  }

  /** A Paddle transaction for the overlay, with the tick box's version and time recorded. */
  @Post("checkout")
  @HttpCode(201)
  checkout(@CurrentUser() user: User, @Body() body: unknown): Promise<{ transactionId: string }> {
    const { item, consent } = parseCheckout(body);
    return this.billing.createCheckout(user, item, consent);
  }

  @Get("checkout/:id")
  status(@CurrentUser() user: User, @Param("id") id: string): Promise<CheckoutStatus> {
    return this.billing.checkoutStatus(user, id);
  }

  /** No webhook yet: ask Paddle for the transaction and apply it here. */
  @Post("checkout/:id/verify")
  @HttpCode(200)
  verify(@CurrentUser() user: User, @Param("id") id: string): Promise<CheckoutStatus> {
    return this.billing.verifyCheckout(user, id);
  }

  @Get("plan-change")
  async preview(@CurrentUser() user: User, @Query("plan") plan?: string): Promise<PlanChangePreview> {
    const p = await this.billing.previewPlanChange(user, parsePlan(plan));
    return { direction: p.direction, chargeNowUsd: p.chargeNowUsd, taxNowUsd: p.taxNowUsd, creditsNow: p.creditsNow, nextRenewalUsd: p.nextRenewalUsd, effectiveAt: p.effectiveAt };
  }

  @Post("plan-change")
  @HttpCode(200)
  change(@CurrentUser() user: User, @Body() body: unknown): Promise<PlanChangePreview> {
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    return this.billing.applyPlanChange(user, parsePlan(b.plan));
  }

  @Delete("plan-change")
  @HttpCode(200)
  async undo(@CurrentUser() user: User): Promise<{ ok: true }> {
    await this.billing.undoPlanChange(user);
    return { ok: true };
  }

  @Post("cancel")
  @HttpCode(200)
  cancel(@CurrentUser() user: User): Promise<{ cancelsAt: string | null }> {
    return this.billing.cancel(user);
  }

  /** "Keep my plan". */
  @Delete("cancel")
  @HttpCode(200)
  async keep(@CurrentUser() user: User): Promise<{ ok: true }> {
    await this.billing.keep(user);
    return { ok: true };
  }

  @Post("portal")
  @HttpCode(200)
  portal(@CurrentUser() user: User): Promise<PortalLinks> {
    return this.billing.portal(user);
  }
}
