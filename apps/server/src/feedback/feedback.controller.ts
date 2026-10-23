// POST /feedback (beta 1): "Send feedback" from the app. The contract's FeedbackBody; the browser's name comes from the
// request's User-Agent header.
import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../auth/auth.guard.js";
import type { User } from "../generated/prisma/client.js";
import { FeedbackService } from "./feedback.service.js";

@Controller("feedback")
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /** 201 { id }; 400 bad_request, 404 (a game that isn't yours), 429 too_many (10 a day). */
  @Post()
  @HttpCode(201)
  send(@CurrentUser() user: User, @Req() req: Request, @Body() body: unknown): Promise<{ id: string }> {
    return this.feedback.send(user, body, req.headers["user-agent"]);
  }
}
