// The account's build ends on every page of the site (notifications, 2026-10-29; apps/web/README.md "Notifications").
// One tab of this browser reads the account's stream (GET /me/events) and writes each notice into the browser's storage,
// which every tab of the site shows from (components/app/Notices.tsx): one stream per browser, one notice per build end
// in all its tabs, and closing it in one closes it in all. Which tab reads: the one holding a Web Lock; the others wait
// for it, and the tab the player looks at takes it over when the reading tab has gone quiet (a hidden tab may be frozen).
// Without Web Locks every tab reads its own stream (the store skips a notice it already has).
import { useSyncExternalStore } from "react";
import type { RunNotice } from "@typeplay/shared";
import { watchAccount } from "./api";

/** The notices to show, newest last, and the build ends closed already (never shown again), for one account. */
type Stored = { user: string; open: RunNotice[]; closed: string[] };

const STORE = "typeplay.notices";
/** The stream's last event id: the next tab to read it starts there, and so gets what came in between. */
const LAST = "typeplay.notices.last";
/** When the reading tab last heard from the stream (ms): a heartbeat comes every 20 s. */
const ALIVE = "typeplay.notices.alive";
const LOCK = "typeplay:account-events";
const KEEP_OPEN = 5;
const KEEP_CLOSED = 60;
/** A notice older than this is not shown (a reconnect after a long sleep brings at most the API's last 30 minutes). */
const MAX_AGE_MS = 24 * 3600_000;
/** Quiet this long, the reading tab is taken to be asleep: the tab the player looks at reads instead. */
const QUIET_MS = 45_000;

const EMPTY: Stored = { user: "", open: [], closed: [] };
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Stored } = { raw: null, value: EMPTY };

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function put(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode: this tab keeps nothing */
  }
}

/** The store as it is now (the same object while nothing changed, as useSyncExternalStore needs). */
function read(): Stored {
  const raw = get(STORE);
  if (raw !== cache.raw) {
    let value = EMPTY;
    try {
      const v = raw ? (JSON.parse(raw) as Stored) : null;
      if (v && typeof v.user === "string" && Array.isArray(v.open) && Array.isArray(v.closed)) value = v;
    } catch {
      /* a broken store: start over */
    }
    cache = { raw, value };
  }
  return cache.value;
}

function write(next: Stored) {
  put(STORE, JSON.stringify(next));
  listeners.forEach((l) => l());
}

/** Changes one account's store (another account's, or none: a fresh one). */
function change(user: string, fn: (s: Stored) => Stored) {
  const now = read();
  write(fn(now.user === user ? now : { user, open: [], closed: [] }));
}

/** A build end, kept to show: one per game (its newest end replaces an older one still open, which counts as closed). */
function add(user: string, notice: RunNotice) {
  change(user, (s) => {
    if (s.closed.includes(notice.messageId) || s.open.some((n) => n.messageId === notice.messageId)) return s;
    if (Date.now() - Date.parse(notice.at) > MAX_AGE_MS) return s;
    const older = s.open.filter((n) => n.projectId === notice.projectId);
    return {
      user,
      open: [...s.open.filter((n) => n.projectId !== notice.projectId), notice].slice(-KEEP_OPEN),
      closed: [...s.closed, ...older.map((n) => n.messageId)].slice(-KEEP_CLOSED),
    };
  });
}

/** Closes notices (the player closed one, opened its game, or the build pill shows it), in every tab. */
export function closeNotices(user: string, match: (n: RunNotice) => boolean) {
  const s = read();
  if (s.user !== user || !s.open.some(match)) return;
  const gone = s.open.filter(match).map((n) => n.messageId);
  write({ ...s, open: s.open.filter((n) => !match(n)), closed: [...s.closed, ...gone].slice(-KEEP_CLOSED) });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORE || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The open notices of this account, newest last (none for another account's store). */
export function useNotices(user: string | null): RunNotice[] {
  const s = useSyncExternalStore(subscribe, read, () => EMPTY);
  return user && s.user === user ? s.open : EMPTY.open;
}

/** At sign-out: nothing of this account's stays in the browser. */
export function clearNotices() {
  stopNotices();
  put(STORE, null);
  put(LAST, null);
  put(ALIVE, null);
  listeners.forEach((l) => l());
}

let running: { user: string; stop: () => void } | null = null;

/**
 * Starts hearing the account's build ends in this tab (once; again for another account). Returns nothing: the stream
 * runs until stopNotices() (sign-out, another account) or the tab closes.
 */
export function startNotices(user: string) {
  if (running?.user === user) return;
  stopNotices();
  let stopped = false;
  /** The stream this tab reads now, if it reads it. */
  let reading: (() => void) | null = null;
  const readStream = () =>
    new Promise<void>((resolve) => {
      const stop = watchAccount(
        (e) => {
          if (e.type === "notice") add(user, e.notice);
        },
        (state) => state === "live" && put(ALIVE, String(Date.now())),
        // Signed out, or not let in: the session shows that; this tab stops reading (and lets go of the lock).
        () => {
          reading = null;
          resolve();
        },
        {
          get: () => get(LAST),
          set: (id) => {
            put(LAST, id);
            put(ALIVE, String(Date.now()));
          },
        },
      );
      reading = () => {
        reading = null;
        stop();
        resolve();
      };
    });

  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) {
    void readStream();
    running = { user, stop: () => reading?.() };
    return;
  }
  // Each request for the lock has its turn number: a request replaced by a newer one (before a takeover) does nothing.
  let turn = 0;
  let cancelWait: (() => void) | null = null;
  const take = (takeover: boolean) => {
    const mine = ++turn;
    cancelWait?.();
    const wait = new AbortController();
    cancelWait = takeover ? null : () => wait.abort();
    locks
      .request(LOCK, takeover ? { steal: true } : { signal: wait.signal }, () => (mine === turn && !stopped ? readStream() : undefined))
      .catch(() => {
        // Taken over by another tab while this one read it: stop, and wait for it again.
        if (mine !== turn || stopped) return;
        reading?.();
        take(false);
      });
  };
  const look = () => {
    if (stopped || reading || document.visibilityState !== "visible") return;
    if (Date.now() - Number(get(ALIVE) ?? 0) > QUIET_MS) take(true);
  };
  take(false);
  // Give a free lock its moment before deciding the reader is asleep.
  const first = setTimeout(look, 2_000);
  const every = setInterval(look, 15_000);
  document.addEventListener("visibilitychange", look);
  running = {
    user,
    stop: () => {
      stopped = true;
      turn++;
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener("visibilitychange", look);
      cancelWait?.();
      reading?.();
    },
  };
}

export function stopNotices() {
  running?.stop();
  running = null;
}
