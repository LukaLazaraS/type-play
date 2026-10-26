// Android export (docs/android-export-design.md): a game's identity and upload key (setup), the
// build queue (one at a time, rows in Postgres are the queue), the export job → signer → store
// pipeline with its timeouts and failure codes, downloads and phone links, the key hand-over, and
// the hourly sweep that expires 30-day-old files. Every state change is written, then announced on
// the project's event stream as { type: "android", build }.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type {
  AndroidApp as AndroidAppView,
  AndroidBuild as AndroidBuildView,
  AndroidCheck,
  AndroidFailCode,
  AndroidKeyInfo,
  AndroidLink,
  AndroidState,
  Orientation,
} from "@typeplay/shared";
import { APP_NAME_MAX, defaultPackageName, packageNameProblem, versionNameOf } from "../../runner/android-prepare.mjs";
import { ApiException, badRequest, notFound } from "../common/api-error.js";
import { config } from "../env.js";
import { EventBus } from "../events/event-bus.js";
import { fileSlug } from "../games/download.js";
import { readGameFile } from "../games/files.js";
import { zip } from "../games/zip.js";
import type { AndroidApp, AndroidBuild, AndroidKey, Prisma, User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { ProjectViews } from "../projects/views.js";
import { RunRegistry } from "../runs/registry.js";
import { projectDir } from "../runs/runs.service.js";
import { newPassword, newToken, open, openWith, parseMasterKey, sameToken, seal, type MasterKeys } from "./crypto.js";
import { checksOf, type Expected, type Inspect } from "./inspect.js";
import { startAndroidJob, type AndroidJobHandle } from "./job.js";
import { phoneLinkUrl, presignSeconds } from "./links.js";
import { iconProblem, pngInfo } from "./png.js";
import { signerFor, type SignerOps } from "./signer-client.js";
import { deleteBuild, MIME, openBuild, presignBuild, putBuild, removeProjectBuilds } from "./store.js";

/** The one plain sentence per failure code (§10). */
const FAIL_TEXT: Record<AndroidFailCode, string> = {
  toolchain: "Android builds are broken on our side right now; we've been told. Nothing to do on your end.",
  game: "Your game's code has an error that stops the Android build. Ask for a fix in the chat.",
  gradle: "The packaging step failed. Try again; if it keeps failing, write to hello@typeplay.app with the build id.",
  timeout: "The build took too long and was stopped. Try again; if it keeps happening, write to hello@typeplay.app.",
  mismatch: "The build didn't come out the way we asked, so we didn't sign it. Try again from a version you trust.",
  sign: "Signing the build failed on our side. Try again; if it keeps failing, write to hello@typeplay.app.",
  store: "The build was made but couldn't be saved. Try again in a minute.",
  interrupted: "This build was interrupted by a restart on our side. Build again.",
  queue_full: "The build waited too long for its turn and was dropped. Try again.",
};
const CANCELLED_TEXT = "Stopped.";
/** Godot's own words for each kind of failure (FACT F12, F13, F27, F30 in docs/research/android-export-2026.md). */
const TOOLCHAIN_RE = /Java SDK path|Android SDK path|Missing 'bin' directory|Unable to find 'java'|platform-tools|build-tools|Release export template not found|Could not find template APK|Android sources not in ZIP|could not start |No such file or directory.*(godot|java)|Android build template not installed|Android build version mismatch/i;
const GAME_RE = /SCRIPT ERROR|Parse Error|ETC2\/ASTC|Could not export project files|Failed to load script|res:\/\/[^ ]+\.gd:\d+|Invalid package name|Missing libraries in the export template|Error exporting|no project\.godot/i;
const EXPIRE_DAYS = 30;
const KEY_DOWNLOADS_A_DAY = 5;
const BUILDS_PER_GAME_A_DAY = 10;
const BUILDS_PER_USER_A_DAY = 30;
const QUEUE_WAIT_MS = 30 * 60_000;
const MAX_UNSIGNED = 300 << 20;
const LOG_TAIL = 4096;
const DAY_MS = 86_400_000;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface Active {
  projectId: string;
  handle: AndroidJobHandle | null;
  cancelled: boolean;
  timedOut: boolean;
  finished: Promise<void>;
}

/** A phone link: one build of one game, for `config.android.linkSeconds` (10 minutes). */
interface Link {
  projectId: string;
  buildId: string;
  path: string;
  filename: string;
  ext: "apk" | "aab";
  expiresAt: number;
}

/** What a phone link leads to: the file to stream (folder store) or a freshly presigned URL to redirect to (R2). */
export type PhoneTarget = { redirect: string } | { stream: Readable; bytes: number; filename: string; mime: string };

type BuildRow = AndroidBuild;

/** The last 4 KB of a build's output, ANSI stripped. */
function tailOf(file: string): string {
  try {
    // eslint-disable-next-line no-control-regex
    const text = readFileSync(file, "utf8").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
    return text.length > LOG_TAIL ? "…" + text.slice(-LOG_TAIL) : text;
  } catch {
    return "";
  }
}

/** Which failure a non-zero exit was, from what the job printed. */
export function classifyFailure(log: string): Exclude<AndroidFailCode, "timeout" | "mismatch" | "sign" | "store" | "interrupted" | "queue_full"> {
  if (TOOLCHAIN_RE.test(log)) return "toolchain";
  if (GAME_RE.test(log)) return "game";
  return "gradle";
}

/** The first error line of a game failure, for the message and errors.jsonl. */
function firstError(log: string): string {
  const line = log.split("\n").find((l) => /SCRIPT ERROR|Parse Error|ERROR:/.test(l));
  return (line ?? "").replace(/^\s*(SCRIPT )?ERROR:\s*/, "").trim().slice(0, 200);
}

@Injectable()
export class AndroidService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger("android");
  private readonly signer: { ops: SignerOps; how: string } | null = signerFor();
  private readonly keys: MasterKeys | null;
  private readonly running = new Map<string, Active>();
  private readonly links = new Map<string, Link>();
  private readonly keyDownloads = new Map<string, number[]>();
  private tickTimer: NodeJS.Timeout | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RunRegistry,
    private readonly events: EventBus,
    private readonly views: ProjectViews,
  ) {
    const key = parseMasterKey(config.android.masterKey);
    const prev = parseMasterKey(config.android.masterKeyPrev);
    this.keys = key ? { current: { id: 1, key }, previous: prev ? [{ id: 0, key: prev }] : [] } : null;
  }

  /** Whether this server builds for Android (Me.features.android, /health). */
  get enabled(): boolean {
    return !!this.signer && !!this.keys;
  }

  get runningCount(): number {
    return this.running.size;
  }

  private get toolchain(): string {
    if (config.android.toolchain) return config.android.toolchain;
    if (config.android.fake) return `fake+godot${config.godotVersion}`;
    return `godot${config.godotVersion}+local`;
  }

  async onModuleInit() {
    if (this.keys?.previous.length) await this.rewrap().catch((e) => this.log.error(`rewrap: ${e}`));
    if (!config.android.on) return this.log.log("Android export off (ANDROID_EXPORT unset)");
    if (!this.enabled) return this.log.warn("Android export on but not usable here: no JDK/SDK/bundletool (JAVA_HOME, ANDROID_HOME, BUNDLETOOL_JAR) and no signer socket; features.android is false");
    this.log.log(`Android export: ${this.signer!.how} signer, store ${config.android.store}, toolchain ${this.toolchain}`);
    // Builds a stopped server left mid-way: failed; queued ones take their turn again.
    const stale = await this.prisma.androidBuild.findMany({ where: { status: { in: ["running", "signing"] } } });
    for (const b of stale) {
      await this.prisma.androidBuild.update({ where: { id: b.id }, data: { status: "failed", failCode: "interrupted", failMessage: FAIL_TEXT.interrupted, finishedAt: new Date() } });
      rmSync(join(config.android.exportsDir, b.id), { recursive: true, force: true });
    }
    if (stale.length) this.log.warn(`marked ${stale.length} interrupted Android build(s) as failed`);
    this.sweepTimer = setInterval(() => void this.sweep().catch((e) => this.log.error(`sweep: ${e}`)), 60 * 60_000);
    this.sweepTimer.unref();
    void this.sweep().catch((e) => this.log.error(`sweep: ${e}`));
    this.tick();
  }

  /**
   * After a rotation (ANDROID_KEY_MASTER_PREV set, `deploy.mjs android-key --rotate --keep-prev`), at the start: every
   * upload key still sealed under an older master is sealed again under the current one, so the next rotation can
   * drop the old master without losing a game's key. Before any request (Nest starts listening after this).
   */
  async rewrap(): Promise<{ resealed: number; unreadable: string[] }> {
    if (!this.keys) return { resealed: 0, unreadable: [] };
    const rows = await this.prisma.androidKey.findMany({ select: { projectId: true, blob: true } });
    let resealed = 0;
    const unreadable: string[] = [];
    for (const row of rows) {
      let opened: ReturnType<typeof openWith>;
      try {
        opened = openWith(this.keys, row.projectId, Buffer.from(row.blob));
      } catch {
        unreadable.push(row.projectId);
        continue;
      }
      if (opened.current) continue;
      const blob = seal(this.keys, row.projectId, opened.material);
      await this.prisma.androidKey.update({ where: { projectId: row.projectId }, data: { blob: new Uint8Array(blob), keyId: this.keys.current.id } });
      resealed++;
    }
    const lost = unreadable.length ? `; ${unreadable.length} open with none of this server's keys (${unreadable.join(", ")})` : "";
    this.log[unreadable.length ? "error" : "log"](`Android upload keys: ${resealed} sealed again under the current master key, of ${rows.length}${lost}`);
    return { resealed, unreadable };
  }

  onApplicationShutdown() {
    this.stopping = true;
    if (this.tickTimer) clearTimeout(this.tickTimer);
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    for (const a of this.running.values()) {
      a.cancelled = true;
      a.handle?.kill();
    }
  }

  // --- views --------------------------------------------------------------------------------------

  private toApp(a: AndroidApp): AndroidAppView {
    return { packageName: a.packageName, appName: a.appName, versionCode: a.versionCode, packageLocked: !!a.packageLockedAt, hasIcon: !!a.iconPng, createdAt: a.createdAt.toISOString() };
  }

  private toKey(k: AndroidKey): AndroidKeyInfo {
    return { certSha256: k.certSha256, createdAt: k.createdAt.toISOString(), downloadedAt: k.downloadedAt?.toISOString() ?? null, downloads: k.downloads };
  }

  private toBuild(b: BuildRow, extra: { position?: number; packageName?: string; certSha256?: string } = {}): AndroidBuildView {
    const inspect = (b.checks ?? null) as Inspect | null;
    const expect: Expected = { format: b.format, packageName: extra.packageName ?? inspect?.package ?? "", versionCode: b.versionCode, versionName: b.versionName, certSha256: extra.certSha256 };
    const v: AndroidBuildView = {
      id: b.id,
      versionN: b.versionN,
      format: b.format,
      versionCode: b.versionCode,
      versionName: b.versionName,
      status: b.status,
      icon: b.icon as AndroidBuildView["icon"],
      checks: inspect && b.status === "done" ? checksOf(expect, inspect) : [],
      godotVersion: b.godotVersion,
      queuedAt: b.queuedAt.toISOString(),
    };
    if (b.failCode) v.failCode = b.failCode as AndroidFailCode;
    if (b.failMessage) v.failMessage = b.failMessage;
    if (b.logTail) v.logTail = b.logTail;
    if (b.bytes != null) v.bytes = b.bytes;
    if (b.sha256) v.sha256 = b.sha256;
    if (b.startedAt) v.startedAt = b.startedAt.toISOString();
    if (b.finishedAt) v.finishedAt = b.finishedAt.toISOString();
    if (b.expiresAt) v.expiresAt = b.expiresAt.toISOString();
    if (b.status === "queued" && extra.position !== undefined) v.queue = { position: extra.position };
    return v;
  }

  private async positionOf(b: BuildRow): Promise<number> {
    return this.prisma.androidBuild.count({ where: { status: "queued", queuedAt: { lt: b.queuedAt } } });
  }

  /** A row as the site sees it (with its queue position and the checks against the game's key). */
  private async view(b: BuildRow): Promise<AndroidBuildView> {
    const app = await this.prisma.androidApp.findUnique({ where: { projectId: b.projectId }, include: { key: true } });
    return this.toBuild(b, { position: b.status === "queued" ? await this.positionOf(b) : undefined, packageName: app?.packageName, certSha256: app?.key?.certSha256 });
  }

  private async emit(b: BuildRow) {
    try {
      this.events.emit(b.projectId, { type: "android", build: await this.view(b) });
    } catch (e) {
      this.log.error(`event for ${b.id}: ${e}`);
    }
  }

  // --- state, setup, update ---------------------------------------------------------------------

  private async appOf(projectId: string) {
    return this.prisma.androidApp.findUnique({ where: { projectId }, include: { key: true, project: true } });
  }

  private async limitsOf(userId: string, projectId: string) {
    const since = new Date(Date.now() - DAY_MS);
    const [game, user] = await Promise.all([
      this.prisma.androidBuild.count({ where: { projectId, queuedAt: { gt: since } } }),
      this.prisma.androidBuild.count({ where: { queuedAt: { gt: since }, app: { project: { ownerId: userId } } } }),
    ]);
    return { perGameToday: Math.max(0, BUILDS_PER_GAME_A_DAY - game), perUserToday: Math.max(0, BUILDS_PER_USER_A_DAY - user) };
  }

  async state(user: User, projectId: string): Promise<AndroidState> {
    await this.views.owned(user.id, projectId);
    const app = await this.appOf(projectId);
    const rows = app ? await this.prisma.androidBuild.findMany({ where: { projectId }, orderBy: { queuedAt: "desc" }, take: 20 }) : [];
    const builds: AndroidBuildView[] = [];
    for (const b of rows) builds.push(this.toBuild(b, { position: b.status === "queued" ? await this.positionOf(b) : undefined, packageName: app?.packageName, certSha256: app?.key?.certSha256 }));
    return { enabled: this.enabled, app: app ? this.toApp(app) : null, key: app?.key ? this.toKey(app.key) : null, builds, limits: await this.limitsOf(user.id, projectId) };
  }

  private requirePaid(user: User) {
    if (user.plan === "free") throw new ApiException(403, "plan_no_export", "Exports are on paid plans. Free is for making and playing in the browser.");
  }

  private requireEnabled() {
    if (!this.enabled) throw new ApiException(503, "android_off", "Android builds aren't available on this server yet.");
  }

  private cleanAppName(raw: unknown, fallback: string): string {
    if (raw === undefined) return fallback;
    if (typeof raw !== "string") throw badRequest("Type a name for the app.");
    const name = raw.replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/\s+/g, " ").trim();
    if (!name) throw badRequest("Type a name for the app.");
    if ([...name].length > APP_NAME_MAX) throw badRequest(`The app name is ${APP_NAME_MAX} letters at most (Google Play's limit).`);
    return name;
  }

  private cleanPackageName(raw: unknown, fallback: string): string {
    if (raw === undefined) return fallback;
    if (typeof raw !== "string") throw badRequest("Type a package name.");
    const name = raw.trim();
    const problem = packageNameProblem(name);
    if (problem) throw badRequest(problem);
    return name;
  }

  /** Setup: the identity and the upload key, made by the signer before the rows are written. */
  async setup(user: User, projectId: string, body: unknown): Promise<AndroidState> {
    const project = await this.views.owned(user.id, projectId);
    this.requirePaid(user);
    this.requireEnabled();
    if (await this.prisma.androidApp.findUnique({ where: { projectId } })) throw new ApiException(409, "busy", "Android is already set up for this game.");
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const appName = this.cleanAppName(b.appName, [...project.name].slice(0, APP_NAME_MAX).join("").trim() || "My game");
    const packageName = this.cleanPackageName(b.packageName, defaultPackageName(project.name, projectId));
    if (await this.prisma.androidApp.findUnique({ where: { packageName } })) throw new ApiException(409, "name_taken", "Another game on TypePlay already uses this package name. Pick another.");
    const password = newPassword();
    const made = await this.signer!.ops.keygen({ projectId, appName, password });
    const blob = seal(this.keys!, projectId, { p12: made.p12, password });
    try {
      await this.prisma.$transaction([
        this.prisma.androidApp.create({ data: { projectId, packageName, appName } }),
        this.prisma.androidKey.create({ data: { projectId, certSha256: made.certSha256, blob: new Uint8Array(blob), keyId: this.keys!.current.id } }),
      ]);
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ApiException(409, "name_taken", "Another game on TypePlay already uses this package name. Pick another.");
      throw e;
    }
    this.log.log(`android ${projectId}: set up as ${packageName}`);
    return this.state(user, projectId);
  }

  async update(user: User, projectId: string, body: unknown): Promise<AndroidState> {
    await this.views.owned(user.id, projectId);
    this.requirePaid(user);
    const app = await this.appOf(projectId);
    if (!app) throw notFound("Set up Android for this game first.");
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const data: Prisma.AndroidAppUpdateInput = {};
    if (b.appName !== undefined) data.appName = this.cleanAppName(b.appName, app.appName);
    if (b.packageName !== undefined) {
      const packageName = this.cleanPackageName(b.packageName, app.packageName);
      if (packageName !== app.packageName) {
        if (app.packageLockedAt && b.confirmPackageChange !== true) {
          throw new ApiException(409, "busy", "This game already has a Play package (.aab) with its package name. A new name is a new app on Google Play: send confirmPackageChange to go ahead.");
        }
        if (await this.prisma.androidApp.findUnique({ where: { packageName } })) throw new ApiException(409, "name_taken", "Another game on TypePlay already uses this package name. Pick another.");
        data.packageName = packageName;
      }
    }
    if (b.iconPng !== undefined) {
      if (b.iconPng === null) data.iconPng = null;
      else {
        if (typeof b.iconPng !== "string") throw badRequest("The icon is a PNG as base64, or null.");
        const png = Buffer.from(b.iconPng, "base64");
        const problem = iconProblem(png);
        if (problem) throw badRequest(problem);
        data.iconPng = png;
      }
    }
    if (!Object.keys(data).length) throw badRequest("Say what to change: the app name, the package name or the icon.");
    try {
      await this.prisma.androidApp.update({ where: { projectId }, data });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ApiException(409, "name_taken", "Another game on TypePlay already uses this package name. Pick another.");
      throw e;
    }
    return this.state(user, projectId);
  }

  // --- the queue ----------------------------------------------------------------------------------

  async startBuild(user: User, projectId: string, body: unknown): Promise<AndroidBuildView> {
    const project = await this.views.owned(user.id, projectId);
    this.requirePaid(user);
    this.requireEnabled();
    const app = await this.appOf(projectId);
    if (!app?.key) throw notFound("Set up Android for this game first.");
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    if (b.format !== "apk" && b.format !== "aab") throw badRequest("format is apk (for your phone) or aab (for Google Play).");
    const n = b.version === undefined ? project.currentVersion : b.version;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1) throw notFound("There is no version to build yet.");
    const version = await this.prisma.version.findUnique({ where: { projectId_n: { projectId, n } } });
    if (!version) throw notFound(`There is no version ${n}.`);
    if (!existsSync(join(projectDir(projectId), ".git"))) throw notFound("This game's files are missing.");
    const run = this.registry.status(projectId);
    if (run === "running") throw new ApiException(409, "busy", "This game is being changed right now. Export it when the build is done.");
    if (run === "queued") throw new ApiException(409, "busy", "This game's last change is waiting for its turn to be built. Export it when that build is done.");
    const going = await this.prisma.androidBuild.count({ where: { projectId, status: { in: ["queued", "running", "signing"] } } });
    if (going) throw new ApiException(409, "busy", "A build of this game is already queued or running. One at a time.");
    const minuteAgo = new Date(Date.now() - 60_000);
    if (await this.prisma.androidBuild.count({ where: { projectId, queuedAt: { gt: minuteAgo } } })) throw new ApiException(429, "too_many", "One build a minute per game. Try again in a moment.");
    const limits = await this.limitsOf(user.id, projectId);
    if (!limits.perGameToday) throw new ApiException(429, "too_many", `That's ${BUILDS_PER_GAME_A_DAY} builds of this game today, the daily limit. Try again tomorrow.`);
    if (!limits.perUserToday) throw new ApiException(429, "too_many", `That's ${BUILDS_PER_USER_A_DAY} Android builds today, the daily limit. Try again tomorrow.`);
    // The build number in the same transaction as the row: never reused, gaps are fine.
    const row = await this.prisma.$transaction(async (tx) => {
      const a = await tx.androidApp.update({ where: { projectId }, data: { versionCode: { increment: 1 } } });
      return tx.androidBuild.create({
        data: {
          id: `${projectId}-a${a.versionCode}`,
          projectId,
          versionN: n,
          commit: version.commit,
          format: b.format as "apk" | "aab",
          versionCode: a.versionCode,
          versionName: versionNameOf(n, a.versionCode),
          godotVersion: config.godotVersion,
          toolchain: this.toolchain,
        },
      });
    });
    this.log.log(`android ${row.id}: queued (${row.format} of v${n})`);
    await this.emit(row);
    this.tick();
    return this.view(row);
  }

  /** Starts queued builds while there is room (MAX_ANDROID_BUILDS), oldest first, skipping busy games. */
  private tick() {
    if (this.stopping || !this.enabled) return;
    if (this.tickTimer) clearTimeout(this.tickTimer);
    this.tickTimer = null;
    void this.dispatch().catch((e) => this.log.error(`dispatch: ${e}`));
  }

  private async dispatch() {
    const queued = await this.prisma.androidBuild.findMany({ where: { status: "queued" }, orderBy: { queuedAt: "asc" }, take: 20 });
    let waiting = 0;
    for (const row of queued) {
      if (this.running.size >= config.android.maxBuilds) {
        waiting++;
        continue;
      }
      if ([...this.running.values()].some((a) => a.projectId === row.projectId)) {
        waiting++;
        continue;
      }
      if (Date.now() - row.queuedAt.getTime() > QUEUE_WAIT_MS) {
        await this.fail(row, "queue_full");
        continue;
      }
      let release: () => void;
      try {
        release = this.registry.reserve(row.projectId, "export");
      } catch {
        waiting++; // the game has a run or a restore going: its turn comes round again in 5 s
        continue;
      }
      this.run(row, release);
    }
    if (waiting && !this.stopping) {
      this.tickTimer = setTimeout(() => this.tick(), 5_000);
      this.tickTimer.unref();
    }
  }

  private async transition(id: string, data: Prisma.AndroidBuildUpdateInput): Promise<BuildRow> {
    const row = await this.prisma.androidBuild.update({ where: { id }, data });
    await this.emit(row);
    return row;
  }

  private async fail(row: BuildRow, code: AndroidFailCode | "cancelled", detail = "", logTail = ""): Promise<BuildRow> {
    const cancelled = code === "cancelled";
    const message = cancelled ? CANCELLED_TEXT : code === "game" && detail ? `${FAIL_TEXT.game} The error: '${detail}'` : FAIL_TEXT[code];
    if (code === "toolchain") this.log.error(`android ${row.id}: toolchain failure${detail ? `: ${detail}` : ""}`);
    else if (code === "mismatch") this.log.warn(`android ${row.id}: the export did not match the request (tamper?): ${detail}`);
    else this.log.log(`android ${row.id}: ${code}${detail ? ` (${detail.slice(0, 200)})` : ""}`);
    return this.transition(row.id, {
      status: cancelled ? "cancelled" : "failed",
      failCode: cancelled ? null : code,
      failMessage: message,
      logTail: logTail || undefined,
      finishedAt: new Date(),
    });
  }

  /** The launcher icon's source: the user's PNG, else the version's poster (the game folder's, then the published one). */
  private iconFor(app: AndroidApp, dir: string, buildId: string): { png: Buffer; kind: "poster" | "own" } | null {
    if (app.iconPng && pngInfo(Buffer.from(app.iconPng))) return { png: Buffer.from(app.iconPng), kind: "own" };
    for (const file of [() => readGameFile(dir, "export/screenshot-start.png", 8 << 20), () => readFileSync(join(config.gamesBuildsDir, buildId, "poster.png"))]) {
      try {
        const png = file();
        if (png.length <= 1 << 20 && png.subarray(0, 8).equals(PNG) && pngInfo(png)) return { png, kind: "poster" };
      } catch {
        // no such picture
      }
    }
    return null;
  }

  private run(row: BuildRow, release: () => void) {
    const active: Active = { projectId: row.projectId, handle: null, cancelled: false, timedOut: false, finished: Promise.resolve() };
    this.running.set(row.id, active);
    active.finished = this.execute(row, active)
      .then(() => undefined)
      .catch(async (e) => {
        this.log.error(`android ${row.id}: ${(e as Error).stack ?? e}`);
        await this.fail(row, "toolchain", String((e as Error).message ?? e)).catch((e2) => this.log.error(`fail ${row.id}: ${e2}`));
      })
      .finally(() => {
        rmSync(join(config.android.exportsDir, row.id), { recursive: true, force: true });
        this.running.delete(row.id);
        release();
        this.tick();
      });
  }

  private async execute(row: BuildRow, active: Active) {
    const app = await this.appOf(row.projectId);
    if (!app?.key) return this.fail(row, "store", "the game's Android setup is gone");
    const dir = projectDir(row.projectId);
    const version = await this.prisma.version.findUnique({ where: { projectId_n: { projectId: row.projectId, n: row.versionN } } });
    const logFile = join(config.dataDir, "logs", `android-${row.id}.log`);
    rmSync(logFile, { force: true });
    // Claimed in one step: a Stop that landed after the queue picked this row up has made it `cancelled`, and then nothing starts.
    const claimed = await this.prisma.androidBuild.updateMany({ where: { id: row.id, status: "queued" }, data: { status: "running", startedAt: new Date() } });
    if (!claimed.count) return;
    await this.emit(await this.prisma.androidBuild.findUniqueOrThrow({ where: { id: row.id } }));
    const icon = this.iconFor(app, dir, version?.buildId ?? "");
    const handle = startAndroidJob({
      dir,
      buildId: row.id,
      commit: row.commit,
      format: row.format,
      packageName: app.packageName,
      versionCode: row.versionCode,
      versionName: row.versionName,
      appName: app.appName,
      orientation: app.project.orientation as Orientation,
      icon,
      logFile,
    });
    active.handle = handle;
    if (active.cancelled) handle.kill();
    const timer = setTimeout(() => {
      active.timedOut = true;
      handle.kill();
    }, config.android.buildTimeoutMin * 60_000);
    const r = await handle.done.finally(() => clearTimeout(timer));
    const rel = `export/android/unsigned-${row.id}.${row.format}`;
    const dropUnsigned = () => rmSync(join(dir, "export", "android", `unsigned-${row.id}.${row.format}`), { force: true });
    if (active.cancelled) {
      dropUnsigned();
      return this.fail(row, "cancelled");
    }
    const tail = tailOf(logFile);
    if (active.timedOut) {
      dropUnsigned();
      return this.fail(row, "timeout", "", tail);
    }
    if (r.code !== 0) {
      dropUnsigned();
      const code = classifyFailure(tail);
      const first = code === "game" ? firstError(tail) : (r.error ?? "");
      if (code === "game") this.learn(row, first);
      return this.fail(row, code, first, tail);
    }
    // The unsigned file, read like any file the agent's folder could hold (no symlinks, a size cap), then removed.
    let unsigned: Buffer;
    try {
      unsigned = readGameFile(dir, rel, MAX_UNSIGNED);
    } catch (e) {
      return this.fail(row, "store", `no unsigned file: ${(e as Error).message}`, tail);
    } finally {
      dropUnsigned();
    }
    await this.transition(row.id, { status: "signing", icon: r.icon });
    const work = join(config.android.exportsDir, row.id);
    rmSync(work, { recursive: true, force: true });
    mkdirSync(work, { recursive: true, mode: 0o750 });
    writeFileSync(join(work, `unsigned.${row.format}`), unsigned, { mode: 0o640 });
    const expect: Expected = { format: row.format, packageName: app.packageName, versionCode: row.versionCode, versionName: row.versionName, certSha256: app.key.certSha256 };
    const material = open(this.keys!, row.projectId, Buffer.from(app.key.blob));
    const result = await this.signer!.ops.sign({ buildId: row.id, ext: row.format, p12: material.p12, password: material.password, expect });
    if (!result.ok) return this.fail(row, result.problem, result.reasons.join("; "), tail);
    const signed = readFileSync(join(work, `signed.${row.format}`));
    let stored: Awaited<ReturnType<typeof putBuild>> | null = null;
    for (let i = 0; i < 3 && !stored; i++) {
      try {
        stored = await putBuild(row.projectId, row.id, row.format, signed);
      } catch (e) {
        this.log.warn(`android ${row.id}: store try ${i + 1}: ${e}`);
        await sleep(2_000 * (i + 1));
      }
    }
    if (!stored) return this.fail(row, "store", "", tail);
    const done = await this.transition(row.id, {
      status: "done",
      path: stored.path,
      bytes: stored.bytes,
      sha256: stored.sha256,
      checks: result.inspect as unknown as Prisma.InputJsonValue,
      logTail: tail || undefined,
      finishedAt: new Date(),
      expiresAt: new Date(Date.now() + EXPIRE_DAYS * DAY_MS),
    });
    // The first Play package fixes the package name (a change would make a new app on Play).
    if (row.format === "aab" && !app.packageLockedAt) await this.prisma.androidApp.update({ where: { projectId: row.projectId }, data: { packageLockedAt: new Date() } });
    const checks = checksOf(expect, result.inspect);
    this.log.log(`android ${row.id} done: ${(stored.bytes / 1e6).toFixed(1)} MB, ${checks.filter((c) => !c.ok).length ? "checks: " + checks.filter((c) => !c.ok).map((c) => c.id).join(", ") : "all checks green"}`);
    return done;
  }

  /** A game failure's first error line, so GOTCHAS can learn from it (agent-logs/errors.jsonl, like the check's). */
  private learn(row: BuildRow, error: string) {
    try {
      const dir = join(config.dataDir, "agent-logs");
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      appendFileSync(join(dir, "errors.jsonl"), JSON.stringify({ at: new Date().toISOString(), kind: "android-export", project: row.projectId, build: row.id, error }) + "\n");
    } catch {
      // a note, not a step
    }
  }

  async cancelBuild(user: User, projectId: string, buildId: string): Promise<AndroidBuildView> {
    await this.views.owned(user.id, projectId);
    const row = await this.prisma.androidBuild.findFirst({ where: { id: buildId, projectId } });
    if (!row) throw notFound("We couldn't find that build.");
    if (row.status === "queued") {
      // In one step too: a row the queue has claimed since (it is `running` now) is stopped through its job below.
      const stopped = await this.prisma.androidBuild.updateMany({ where: { id: buildId, status: "queued" }, data: { status: "cancelled", failCode: null, failMessage: CANCELLED_TEXT, finishedAt: new Date() } });
      if (stopped.count) {
        this.log.log(`android ${buildId}: cancelled`);
        const cancelled = await this.prisma.androidBuild.findUniqueOrThrow({ where: { id: buildId } });
        await this.emit(cancelled);
        return this.view(cancelled);
      }
    }
    const active = this.running.get(buildId);
    if (active) {
      active.cancelled = true;
      active.handle?.kill();
      await active.finished;
    }
    return this.view(await this.prisma.androidBuild.findUniqueOrThrow({ where: { id: buildId } }));
  }

  /** Stops whatever this game has going (before the game is deleted). */
  async cancelAll(projectId: string): Promise<void> {
    for (const [id, a] of this.running) {
      if (a.projectId !== projectId) continue;
      a.cancelled = true;
      a.handle?.kill();
      await a.finished;
      this.running.delete(id);
    }
    const queued = await this.prisma.androidBuild.findMany({ where: { projectId, status: "queued" } });
    for (const row of queued) await this.fail(row, "cancelled");
  }

  // --- downloads and links ------------------------------------------------------------------------

  private async doneBuild(user: User, projectId: string, buildId: string) {
    const project = await this.views.owned(user.id, projectId);
    const row = await this.prisma.androidBuild.findFirst({ where: { id: buildId, projectId } });
    if (!row) throw notFound("We couldn't find that build.");
    if (row.status === "expired") throw new ApiException(410, "not_found", "This build's file is gone (files are kept for 30 days). Build it again.");
    if (row.status !== "done" || !row.path) throw notFound("This build has no file to download.");
    return { project, row, filename: `${fileSlug(project.name)}-v${row.versionCode}.${row.format}` };
  }

  async download(user: User, projectId: string, buildId: string) {
    const { row, filename } = await this.doneBuild(user, projectId, buildId);
    const file = await openBuild(row.path!);
    if (!file) throw new ApiException(410, "not_found", "This build's file is gone. Build it again.");
    return { ...file, filename, mime: MIME[row.format] };
  }

  /**
   * A 10-minute phone link for a finished build. Always the short `${API_PUBLIC_URL}/android/dl/<token>`, in every store
   * mode: the site draws it as a QR code, and a presigned storage URL (~450 characters) is too long for one. What the link
   * leads to is decided when it is opened (`downloadByToken`).
   */
  async link(user: User, projectId: string, buildId: string): Promise<AndroidLink> {
    const { row, filename } = await this.doneBuild(user, projectId, buildId);
    const expiresAt = Date.now() + config.android.linkSeconds * 1000;
    const token = newToken();
    this.links.set(token, { projectId, buildId: row.id, path: row.path!, filename, ext: row.format, expiresAt });
    return { url: phoneLinkUrl(config.publicUrl, token), expiresAt: new Date(expiresAt).toISOString() };
  }

  /**
   * What the phone link leads to (no sign-in; the token is the secret). The checks: the link has not run out (10 minutes),
   * it is for this one build, and the build is still there (the 30-day sweep or a deleted game can take it within the
   * link's life). R2: a redirect to a presigned URL made now, for a few minutes at most and never past the link's own end;
   * the folder store: the file to stream.
   */
  async downloadByToken(token: string): Promise<PhoneTarget> {
    const now = Date.now();
    for (const [t, l] of this.links) if (l.expiresAt < now) this.links.delete(t);
    const match = [...this.links.entries()].find(([t]) => sameToken(t, token));
    if (!match) throw notFound("This link has expired. Make a new one on the game's Android page.");
    const link = match[1];
    const row = await this.prisma.androidBuild.findUnique({ where: { id: link.buildId }, select: { projectId: true, status: true, path: true } });
    if (!row || row.projectId !== link.projectId || row.status !== "done" || row.path !== link.path) throw notFound("This build's file is gone. Build it again.");
    const presigned = presignBuild(link.path, link.filename, presignSeconds(link.expiresAt, now));
    if (presigned) return { redirect: presigned };
    const file = await openBuild(link.path);
    if (!file) throw notFound("This build's file is gone. Build it again.");
    return { ...file, filename: link.filename, mime: MIME[link.ext] };
  }

  /**
   * The app's icon picture (owner only): the PNG the user uploaded, else the game's start-screen picture a build would
   * use as the launcher icon's source (Godot crops it square at build time; this one is as it is). 404 without Android
   * setup, or when the game has neither.
   */
  async icon(user: User, projectId: string): Promise<Buffer> {
    const project = await this.views.owned(user.id, projectId);
    const app = await this.prisma.androidApp.findUnique({ where: { projectId } });
    if (!app) throw notFound("Set up Android for this game first.");
    const version = project.currentVersion ? await this.prisma.version.findUnique({ where: { projectId_n: { projectId, n: project.currentVersion } }, select: { buildId: true } }) : null;
    const icon = this.iconFor(app, projectDir(projectId), version?.buildId ?? "");
    if (!icon) throw notFound("This game has no icon picture yet: upload one, or its start screen is used once it has one.");
    return icon.png;
  }

  // --- the key ------------------------------------------------------------------------------------

  async keyZip(user: User, projectId: string): Promise<{ file: string; data: Buffer }> {
    const project = await this.views.owned(user.id, projectId);
    this.requirePaid(user);
    const app = await this.appOf(projectId);
    if (!app?.key || !this.keys) throw notFound("This game has no Android key yet: set up Android first.");
    const today = (this.keyDownloads.get(projectId) ?? []).filter((t) => t > Date.now() - DAY_MS);
    if (today.length >= KEY_DOWNLOADS_A_DAY) throw new ApiException(429, "too_many", `The key can be downloaded ${KEY_DOWNLOADS_A_DAY} times a day. Try again tomorrow.`);
    const material = open(this.keys, projectId, Buffer.from(app.key.blob));
    const slug = fileSlug(project.name);
    const fp = app.key.certSha256.toUpperCase().match(/.{2}/g)!.join(":");
    const readme = [
      `${app.appName}: Android signing key (upload key)`,
      "",
      `File: ${slug}-upload-key.jks (a PKCS12 keystore)`,
      "Key alias: upload",
      `Password (keystore and key): ${material.password}`,
      `Certificate SHA-256: ${fp}`,
      `Package name: ${app.packageName}`,
      "",
      "This file signs the Android builds of this game. Google Play keeps the real signing key for you",
      "(Play App Signing); this one proves it is you who uploads. Keep it with the password: you need it",
      "to publish updates from your own computer, and anyone who has it can upload versions of your game.",
      "If you lose it, Google can replace it: Play Console > Protected with Play > Play Store protection >",
      "Manage Play app signing > Request upload key reset (the new key works about two days later).",
      "TypePlay keeps an encrypted copy so your builds here keep working.",
      "",
      "In Godot: Project > Export > Android > Keystore: Release = this file, User = upload, Password = the one above.",
      "In Android Studio or Gradle: storeFile = this file, storePassword = keyPassword = the one above, keyAlias = upload.",
    ].join("\r\n") + "\r\n";
    const data = zip([
      { name: `${slug}-upload-key.jks`, data: material.p12 },
      { name: "README.txt", data: Buffer.from(readme) },
    ]);
    today.push(Date.now());
    this.keyDownloads.set(projectId, today);
    await this.prisma.androidKey.update({ where: { projectId }, data: { downloadedAt: new Date(), downloads: { increment: 1 } } });
    this.log.log(`android ${projectId}: key downloaded (${app.key.downloads + 1} times)`);
    return { file: `${slug}-upload-key.zip`, data };
  }

  // --- housekeeping -------------------------------------------------------------------------------

  /** Done builds past their 30 days: the file goes, the row says expired. */
  async sweep() {
    const due = await this.prisma.androidBuild.findMany({ where: { status: "done", expiresAt: { lt: new Date() } }, take: 200 });
    for (const b of due) {
      if (b.path) await deleteBuild(b.path).catch((e) => this.log.warn(`expire ${b.id}: ${e}`));
      await this.transition(b.id, { status: "expired", path: null });
    }
    if (due.length) this.log.log(`expired ${due.length} Android build file(s)`);
    const now = Date.now();
    for (const [t, l] of this.links) if (l.expiresAt < now) this.links.delete(t);
  }

  /** A deleted game: its builds' files (the rows go with the project, cascade). */
  async removeProject(projectId: string): Promise<void> {
    const rows = await this.prisma.androidBuild.findMany({ where: { projectId }, select: { path: true } });
    await removeProjectBuilds(projectId, rows.map((r) => r.path).filter((p): p is string => !!p)).catch((e) => this.log.error(`remove android files ${projectId}: ${e}`));
  }

  /** For GET /me/export: the package, the key's fingerprint and the builds; never the key. */
  async exportFor(projectId: string): Promise<{ packageName: string; certSha256: string; builds: AndroidBuildView[] } | null> {
    const app = await this.appOf(projectId);
    if (!app?.key) return null;
    const rows = await this.prisma.androidBuild.findMany({ where: { projectId }, orderBy: { queuedAt: "desc" } });
    return { packageName: app.packageName, certSha256: app.key.certSha256, builds: rows.map((b) => this.toBuild(b, { packageName: app.packageName, certSha256: app.key!.certSha256 })) };
  }

  /** The checks list for a row (admin, tests). */
  checksFor(row: BuildRow, packageName: string, certSha256: string): AndroidCheck[] {
    const inspect = row.checks as Inspect | null;
    if (!inspect) return [];
    return checksOf({ format: row.format, packageName, versionCode: row.versionCode, versionName: row.versionName, certSha256 }, inspect);
  }

  /** The seal/open pair, for the unit test (no database). */
  static sealFor(keys: MasterKeys, projectId: string, p12: Buffer, password: string) {
    return seal(keys, projectId, { p12, password });
  }

  static sha256(data: Buffer) {
    return createHash("sha256").update(data).digest("hex");
  }
}
