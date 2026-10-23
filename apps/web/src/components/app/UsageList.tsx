"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { UsageEntry } from "@typeplay/shared";
import { api } from "@/lib/api";
import { credits, whenParts } from "@/lib/format";

type Load = { status: "loading" } | { status: "ok" } | { status: "error"; message: string };

/** The credit history: every credit added and spent, newest first, 25 at a time. */
export function UsageList() {
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [more, setMore] = useState(false);

  const fetchPage = useCallback(async (cursor: string | null) => {
    const page = await api.usage(cursor);
    setEntries((old) => (cursor ? [...old, ...page.entries.filter((e) => !old.some((o) => o.id === e.id))] : page.entries));
    setNext(page.next);
  }, []);

  useEffect(() => {
    let live = true;
    api
      .usage(null)
      .then((page) => {
        if (!live) return;
        setEntries(page.entries);
        setNext(page.next);
        setLoad({ status: "ok" });
      })
      .catch((e: Error) => live && setLoad({ status: "error", message: e.message }));
    return () => {
      live = false;
    };
  }, []);

  const showMore = async () => {
    setMore(true);
    try {
      await fetchPage(next);
      setLoad({ status: "ok" });
    } catch (e) {
      setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setMore(false);
    }
  };

  if (load.status === "loading") {
    return (
      <ol className="usage" aria-busy="true" aria-label="Loading your credit history">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="usage__row usage__row--ghost" aria-hidden="true">
            <span />
            <span />
            <span />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <>
      {entries.length === 0 && load.status === "ok" ? (
        <p className="usage__empty">Nothing here yet. Each build will show up here with what it cost.</p>
      ) : (
        <ol className="usage">
          {entries.map((e) => (
            <li key={e.id} className="usage__row">
              <When iso={e.at} />
              <div className="usage__what">
                <b>{e.what}</b>
                {e.game ? (
                  <Link href={`/games/${e.game.id}`} className="usage__game" prefetch={false}>
                    {e.game.name}
                  </Link>
                ) : (
                  e.gameDeleted && <span className="usage__game usage__game--gone">A game you deleted</span>
                )}
                {e.prompt && <q className="usage__prompt">{e.prompt}</q>}
              </div>
              <span className="figures usage__amount" data-plus={e.amount > 0 || undefined}>
                <span className="sr-only">{e.amount > 0 ? "added" : "spent"} </span>
                {e.amount > 0 ? "+" : "−"}
                {credits(Math.abs(e.amount))}
              </span>
            </li>
          ))}
        </ol>
      )}
      {load.status === "error" && (
        <div className="usage__problem" role="alert">
          <p className="composer__error">{load.message}</p>
          <button type="button" className="button button--quiet button--small" onClick={() => void showMore()} disabled={more}>
            Try again
          </button>
        </div>
      )}
      {next && load.status === "ok" && (
        <button type="button" className="button button--quiet button--small usage__more" onClick={() => void showMore()} disabled={more}>
          {more ? "Loading…" : "Show more"}
        </button>
      )}
    </>
  );
}

/** The date over the time (one line on phones), so a date with a year still fits its column. */
function When({ iso }: { iso: string }) {
  const { day, time } = whenParts(iso);
  return (
    <time className="figures usage__when" dateTime={iso}>
      <span>{day}</span> <span>{time}</span>
    </time>
  );
}
