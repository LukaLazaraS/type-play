// The webhook inbox (docs/payments-design.md §6): the route stores each event and answers at once;
// this loop applies them. It claims `received` rows that are due, oldest `occurred_at` first, with
// FOR UPDATE SKIP LOCKED (so a second API process could run the same loop), runs each handler under
// the user's lock, and writes the outcome: processed, ignored, parked (a person has to look), or a
// retry with backoff (60 s × 2^attempts, at most an hour; failed after 20). It runs after each store
// (setImmediate), every 30 s and at start (BILLING_JOBS=0 keeps only the first).
import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { config } from "../env.js";
import type { EventStatus, PrismaClient } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { BillingHandlers, SUBSCRIBED_EVENTS, type HandlerResult } from "./handlers.js";
import { PaddleService } from "./paddle.service.js";
import type { PaddleEnvelope } from "./paddle.types.js";

const LOOP_MS = 30_000;
const CLAIM = 50;
export const MAX_ATTEMPTS = 20;
export const backoffMs = (attempts: number) => Math.min(60_000 * 2 ** attempts, 3_600_000);

interface EventRow {
  id: string;
  type: string;
  occurredAt: Date;
  attempts: number;
  payload: PaddleEnvelope;
}

export interface InboxStats {
  received: number;
  processed: number;
  ignored: number;
  parked: number;
  failed: number;
  lastEventAt: string | null;
}

