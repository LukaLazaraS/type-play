"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Play } from "@phosphor-icons/react";
import type { RunNotice } from "@typeplay/shared";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { InkPillLink } from "@/components/ui/InkPill";
import { Toast } from "@/components/ui/Toast";
import { closeNotices, startNotices, stopNotices, useNotices } from "@/lib/notices";
import { closeShown, syncDevice } from "@/lib/push";
import { useWaiting } from "./WhileYouWait";

/** At most this many show at once, the newest; closing one brings back the one before it. */
const SHOWN = 3;
const ICON_SVG = "/icons/attention.svg";
const ICON_PNG = "/icons/attention-32.png";

/**
 * The game's name in 700 and what happened after it ("Spike Cat is ready", "Spike Cat: your change didn't work"). A long
 * name gives way on its one line, the colon stays with it, and what happened always shows.
 */
function Who({ notice: n }: { notice: RunNotice }) {
  const after = n.title.startsWith(n.name) ? n.title.slice(n.name.length) : `: ${n.title}`;
  const colon = after.startsWith(":");
  return (
    <>
      <span className="runnotice__who">
        <b>{n.name}</b>
        {colon && ":"}
      </span>
      {colon ? after.slice(1) : after}
    </>
  );
}

/**
 * The account's build ends, on every page but the game's own (notifications, 2026-10-29): a toast per build end with the
 * game's name, what happened and the way to it, until the player closes it (in every tab of the site at once). While the
 * tab is in the background, its title and icon say so too, until the player looks at it. The game's own page says it in
 * the chat: no toast there, and on screen it closes the game's toasts and its notifications on this device. The game the
 * build pill follows is the build pill's to tell (in this tab).
 */
export function Notices({ userId }: { userId: string }) {
  const pathname = usePathname();
  const page = /^\/games\/([^/]+)\/?$/.exec(pathname)?.[1] ?? null;
  const waiting = useWaiting();
  const notices = useNotices(userId);
  const [said, setSaid] = useState("");
  const [attention, setAttention] = useState<{ count: number; notice: RunNotice } | null>(null);
  // The build ends this tab has heard of: those already open when it opened are not news.
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    startNotices(userId);
    void syncDevice(userId);
    return () => stopNotices();
  }, [userId]);

  // News: read out (when this tab shows it), and the tab's title and icon while it is in the background.
  useEffect(() => {
    if (!known.current) {
      known.current = new Set(notices.map((n) => n.messageId));
      return;
    }
    const fresh = notices.filter((n) => !known.current!.has(n.messageId));
    if (!fresh.length) return;
    fresh.forEach((n) => known.current!.add(n.messageId));
    const last = fresh[fresh.length - 1];
    if (last.projectId !== page && last.projectId !== waiting) setSaid(`${last.title}. ${last.body}`);
    if (document.visibilityState !== "visible") setAttention((a) => ({ count: (a?.count ?? 0) + fresh.length, notice: last }));
  }, [notices, page, waiting]);

  // Its notice closed in another tab (seen there): the title goes back too.
  if (attention && !notices.some((n) => n.messageId === attention.notice.messageId)) setAttention(null);

  // The game's own page on screen: its notices are seen.
  useEffect(() => {
    if (!page) return;
    const look = () => {
      if (document.visibilityState !== "visible") return;
      closeNotices(userId, (n) => n.projectId === page);
      void closeShown({ projectId: page });
    };
    look();
    document.addEventListener("visibilitychange", look);
    return () => document.removeEventListener("visibilitychange", look);
  }, [page, userId, notices]);

  // The build pill let go of its game (the player closed it, or went to the game): its news is told.
  const followed = useRef(waiting);
  useEffect(() => {
    const was = followed.current;
    followed.current = waiting;
    if (was && was !== waiting) closeNotices(userId, (n) => n.projectId === was);
  }, [waiting, userId]);

  useTabAttention(attention, () => setAttention(null));

  const close = (n: RunNotice) => {
    closeNotices(userId, (m) => m.messageId === n.messageId);
    void closeShown({ messageId: n.messageId });
  };
  const shown = notices.filter((n) => n.projectId !== page && n.projectId !== waiting).slice(-SHOWN);

  return (
    <>
      {/* One polite line says each build end once; the toasts themselves aren't live (they would say it again). */}
      <p className="sr-only" role="status">
        {said}
      </p>
      {shown.map((n) => (
        <Toast key={n.messageId} className="runnotice" closeLabel={`Close: ${n.name}`} onClose={() => close(n)}>
          <span className="runnotice__text">
            <Who notice={n} />.{n.kind === "failed" && " Nothing was charged."}
          </span>
          {/* A phone shows the icon alone (as the build pill's arrow): the words get the room. */}
          {n.kind === "ready" ? (
            <ButtonLink href={n.url} size="small" className="runnotice__go" aria-label={`Play ${n.name}`}>
              <Play size={16} weight="fill" aria-hidden="true" />
              <span className="runnotice__label">Play it</span>
            </ButtonLink>
          ) : (
            <InkPillLink
              href={n.url}
              size="small"
              className="runnotice__go"
              aria-label={`${n.kind === "toobig" ? "See why" : "See what to do"}: ${n.name}`}
              icon={<ArrowRight size={16} weight="bold" aria-hidden="true" />}
              iconAfter
              label={n.kind === "toobig" ? "See why" : "See what to do"}
            />
          )}
        </Toast>
      ))}
    </>
  );
}

/**
 * While the tab is in the background and a build ended: "(1) Spike Cat is ready" as its title and the icon with the hot
 * dot, until the player looks at the tab. A page that changes its own title meanwhile (a game named by its first build)
 * keeps its new title for afterwards.
 */
function useTabAttention(attention: { count: number; notice: RunNotice } | null, onSeen: () => void) {
  const seen = useRef(onSeen);
  useEffect(() => {
    seen.current = onSeen;
  });
  useEffect(() => {
    if (!attention) return;
    const title = `(${attention.count}) ${attention.notice.title}`;
    let base = document.title;
    document.title = title;
    const observer = new MutationObserver(() => {
      if (document.title === title) return;
      base = document.title;
      document.title = title;
    });
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    const icons = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')].map((link) => ({ link, href: link.getAttribute("href"), type: link.getAttribute("type") }));
    for (const { link, type, href } of icons) {
      const svg = type === "image/svg+xml" || /\.svg(\?|$)/.test(href ?? "");
      link.setAttribute("href", svg ? ICON_SVG : ICON_PNG);
      link.setAttribute("type", svg ? "image/svg+xml" : "image/png");
    }
    const look = () => document.visibilityState === "visible" && seen.current();
    document.addEventListener("visibilitychange", look);
    return () => {
      document.removeEventListener("visibilitychange", look);
      observer.disconnect();
      document.title = base;
      for (const { link, href, type } of icons) {
        if (href === null) link.removeAttribute("href");
        else link.setAttribute("href", href);
        if (type === null) link.removeAttribute("type");
        else link.setAttribute("type", type);
      }
    };
  }, [attention]);
}
