"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import type { Effort, Message, ModelChoice, Project, ProjectSummary, RunEvent, Version } from "@typeplay/shared";
import { ChatLog, type LiveLine } from "@/components/app/ChatLog";
import { Composer } from "@/components/app/Composer";
import { setFeedbackGame } from "@/components/app/Feedback";
import { SignIn } from "@/components/app/SignIn";
import { Stage } from "@/components/app/Stage";
import { useEstimates } from "@/components/app/useEstimates";
import { useNow } from "@/components/app/useNow";
import { forgetWaiting, waitingFor } from "@/components/app/WhileYouWait";
import { api, ApiFailure, watchProject, type StreamState } from "@/lib/api";
import { creditsWord } from "@/lib/format";
import { refreshMe, setCredits, signOut, useSession } from "@/lib/session";

/** Why the page or its live updates can't go on (ApiFailure's code and status, or server_error for anything else). */
type Fatal = { code: ApiFailure["code"] | "server_error"; status: number; message: string };
const fatalOf = (e: unknown): Fatal => ({
  code: e instanceof ApiFailure ? e.code : "server_error",
  status: e instanceof ApiFailure ? e.status : 0,
  message: e instanceof Error ? e.message : String(e),
});

/** A finished run's message, version and summary, folded into the project. */
function settle(p: Project, message: Message, version: Version | null, summary: ProjectSummary): Project {
  const messages = p.messages.some((m) => m.id === message.id)
    ? p.messages.map((m) => (m.id === message.id ? message : m))
    : [...p.messages, message];
  const versions = version && !p.versions.some((v) => v.n === version.n) ? [...p.versions, version] : p.versions;
  return { ...p, ...summary, messages, versions, currentVersion: version ? version.n : p.currentVersion };
}

type Tab = "chat" | "play";