@Injectable()
export class InboxService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger("inbox");
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private again = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
    private readonly handlers: BillingHandlers,
    private readonly paddle: PaddleService,
  ) {}

  onModuleInit() {
    if (this.paddle.mode === "off" || !config.billingJobs) return;
    this.timer = setInterval(() => this.kick(), LOOP_MS);
    this.timer.unref();
    setTimeout(() => this.kick(), 3_000).unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Stores a verified event: a new row (`received`, or `ignored` for a type we don't handle), or for
   * an event seen before (a retry or a replay keeps its event_id) one more delivery, and a `failed`
   * row back to `received` with its attempts reset so a replay gets it another 20 tries. An ignored
   * event keeps its envelope only (no `data`): a customer.* or address.* payload carries an email and
   * a postal address, which has no business sitting here for good. A simulated event (ntfsimevt_…)
   * on the live account is ignored the same way: the live destination's usage type is Platform only,
   * and an edited simulation must never grant real credits.
   */
  async store(e: PaddleEnvelope): Promise<{ inserted: boolean; status: EventStatus }> {
    const simulated = this.paddle.mode === "live" && e.event_id.startsWith("ntfsimevt_");
    const handled = SUBSCRIBED_EVENTS.has(e.event_type) && !simulated;
    const status: EventStatus = handled ? "received" : "ignored";
    const payload = handled ? e : { event_id: e.event_id, event_type: e.event_type, occurred_at: e.occurred_at, notification_id: e.notification_id };
    const error = simulated ? "a simulated event on the live account: ignored (the live destination's usage type is Platform only)" : handled ? null : `${e.event_type} is not handled (the envelope is kept, the payload is not)`;
    if (simulated) this.log.warn(`${e.event_type} ${e.event_id}: ${error}`);
    const rows = await this.prisma.$queryRaw<{ inserted: boolean; status: EventStatus }[]>`
      INSERT INTO "PaddleEvent" (id, "notificationId", type, "occurredAt", "receivedAt", status, attempts, deliveries, payload, error)
      VALUES (${e.event_id}, ${e.notification_id}, ${e.event_type}, ${new Date(e.occurred_at)}, now(), ${status}::"EventStatus", 0, 1, ${JSON.stringify(payload)}::jsonb, ${error})
      ON CONFLICT (id) DO UPDATE SET
        deliveries = "PaddleEvent".deliveries + 1,
        status = CASE WHEN "PaddleEvent".status = 'failed' THEN 'received'::"EventStatus" ELSE "PaddleEvent".status END,
        attempts = CASE WHEN "PaddleEvent".status = 'failed' THEN 0 ELSE "PaddleEvent".attempts END,
        "nextTryAt" = CASE WHEN "PaddleEvent".status = 'failed' THEN NULL ELSE "PaddleEvent"."nextTryAt" END
      RETURNING (xmax = 0) AS inserted, status`;
    return rows[0];
  }

  /** Runs the loop soon (coalesced: one pass at a time, another queued while one is going). */
  kick() {
    if (this.paddle.mode === "off") return;
    if (this.running) {
      this.again = true;
      return;
    }
    setImmediate(() => void this.run());
  }

  private async run() {
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      let n: number;
      do {
        this.again = false;
        n = await this.pass();
      } while (this.again || n === CLAIM);
    } catch (e) {
      this.log.error(`inbox: ${(e as Error).stack ?? e}`);
    } finally {
      this.running = false;
      if (this.again) this.kick(); // a store landed as the loop was ending
    }
  }

  /** One pass: claim up to 50 due rows (locked for the pass), apply each, write what happened. */
  private pass(): Promise<number> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<EventRow[]>`
          SELECT id, type, "occurredAt", attempts, payload FROM "PaddleEvent"
          WHERE status = 'received' AND ("nextTryAt" IS NULL OR "nextTryAt" <= now())
          ORDER BY "occurredAt", "receivedAt" FOR UPDATE SKIP LOCKED LIMIT ${CLAIM}`;
        for (const row of rows) {
          const outcome = await this.applyRow(row, `webhook:${row.id}`);
          await tx.paddleEvent.update({ where: { id: row.id }, data: outcome });
        }
        return rows.length;
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  }

  /** The handler for one row, and the row's new state (never throws: an error becomes a retry or `failed`). The
   * handler's note (what it did, or why it was parked or ignored) is kept in `error`, which `admin events` shows. */
  private async applyRow(row: EventRow, actor: string): Promise<{ status: EventStatus; attempts: number; nextTryAt: Date | null; processedAt: Date | null; error: string | null; userId?: string | null }> {
    const attempts = row.attempts + 1;
    try {
      const result = await this.handlers.apply(row.type, row.payload.data, row.occurredAt, { eventId: row.id, actor });
      if (result.status !== "processed") this.log.warn(`${row.type} ${row.id}: ${result.status}: ${result.note}`);
      else this.log.log(`${row.type} ${row.id}: ${result.note}`);
      return { status: result.status, attempts, nextTryAt: null, processedAt: new Date(), error: result.note, userId: result.userId ?? undefined };
    } catch (e) {
      const message = ((e as Error).message ?? String(e)).slice(0, 1000);
      const failed = attempts >= MAX_ATTEMPTS;
      this.log.error(`${row.type} ${row.id}: attempt ${attempts} failed${failed ? " for good" : `, next in ${Math.round(backoffMs(attempts) / 1000)} s`}: ${message}`);
      return { status: failed ? "failed" : "received", attempts, nextTryAt: failed ? null : new Date(Date.now() + backoffMs(attempts)), processedAt: null, error: message };
    }
  }

  /** `admin retry <id>`: the handler now, whatever the row's status, as the admin; returns what it did. */
  async retry(id: string, actor: string): Promise<HandlerResult> {
    const row = await this.prisma.paddleEvent.findUnique({ where: { id } });
    if (!row) throw new Error(`no event ${id}`);
    const result = await this.handlers.apply(row.type, (row.payload as unknown as PaddleEnvelope).data, row.occurredAt, { eventId: row.id, actor });
    await this.prisma.paddleEvent.update({
      where: { id },
      data: { status: result.status, attempts: { increment: 1 }, nextTryAt: null, processedAt: new Date(), error: result.note, userId: result.userId ?? undefined },
    });
    return result;
  }

  /** For GET /health: rows by status and the newest delivery. */
  async stats(): Promise<InboxStats> {
    const rows = await this.prisma.$queryRaw<{ status: EventStatus; n: number }[]>`SELECT status, count(*)::int AS n FROM "PaddleEvent" GROUP BY status`;
    const last = await this.prisma.paddleEvent.aggregate({ _max: { receivedAt: true } });
    const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<EventStatus, number>>;
    return { received: by.received ?? 0, processed: by.processed ?? 0, ignored: by.ignored ?? 0, parked: by.parked ?? 0, failed: by.failed ?? 0, lastEventAt: last._max.receivedAt?.toISOString() ?? null };
  }
}
