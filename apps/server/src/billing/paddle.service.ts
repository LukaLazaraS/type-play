// Billing's switch and catalog (docs/payments-design.md §5, §10): the mode (off / sandbox / live), the
// Paddle client, which price id sells what, and the cross-check at start: each configured price is
// fetched from Paddle and compared with credits.ts (amount, currency, cycle, custom_data.credits). A
// mismatch refuses to start; Paddle not answering leaves billing "not ready" (503 billing_off) until
// a retry every 5 minutes, or the next billing call, gets through.
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type { PlanId } from "@typeplay/shared";
import { ApiException } from "../common/api-error.js";
import { PACK_CREDITS, PACK_PRICE_CENTS, PLAN_CREDITS, PLAN_PRICE_CENTS, toTenths } from "../credits/credits.js";
import { config, paddleMode } from "../env.js";
import { PaddleClient, PaddleError, PaddleUnreachable } from "./paddle.client.js";
import type { PaddlePrice } from "./paddle.types.js";

export type PaidPlan = Exclude<PlanId, "free">;
export const PAID_PLANS: PaidPlan[] = ["medium", "high", "ultra", "ultraplus"];
export type CatalogItem = { kind: "plan"; plan: PaidPlan; tenths: number } | { kind: "pack"; tenths: number };

const RECHECK_MS = 5 * 60_000;
/** A billing call while not ready tries Paddle again, but not more often than this. */
const RECHECK_ON_CALL_MS = 10_000;

/** What each price must look like at Paddle (the catalog script writes exactly this). */
export function expectedPrice(item: PaidPlan | "pack"): { amount: string; credits: number; cycle: { interval: string; frequency: number } | null; custom_data: Record<string, unknown> } {
  if (item === "pack") return { amount: String(PACK_PRICE_CENTS), credits: PACK_CREDITS, cycle: null, custom_data: { pack: true, credits: PACK_CREDITS } };
  return { amount: String(PLAN_PRICE_CENTS[item]), credits: PLAN_CREDITS[item], cycle: { interval: "month", frequency: 1 }, custom_data: { plan: item, credits: PLAN_CREDITS[item] } };
}

/** One line per difference between a Paddle price and what we sell; empty when it matches. */
export function priceProblems(item: PaidPlan | "pack", p: PaddlePrice): string[] {
  const want = expectedPrice(item);
  const out: string[] = [];
  if (p.status && p.status !== "active") out.push(`status ${p.status}`);
  if (p.unit_price?.amount !== want.amount) out.push(`amount ${p.unit_price?.amount} (want ${want.amount})`);
  if (p.unit_price?.currency_code !== "USD") out.push(`currency ${p.unit_price?.currency_code} (want USD)`);
  const cycle = p.billing_cycle ? `${p.billing_cycle.interval}/${p.billing_cycle.frequency}` : "one-time";
  const wantCycle = want.cycle ? `${want.cycle.interval}/${want.cycle.frequency}` : "one-time";
  if (cycle !== wantCycle) out.push(`billing cycle ${cycle} (want ${wantCycle})`);
  if (Number(p.custom_data?.credits) !== want.credits) out.push(`custom_data.credits ${JSON.stringify(p.custom_data?.credits)} (want ${want.credits})`);
  if (item === "pack" ? p.custom_data?.pack !== true : p.custom_data?.plan !== item) out.push(`custom_data ${JSON.stringify(p.custom_data)} (want ${JSON.stringify(want.custom_data)})`);
  if (p.tax_mode && p.tax_mode !== "external") out.push(`tax_mode ${p.tax_mode} (want external)`);
  return out;
}

