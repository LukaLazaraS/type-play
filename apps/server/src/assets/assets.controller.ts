// The Assets tab's routes of the contract (packages/shared/src/index.ts, "the Assets tab"): a version's list, and each
// asset's file (Download), picture and thumbnail, for the game's owner only.
import { createReadStream } from "node:fs";
import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import type { GameAssets } from "@typeplay/shared";
import { CurrentUser } from "../auth/auth.guard.js";
import type { User } from "../generated/prisma/client.js";
import { type AssetForm, AssetsService } from "./assets.service.js";

/**
 * Streams a kept file: never cached by anything shared, never sniffed as anything but its type, and sandboxed should
 * anyone open it as a page (the files are the game agent's).
 */
function send(res: Response, f: { path: string; size: number; type: string; name: string }, form: AssetForm) {
  res.writeHead(200, {
    "Content-Type": f.type,
    "Content-Length": f.size,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": form === "file" ? `attachment; filename="${f.name}"` : "inline",
  });
  createReadStream(f.path)
    .on("error", () => res.destroy())
    .pipe(res);
}

@Controller("projects/:id/assets")
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get(":buildId")
  list(@CurrentUser() user: User, @Param("id") id: string, @Param("buildId") buildId: string): Promise<GameAssets> {
    return this.assets.list(user, id, buildId);
  }

  @Get(":buildId/:assetId")
  async file(@CurrentUser() user: User, @Param("id") id: string, @Param("buildId") buildId: string, @Param("assetId") assetId: string, @Res() res: Response) {
    send(res, await this.assets.file(user, id, buildId, assetId, "file"), "file");
  }

  @Get(":buildId/:assetId/picture")
  async picture(@CurrentUser() user: User, @Param("id") id: string, @Param("buildId") buildId: string, @Param("assetId") assetId: string, @Res() res: Response) {
    send(res, await this.assets.file(user, id, buildId, assetId, "picture"), "picture");
  }

  @Get(":buildId/:assetId/thumb")
  async thumb(@CurrentUser() user: User, @Param("id") id: string, @Param("buildId") buildId: string, @Param("assetId") assetId: string, @Res() res: Response) {
    send(res, await this.assets.file(user, id, buildId, assetId, "thumb"), "thumb");
  }
}
