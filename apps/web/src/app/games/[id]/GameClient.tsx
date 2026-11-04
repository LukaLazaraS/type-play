"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import type { Effort, GameAsset, Message, MessageImage, ModelChoice, Project, ProjectSummary, RunEvent, Version } from "@typeplay/shared";
import { Assets } from "@/components/app/Assets";
import { ChatLog, type LiveLine } from "@/components/app/ChatLog";
import { Composer } from "@/components/app/Composer";
import { setFeedbackGame } from "@/components/app/Feedback";
import { LiveStatus } from "@/components/app/LiveStatus";
import { People } from "@/components/app/People";
import { focusQuestions } from "@/components/app/QuestionsCard";
import { useMedia } from "@/components/app/PlatformSwitch";
import { SignIn } from "@/components/app/SignIn";
import { Stage } from "@/components/app/Stage";
import { useEstimates } from "@/components/app/useEstimates";
import { useNow } from "@/components/app/useNow";
import { forgetWaiting, waitingFor } from "@/components/app/WhileYouWait";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageWidget } from "@/components/ui/PageWidget";
import { Tabs } from "@/components/ui/PillBar";
import { api, ApiFailure, watchProject, type StreamState } from "@/lib/api";
import { assetPictureFile } from "@/lib/assets";
import { assets as assetWords, inLine, people as together, questions } from "@/content/app";
import { aheadWord, creditsWord } from "@/lib/format";
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
  // `queue` as the summary says it: gone once the build has left the line.
  return { ...p, ...summary, queue: summary.queue, messages, versions, currentVersion: version ? version.n : p.currentVersion };
}

/** The phone's tabs; on a computer the chat always shows, and the stage shows the game (play) or its assets. */
type Tab = "chat" | "play" | "assets";
/** Where the layout has the phone's tabs (app.css: the game page under 960px). */
const TABS = "(max-width: 959px)";

