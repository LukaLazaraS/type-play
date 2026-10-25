"use client";

import { useEffect, useRef, useState } from "react";
import type { AndroidBuild, AndroidFormat, AndroidLink } from "@typeplay/shared";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextField } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { Pulse } from "@/components/ui/Pulse";
import { android, LINK_MINUTES } from "@/content/android";
import { api, saveFile } from "@/lib/api";
import { ago } from "@/lib/format";
import { useNow } from "../useNow";
import { Checks } from "./Checks";
import { QrCode } from "./QrCode";

export const ACTIVE: AndroidBuild["status"][] = ["queued", "running", "signing"];
const fileSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1_048_576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`);
const daysLeft = (iso: string, now: number) => Math.round((Date.parse(iso) - now) / 86_400_000);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** The longest link the QR encoder takes (lib/qr.ts: 213 bytes at version 10). The API's phone link is ~80 characters in every store; a longer one would show as text. */
const QR_MAX = 210;

/** Every build of this game, newest first: its state, its download and phone link, its checks, what went wrong. */
export function BuildList({
  projectId,
  builds,
  now,
  onCancel,
  onAgain,
}: {
  projectId: string;
  builds: AndroidBuild[];
  /** A minute tick, for "2 min ago" and the days left. */
  now: number;
  onCancel: (buildId: string) => Promise<void>;
  onAgain: (format: AndroidFormat, versionN: number) => Promise<void>;
}) {
  const t = android.builds;
  return (
    <Card title={t.title} titleId="droid-builds" className="droid__builds">
      {builds.length ? (
        <ol className="builds">
          {builds.map((b) => (
            <BuildRow key={b.id} projectId={projectId} build={b} now={now} onCancel={onCancel} onAgain={onAgain} />
          ))}
        </ol>
      ) : (
        <p className="acct__note">{t.empty}</p>
      )}
    </Card>
  );
}

type Open = "phone" | "checks" | "details" | null;

function BuildRow({ projectId, build: b, now, onCancel, onAgain }: { projectId: string; build: AndroidBuild; now: number; onCancel: (id: string) => Promise<void>; onAgain: (f: AndroidFormat, n: number) => Promise<void> }) {
  const t = android.builds;
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState<"download" | "cancel" | "again" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = ACTIVE.includes(b.status);
  const done = b.status === "done";
  const problems = done ? b.checks.filter((c) => !c.ok).length : 0;
  // A game-code failure fails the same way again: the chat is the way out, not Build again.
  const needsChat = b.status === "failed" && b.failCode === "game";

  const run = async (what: NonNullable<typeof busy>, go: () => Promise<void>) => {
    setBusy(what);
    setError(null);
    try {
      await go();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };
  const download = () =>
    run("download", async () => {
      saveFile(await api.android.download(projectId, b.id, `game.${b.format}`));
      // The file is on its way: an APK's next step is the phone, so its panel opens with the install steps.
      if (b.format === "apk") setOpen("phone");
    });
  const toggle = (o: Open) => setOpen((now) => (now === o ? null : o));

  const meta = [`version ${b.versionN}`, `build ${b.versionCode} (${b.versionName})`, done && b.bytes != null ? fileSize(b.bytes) : null, done && b.expiresAt ? t.expires(daysLeft(b.expiresAt, now)) : null, done ? t.icon[b.icon] : null, ago(b.queuedAt, now)]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="builds__row" data-status={b.status} data-format={b.format}>
      <span className="builds__format figures" aria-hidden="true">
        {b.format.toUpperCase()}
      </span>
      <div className="builds__text">
        <p className="builds__line">
          {active && <Pulse />}
          <b>
            <span className="sr-only">{b.format.toUpperCase()}, </span>
            {t.status[b.status]}
            {done && problems > 0 && <span className="builds__problems">{problems === 1 ? ", 1 check to look at" : `, ${problems} checks to look at`}</span>}
          </b>
        </p>
        <p className="figures builds__meta">{meta}</p>
        {b.status === "failed" && b.failMessage && <ErrorLine>{b.failMessage}</ErrorLine>}
        {b.status === "expired" && <p className="acct__note">{t.expired}</p>}
      </div>
      <div className="builds__actions">
        {active && (
          <Button look="quiet" size="small" busy={busy === "cancel"} busyLabel={android.build.stopping} onClick={() => void run("cancel", () => onCancel(b.id))}>
            {t.cancel}
          </Button>
        )}
        {done && (
          <>
            <Button look="quiet" size="small" busy={busy === "download"} busyLabel={t.downloading} onClick={() => void download()}>
              {t.download}
            </Button>
            {b.format === "apk" && (
              <Button look="quiet" size="small" aria-expanded={open === "phone"} onClick={() => toggle("phone")}>
                {t.phone}
              </Button>
            )}
            <Button look="quiet" size="small" aria-expanded={open === "checks"} onClick={() => toggle("checks")}>
              {t.checks}
            </Button>
          </>
        )}
        {b.status === "failed" && b.logTail && (
          <Button look="quiet" size="small" aria-expanded={open === "details"} onClick={() => toggle("details")}>
            {t.details}
          </Button>
        )}
        {needsChat ? (
          <ButtonLink href={`/games/${projectId}`} look="quiet" size="small">
            {t.chat}
          </ButtonLink>
        ) : (
          (b.status === "failed" || b.status === "expired" || b.status === "cancelled") && (
            <Button look="quiet" size="small" busy={busy === "again"} busyLabel="Starting…" onClick={() => void run("again", () => onAgain(b.format, b.versionN))}>
              {t.again}
            </Button>
          )
        )}
      </div>
      {error && <ErrorLine className="builds__error">{error}</ErrorLine>}
      {open === "phone" && done && <PhonePanel projectId={projectId} buildId={b.id} />}
      {open === "checks" && done && (
        <Panel className="builds__panel">
          <p className="field-hint">{android.checks.lead}</p>
          <Checks checks={b.checks} />
        </Panel>
      )}
      {open === "details" && b.logTail && (
        <Panel className="builds__panel">
          <pre className="builds__log figures">{b.logTail}</pre>
        </Panel>
      )}
    </li>
  );
}

/** A 10-minute no-sign-in link for the phone, as a QR code and as text, with the install steps. */
function PhonePanel({ projectId, buildId }: { projectId: string; buildId: string }) {
  const t = android.phone;
  const [link, setLink] = useState<AndroidLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const [ask, setAsk] = useState(0); // bumped by "New link"
  const now = useNow(!!link);

  useEffect(() => {
    let live = true;
    api.android.link(projectId, buildId).then(
      (l) => live && setLink(l),
      (e: unknown) => live && setError(message(e)),
    );
    return () => {
      live = false;
    };
  }, [projectId, buildId, ask]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  // "Good for 10 more minutes" at the start (never 11 from clock skew), "1 more minute" at the end.
  const left = link ? Date.parse(link.expiresAt) - now : LINK_MINUTES * 60_000;
  const expired = !!link && left <= 0;
  const minutes = expired ? 0 : Math.min(LINK_MINUTES, Math.max(1, Math.round(left / 60_000)));
  const code = !!link && link.url.length <= QR_MAX;
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      field.current?.focus();
      field.current?.select();
    }
  };

  return (
    <Panel className="builds__panel qrpanel" role="group" aria-label={t.title}>
      {error ? (
        <ErrorLine>{error}</ErrorLine>
      ) : !link ? (
        <p className="acct__note" aria-busy="true">
          Making the link…
        </p>
      ) : (
        <>
          {code && (
            <div className="qrpanel__code" data-expired={expired || undefined}>
              <QrCode text={link.url} label="QR code of the phone link" />
            </div>
          )}
          <div className="qrpanel__text">
            <h3 className="qrpanel__title">{t.title}</h3>
            <p className="acct__note qrpanel__caption">{code ? t.caption : t.noCode}</p>
            <TextField
              ref={field}
              id={`phone-link-${buildId}`}
              tone="paper"
              boxClassName="qrpanel__link"
              readOnly
              value={link.url}
              aria-label="Phone link"
              spellCheck={false}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="acct__buttons">
              {expired ? (
                <Button
                  size="small"
                  onClick={() => {
                    setLink(null);
                    setError(null);
                    setAsk((n) => n + 1);
                  }}
                >
                  {t.again}
                </Button>
              ) : (
                <Button look="quiet" size="small" onClick={() => void copy()}>
                  {copied ? t.copied : t.copy}
                </Button>
              )}
              <span className="figures qrpanel__life">{t.life(minutes)}</span>
            </div>
            <ol className="qrpanel__steps">
              {t.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </>
      )}
    </Panel>
  );
}
