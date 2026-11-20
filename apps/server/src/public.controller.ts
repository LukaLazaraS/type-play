// What anyone may see or do, without signing in: a shared game (the share page typeplay.app/play/<id>), the
// public gallery (typeplay.app/explore) and its list for the sitemap, a play of a shared game, and a report about one.
import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import type { GalleryPage, GallerySitemap, PublicGame } from "@typeplay/shared";
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

  /** The gallery: games their makers listed, most played this week, newest or A to Z first, of a genre or matching a search.
   * Never cached, so a game taken out leaves at once. */
  @Get("gallery")
  @Header("Cache-Control", "no-store")
  page(
    @Query("sort") sort?: unknown,
    @Query("cursor") cursor?: unknown,
    @Query("limit") limit?: unknown,
    @Query("genre") genre?: unknown,
    @Query("q") q?: unknown,
  ): Promise<GalleryPage> {
    return this.gallery.page(sort, cursor, limit, genre, q);
  }

  /**
   * Every game in the gallery, the newest change first (at most 50,000, one sitemap file's limit): what the site's
   * sitemap.xml lists. Only what /explore shows anyone, nothing about makers. Cached 5 minutes by whatever sits between
   * (a CDN, the site): a sitemap is a hint that crawlers read a few times a day, and each page says index or noindex
   * itself at request time (GET games/:id, never cached), so a game that just left the gallery is out of search even
   * while an older copy of this list still names it.
   */
  @Get("sitemap")
  @Header("Cache-Control", "public, max-age=300")
  sitemap(): Promise<GallerySitemap> {
    return this.gallery.sitemap();
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