@Injectable()
export class PaddleService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger("paddle");
  readonly mode = paddleMode();
  readonly client = PaddleClient.fromConfig();
  /** The catalog check passed (false while Paddle doesn't answer; never true when the mode is off). */
  ready = false;
  /** Why billing is not ready when the key itself is the problem (401/403 at the catalog check); on GET /health. */
  problem: string | null = null;
  private lastTry = 0;
  private timer: NodeJS.Timeout | null = null;
  private readonly byId = new Map<string, CatalogItem>();

  constructor() {
    const p = config.paddle.prices;
    for (const plan of PAID_PLANS) if (p[plan]) this.byId.set(p[plan], { kind: "plan", plan, tenths: toTenths(PLAN_CREDITS[plan]) });
    if (p.pack) this.byId.set(p.pack, { kind: "pack", tenths: toTenths(PACK_CREDITS) });
  }

  async onModuleInit() {
    if (this.mode === "off") {
      this.log.log("billing off (no PADDLE_ENV / PADDLE_API_KEY)");
      return;
    }
    await this.check(true);
    this.timer = setInterval(() => void this.check(false).catch(() => {}), RECHECK_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  /** The price id of a plan or the pack. */
  priceIdFor(item: PaidPlan | "pack"): string {
    return config.paddle.prices[item];
  }

  /** What a Paddle price sells, or null for one we don't know (parked, never guessed). */
  priceOf(priceId: string): CatalogItem | null {
    return this.byId.get(priceId) ?? null;
  }

  tenthsOfPrice = (priceId: string): number | null => this.priceOf(priceId)?.tenths ?? null;

  /**
   * The client, when billing is on and Paddle answered the catalog check; otherwise 503 billing_off
   * (after one fresh try when the last one is older than 10 s).
   */
  async require(): Promise<PaddleClient> {
    if (this.mode === "off" || !this.client) throw new ApiException(503, "billing_off", "Payments aren't available on this server.");
    if (!this.ready && Date.now() - this.lastTry > RECHECK_ON_CALL_MS) await this.check(false).catch(() => {});
    if (!this.ready) throw new ApiException(503, "billing_off", "Payments aren't available right now. Try again in a few minutes.");
    return this.client;
  }

  /**
   * Fetches the five prices and compares them with credits.ts. A mismatch throws (at start: the API
   * refuses to run with a catalog that sells something else). Paddle not answering, or refusing the
   * key (401, or 403 for a key that expired, was revoked or lacks a permission): `ready` stays false,
   * billing answers 503 and the rest of the API runs; the error is swallowed unless `atStart` asks
   * for the log line. A refused key needs a new one in .env and a restart, so it is logged as an error.
   */
  async check(atStart: boolean): Promise<void> {
    if (!this.client) return;
    this.lastTry = Date.now();
    const wasReady = this.ready;
    const problems: string[] = [];
    try {
      for (const item of [...PAID_PLANS, "pack" as const]) {
        const id = this.priceIdFor(item);
        let price: PaddlePrice;
        try {
          price = await this.client.get<PaddlePrice>(`/prices/${encodeURIComponent(id)}`);
        } catch (e) {
          if (e instanceof PaddleError && e.status === 404) {
            problems.push(`${item}: price ${id} not found at Paddle (${this.mode})`);
            continue;
          }
          throw e;
        }
        for (const p of priceProblems(item, price)) problems.push(`${item} (${id}): ${p}`);
      }
    } catch (e) {
      const refused = e instanceof PaddleError && (e.status === 401 || e.status === 403);
      if (e instanceof PaddleUnreachable || refused) {
        this.ready = false;
        if (refused) {
          const hadProblem = this.problem !== null;
          this.problem = `the key was refused (${e.status} ${e.code}): check PADDLE_API_KEY, its permissions and its expiry (Paddle keys expire, 90 days by default), then restart the API`;
          if (atStart || wasReady || !hadProblem) this.log.error(`catalog check: ${this.problem}; billing answers 503 billing_off meanwhile (GET /health billing.problem), the rest of the API runs`);
        } else if (atStart || wasReady) {
          this.log.warn(`catalog check: ${e.message}; billing answers 503 until the next try (every 5 min)`);
        }
        return;
      }
      throw e;
    }
    if (problems.length) {
      this.ready = false;
      throw new Error(`Paddle's ${this.mode} catalog does not match credits.ts:\n  ${problems.join("\n  ")}\nFix the prices at Paddle or the ids in .env (npm run paddle:catalog).`);
    }
    if (!this.ready) this.log.log(`billing ${this.mode}: the five prices match credits.ts`);
    this.ready = true;
    this.problem = null;
  }
}
