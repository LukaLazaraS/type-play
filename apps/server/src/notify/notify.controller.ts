// Notifications (2026-10-29): a device turns them on or off (POST and DELETE /me/push), and every open page of the site
// hears the account's build ends (GET /me/events). The ends themselves come from runs.service.ts `ended`.
import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { AccountEvent, RunNotice } from "@typeplay/shared";
import { CurrentUser } from "../auth/auth.guard.js";
import { EventBus } from "../events/event-bus.js";
import type { User } from "../generated/prisma/client.js";
import { PushService } from "./push.service.js";

@Controller("me")
export class NotifyController {
  constructor(
    private readonly push: PushService,
    private readonly events: EventBus,
  ) {}

  /** This device turns notifications on (PushSubscriptionBody). */
  @Post("push")
  @HttpCode(201)
  subscribe(@CurrentUser() user: User, @Body() body: unknown): Promise<{ ok: true }> {
    return this.push.save(user, body);
  }

  /** This device turns them off, or signs out (PushEndpointBody). */
  @Delete("push")
  @HttpCode(200)
  unsubscribe(@Body() body: unknown): Promise<{ ok: true }> {
    return this.push.remove(body);
  }

  /**
   * Server-Sent Events: the account's build ends (AccountEvent), each with its event id (server ms); a comment with the
   * time now at the start and every 20 s. Last-Event-ID (a reconnect) brings the kept notices since then first.
   */
  @Get("events")
  stream(@CurrentUser() user: User, @Req() req: Request, @Res() res: Response) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    const send = (notice: RunNotice, id: number) => res.write(`id: ${id}\ndata: ${JSON.stringify({ type: "notice", notice } satisfies AccountEvent)}\n\n`);
    const tick = (what: string) => res.write(`id: ${this.events.nextId()}\n: ${what}\n\n`);
    const after = Number(req.headers["last-event-id"]);
    // Listen first, then what was missed, so nothing falls in between (a notice that is in both is sent once).
    const sent = new Set<string>();
    const once = (notice: RunNotice, id: number) => {
      if (sent.has(notice.messageId)) return;
      sent.add(notice.messageId);
      send(notice, id);
    };
    const unsubscribe = this.events.subscribeAccount(user.id, once);
    if (Number.isFinite(after) && after > 0) for (const k of this.events.noticesAfter(user.id, after)) once(k.notice, k.id);
    tick("hello");
    const heartbeat = setInterval(() => tick("heartbeat"), 20_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }
}
