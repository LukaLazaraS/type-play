// Live run events per project, in memory (one server process). Package 5 may swap this for
// Postgres LISTEN/NOTIFY or Redis when there is more than one process.
import { Injectable } from "@nestjs/common";
import type { RunEvent } from "@typeplay/shared";

type Listener = (e: RunEvent) => void;

@Injectable()
export class EventBus {
  private readonly listeners = new Map<string, Set<Listener>>();

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
}
