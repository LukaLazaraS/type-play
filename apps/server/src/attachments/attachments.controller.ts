// The pictures' routes of the contract (packages/shared/src/index.ts, "Pictures"): upload one, take back one not sent,
// and fetch one (the clean picture or its thumbnail), each for its owner only.
import { createReadStream } from "node:fs";
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import type { Attachment } from "@typeplay/shared";
import { CurrentUser } from "../auth/auth.guard.js";
import type { User } from "../generated/prisma/client.js";
import { AttachmentsService } from "./attachments.service.js";

/** Streams a picture file: never cached by anything shared, never sniffed as anything but a picture. */
function sendPicture(res: Response, f: { path: string; type: string; size: number }) {
  res.writeHead(200, {
    "Content-Type": f.type,
    "Content-Length": f.size,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  });
  createReadStream(f.path)
    .on("error", () => res.destroy())
    .pipe(res);
}

@Controller("attachments")
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  /** The picture's bytes are the body (main.ts reads them raw, at most 10 MB); 201 with its id, size and format. */
  @Post()
  @HttpCode(201)
  upload(@CurrentUser() user: User, @Body() body: unknown): Promise<Attachment> {
    return this.attachments.upload(user, body);
  }

  @Delete(":id")
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param("id") id: string): Promise<{ ok: true }> {
    return this.attachments.remove(user, id);
  }

  @Get(":id")
  async full(@CurrentUser() user: User, @Param("id") id: string, @Res() res: Response) {
    sendPicture(res, await this.attachments.file(user, id, "full"));
  }

  @Get(":id/thumb")
  async thumb(@CurrentUser() user: User, @Param("id") id: string, @Res() res: Response) {
    sendPicture(res, await this.attachments.file(user, id, "thumb"));
  }
}
