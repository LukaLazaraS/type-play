// POST /webhooks/paddle (docs/payments-design.md §6): verify the signature on the raw body, store the
// event, answer { ok: true } within Paddle's 5 s, and let the inbox apply it. No sign-in (@Public):
// the signature is the check. 401 bad signature, 400 bad JSON or envelope, 503 while billing is off,
// 500 when the database is down (Paddle retries: 60 times over 3 days live, 3 in 15 min sandbox).
import { Controller, Headers, HttpCode, Logger, Post, Req, type RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../auth/auth.guard.js";
import { ApiException, badRequest } from "../common/api-error.js";
import { config } from "../env.js";
import { InboxService } from "./inbox.service.js";
import { PaddleService } from "./paddle.service.js";
import { LOG_SKEW_S, verifySignature } from "./paddle.signature.js";
import type { PaddleEnvelope } from "./paddle.types.js";

const ID = /^[A-Za-z0-9_-]{1,120}$/;

/** The documented envelope, or null. */
export function parseEnvelope(body: unknown): PaddleEnvelope | null {
  const b = (body && typeof body === "object" ? body : null) as Record<string, unknown> | null;
  if (!b) return null;
  const { event_id, event_type, occurred_at, notification_id, data } = b;
  if (typeof event_id !== "string" || !ID.test(event_id)) return null;
  if (typeof event_type !== "string" || !/^[a-z_]+\.[a-z_]+$/.test(event_type)) return null;
  if (typeof notification_id !== "string" || !ID.test(notification_id)) return null;
  if (typeof occurred_at !== "string" || Number.isNaN(Date.parse(occurred_at))) return null;
  if (!data || typeof data !== "object") return null;
  return { event_id, event_type, occurred_at, notification_id, data };
}

@Controller("webhooks")
@Public()
export class WebhooksController {
  private readonly log = new Logger("webhooks");

  constructor(
    private readonly paddle: PaddleService,
    private readonly inbox: InboxService,
  ) {}

  @Post("paddle")
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>, @Headers("paddle-signature") signature?: string): Promise<{ ok: true }> {
    if (this.paddle.mode === "off" || !config.paddle.webhookSecret) {
      throw new ApiException(503, "billing_off", "Payments are off on this server (no PADDLE_WEBHOOK_SECRET).");
    }
    const raw = req.rawBody;
    if (!raw?.length) throw badRequest("No body.");
    const check = verifySignature(raw, signature, [config.paddle.webhookSecret, config.paddle.webhookSecretPrevious]);
    if (!check.ok) {
      this.log.warn(`refused: ${check.why}`);
      throw new ApiException(401, "unauthorized", "Bad signature.");
    }
    if (check.skewS > LOG_SKEW_S) this.log.warn(`signature timestamp ${check.skewS} s from our clock (is NTP running?)`);
    const envelope = parseEnvelope(req.body);
    if (!envelope) throw badRequest("Not a Paddle event.");
    const stored = await this.inbox.store(envelope);
    this.log.log(`${envelope.event_type} ${envelope.event_id}${stored.inserted ? "" : ` (delivered again, ${stored.status})`}`);
    if (stored.status === "received") this.inbox.kick();
    return { ok: true };
  }
}
