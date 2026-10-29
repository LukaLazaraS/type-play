// Web Push (notifications, 2026-10-29): the devices that turned notifications on (PushSubscription rows), and a build's
// end sent to each of them, encrypted for that browser (RFC 8291) and signed with our VAPID key (RFC 8292) by the web-push
// library; the request itself goes out with fetch, so it has a time limit, never follows a redirect, and reaches only a
// browser's push service (SSRF: a player chooses the address). A push service that says the address is gone (404, 410)
// or isn't ours (401, 403) gets the row deleted; a busy one (429, 5xx) or a network error gets one more try. Never throws
// into a run: what can't be sent is logged by the push service's host, never by the address (it works like a password).
import { setTimeout as sleep } from "node:timers/promises";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { PushSubscriptionBody, RunNotice } from "@typeplay/shared";
import webpush, { type RequestDetails } from "web-push";
import { badRequest } from "../common/api-error.js";
import { config } from "../env.js";
import type { PushSubscription, User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";

/** The browsers' push services (https, port 443): Chrome and most others (FCM), Firefox, Edge on Windows, Safari and iOS. */
const SERVICES = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];
/** Devices an account keeps at most: a new one past it replaces the oldest. */
export const MAX_DEVICES = 20;
/** How long a push service keeps a push for a device that is off (then it is dropped): a build's end is news for a day. */
const TTL_S = 24 * 60 * 60;
const TIMEOUT_MS = 10_000;
/** The longest wait before the one retry, whatever Retry-After says. */
const RETRY_MAX_MS = 10_000;

/** The push service's host when `endpoint` is one we send to (null: refused); http on this PC only with PUSH_ALLOW_LOCAL. */
export function pushServiceOf(endpoint: string, allowLocal = config.push.allowLocal): string | null {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol === "https:" && (url.port === "" || url.port === "443") && SERVICES.some((re) => re.test(url.hostname))) return url.hostname;
  if (allowLocal && url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) return url.hostname;
  return null;
}

/** A base64url text that decodes to exactly `bytes` bytes (padding allowed, as some browsers send it). */
const keyOf = (value: unknown, bytes: number): string | null =>
  typeof value === "string" && /^[A-Za-z0-9_-]+={0,2}$/.test(value) && Buffer.from(value, "base64url").length === bytes ? value.replace(/=+$/, "") : null;

const NOT_A_DEVICE = "That isn't a browser's notification address. Turn notifications on again from your account page.";

