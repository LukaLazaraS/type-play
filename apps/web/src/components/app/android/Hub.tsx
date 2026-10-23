"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { AndroidLogo } from "@phosphor-icons/react";
import type { AndroidBuild, AndroidFormat, AndroidState, Project } from "@typeplay/shared";
import { android } from "@/content/android";
import { api } from "@/lib/api";
import { ago, clock } from "@/lib/format";
import { posterUrl } from "@/lib/urls";
import { useNow } from "../useNow";
import { ACTIVE, BuildList } from "./BuildList";
import { IdentityForm, type Identity } from "./IdentityForm";
import { KeyCard } from "./KeyCard";
import { PlayChecklist } from "./PlayChecklist";
import { useAppIcon } from "./useAppIcon";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
type Ready = AndroidState & { app: NonNullable<AndroidState["app"]> };

/** After setup: build, the builds, the app's identity, the key and the Play checklist. */
export function Hub({ project, state, now, iconPreview, onState }: { project: Project; state: Ready; now: number; iconPreview: string | null; onState: Dispatch<SetStateAction<AndroidState | null>> }) {
  const active = state.builds.find((b) => ACTIVE.includes(b.status)) ?? null;
  // Folded into the latest state (an event may land while the request is in flight), newest first, at most 20.
  const merge = (b: AndroidBuild) => onState((s) => (s ? { ...s, builds: s.builds.some((x) => x.id === b.id) ? s.builds.map((x) => (x.id === b.id ? b : x)) : [b, ...s.builds].slice(0, 20) } : s));

  const build = async (format: AndroidFormat, version?: number) => merge(await api.android.build(project.id, { format, version }));
  const cancel = async (buildId: string) => merge(await api.android.cancel(project.id, buildId));

  return (
    <div className="droid__grid">
      <BuildCard project={project} state={state} active={active} now={now} onBuild={build} onCancel={cancel} />
      <BuildList projectId={project.id} builds={state.builds} now={now} onCancel={cancel} onAgain={build} />
      <IdentityCard project={project} state={state} iconPreview={iconPreview} onState={onState} />
      {state.key && <KeyCard projectId={project.id} info={state.key} onDownloaded={() => void api.android.state(project.id).then(onState).catch(() => {})} />}
      <PlayChecklist packageName={state.app.packageName} />
    </div>
  );
}

