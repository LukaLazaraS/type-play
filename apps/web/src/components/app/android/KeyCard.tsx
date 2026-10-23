"use client";

import { useState } from "react";
import type { AndroidKeyInfo } from "@typeplay/shared";
import { android } from "@/content/android";
import { api, saveFile } from "@/lib/api";
import { dayOf } from "@/lib/format";

/** The game's upload key: what it is in one breath, the download, and what to do if it is lost behind a toggle. */
export function KeyCard({ projectId, info, onDownloaded }: { projectId: string; info: AndroidKeyInfo; onDownloaded: () => void }) {
  const t = android.key;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      saveFile(await api.android.keyZip(projectId));
      onDownloaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // In pairs with colons, as Play Console and keytool print it, so two copies compare by eye; the
  // line may break only between groups of four pairs.
  const groups = info.certSha256.toUpperCase().match(/.{1,8}/g)?.map((g) => g.match(/.{1,2}/g)!.join(":")) ?? [info.certSha256];
  return (
    <section className="widget acct__card droid__key" aria-labelledby="droid-key">
      <h2 id="droid-key" className="acct__h">
        {t.title}
      </h2>
      <p className="acct__note">{t.text}</p>
      <div className="act">
        <button type="button" className="button button--quiet button--small" disabled={busy} onClick={() => void download()}>
          {busy ? t.downloading : t.download}
        </button>
        {error && (
          <span className="composer__error" role="alert">
            {error}
          </span>
        )}
      </div>
      <p className="field-hint">
        {t.inside} {info.downloadedAt ? t.downloaded(info.downloads, dayOf(info.downloadedAt)) : t.never}
      </p>
      <button type="button" className="link bill__linkbutton ident__link" aria-expanded={more} aria-controls="droid-key-more" onClick={() => setMore((m) => !m)}>
        {t.lostTitle}
      </button>
      {more && (
        <div id="droid-key-more" className="droid__more">
          <p className="acct__note">{t.lost}</p>
          <p className="acct__note">{t.more}</p>
          <dl className="droid__facts">
            <div>
              <dt>{t.fingerprint}</dt>
              <dd className="figures droid__fingerprint">
                {groups.map((g, i) => (
                  <span key={i}>
                    {g}
                    {i < groups.length - 1 && ":"}
                    <wbr />
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