/** POST /me/push's body, checked: a push service's https address, a P-256 public key (65 bytes, uncompressed) and a 16-byte secret. */
export function parseSubscription(body: unknown): { endpoint: string; p256dh: string; auth: string } {
  const b = (body ?? {}) as Partial<PushSubscriptionBody>;
  const endpoint = typeof b.endpoint === "string" && b.endpoint.length <= 2048 ? b.endpoint : null;
  if (!endpoint || !pushServiceOf(endpoint)) throw badRequest(NOT_A_DEVICE);
  const p256dh = keyOf(b.keys?.p256dh, 65);
  const auth = keyOf(b.keys?.auth, 16);
  if (!p256dh || Buffer.from(p256dh, "base64url")[0] !== 4 || !auth) throw badRequest(NOT_A_DEVICE);
  return { endpoint, p256dh, auth };
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly log = new Logger("push");
  /** Both VAPID keys are set (env.ts checks they are a pair): pushes go out. */
  readonly on = !!(config.push.publicKey && config.push.privateKey);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.log.log(this.on ? "notifications: Web Push on" : "notifications: Web Push off (no VAPID keys): devices are kept, nothing is sent");
  }

  /** This device turns notifications on for `user`: its row, made or moved here (a device belongs to its last account). */
  async save(user: User, body: unknown): Promise<{ ok: true }> {
    const sub = parseSubscription(body);
    await this.prisma.$transaction(async (tx) => {
      const had = await tx.pushSubscription.findUnique({ where: { endpoint: sub.endpoint }, select: { userId: true } });
      if (!had) await tx.pushSubscription.create({ data: { userId: user.id, ...sub } });
      else if (had.userId === user.id) await tx.pushSubscription.update({ where: { endpoint: sub.endpoint }, data: { p256dh: sub.p256dh, auth: sub.auth } });
      // Another account's device until now: this account's from now on, as if new.
      else await tx.pushSubscription.update({ where: { endpoint: sub.endpoint }, data: { userId: user.id, p256dh: sub.p256dh, auth: sub.auth, createdAt: new Date(), lastSentAt: null } });
      const extra = await tx.pushSubscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: MAX_DEVICES, select: { id: true } });
      if (extra.length) await tx.pushSubscription.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } });
    });
    return { ok: true };
  }

  /**
   * This device turns notifications off (or signs out): its row goes, whichever account had it. The address itself is the
   * proof: only that browser (and its push service) knows it, and a device whose account changed must be able to drop
   * the old account's row.
   */
  async remove(body: unknown): Promise<{ ok: true }> {
    const endpoint = (body as { endpoint?: unknown } | null)?.endpoint;
    if (typeof endpoint !== "string" || !endpoint || endpoint.length > 2048) throw badRequest("Say which device: its notification address.");
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { ok: true };
  }

  /** The devices of an account for its data export: when each was turned on, and its push service. */
  async exportFor(userId: string): Promise<{ addedAt: string; service: string }[]> {
    const rows = await this.prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { endpoint: true, createdAt: true } });
    return rows.map((r) => ({ addedAt: r.createdAt.toISOString(), service: pushServiceOf(r.endpoint, true) ?? "unknown" }));
  }

  /** A build's end to every device of the account that turned notifications on. Never throws. */
  async send(userId: string, notice: RunNotice): Promise<void> {
    if (!this.on) return;
    try {
      const devices = await this.prisma.pushSubscription.findMany({ where: { userId } });
      if (!devices.length) return;
      // `tag`: one notification per build end on a device, however often it arrives (service worker, apps/web/public/sw.js).
      const payload = JSON.stringify({ v: 1, ...notice, tag: `run-${notice.messageId}` });
      // A newer end of the same game replaces one a device hasn't received yet (RFC 8030 Topic: 32 url-safe letters at most).
      const topic = `game-${notice.projectId}`.slice(0, 32);
      await Promise.all(devices.map((d) => this.deliver(d, payload, topic)));
    } catch (e) {
      this.log.error(`push for ${notice.projectId}: ${(e as Error).message}`);
    }
  }

  private async deliver(device: PushSubscription, payload: string, topic: string) {
    const host = pushServiceOf(device.endpoint);
    if (!host) return this.drop(device, "not a push service we send to");
    let request: RequestDetails;
    try {
      request = webpush.generateRequestDetails({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, payload, {
        vapidDetails: { subject: config.push.subject, publicKey: config.push.publicKey, privateKey: config.push.privateKey },
        TTL: TTL_S,
        urgency: "high",
        topic,
        contentEncoding: "aes128gcm",
      });
    } catch (e) {
      return this.drop(device, `its keys don't encrypt (${(e as Error).message})`);
    }
    // fetch works out the length of the body itself.
    const headers = Object.fromEntries(Object.entries(request.headers).filter(([k]) => k.toLowerCase() !== "content-length"));
    for (let attempt = 1; ; attempt++) {
      let status = 0;
      let retryAfterS = 0;
      try {
        const res = await fetch(request.endpoint, { method: "POST", headers, body: request.body, redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
        status = res.status;
        retryAfterS = Number(res.headers.get("retry-after")) || 0;
        await res.arrayBuffer().catch(() => {});
      } catch {
        // offline, refused, a redirect, or past the time limit: status 0
      }
      if (status >= 200 && status < 300) {
        await this.prisma.pushSubscription.updateMany({ where: { id: device.id }, data: { lastSentAt: new Date() } });
        return;
      }
      if (status === 401 || status === 403 || status === 404 || status === 410) return this.drop(device, `${host} answered ${status}`);
      if (attempt < 2 && (status === 0 || status === 429 || status >= 500)) {
        await sleep(Math.min(retryAfterS * 1000 || 3000, RETRY_MAX_MS));
        continue;
      }
      this.log.warn(`device ${device.id} (${host}): not sent, ${status ? `${host} answered ${status}` : "no answer"}`);
      return;
    }
  }

  /** A device that can't get pushes any more (expired, unsubscribed, made with another key): its row goes. */
  private async drop(device: PushSubscription, why: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { id: device.id } }).catch(() => {});
    this.log.log(`device ${device.id} removed: ${why}`);
  }
}
