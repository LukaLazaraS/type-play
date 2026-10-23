// What anyone may see or do, without signing in: a shared game (the share page typeplay.app/play/<id>), the
// public gallery (typeplay.app/explore), a play of a shared game, and a report about one.
import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import type { GalleryPage, PublicGame } from "@typeplay/shared";
import { Public } from "./auth/auth.guard.js";
import { GalleryService } from "./gallery/gallery.service.js";
import { visitorKey } from "./gallery/limits.js";
import { ProjectViews } from "./projects/views.js";

@Controller("public")
@Public()
export class PublicController {
  constructor(
    private readonly views: ProjectViews,
    private readonly gallery: GalleryService,
  ) {}

  /** 404 unless the owner shares it and it has a build; unsharing makes it 404 at once (no cache). */
  @Get("games/:id")
  @Header("Cache-Control", "no-store")
  game(@Param("id") id: string): Promise<PublicGame> {
    return this.views.publicGame(id);
  }

  /** The gallery: games their makers listed, newest or most played this week first. Never cached, so a game taken out leaves at once. */
  @Get("gallery")
  @Header("Cache-Control", "no-store")
  page(@Query("sort") sort?: unknown, @Query("cursor") cursor?: unknown, @Query("limit") limit?: unknown): Promise<GalleryPage> {
    return this.gallery.page(sort, cursor, limit);
  }

  /** The share page's game started (the frame said ready): one more play today. 204 whatever came of it, so it says nothing. */
  @Post("games/:id/play")
  @HttpCode(204)
  async play(@Param("id") id: string, @Req() req: Request): Promise<void> {
    await this.gallery.countPlay(id, visitorKey(req));
  }

  /** "Report this game" (ReportBody): 204, or 400, 404 (not shared), 429 too_many. */
  @Post("games/:id/report")
  @HttpCode(204)
  async report(@Param("id") id: string, @Req() req: Request, @Body() body: unknown): Promise<void> {
    await this.gallery.report(id, visitorKey(req), body);
  }
}
