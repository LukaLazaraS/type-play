// Pictures attached to messages (2026-11-04; apps/server/README.md "Pictures"): uploaded one at a time as the player
// attaches them (staged: no message yet), then sent with a message (POST /projects, POST /projects/:id/messages
// `images`), which owns them from then on; they go with it, its game and the account. Only their owner fetches them.
// A picture sent again (the size check's one tap, Try again) is copied for the new message, so each message owns its own.
import { randomInt } from "node:crypto";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type { Attachment as AttachmentView } from "@typeplay/shared";
import { ApiException, badRequest, notFound } from "../common/api-error.js";
import type { Tx } from "../credits/ledger.service.js";
import { config } from "../env.js";
import type { Attachment, ImageFormat, User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { cleanPicture, PictureProblem } from "./images.js";
import { MAX_IMAGES } from "./limits.js";
import { copyPicture, ID, listPictureFiles, pathOf, removePictures, TYPE, writePicture, type PictureFile } from "./store.js";

/** A picture a run gets: run.mjs `--images` (agent.ts), the runner's job (runner.mjs). */
export interface RunImage {
  id: string;
  format: ImageFormat;
}

/** A picture a message names, checked: staged (claimed by the message) or sent before in this game (copied for it). */
export interface Picked {
  row: Attachment;
  again: boolean;
}

/** Picked pictures ready for the message's transaction: copies made for the ones sent again (undo() removes them). */
export interface Prepared {
  images: (RunImage & { width: number; height: number; bytes: number; staged: boolean })[];
  undo(): void;
}

/** Pictures uploaded and not sent at most this many at once per account (a composer holds 10; two tabs, 20). */
const MAX_STAGED = 30;
/** Uploads per account in an hour at most (10 messages of 10 pictures and some to spare): the decoding costs CPU. */
const UPLOADS_PER_HOUR = 120;
/** An upload never sent is deleted after this long. */
const STAGED_HOURS = 24;
/** Files no row names are left alone this long (an upload being written has its files before its row). */
const ORPHAN_GRACE_MS = 60 * 60_000;
/** This PC's run folders (agent.ts) older than this belong to no run (a run lasts at most RUN_TIMEOUT_MIN + 5). */
const RUN_FOLDER_MAX_MS = 2 * 60 * 60_000;
const HOUR = 60 * 60_000;

const GONE = "One of the pictures is no longer there. Attach it again.";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/** 24 random letters and digits (124 bits): an id nobody can guess, and the files' name. */
const newAttachmentId = () => Array.from({ length: 24 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export const toAttachment = (a: Attachment): AttachmentView => ({ id: a.id, format: a.format, width: a.width, height: a.height, bytes: a.bytes });

/** A create or message body's `images`: up to 10 different attachment ids, in the order the player put them. */
export function parseImageIds(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || !raw.every((x) => typeof x === "string" && ID.test(x))) throw badRequest("images is a list of picture ids.");
  if (raw.length > MAX_IMAGES) throw badRequest(`A message can carry up to ${MAX_IMAGES} pictures.`);
  if (new Set(raw).size !== raw.length) throw badRequest("The same picture is in this message twice.");
  return raw as string[];
}

@Injectable()
export class AttachmentsService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger("attachments");
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;
  /** Each account's uploads in the last hour (in memory: a restart forgets them, as the gallery's limits). */
  private readonly recent = new Map<string, number[]>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), HOUR);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  /** POST /attachments: the picture's bytes (any Content-Type: the content decides), checked, cleaned and kept staged. */
  async upload(user: User, body: unknown): Promise<AttachmentView> {
    if (!Buffer.isBuffer(body) || !body.length) throw badRequest("Send the picture itself as the request's body.");
    const now = Date.now();
    const recent = (this.recent.get(user.id) ?? []).filter((t) => now - t < HOUR);
    if (recent.length >= UPLOADS_PER_HOUR) throw new ApiException(429, "too_many", "That's a lot of pictures in a short time. Try again in a few minutes.");
    recent.push(now);
    this.recent.set(user.id, recent);
    const staged = await this.prisma.attachment.count({ where: { userId: user.id, messageId: null } });
    if (staged >= MAX_STAGED) throw new ApiException(429, "too_many", `You have ${MAX_STAGED} pictures waiting to be sent. Send them or remove some first.`);
    let clean: Awaited<ReturnType<typeof cleanPicture>>;
    try {
      clean = await cleanPicture(body);
    } catch (e) {
      if (e instanceof PictureProblem) throw badRequest(e.message);
      throw e;
    }
    const id = newAttachmentId();
    writePicture(id, clean.format, { full: clean.full, view: clean.view, thumb: clean.thumb });
    try {
      const row = await this.prisma.attachment.create({
        data: { id, userId: user.id, format: clean.format, width: clean.width, height: clean.height, bytes: clean.full.length },
      });
      return toAttachment(row);
    } catch (e) {
      removePictures([{ id, format: clean.format }]);
      throw e;
    }
  }

  /** DELETE /attachments/:id: a picture taken out of the box before it was sent. One that was sent stays with its message. */
  async remove(user: User, id: string): Promise<{ ok: true }> {
    const row = ID.test(id) ? await this.prisma.attachment.findFirst({ where: { id, userId: user.id, messageId: null } }) : null;
    if (!row) throw notFound("We couldn't find that picture.");
    // Only while still staged: a message that claimed it a moment ago keeps it.
    const gone = await this.prisma.attachment.deleteMany({ where: { id, userId: user.id, messageId: null } });
    if (gone.count) removePictures([row]);
    return { ok: true };
  }

  /** GET /attachments/:id[/thumb]: the owner's picture (404 for anyone else, as for one that isn't there). */
  async file(user: User, id: string, file: Extract<PictureFile, "full" | "thumb">): Promise<{ path: string; type: string; size: number }> {
    const row = ID.test(id) ? await this.prisma.attachment.findFirst({ where: { id, userId: user.id } }) : null;
    const path = row ? pathOf(row.id, row.format, file) : null;
    if (!row || !path || !existsSync(path)) throw notFound("We couldn't find that picture.");
    return { path, type: file === "full" ? TYPE[row.format] : "image/webp", size: statSync(path).size };
  }

  /**
   * The pictures a create or message body names (`images`), checked before anything is written: each the player's own,
   * and either staged or sent before with a message of this game (`projectId`; a new game has none). 400 otherwise.
   */
  async pick(user: User, raw: unknown, projectId: string | null): Promise<Picked[]> {
    const ids = parseImageIds(raw);
    if (!ids.length) return [];
    const rows = await this.prisma.attachment.findMany({ where: { id: { in: ids }, userId: user.id }, include: { message: { select: { projectId: true } } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => {
      const row = byId.get(id);
      if (row && row.messageId === null) return { row, again: false };
      if (row && projectId && row.message?.projectId === projectId) return { row, again: true };
      throw badRequest(GONE);
    });
  }

  /** Copies for the pictures sent again (new ids, the files copied); the staged ones as they are. */
  prepare(picked: Picked[]): Prepared {
    const copies: RunImage[] = [];
    try {
      const images = picked.map(({ row, again }) => {
        if (!again) return { id: row.id, format: row.format, width: row.width, height: row.height, bytes: row.bytes, staged: true };
        const id = newAttachmentId();
        copyPicture(row, id);
        copies.push({ id, format: row.format });
        return { id, format: row.format, width: row.width, height: row.height, bytes: row.bytes, staged: false };
      });
      return { images, undo: () => removePictures(copies) };
    } catch (e) {
      removePictures(copies);
      throw e;
    }
  }

  /**
   * Inside the transaction that writes the player's message: the staged pictures become the message's (only while still
   * staged: a second tab sending the same picture at once gets 400), the copies get their rows; places in order.
   */
  async attachIn(tx: Tx, userId: string, messageId: string, prepared: Prepared): Promise<RunImage[]> {
    for (const [position, p] of prepared.images.entries()) {
      if (p.staged) {
        const claimed = await tx.attachment.updateMany({ where: { id: p.id, userId, messageId: null }, data: { messageId, position } });
        if (claimed.count !== 1) throw badRequest(GONE);
      } else {
        await tx.attachment.create({ data: { id: p.id, userId, messageId, position, format: p.format, width: p.width, height: p.height, bytes: p.bytes } });
      }
    }
    return prepared.images.map(({ id, format }) => ({ id, format }));
  }

  /** A build in line keeps its pictures' ids (QueuedRun.images); at its turn, the pictures as a run gets them, in order. */
  async forRun(ids: string[]): Promise<RunImage[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.attachment.findMany({ where: { id: { in: ids } }, select: { id: true, format: true } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  }

  /** A game's pictures, read before its rows go (projects.service removeGame), to delete their files after. */
  ofGame(projectId: string): Promise<RunImage[]> {
    return this.prisma.attachment.findMany({ where: { message: { projectId } }, select: { id: true, format: true } });
  }

  /** An account's pictures not sent with any message (its games' go with each game), read before the account goes. */
  stagedOf(userId: string): Promise<RunImage[]> {
    return this.prisma.attachment.findMany({ where: { userId, messageId: null }, select: { id: true, format: true } });
  }

  /** Deletes pictures' files once their rows are gone; never throws (the sweep takes what is left). */
  removeFiles(list: RunImage[]) {
    try {
      removePictures(list);
    } catch (e) {
      this.log.error(`removing ${list.length} picture(s): ${e}`);
    }
  }

  /**
   * Every hour and at start: uploads never sent within a day go (rows and files); files no row names (older than an hour:
   * an upload being written has its files first) go; and this PC's run folders that outlived their run go.
   */
  async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const old = await this.prisma.attachment.findMany({
        where: { messageId: null, createdAt: { lt: new Date(Date.now() - STAGED_HOURS * HOUR) } },
        select: { id: true, format: true },
      });
      if (old.length) {
        await this.prisma.attachment.deleteMany({ where: { id: { in: old.map((o) => o.id) }, messageId: null } });
        // A picture sent in the meantime keeps its row, and so its files.
        const kept = new Set((await this.prisma.attachment.findMany({ where: { id: { in: old.map((o) => o.id) } }, select: { id: true } })).map((r) => r.id));
        removePictures(old.filter((o) => !kept.has(o.id)));
        this.log.log(`swept ${old.length - kept.size} picture(s) never sent`);
      }
      const files = listPictureFiles();
      const ids = [...new Set(files.map((f) => f.id).filter(Boolean))];
      const known = new Set<string>();
      for (let i = 0; i < ids.length; i += 500) {
        for (const r of await this.prisma.attachment.findMany({ where: { id: { in: ids.slice(i, i + 500) } }, select: { id: true } })) known.add(r.id);
      }
      const cutoff = Date.now() - ORPHAN_GRACE_MS;
      let orphans = 0;
      for (const f of files) {
        if ((!f.id || !known.has(f.id)) && f.mtimeMs < cutoff) {
          rmSync(f.path, { force: true });
          orphans++;
        }
      }
      if (orphans) this.log.log(`swept ${orphans} picture file(s) no row named`);
      const runs = join(config.dataDir, "run-images");
      for (const name of existsSync(runs) ? readdirSync(runs) : []) {
        const path = join(runs, name);
        try {
          if (Date.now() - statSync(path).mtimeMs > RUN_FOLDER_MAX_MS) rmSync(path, { recursive: true, force: true });
        } catch {
          // gone meanwhile
        }
      }
      for (const [userId, times] of this.recent) if (!times.some((t) => Date.now() - t < HOUR)) this.recent.delete(userId);
    } catch (e) {
      this.log.error(`sweep: ${e}`);
    } finally {
      this.sweeping = false;
    }
  }
}
