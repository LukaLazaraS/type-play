"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import type { AndroidState, Project, RunEvent } from "@typeplay/shared";
import { Hub } from "@/components/app/android/Hub";
import { Setup } from "@/components/app/android/Setup";
import { SignIn } from "@/components/app/SignIn";
import { useNow } from "@/components/app/useNow";
import { android } from "@/content/android";
import { api, ApiFailure, watchProject, type StreamState } from "@/lib/api";
import { signOut, useSession } from "@/lib/session";

type Fatal = { code: ApiFailure["code"] | "server_error"; status: number; message: string };
const fatalOf = (e: unknown): Fatal => ({
  code: e instanceof ApiFailure ? e.code : "server_error",
  status: e instanceof ApiFailure ? e.status : 0,
  message: e instanceof Error ? e.message : String(e),
});
const ACTIVE = ["queued", "running", "signing"];

/** /games/<id>/android: the plan panel on Free, setup on the first visit, then the hub. */
export function AndroidClient() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const signedIn = session.status === "in";
  const me = signedIn ? session.me : null;
  const [project, setProject] = useState<Project | null>(null);
  const [state, setState] = useState<AndroidState | null>(null);
  const [fatal, setFatal] = useState<Fatal | null>(null);
  // One line above the hub: "Android is set up…", or an icon the API refused at setup. Gone at the next build event.
  const [notice, setNotice] = useState<string | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [stream, setStream] = useState<StreamState>("connecting");
  const streamRef = useRef<StreamState>("connecting");
  const [watchKey, setWatchKey] = useState(0);

  const reload = useCallback(() => api.android.state(id).then(setState).catch(() => {}), [id]);

  const onEvent = useCallback(
    (e: RunEvent) => {
      switch (e.type) {
        case "snapshot":
          setProject(e.project);
          break;
        case "done":
        case "failed":
          // A new version of the game: the version picker gains it.
          setProject((p) =>
            p
              ? {
                  ...p,
                  ...e.project,
                  versions: e.type === "done" && e.version && !p.versions.some((v) => v.n === e.version!.n) ? [...p.versions, e.version] : p.versions,
                  currentVersion: e.type === "done" && e.version ? e.version.n : p.currentVersion,
                }
              : p,
          );
          break;
        case "android": {
          const b = e.build;
          setState((s) => (s ? { ...s, builds: s.builds.some((x) => x.id === b.id) ? s.builds.map((x) => (x.id === b.id ? b : x)) : [b, ...s.builds].slice(0, 20) } : s));
          // The game is reserved while a build runs; the limits and the package lock move when it ends.
          setProject((p) => (p ? { ...p, status: b.status === "running" || b.status === "signing" ? "exporting" : p.status === "exporting" ? "idle" : p.status } : p));
          setNotice(null);
          if (!ACTIVE.includes(b.status)) void reload();
          break;
        }
      }
    },
    [reload],
  );
  const onStream = useCallback(
    (s: StreamState) => {
      if (s === "retrying" && streamRef.current === "live") void reload();
      streamRef.current = s;
      setStream(s);
    },
    [reload],
  );

  useEffect(() => {
    if (!signedIn || !id) return;
    let live = true;
    Promise.all([api.project(id), api.android.state(id)])
      .then(([p, s]) => {
        if (!live) return;
        setProject((now) => now ?? p);
        setState(s);
      })
      .catch((e: unknown) => live && setFatal(fatalOf(e)));
    const stop = watchProject(id, onEvent, onStream, (e) => setFatal(fatalOf(e)));
    return () => {
      live = false;
      stop();
    };
  }, [signedIn, id, onEvent, onStream, watchKey]);
  useEffect(() => {
    if (fatal?.code === "unauthorized" && fatal.status === 401) void signOut();
  }, [fatal]);

  // A minute tick for "2 min ago" and the days left; the build clock and the link countdown tick by the second on their own.
  const now = useNow(!!state, 60_000);
  const back = `/games/${id}`;

  if (session.status === "loading") return <main className="droid" data-app aria-busy="true" />;
  if (session.status === "out") {
    return (
      <main className="widget make" data-app>
        <h1 className="title make__title">{android.title}</h1>
        <p className="make__lead">Sign in to put your game on a phone.</p>
        <SignIn next={`/games/${id}/android`} />
      </main>
    );
  }
  if (fatal && (!project || !state)) {
    return (
      <main className="widget make" data-app>
        <h1 className="title make__title">Can&apos;t open this page.</h1>
        <p className="make__lead" role="alert">
          {fatal.message}
        </p>
        <Link href="/games" className="button">
          Your games
        </Link>
      </main>
    );
  }
  if (!project || !state || !me) {
    return (
      <main className="droid" data-app aria-busy="true">
        <p className="make__lead">Opening…</p>
      </main>
    );
  }

  const head = (
    <header className="droid__head">
      <h1 className="title mine__title droid__title">{android.title}</h1>
      <p className="mine__lead">{android.lead}</p>
      <Link href={back} className="droid__back">
        <ArrowLeft size={16} weight="bold" aria-hidden="true" />
        Back to {project.name}
      </Link>
    </header>
  );
  const title = <title>{`Android: ${project.name} | TypePlay`}</title>;

  if (!me.features?.android || !state.enabled) {
    return (
      <main className="droid" data-app>
        {title}
        {head}
        <section className="widget acct__card droid__panel">
          <p className="acct__note">{android.off}</p>
          <Link href={back} className="button button--quiet">
            {android.noGame.action}
          </Link>
        </section>
      </main>
    );
  }
  if (me.plan === "free") {
    return (
      <main className="droid" data-app>
        {title}
        {head}
        <section className="widget acct__card droid__panel" data-panel="plan">
          <h2 className="title droid__h2">{android.plan.title}</h2>
          <p className="acct__note">{android.plan.text}</p>
          <div className="acct__buttons">
            <Link href={android.plan.href} className="button">
              {android.plan.action}
            </Link>
            <Link href={back} className="button button--quiet">
              {android.noGame.action}
            </Link>
          </div>
        </section>
      </main>
    );
  }
  if (!project.buildId) {
    return (
      <main className="droid" data-app>
        {title}
        {head}
        <section className="widget acct__card droid__panel">
          <p className="acct__note">{android.noGame.text}</p>
          <Link href={back} className="button">
            {android.noGame.action}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="droid" data-app>
      {title}
      {head}
      {fatal ? (
        <p className="droid__offline" role="alert">
          {fatal.code === "not_found" ? (
            <>
              This game was deleted.{" "}
              <Link href="/games" className="link">
                Your games
              </Link>
            </>
          ) : (
            <>
              Live updates stopped.{" "}
              <button
                type="button"
                className="link ws__retry"
                onClick={() => {
                  setFatal(null);
                  setWatchKey((k) => k + 1);
                }}
              >
                Retry
              </button>
            </>
          )}
        </p>
      ) : (
        stream === "retrying" && (
          <p className="droid__offline" role="status">
            Lost the live updates. Reconnecting…
          </p>
        )
      )}
      {notice && (
        <p className="droid__notice" role="alert">
          {notice}
        </p>
      )}
      {state.app ? (
        <Hub project={project} state={{ ...state, app: state.app }} now={now} iconPreview={iconPreview} onState={setState} />
      ) : (
        <Setup
          project={project}
          onDone={(s, n, preview) => {
            setState(s);
            setNotice(n ?? android.setup.done);
            setIconPreview(preview);
            // The hub mounts under the notice: the keyboard lands on the first thing to do.
            requestAnimationFrame(() => document.getElementById("droid-build")?.focus());
          }}
        />
      )}
    </main>
  );
}
