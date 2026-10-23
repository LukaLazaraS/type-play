"use client";

import { useState } from "react";
import type { Version } from "@typeplay/shared";
import { ago } from "@/lib/format";

/** Every version the game has had, newest first. Restoring brings an old one back as a new version. */
export function Versions({
  versions,
  current,
  running,
  onRestore,
}: {
  versions: Version[];
  current: number | null;
  running: boolean;
  onRestore: (n: number) => Promise<void>;
}) {
  const [asking, setAsking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!versions.length) return null;

  const sorted = [...versions].sort((a, b) => b.n - a.n);
  const next = sorted[0].n + 1;

  const restore = async (n: number) => {
    setBusy(true);
    setError(null);
    try {
      await onRestore(n);
      setAsking(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="versions" aria-labelledby="versions-title">
      <div className="versions__head">
        <h2 id="versions-title" className="versions__title">
          Versions
        </h2>
        {error ? (
          <p className="versions__error" role="alert">
            {error}
          </p>
        ) : (
          running && <p className="versions__note">You can go back once this build is done.</p>
        )}
      </div>
      <ol className="versions__strip">
        {sorted.map((v) => {
          const now = v.n === current;
          return (
            <li key={v.n} className="version" data-current={now || undefined}>
              {asking === v.n ? (
                <>
                  <p className="version__ask">
                    Play version {v.n} again? It comes back as version {next}, and nothing is lost.
                  </p>
                  <div className="version__actions">
                    <button type="button" className="button button--small" disabled={busy} onClick={() => void restore(v.n)}>
                      {busy ? "Restoring…" : "Restore"}
                    </button>
                    <button type="button" className="inkpill inkpill--small" disabled={busy} onClick={() => setAsking(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="figures version__n">
                    Version {v.n} · {ago(v.createdAt)}
                  </span>
                  <p className="version__label" title={v.label}>
                    {v.label}
                  </p>
                  {now ? (
                    <span className="version__now figures">Playing now</span>
                  ) : (
                    <button
                      type="button"
                      className="inkpill inkpill--small version__restore"
                      disabled={running}
                      onClick={() => {
                        setError(null);
                        setAsking(v.n);
                      }}
                    >
                      Restore
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