/** The game page: chat on the left, the game (or its assets) on the right; three tabs on a phone. */
export function GameClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const session = useSession();
  const signedIn = session.status === "in";
  const [project, setProject] = useState<Project | null>(null);
  const [fatal, setFatal] = useState<Fatal | null>(null);
  // Pair developing (2026-11-04): the owner took this player out of the game (or they left it in another tab).
  const [removed, setRemoved] = useState(false);
  // The game's people changed (the stream's people events, counted): an open People panel reads its list again.
  const [peopleChanged, setPeopleChanged] = useState(0);
  const [live, setLive] = useState<LiveLine>(null);
  const [stream, setStream] = useState<StreamState>("connecting");
  const streamRef = useRef<StreamState>("connecting");
  const [watchKey, setWatchKey] = useState(0); // bumped by Retry: opens the live updates again
  const [tab, setTab] = useState<Tab | null>(null);
  const [fresh, setFresh] = useState(false); // a new version the phone's Play tab hasn't shown yet
  const [played, setPlayed] = useState(false);
  // A tapped next-step idea, or a stop's one tap (the message again, with the bigger AI and the pictures it carried), or an
  // asset's Change it (its sentence, and its picture as a file for the box's tray).
  const [prefill, setPrefill] = useState<{ text: string; n: number; model?: ModelChoice; images?: MessageImage[]; files?: File[] } | null>(null);
  const tabsShown = useMedia(TABS) === true;
  // What the stream's handler needs to know, without re-subscribing on every change.
  const current = useRef<Project | null>(null);
  // Events applied so far: a project fetched because of an event is used only when nothing newer came meanwhile.
  const seq = useRef(0);
  // What the announcer last said about a build in line: its start, or why it left the line without starting.
  const [said, setSaid] = useState("");
  const tabRef = useRef<Tab>("chat");
  // Phones open on the game when there is one to play (or the first build, with games to play while it runs),
  // else on the chat; then the player decides.
  const opened = useCallback((p: Project) => setTab((t) => t ?? (p.buildId || p.status === "running" || p.status === "queued" ? "play" : "chat")), []);

  const onEvent = useCallback((e: RunEvent) => {
    seq.current += 1;
    switch (e.type) {
      case "snapshot":
        setProject(e.project);
        opened(e.project);
        if (e.project.status !== "running") setLive(null);
        break;
      case "queued": {
        // The build waits for its turn: its place and rough wait, as they change.
        const p = current.current;
        if (p && !p.messages.some((m) => m.id === e.messageId)) {
          // Sent from another tab: its messages, unless a newer event (its start) has come by the time they arrive.
          const at = seq.current;
          void api
            .project(p.id)
            .then((q) => seq.current === at && setProject(q))
            .catch(() => {});
        } else {
          setProject((q) => (q ? { ...q, status: "queued", queue: e.queue } : q));
        }
        break;
      }
      case "started": {
        setLive({ messageId: e.messageId, text: "" });
        const p = current.current;
        if (p?.status === "queued") setSaid(inLine.started);
        if (p && !p.messages.some((m) => m.id === e.messageId)) {
          // Started somewhere else (another tab): fetch the new messages.
          void api.project(p.id).then(setProject).catch(() => {});
        } else {
          // A build that waited in line starts now: its answer turns from waiting to building, its clock from its start.
          setProject((q) =>
            q
              ? {
                  ...q,
                  status: "running",
                  queue: undefined,
                  messages: q.messages.map((m) => (m.id === e.messageId ? { ...m, status: "running", startedAt: e.startedAt ?? m.startedAt } : m)),
                }
              : q,
          );
        }
        break;
      }
      case "progress":
        setLive({ messageId: e.messageId, text: e.text });
        break;
      case "done":
      case "failed":
        // A build that left the line without starting: why, read out (nobody may have pressed anything).
        if (e.type === "failed" && !e.message.startedAt) setSaid(e.message.text);
        // The AI asks before it builds (2026-11-04): said once, wherever the player is on the page.
        if (e.type === "done" && e.message.questions) setSaid(questions.said(e.message.questions.items.length));
        setProject((p) => (p ? settle(p, e.message, e.type === "done" ? e.version : null, e.project) : p));
        setLive(null);
        // The owner's balance comes only on the owner's stream (a member's own credits didn't move).
        if (e.credits) setCredits(e.credits);
        if (e.type === "done" && e.version && tabRef.current !== "play") setFresh(true);
        break;
      case "people": {
        setPeopleChanged((n) => n + 1);
        // Only an invitation changed: who is in is the same (the owner's open panel reads it again, nothing else).
        if (e.invites) break;
        // Someone joined or left: the game again (its people, and the messages' names).
        const at = seq.current;
        void api
          .project(id)
          .then((q) => seq.current === at && setProject(q))
          .catch(() => {});
        break;
      }
      case "removed":
        setRemoved(true);
        break;
      case "android": {
        // An Android build reserves the game while it runs (the API answers 409 to chat meanwhile).
        const s = e.build.status;
        setProject((p) => (p ? { ...p, status: s === "running" || s === "signing" ? "exporting" : p.status === "exporting" ? "idle" : p.status } : p));
        break;
      }
    }
  }, [opened, id]);

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
  const queued = project?.status === "queued";
  const exporting = project?.status === "exporting";
  const now = useNow(running);
  const kind = project?.currentVersion == null ? "new" : "edit";
  const me = session.status === "in" ? session.me : null;
  const [effort, setEffort] = useState<Effort>("medium");
  // Pair developing (2026-11-04): in someone else's game every message goes by its owner's plan (their AIs, their
  // estimates) and is paid from their credits, so the composer shows no balance of yours.
  const access = project?.access;
  const member = access?.role === "editor";
  const allowed = member ? access.models : (me?.models ?? ["fast"]);
  const plan = member ? access.plan : (me?.plan ?? null);
  const game = member ? project?.id : undefined;
  const estimates = useEstimates(kind, plan, effort, game);
  // More than one person has written here, or is in it: every player message says who sent it.
  const shared = !!access && (access.members.length > 0 || !!project?.messages.some((m) => m.role === "user" && m.by?.id !== access.owner.id));
  // The build going or waiting, and who asked for it: a member stops only their own.
  const building = project?.messages.findLast((m) => m.role === "agent" && (m.status === "running" || m.status === "queued"));
  const othersBuild = building?.by && me && building.by.id !== me.id && member ? building.by.name : null;
  // The owner may stop a member's build too, after a question (it ends someone else's change).
  const stopsOthers = building?.by && me && building.by.id !== me.id && !member ? building.by.name : null;
  // Questions the AI asked before a build (2026-11-04), open while they are the newest message and nothing runs: Build it
  // builds on the AI and effort they were asked on, at that price (the estimate shown beside it). Only the one who asked
  // answers them (pair developing); for anyone else they read as passed by, and a message is a request of its own.
  const lastMessage = project?.messages.at(-1);
  const asked =
    lastMessage?.role === "agent" && lastMessage.status === "done" && lastMessage.questions && lastMessage.model && (!lastMessage.by || !me || lastMessage.by.id === me.id)
      ? lastMessage
      : null;
  const askedEstimates = useEstimates(kind, plan, asked?.effort ?? effort, game);
  // The card's answers as they are picked, for words typed in the box meanwhile (by the questions' message).
  const draft = useRef<{ id: string; answers: (string | null)[] } | null>(null);
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

  const send = async (text: string, model: ModelChoice, effort: Effort, confirm: boolean, images: string[] = [], ask = false) => {
    // Words typed while questions are open answer them, with any of the card's answers tapped so far (none is lost).
    const d = draft.current;
    const answers = asked && d?.id === asked.id && d.answers.some((a) => a !== null) ? d.answers : undefined;
    const p = await api.send(id, { text, model, effort, confirm: confirm || undefined, images: images.length ? images : undefined, ask: ask || undefined, answers });
    setProject(p);
    void refreshMe();
  };
  // Build it under open questions: the answers, on the AI and effort they were asked on. A first build: a phone goes to
  // Play, where the build shows; with a mouse the keyboard goes to the chat's box (the card it was on is gone).
  const answer = async (answers: (string | null)[]) => {
    // The card shows only for the one who asked; should it be pressed anyway, it says so instead of waiting forever.
    if (!asked?.model) throw new Error(together.answerGone);
    const first = !project?.buildId;
    const p = await api.send(id, { answers, model: asked.model, effort: asked.effort ?? "medium" });
    setProject(p);
    void refreshMe();
    if (first && window.matchMedia("(max-width: 959px)").matches) show("play");
    else if (window.matchMedia("(pointer: fine)").matches) requestAnimationFrame(() => document.getElementById("say")?.focus({ preventScroll: true }));
  };
  // "Answer them" on the stage: the chat (a phone's other tab), the keyboard on the first question.
  const toQuestions = () => {
    show("chat");
    requestAnimationFrame(focusQuestions);
  };
  const stop = async () => setProject(await api.cancel(id));
  // Change it (the Assets tab): the asset's sentence into the box, and its picture (a picture, a look, a model's still)
  // handed to the box's tray as a file, exactly as if the player had dropped it there. On a phone the chat is its own
  // tab: it opens there; on a computer the box is beside the list, which stays open for more.
  /** The way to the chat box (an empty asset list's button): the Chat tab on a phone, the box beside the list on a computer. */
  const toChat = () => {
    if (tabsShown) show("chat");
    requestAnimationFrame(() => document.getElementById("say")?.focus());
  };
  const changeAsset = async (asset: GameAsset, buildId: string) => {
    const files = asset.picture ? [await assetPictureFile(id, buildId, asset)] : undefined;
    setPrefill((p) => ({ text: assetWords.starter(asset), n: (p?.n ?? 0) + 1, files }));
    if (tabsShown) show("chat");
  };
  const restore = async (n: number) => {
    setProject(await api.restore(id, n));
  };
  const first = project?.messages.find((m) => m.role === "user");
  const firstPrompt = first?.text;
  // Building again after a failed first build: the first message's words and pictures (the API copies them for it).
  const retry =
    project && !running && !queued && !project.buildId && firstPrompt && !asked
      ? () => send(firstPrompt, allowed.includes("smart") ? "smart" : "fast", effort, false, (first?.images ?? []).map((i) => i.id))
      : null;
  // Out of the game (pair developing): to the list, where it is gone.
  const left = () => router.replace("/games");

  if (session.status === "loading") return <main className="ws" data-app aria-busy="true" />;
  if (session.status === "out") {
    return (
      <PageWidget title="Sign in to play." lead="This game is in your account. Sign in to play it and keep changing it.">
        <SignIn next={`/games/${id}`} />
      </PageWidget>
    );
  }
  if (removed) {
    return (
      <PageWidget title={together.removedTitle} lead={together.removedLead} leadRole="alert">
        <ButtonLink href="/games">{together.yourGames}</ButtonLink>
      </PageWidget>
    );
  }
  if (!project) {
    return fatal ? (
      <PageWidget title="Can't open this game." lead={fatal.message} leadRole="alert">
        <ButtonLink href="/games">Your games</ButtonLink>
      </PageWidget>
    ) : (
      <PageWidget lead="Opening your game…" />
    );
  }

  const spent = project.messages.reduce((sum, m) => sum + (m.role === "agent" ? (m.credits ?? 0) : 0), 0);

  return (
    <main className="ws" data-app data-tab={shown}>
      <title>{`${project.name} | TypePlay`}</title>
      {/* A build in line, read out whichever tab shows: its place when it changes (the minutes are on the screen only), its
          start, or why it left the line without starting. */}
      <p className="sr-only" role="status">
        {queued && project.queue ? `${inLine.state}: ${aheadWord(project.queue.ahead)}` : said}
      </p>
      <Tabs
        label="Game page"
        className="ws__tabs"
        value={shown}
        onChange={show}
        before={
          <Link href="/games" className="ws__back" aria-label="Your games">
            <ArrowLeft size={18} weight="bold" aria-hidden="true" />
          </Link>
        }
        after={<People project={project} me={me} onLeft={left} changed={peopleChanged} on="ink" />}
        tabs={[
          { id: "chat", label: "Chat", tabId: "ws-tab-chat", panelId: "ws-chat" },
          {
            id: "play",
            label: (
              <>
                Play
                {fresh && (
                  <>
                    <span className="ws__dot" aria-hidden="true" />
                    <span className="sr-only">, new version ready</span>
                  </>
                )}
              </>
            ),
            tabId: "ws-tab-play",
            panelId: "ws-play",
          },
          { id: "assets", label: assetWords.tab, tabId: "ws-tab-assets", panelId: "ws-play" },
        ]}
      />

      <section id="ws-chat" role="tabpanel" aria-labelledby="ws-tab-chat" className="widget ws__chat">
        <header className="ws__head">
          <Link href="/games" className="ws__all">
            <ArrowLeft size={16} weight="bold" aria-hidden="true" />
            Your games
          </Link>
          {/* "used", so it never reads as a balance beside the status bar's (the header holds the people button too). */}
          <span className="figures ws__spent" title="Credits used on this game so far">
            {creditsWord(spent)} used
          </span>
          <People project={project} me={me} onLeft={left} changed={peopleChanged} />
        </header>
        <LiveStatus
          fatal={fatal}
          stream={stream}
          onRetry={() => {
            setFatal(null);
            setWatchKey((k) => k + 1);
          }}
          className="ws__offline"
        />
        <ChatLog
          messages={project.messages}
          live={live}
          queue={project.queue}
          now={now}
          currentVersion={project.currentVersion}
          onPlay={() => show("play")}
          onSuggest={(text) => setPrefill((p) => ({ text, n: (p?.n ?? 0) + 1 }))}
          models={allowed}
          me={me?.id ?? null}
          shared={shared}
          onBigger={(text, model) => {
            // The message the stop answered, with its pictures: they go back in the box with its words.
            const asked = project.messages.at(-2);
            setPrefill((p) => ({ text, model, images: asked?.role === "user" ? asked.images : undefined, n: (p?.n ?? 0) + 1 }));
          }}
          answering={{
            busy: running || queued || exporting,
            cost: asked?.model ? (askedEstimates[asked.model] ?? null) : null,
            onAnswer: answer,
            onDraft: (answers) => {
              if (asked) draft.current = { id: asked.id, answers };
            },
            ownCredits: !member,
          }}
        />
        <Composer
          kind={kind}
          allowed={allowed}
          estimates={estimates}
          effort={effort}
          onEffort={setEffort}
          running={running}
          queued={queued}
          queue={project.queue}
          exporting={exporting}
          balance={member ? null : (me?.credits ?? null)}
          me={me}
          backTo={`/games/${id}`}
          onSend={send}
          onStop={stop}
          prefill={prefill}
          answering={asked && !running && !queued && !exporting ? { model: asked.model!, effort: asked.effort ?? "medium" } : null}
          paidBy={member ? access.owner.name : null}
          othersBuild={othersBuild}
          stopsOthers={stopsOthers}
        />
      </section>

      {/* The stage: the game, or its assets (the phone's Play and Assets tabs, the computer's switch in the game's bar). */}
      <div id="ws-play" role="tabpanel" aria-labelledby={shown === "assets" ? "ws-tab-assets" : "ws-tab-play"} className="widget widget--ink ws__play">
        <Stage
          project={project}
          live={live}
          now={now}
          played={played}
          onPlayed={() => setPlayed(true)}
          onRestore={restore}
          onRetry={retry}
          onQuestions={asked && !running && !queued && !exporting ? toQuestions : null}
          questionCount={asked?.questions?.items.length ?? 0}
          onChange={setProject}
          onAsk={(text) => {
            setPrefill((p) => ({ text, n: (p?.n ?? 0) + 1 }));
            show("chat"); // on a phone the box is on the Chat tab
          }}
          android={!!me?.features?.android}
          pane={shown === "assets" ? "assets" : "play"}
          onPane={show}
          fresh={fresh}
          assets={<Assets projectId={project.id} buildId={project.buildId} version={project.currentVersion} active={shown === "assets"} onChange={changeAsset} onAsk={toChat} />}
          onLeft={left}
        />
      </div>
    </main>
  );
}
