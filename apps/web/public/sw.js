// TypePlay's service worker: build notifications only (Web Push, 2026-10-29; apps/web/README.md "Notifications"). No
// caching and no fetch handler: every page and file loads from the network exactly as without it. Registered only on a
// device that turns notifications on (src/lib/push.ts).
//
// A push is a build's end (RunNotice from the API, JSON with v: 1): it shows as one system notification per build end
// (`tag`), which opens the game's page. While a page of the site is on screen the site tells the player itself (the
// notice, the chat), so Chromium and Firefox show nothing more; WebKit (Safari, and every browser on iPhone and iPad) takes
// the permission away after three pushes that show nothing, even with the site on screen, so there it shows, quietly.

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png";
const ua = self.navigator.userAgent;
const WEBKIT = /iPhone|iPad|iPod/.test(ua) || (/AppleWebKit/.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua));

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let n = null;
      try {
        n = event.data ? event.data.json() : null;
      } catch {
        n = null;
      }
      // Something we can't read still shows (never a push without a notification): the way to the games.
      if (!n || n.v !== 1 || typeof n.title !== "string") n = { title: "TypePlay", body: "One of your games has news.", url: "/games", tag: "typeplay" };
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const looking = windows.some((w) => w.visibilityState === "visible");
      if (looking && !WEBKIT) return;
      await self.registration.showNotification(n.title, {
        body: n.body,
        tag: n.tag,
        icon: ICON,
        badge: BADGE,
        silent: looking,
        timestamp: n.at ? Date.parse(n.at) : Date.now(),
        data: { url: n.url || "/games", projectId: n.projectId || null, messageId: n.messageId || null },
      });
    })().catch(() => self.registration.showNotification("TypePlay", { body: "One of your games has news.", tag: "typeplay", icon: ICON, data: { url: "/games" } })),
  );
});

// A tap on the notification: the game's page, in a tab that already shows it, or a new one (never over a page the
// player has open elsewhere on the site).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/games", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = windows.find((w) => w.url.split("#")[0] === url);
      if (same) return same.focus();
      return self.clients.openWindow(url);
    })(),
  );
});

// The browser replaced the subscription (it expired, or its keys changed): a new one with the same key, so pushes keep
// coming. The API learns the new address from the site's next start (src/lib/push.ts `syncDevice`): a worker has no
// sign-in to send it with.
self.addEventListener("pushsubscriptionchange", (event) => {
  const key = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
  if (!key) return;
  event.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).catch(() => {}));
});