/** The game page: chat on the left, the game on the right; two tabs on a phone. */
export function GameClient() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const signedIn = session.status === "in";
  const [project, setProject] = useState<Project | null>(null);
  const [fatal, setFatal] = useState<Fatal | null>(null);
  const [live, setLive] = useState<LiveLine>(null);
  const [stream, setStream] = useState<StreamState>("connecting");
  const streamRef = useRef<StreamState>("connecting");
  const [watchKey, setWatchKey] = useState(0); // bumped by Retry: opens the live updates again
  const [tab, setTab] = useState<Tab | null>(null);
  const [fresh, setFresh] = useState(false); // a new version the phone's Play tab hasn't shown yet
  const [played, setPlayed] = useState(false);
  const [prefill, setPrefill] = useState<{ text: string; n: number } | null>(null); // a tapped next-step idea
  // What the stream's handler needs to know, without re-subscribing on every change.
  const current = useRef<Project | null>(null);
  const tabRef = useRef<Tab>("chat");
  // Phones open on the game when there is one to play (or the first build, with games to play while it runs),
  // else on the chat; then the player decides.
  const opened = useCallback((p: Project) => setTab((t) => t ?? (p.buildId || p.status === "running" ? "play" : "chat")), []);

  const onEvent = useCallback((e: RunEvent) => {
    switch (e.type) {
      case "snapshot":
        setProject(e.project);
        opened(e.project);
        if (e.project.status !== "running") setLive(null);
        break;
      case "started": {
        setLive({ messageId: e.messageId, text: "" });
        const p = current.current;
        if (p && !p.messages.some((m) => m.id === e.messageId)) {
          // Started somewhere else (another tab): fetch the new messages.
          void api.project(p.id).then(setProject).catch(() => {});
        } else {
          setProject((q) => (q ? { ...q, status: "running" } : q));
        }
        break;
      }
      case "progress":
        setLive({ messageId: e.messageId, text: e.text });
        break;
      case "done":
      case "failed":
        setProject((p) => (p ? settle(p, e.message, e.type === "done" ? e.version : null, e.project) : p));
        setLive(null);
        setCredits(e.credits);
        if (e.type === "done" && e.version && tabRef.current === "chat") setFresh(true);
        break;
      case "android": {
        // An Android build reserves the game while it runs (the API answers 409 to chat meanwhile).
        const s = e.build.status;
        setProject((p) => (p ? { ...p, status: s === "running" || s === "signing" ? "exporting" : p.status === "exporting" ? "idle" : p.status } : p));
        break;
      }
    }
  }, [opened]);

  // The stream's state; on the first drop after being live, the project is fetched once, so a
  // build that finished while the connection was down shows up even if reconnecting keeps failing.
  const onStream = useCallback(
    (s: StreamState) => {
      if (s === "retrying" && streamRef.current === "live") void api.project(id).then(setProject).catch(() => {});
      streamRef.current = s;
      setStream(s);
    },
    [id],
  );

  // Back on this game's page: the gallery's way back to it (BuildPill) has done its job.
  useEffect(() => {
    if (id && waitingFor() === id) forgetWaiting();
  }, [id]);

  useEffect(() => {
    if (!signedIn || !id) return;
    let live = true;
    api
      .project(id)
      .then((p) => {
        if (!live) return;
        setProject((now) => now ?? p);
        opened(p);
      })
      .catch((e: unknown) => live && setFatal(fatalOf(e)));
    const stop = watchProject(id, onEvent, onStream, (e) => setFatal(fatalOf(e)));
    return () => {
      live = false;
      stop();
    };
  }, [signedIn, id, onEvent, onStream, opened, watchKey]);

  // A sign-in the API refused (401): out, to the sign-in screen. No token on this device for the
  // moment (status 0, a failed refresh while offline) only stops the updates; Retry asks again.
  useEffect(() => {
    if (fatal?.code === "unauthorized" && fatal.status === 401) void signOut();
  }, [fatal]);

  const running = project?.status === "running";
  const exporting = project?.status === "exporting";
  const now = useNow(running);
  const kind = project?.currentVersion == null ? "new" : "edit";
  const me = session.status === "in" ? session.me : null;
  const [effort, setEffort] = useState<Effort>("medium");
  const estimates = useEstimates(kind, me?.plan ?? null, effort);
  const shown: Tab = tab ?? "chat";
  useEffect(() => {
    current.current = project;
    tabRef.current = shown;
  });
  // The account menu's Send feedback offers to attach this game and its newest answer while the page is open.
  const gameId = project?.id;
  const gameName = project?.name;
  const lastAnswer = project?.messages.findLast((m) => m.role === "agent")?.id ?? null;
  useEffect(() => {
    if (!gameId || !gameName) return;
    setFeedbackGame({ id: gameId, name: gameName, messageId: lastAnswer });
    return () => setFeedbackGame(null);
  }, [gameId, gameName, lastAnswer]);

  const show = (t: Tab) => {
    setTab(t);
    if (t === "play") setFresh(false);
  };

  const send = async (text: string, model: ModelChoice, effort: Effort, confirm: boolean) => {
    const p = await api.send(id, { text, model, effort, confirm: confirm || undefined });
    setProject(p);
    void refreshMe();
  };
  const stop = async () => setProject(await api.cancel(id));
  const restore = async (n: number) => {
    setProject(await api.restore(id, n));
  };
  const firstPrompt = project?.messages.find((m) => m.role === "user")?.text;
  const retry =
    project && !running && !project.buildId && firstPrompt
      ? () => send(firstPrompt, me?.models.includes("smart") ? "smart" : "fast", effort, false)
      : null;

  if (session.status === "loading") return <main className="ws" data-app aria-busy="true" />;
  if (session.status === "out") {
    return (
      <main className="widget make" data-app>
        <h1 className="title make__title">Sign in to play.</h1>
        <p className="make__lead">This game is in your account. Sign in to play it and keep changing it.</p>
        <SignIn next={`/games/${id}`} />
      </main>
    );
  }
  if (!project) {
    return (
      <main className="widget make" data-app>
        {fatal ? (
          <>
            <h1 className="title make__title">Can&apos;t open this game.</h1>
            <p className="make__lead" role="alert">
              {fatal.message}
            </p>
            <Link href="/games" className="button">
              Your games
            </Link>
          </>
        ) : (
          <p className="make__lead" aria-busy="true">
            Opening your game…
          </p>
        )}
      </main>
    );
  }

  const spent = project.messages.reduce((sum, m) => sum + (m.role === "agent" ? (m.credits ?? 0) : 0), 0);

  return (
    <main className="ws" data-app data-tab={shown}>
      <title>{`${project.name} | TypePlay`}</title>
      <div
        className="ws__tabs"
        role="tablist"
        aria-label="Game page"
        onKeyDown={(e) => {
          // Tabs move with the arrow keys, as a tab list does.
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          const next: Tab = shown === "chat" ? "play" : "chat";
          show(next);
          e.currentTarget.querySelector<HTMLElement>(`#ws-tab-${next}`)?.focus();
        }}
      >
        <Link href="/games" className="ws__back" aria-label="Your games">
          <ArrowLeft size={18} weight="bold" aria-hidden="true" />
        </Link>
        <button type="button" role="tab" id="ws-tab-chat" aria-selected={shown === "chat"} aria-controls="ws-chat" className="ws__tab" onClick={() => show("chat")}>
          Chat
        </button>
        <button type="button" role="tab" id="ws-tab-play" aria-selected={shown === "play"} aria-controls="ws-play" className="ws__tab" onClick={() => show("play")}>
          Play
          {fresh && (
            <>
              <span className="ws__dot" aria-hidden="true" />
              <span className="sr-only">, new version ready</span>
            </>
          )}
        </button>
      </div>

      <section id="ws-chat" role="tabpanel" aria-labelledby="ws-tab-chat" className="widget ws__chat">
        <header className="ws__head">
          <Link href="/games" className="ws__all">
            <ArrowLeft size={16} weight="bold" aria-hidden="true" />
            Your games
          </Link>
          <span className="figures ws__spent" title="Credits used on this game so far">
            {creditsWord(spent)} on this game
          </span>
        </header>
        {fatal ? (
          <p className="ws__offline" role="alert">
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
            <p className="ws__offline" role="status">
              Lost the live updates. Reconnecting…
            </p>
          )
        )}
        <ChatLog
          messages={project.messages}
          live={live}
          now={now}
          currentVersion={project.currentVersion}
          onPlay={() => show("play")}
          onSuggest={(text) => setPrefill((p) => ({ text, n: (p?.n ?? 0) + 1 }))}
        />
        <Composer
          kind={kind}
          allowed={me?.models ?? ["fast"]}
          estimates={estimates}
          effort={effort}
          onEffort={setEffort}
          running={running}
          exporting={exporting}
          balance={me?.credits ?? null}
          me={me}
          backTo={`/games/${id}`}
          onSend={send}
          onStop={stop}
          prefill={prefill}
        />
      </section>

      <div id="ws-play" role="tabpanel" aria-labelledby="ws-tab-play" className="widget widget--ink ws__play">
        <Stage
          project={project}
          live={live}
          now={now}
          played={played}
          onPlayed={() => setPlayed(true)}
          onRestore={restore}
          onRetry={retry}
          onChange={setProject}
          android={!!me?.features?.android}
        />
      </div>
    </main>
  );
}
