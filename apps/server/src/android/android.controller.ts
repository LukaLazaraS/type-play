// The Android routes of the contract (packages/shared/src/index.ts, "Android export").
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import type { AndroidBuild, AndroidLink, AndroidState } from "@typeplay/shared";
import { CurrentUser, Public } from "../auth/auth.guard.js";
import type { User } from "../generated/prisma/client.js";
import { AndroidService } from "./android.service.js";

@Controller()
export class AndroidController {
  constructor(private readonly android: AndroidService) {}

  @Get("projects/:id/android")
  state(@CurrentUser() user: User, @Param("id") id: string): Promise<AndroidState> {
    return this.android.state(user, id);
  }

  @Post("projects/:id/android")
  @HttpCode(201)
  setup(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown): Promise<AndroidState> {
    return this.android.setup(user, id, body);
  }

  @Patch("projects/:id/android")
  @HttpCode(200)
  update(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown): Promise<AndroidState> {
    return this.android.update(user, id, body);
  }

  @Post("projects/:id/android/builds")
  @HttpCode(202)
  start(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown): Promise<AndroidBuild> {
    return this.android.startBuild(user, id, body);
  }

  @Post("projects/:id/android/builds/:bid/cancel")
  @HttpCode(200)
  cancel(@CurrentUser() user: User, @Param("id") id: string, @Param("bid") bid: string): Promise<AndroidBuild> {
    return this.android.cancelBuild(user, id, bid);
  }

  /** The signed file (the site fetches it with the sign-in header, then saves it). */
  @Get("projects/:id/android/builds/:bid/download")
  async download(@CurrentUser() user: User, @Param("id") id: string, @Param("bid") bid: string, @Res() res: Response) {
    const file = await this.android.download(user, id, bid);
    this.send(res, file);
  }

  @Post("projects/:id/android/builds/:bid/link")
  @HttpCode(200)
  link(@CurrentUser() user: User, @Param("id") id: string, @Param("bid") bid: string): Promise<AndroidLink> {
    return this.android.link(user, id, bid);
  }

  /**
   * The phone link: no sign-in, the token is the secret, good for 10 minutes. The folder store streams the file; R2
   * answers a 302 to a presigned URL made now (never cached: the next visit gets a fresh one, inside the link's window).
   */
  @Get("android/dl/:token")
  @Public()
  async byToken(@Param("token") token: string, @Res() res: Response) {
    const target = await this.android.downloadByToken(String(token ?? "").slice(0, 100));
    if ("redirect" in target) {
      res.writeHead(302, { Location: target.redirect, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
      res.end();
      return;
    }
    this.send(res, target);
  }

  /** The app's icon picture: the uploaded PNG, else the start-screen picture a build would use (owner only). */
  @Get("projects/:id/android/icon")
  async icon(@CurrentUser() user: User, @Param("id") id: string, @Res() res: Response) {
    const png = await this.android.icon(user, id);
    // The answer is per signed-in user: a browser's cache must not hand it to another sign-in (the CORS layer's Vary: Origin stays).
    res.vary("Authorization");
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": png.length,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(png);
  }

  /** The upload key as a zip (the keystore + README.txt with the password). */
  @Get("projects/:id/android/key")
  async key(@CurrentUser() user: User, @Param("id") id: string, @Res() res: Response) {
    const { file, data } = await this.android.keyZip(user, id);
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Length": data.length,
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    });
    res.end(data);
  }

  private send(res: Response, file: { stream: NodeJS.ReadableStream; bytes: number; filename: string; mime: string }) {
    res.writeHead(200, {
      "Content-Type": file.mime,
      ...(file.bytes ? { "Content-Length": file.bytes } : {}),
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    });
    file.stream.on("error", () => res.end());
    file.stream.pipe(res);
  }
}