/** The version to build and the two builds; the live state of the one running, with Stop. */
function BuildCard({
  project,
  state,
  active,
  now,
  onBuild,
  onCancel,
}: {
  project: Project;
  state: AndroidState;
  active: AndroidBuild | null;
  /** A minute tick, for the versions' ages. */
  now: number;
  onBuild: (format: AndroidFormat, version: number) => Promise<void>;
  onCancel: (buildId: string) => Promise<void>;
}) {
  const t = android.build;
  const versions = [...project.versions].sort((a, b) => b.n - a.n);
  const [picked, setPicked] = useState<number | null>(null);
  const version = picked ?? project.currentVersion ?? versions[0]?.n ?? 1;
  const [busy, setBusy] = useState<AndroidFormat | "stop" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tick = useNow(!!active); // the clock, by the second, only while a build runs
  const gameBuilding = project.status === "running";
  const noneToday = state.limits.perGameToday <= 0 ? t.noneToday : state.limits.perUserToday <= 0 ? t.noneTodayUser : null;
  const locked = !!active || gameBuilding || !!noneToday;

  const start = async (format: AndroidFormat) => {
    setBusy(format);
    setError(null);
    try {
      await onBuild(format, version);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };
  const stop = async () => {
    if (!active) return;
    setBusy("stop");
    setError(null);
    try {
      await onCancel(active.id);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  const since = active?.startedAt ?? active?.queuedAt;
  const stateWord = active ? (active.status === "queued" ? t.queued : active.status === "running" ? t.running : t.signing) + (active.status === "queued" && active.queue && active.queue.position > 0 ? `: ${t.ahead(active.queue.position)}` : "") : "";
  return (
    <section className="widget acct__card droid__build" aria-labelledby="droid-build">
      {/* Focused after setup, so the keyboard lands on the first thing to do. */}
      <h2 id="droid-build" className="acct__h" tabIndex={-1}>
        {t.title}
      </h2>
      <div className="ident__field droid__version">
        <label htmlFor="droid-version" className="field-label">
          {t.version}
        </label>
        <div className="field ident__input">
          <select id="droid-version" value={version} disabled={locked || busy !== null} onChange={(e) => setPicked(Number(e.target.value))}>
            {versions.map((v) => (
              <option key={v.n} value={v.n}>
                Version {v.n}
                {v.n === project.currentVersion ? ` (${t.current})` : ` · ${ago(v.createdAt, now)}`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="droid__actions">
        <div className="droid__action">
          <button type="button" className="button" disabled={locked || busy !== null} onClick={() => void start("apk")}>
            {busy === "apk" ? "Starting…" : t.apk.action}
          </button>
          <span className="figures">{t.apk.time}</span>
        </div>
        <div className="droid__action">
          <button type="button" className="button button--quiet" disabled={locked || busy !== null} onClick={() => void start("aab")}>
            {busy === "aab" ? "Starting…" : t.aab.action}
          </button>
          <span className="figures">{t.aab.time}</span>
        </div>
      </div>
      {active ? (
        <div className="droid__live" data-status={active.status}>
          <p className="droid__live-line">
            <span className="pulse" aria-hidden="true" />
            {/* Only the state word is announced; the clock beside it changes every second. */}
            <b role="status">{stateWord}</b>
            {since && <span className="figures">{clock(since, tick)}</span>}
            <span className="figures">{active.format === "apk" ? t.apk.time : t.aab.time}</span>
          </p>
          <p className="field-hint">{t.leave}</p>
          <button type="button" className="button button--quiet button--small" disabled={busy === "stop"} onClick={() => void stop()}>
            {busy === "stop" ? t.stopping : t.stop}
          </button>
        </div>
      ) : gameBuilding ? (
        <p className="field-hint">The game is being built right now; the Android build can start when it&apos;s done.</p>
      ) : (
        noneToday && <p className="field-hint">{noneToday}</p>
      )}
      {error && (
        <p className="composer__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** The app's name, package name and icon, with "Change" opening the same form as setup. */
function IdentityCard({ project, state, iconPreview: initialPreview, onState }: { project: Project; state: Ready; iconPreview: string | null; onState: Dispatch<SetStateAction<AndroidState | null>> }) {
  const t = android.identity;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(initialPreview);
  const change = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const app = state.app;
  // The PNG uploaded in this visit is in memory (`preview`); on a later visit the API keeps it and sends it back.
  const stored = useAppIcon(project.id, app.hasIcon && !preview);
  const shown = preview ?? stored;
  // Focus comes back to Change when the form closes (it unmounted the control that had it).
  useEffect(() => {
    if (wasEditing.current && !editing) change.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const save = async (v: Identity) => {
    const body: Parameters<typeof api.android.update>[1] = {};
    if (v.appName !== app.appName) body.appName = v.appName;
    if (v.packageName !== app.packageName) body.packageName = v.packageName;
    if (v.confirmPackageChange) body.confirmPackageChange = true;
    if (v.iconPng !== undefined) body.iconPng = v.iconPng;
    if (!Object.keys(body).length) return setEditing(false);
    setBusy(true);
    setError(null);
    try {
      onState(await api.android.update(project.id, body));
      if (v.iconPng !== undefined) setPreview(v.iconPreview ?? null);
      setEditing(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const icon: "own" | "poster" | "placeholder" = app.hasIcon ? "own" : project.poster ? "poster" : "placeholder";
  return (
    <section className="widget acct__card droid__app" aria-labelledby="droid-app">
      <h2 id="droid-app" className="acct__h">
        {t.title}
      </h2>
      {editing ? (
        <IdentityForm project={project} app={app} iconPreview={shown} busy={busy} error={error} submitLabel={t.save} busyLabel={t.busy} onSubmit={(v) => void save(v)} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div className="droid__who">
            <span className="ident__tile" aria-hidden="true">
              {icon === "own" && shown ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shown} alt="" />
              ) : icon === "poster" && project.buildId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posterUrl(project.buildId)} alt="" />
              ) : (
                // An uploaded icon is on its way from the API: the neutral icon waits a moment before it shows.
                <AndroidLogo size={28} weight="fill" className={icon === "own" ? "ident__late" : undefined} />
              )}
            </span>
            <div className="droid__who-text">
              <b className="droid__appname">{app.appName}</b>
              <span className="acct__note">
                {t.icon.label}: {t.icon[icon]}
              </span>
            </div>
          </div>
          <dl className="droid__facts">
            <div>
              <dt>{t.packageName.label}</dt>
              <dd>
                <span className="figures droid__package">{app.packageName}</span>
                <span className="field-hint">{app.packageLocked ? t.packageName.locked : t.packageName.lock}</span>
              </dd>
            </div>
          </dl>
          <button ref={change} type="button" className="button button--quiet button--small" onClick={() => setEditing(true)}>
            {t.edit}
          </button>
        </>
      )}
    </section>
  );
}
