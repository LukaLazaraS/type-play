// Notifications on this device (Web Push, 2026-10-29; apps/web/README.md "Notifications"): whether the browser can, its
// permission, the service worker (public/sw.js, registered only here) and the subscription the API keeps (POST /me/push).
// Never on page load: the site asks first (components/app/NotifyAsk.tsx), and the browser's prompt comes only after a yes
// there or the switch on /account.
import type { PushSubscriptionBody } from "@typeplay/shared";
import { app } from "@/content/app";
import { api } from "./api";

/** The account this device's subscription was made for: another account signing in here never inherits it. */
const OWNER = "typeplay.push.owner";
/** The address last given to the API in this tab, so a page load doesn't write it again. */
const SYNCED = "typeplay.push.synced";
/** The site's question was answered on this device, per account (yes or no thanks): it never comes back. */
const ASKED = "typeplay.notify.asked.";

/**
 * yes: this browser can (the question and the switch show). homescreen: an iPhone or iPad in Safari, which can only once
 * TypePlay is on the Home Screen (iOS 16.4+). no: no push here (an old browser, or a site without the key).
 */
export type PushSupport = "yes" | "homescreen" | "no";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined" || !app.vapidPublicKey) return "no";
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "yes";
  // iPadOS says it is a Mac; its touch screen gives it away.
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return apple ? "homescreen" : "no";
}

const local = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* private mode: nothing kept */
    }
  },
};

export const wasAsked = (userId: string) => local.get(ASKED + userId) !== null;
export const markAsked = (userId: string) => local.set(ASKED + userId, new Date().toISOString());

/** The key as the browser wants it: bytes, from the base64url text. */
function serverKey(): Uint8Array<ArrayBuffer> {
  const b64 = app.vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const sameKey = (sub: PushSubscription) => {
  const key = sub.options.applicationServerKey;
  if (!key) return false;
  const a = new Uint8Array(key);
  const b = serverKey();
  return a.length === b.length && a.every((x, i) => x === b[i]);
};

/** This site's service worker registration, if it has one (only devices that turned notifications on). */
const registration = () => navigator.serviceWorker.getRegistration("/").catch(() => undefined);

/** on: this browser has a subscription made for this account, with permission; blocked: the permission is refused. */
export async function deviceState(userId: string): Promise<"on" | "off" | "blocked"> {
  if (pushSupport() !== "yes") return "off";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted" || local.get(OWNER) !== userId) return "off";
  const sub = await (await registration())?.pushManager.getSubscription().catch(() => null);
  return sub ? "on" : "off";
}

/**
 * Turns notifications on for this device, from a tap (the question's yes, or the switch): the browser's prompt first,
 * straight from the tap (Safari allows it nowhere else), then the service worker, the subscription and the API's copy.
 * on; blocked (no, now or before: only the browser's settings change it); dismissed (the prompt closed without an
 * answer); failed (this browser couldn't: its push service didn't answer, or the API didn't).
 */
export async function turnOn(userId: string): Promise<"on" | "blocked" | "dismissed" | "failed"> {
  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return "failed";
  }
  if (permission === "denied") return "blocked";
  if (permission !== "granted") return "dismissed";
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    // One made with another key (a key changed since) can't get our pushes: a new one.
    if (sub && !sameKey(sub)) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey() });
    await api.push.on(sub.toJSON() as PushSubscriptionBody);
    local.set(OWNER, userId);
    session(SYNCED, sub.endpoint);
    return "on";
  } catch {
    return "failed";
  }
}

/** Turns them off for this device (the switch, and every sign-out): the API's copy, then the subscription. Never throws. */
export async function turnOff(): Promise<void> {
  local.set(OWNER, null);
  session(SYNCED, null);
  if (pushSupport() !== "yes") return;
  const sub = await (await registration())?.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  // Offline, or signed out already: the push service answers the next push with 410 and the API drops the row then.
  await api.push.off(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/**
 * At the app's start, once per tab: a device with notifications on gives the API its subscription again when it changed
 * (a browser replaces one now and then: sw.js) and gets the newest service worker; one another account turned on here is
 * turned off (it was never this account's yes).
 */
export async function syncDevice(userId: string): Promise<void> {
  if (pushSupport() !== "yes" || Notification.permission !== "granted") return;
  const reg = await registration();
  if (!reg) return;
  void reg.update().catch(() => {});
  const sub = await reg.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  if (local.get(OWNER) !== userId) return turnOff();
  if (session(SYNCED) === sub.endpoint) return;
  await api.push.on(sub.toJSON() as PushSubscriptionBody).catch(() => {});
  session(SYNCED, sub.endpoint);
}

/** This device's notifications for a game, or for one build end, closed: the player is looking at it on the site. */
export async function closeShown(match: { projectId?: string; messageId?: string }): Promise<void> {
  if (pushSupport() !== "yes") return;
  const shown = (await (await registration())?.getNotifications().catch(() => [])) ?? [];
  for (const n of shown) {
    const data = n.data as { projectId?: string; messageId?: string } | null;
    if ((match.projectId && data?.projectId === match.projectId) || (match.messageId && data?.messageId === match.messageId)) n.close();
  }
}

/** sessionStorage, quietly: get with one argument, set (or remove with null) with two. */
function session(key: string, value?: string | null): string | null {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* nothing kept */
  }
  return null;
}
