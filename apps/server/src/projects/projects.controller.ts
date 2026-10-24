// The project routes of the contract (packages/shared/src/index.ts).
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Message, Project, ProjectSummary, RunEvent } from "@typeplay/shared";
import { CurrentUser } from "../auth/auth.guard.js";
import { EventBus } from "../events/event-bus.js";
import type { User } from "../generated/prisma/client.js";
import { RunRegistry } from "../runs/registry.js";
import { RunsService } from "../runs/runs.service.js";
import { ProjectsService } from "./projects.service.js";
import { ProjectViews, toMessage } from "./views.js";

@Controller("projects")
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly views: ProjectViews,
    private readonly events: EventBus,
    private readonly registry: RunRegistry,
    private readonly runs: RunsService,
  ) {}

  @Get()
  list(@CurrentUser() user: User): Promise<ProjectSummary[]> {
    return this.views.list(user.id);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: User, @Body() body: unknown): Promise<Project> {
    return this.projects.create(user, body);
  }

  @Get(":id")
  async get(@CurrentUser() user: User, @Param("id") id: string): Promise<Project> {
    await this.views.owned(user.id, id);
    return this.views.full(id);
  }

  @Post(":id/messages")
  @HttpCode(201)
  send(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown): Promise<Project> {
    return this.projects.send(user, id, body);
  }

  @Post(":id/restore")
  @HttpCode(200)
  restore(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown): Promise<Project> {
    return this.projects.restore(user, id, body);
  }

  /** Rename, share or unshare. */
  @Patch(":id")
  @HttpCode(200)
  update(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown): Promise<Project> {
    return this.projects.update(user, id, body);
  }

  @Delete(":id")
  @HttpCode(200)
  remove(@CurrentUser() user: User, @Param("id") id: string): Promise<{ ok: true }> {
    return this.projects.remove(user, id);
  }

  /** The Godot project as a .zip (the site fetches it with the sign-in header, then saves it). */
  @Get(":id/download")
  async download(@CurrentUser() user: User, @Param("id") id: string, @Res() res: Response) {
    const { file, data } = await this.projects.download(user, id);
    res.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Length": data.length,
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    });
    res.end(data);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@CurrentUser() user: User, @Param("id") id: string): Promise<Project> {
    return this.projects.cancel(user, id);
  }

  /** "More ideas": the newest answer with three new next-step suggestions (free; at most 3 times per answer). */
  @Post(":id/ideas")
  @HttpCode(200)
  async ideas(@CurrentUser() user: User, @Param("id") id: string): Promise<Message> {
    await this.views.owned(user.id, id);
    return toMessage(await this.runs.moreIdeas(id));
  }

  /** Server-Sent Events: a snapshot first, then the project's run events; a heartbeat comment every 20 s. */
  @Get(":id/events")
  async stream(@CurrentUser() user: User, @Param("id") id: string, @Req() req: Request, @Res() res: Response) {
    await this.views.owned(user.id, id); // 404 before the stream opens
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    const send = (e: RunEvent) => res.write(`data: ${JSON.stringify(e)}\n\n`);
    // Listen first and hold events until the snapshot is out, so nothing falls in between.
    let held: RunEvent[] | null = [];
    const unsubscribe = this.events.subscribe(id, (e) => (held ? held.push(e) : send(e)));
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);
    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    req.on("close", close);
    try {
      send({ type: "snapshot", project: await this.views.full(id) });
      const progress = this.registry.active.get(id)?.lastProgress;
      if (progress && !held.some((e) => e.type === "progress")) send(progress); // the "building…" line so far
      for (const e of held) send(e);
      held = null;
    } catch {
      close();
      res.end();
    }
  }
}
