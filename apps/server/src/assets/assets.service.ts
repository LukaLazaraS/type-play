// The Assets tab's API (2026-11-04; the contract's "Assets" block, docs/design/assets.md): a version's list, and each
// asset's file, picture and thumbnail, for the game's owner only. Lists are made when a version is published
// (afterBuild, from runs.service.ts) or, for the current version of a game made before the tab, at the first ask.
import { Injectable, Logger } from "@nestjs/common";
import { join } from "node:path";
import type { GameAsset, GameAssets } from "@typeplay/shared";
import { ApiException, notFound } from "../common/api-error.js";
import { config } from "../env.js";
import type { User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { ProjectViews } from "../projects/views.js";
import { fileSlug } from "../games/download.js";
import { RunRegistry } from "../runs/registry.js";
import { importAssets } from "./importer.js";
import { blobFile, BUILD, readList, type StoredAsset, type StoredList, writeList } from "./store.js";

const ASSET_ID = /^[0-9a-f]{16}$/;
export type AssetForm = "file" | "picture" | "thumb";

/** What the site sees of a kept asset: the list's fields without the stored files. */
function view({ blobs, types, ...asset }: StoredAsset): GameAsset {
  void blobs;
  void types;
  return asset;
}

@Injectable()
export class AssetsService {
  private readonly log = new Logger("assets");
  /** One list made at a time in this process (sharp's work is capped too): the live API has one vCPU. */
  private turn: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly views: ProjectViews,
    private readonly registry: RunRegistry,
  ) {}

  private inTurn<T>(work: () => Promise<T>): Promise<T> {
    const next = this.turn.then(work, work);
    this.turn = next.catch(() => {});
    return next;
  }

  private async make(projectId: string, buildId: string, commit: string | null): Promise<StoredList> {
    return this.inTurn(async () => {
      const t = Date.now();
      const list = await importAssets({ projectId, buildId, dir: join(config.dataDir, "projects", projectId), commit });
      writeList(projectId, list);
      this.log.log(`${buildId}: ${list.assets.length} assets (${list.source}) in ${Date.now() - t} ms${list.notes.length ? `; ${list.notes.slice(0, 6).join(" | ")}` : ""}`);
      return list;
    });
  }

  /**
   * A version was just published (runs.service.ts, before the player hears it is done): its list, with the build's
   * capture when it is of `commit`. Never throws: a list that can't be made is logged, and the tab says so.
   */
  async afterBuild(projectId: string, buildId: string, commit: string): Promise<void> {
    try {
      await this.make(projectId, buildId, commit);
    } catch (e) {
      this.log.error(`${buildId}: the asset list failed: ${(e as Error).stack ?? e}`);
    }
  }

  /** The owner's game and its version with this build, or 404. */
  private async version(user: User, projectId: string, buildId: string) {
    const project = await this.views.owned(user.id, projectId);
    if (typeof buildId !== "string" || !BUILD.test(buildId)) throw notFound("We couldn't find that version.");
    const version = await this.prisma.version.findFirst({ where: { projectId: project.id, buildId }, select: { n: true } });
    if (!version) throw notFound("We couldn't find that version.");
    return project;
  }

  async list(user: User, projectId: string, buildId: string): Promise<GameAssets> {
    const project = await this.version(user, projectId, buildId);
    let list = readList(project.id, buildId);
    if (!list) {
      // Made before the tab. The current version's files are in the game folder (at that version unless a build is
      // changing them): listed now and kept. An older version's are in its history only, which this process doesn't read.
      const current = project.currentVersion == null ? null : await this.prisma.version.findUnique({ where: { projectId_n: { projectId: project.id, n: project.currentVersion } }, select: { buildId: true } });
      if (current?.buildId !== buildId) return { buildId, source: "none", assets: [] };
      if (this.registry.status(project.id) === "running" || project.dirty) {
        throw new ApiException(409, "busy", "This game is being changed right now. Its assets show here when that is done.");
      }
      list = readList(project.id, buildId) ?? (await this.make(project.id, buildId, null));
    }
    return { buildId, source: list.source, assets: list.assets.map(view) };
  }

  /** An asset's file (what Download saves), its picture, or its thumbnail: the path to stream, its type and a name. */
  async file(user: User, projectId: string, buildId: string, assetId: string, form: AssetForm) {
    const project = await this.version(user, projectId, buildId);
    const list = typeof assetId === "string" && ASSET_ID.test(assetId) ? readList(project.id, buildId) : null;
    const asset = list?.assets.find((a) => a.id === assetId);
    if (!asset) throw notFound("We couldn't find that asset.");
    // A look's file is its picture (an animated one's is its sprite sheet, so it has a picture of its own).
    const sha = form === "file" ? asset.blobs.file : form === "picture" ? (asset.blobs.picture ?? (asset.made === "code" && asset.kind === "picture" ? asset.blobs.file : undefined)) : asset.blobs.thumb;
    const found = sha ? blobFile(project.id, sha) : null;
    if (!found) throw notFound(form === "file" ? "This asset's file is missing." : "This asset has no picture.");
    const type = form === "thumb" ? "image/webp" : form === "picture" ? (asset.types.picture ?? asset.types.file) : asset.types.file;
    return { ...found, type, name: `${fileSlug(asset.name)}.${asset.format}` };
  }
}
