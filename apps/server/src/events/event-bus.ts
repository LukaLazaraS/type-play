// Live run events per project, in memory (one server process). Package 5 may swap this for
// Postgres LISTEN/NOTIFY or Redis when there is more than one process.
import { Injectable } from "@nestjs/common";
import type { RunEvent, RunNotice } from "@typeplay/shared";

type Listener = (e: RunEvent) => void;
type NoticeListener = (n: RunNotice, id: number) => void;

/** How long an account's notices are kept for a page that reconnects (Last-Event-ID), and how many at most. */
const KEEP_MS = 30 * 60_000;
const KEEP_MAX = 20;

@Injectable()
export class EventBus {
  private readonly listeners = new Map<string, Set<Listener>>();
  /** The account streams (GET /me/events, notifications 2026-10-29), by user. */
  private readonly accounts = new Map<string, Set<NoticeListener>>();
  /** Each account's recent notices with their event ids (server ms), oldest first. */
  private readonly recent = new Map<string, { id: number; notice: RunNotice }[]>();
  private lastId = 0;

  subscribe(projectId: string, fn: Listener): () => void {
    let set = this.listeners.get(projectId);
    if (!set) this.listeners.set(projectId, (set = new Set()));
    set.add(fn);
    return () => {
      set.delete(fn);
      if (!set.size) this.listeners.delete(projectId);
    };
  }

  emit(projectId: string, e: RunEvent) {
    for (const fn of this.listeners.get(projectId) ?? []) {
      try {
        fn(e);
      } catch {
        // a broken stream must not stop the others
      }
    }
  }

  /** An event id: the server's clock in ms, never the same twice nor going back while this process runs. */
  nextId(): number {
    this.lastId = Math.max(Date.now(), this.lastId + 1);
    return this.lastId;
  }

  subscribeAccount(userId: string, fn: NoticeListener): () => void {
    let set = this.accounts.get(userId);
    if (!set) this.accounts.set(userId, (set = new Set()));
    set.add(fn);
    return () => {
      set.delete(fn);
      if (!set.size) this.accounts.delete(userId);
    };
  }

  /** A build of the account's ended: to its open pages now, and kept a while for the ones that reconnect. */
  notify(userId: string, notice: RunNotice) {
    const id = this.nextId();
    // Accounts whose newest notice is past the time go (nothing else would drop them).
    for (const [user, list] of this.recent) if (list[list.length - 1].id <= id - KEEP_MS) this.recent.delete(user);
    const kept = (this.recent.get(userId) ?? []).filter((k) => k.id > id - KEEP_MS);
    kept.push({ id, notice });
    this.recent.set(userId, kept.slice(-KEEP_MAX));
    for (const fn of this.accounts.get(userId) ?? []) {
      try {
        fn(notice, id);
      } catch {
        // a broken stream must not stop the others
      }
    }
  }

  /** The account's kept notices after event id `after` (what a reconnecting page missed). */
  noticesAfter(userId: string, after: number): { id: number; notice: RunNotice }[] {
    const now = Date.now();
    const kept = (this.recent.get(userId) ?? []).filter((k) => k.id > now - KEEP_MS);
    if (kept.length) this.recent.set(userId, kept);
    else this.recent.delete(userId);
    return kept.filter((k) => k.id > after);
  }
}
