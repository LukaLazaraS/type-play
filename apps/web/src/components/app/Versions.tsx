"use client";

import { useState } from "react";
import type { Version } from "@typeplay/shared";
import { Button } from "@/components/ui/Button";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { InkPill } from "@/components/ui/InkPill";
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
          <ErrorLine tone="sky">{error}</ErrorLine>
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
                    <Button size="small" busy={busy} busyLabel="Restoring…" onClick={() => void restore(v.n)}>
                      Restore
                    </Button>
                    <InkPill size="small" disabled={busy} onClick={() => setAsking(null)}>
                      Cancel
                    </InkPill>
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
                    <InkPill
                      size="small"
                      className="version__restore"
                      disabled={running}
                      onClick={() => {
                        setError(null);
                        setAsking(v.n);
                      }}
                    >
                      Restore
                    </InkPill>
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
