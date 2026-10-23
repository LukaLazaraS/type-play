"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, ChatCircleText, DotsThree, DownloadSimple, PencilSimple, Trash } from "@phosphor-icons/react";
import type { Project } from "@typeplay/shared";
import { playUrl } from "@/components/GameFrame";
import { api, saveFile } from "@/lib/api";
import { useSession } from "@/lib/session";
import { FeedbackDialog, type FeedbackHandle } from "./Feedback";
import { usePopover } from "./usePopover";

/** The game's own menu: rename, download the project, open in a new tab, send feedback about it, delete (asks first). */
export function GameMenu({ project, onRename }: { project: Project; onRename: () => void }) {
  const router = useRouter();
  const session = useSession();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const feedback = useRef<FeedbackHandle>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<"download" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reset = useCallback(() => {
    setAsking(false);
    setError(null);
  }, []);
  usePopover(trigger, panel, reset);
  const close = () => panel.current?.hidePopover();
  const running = project.status === "running";

  const download = async () => {
    setBusy("download");
    setError(null);
    try {
      saveFile(await api.download(project.id));
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    setError(null);
    try {
      await api.remove(project.id);
      router.replace("/games");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <>
      <button ref={trigger} type="button" className="inkpill" popoverTarget={`game-menu-${project.id}`} aria-label="More: rename, download, feedback, delete">
        <DotsThree size={20} weight="bold" aria-hidden="true" />
        <span className="inkpill__label">More</span>
      </button>
      <div ref={panel} id={`game-menu-${project.id}`} popover="auto" className="pop menu" data-width={300}>
        {asking ? (
          <div className="menu__ask" role="group" aria-labelledby={`delete-q-${project.id}`}>
            <p id={`delete-q-${project.id}`}>
              <b>Delete {project.name}?</b> Every version goes, and its share page{running ? ", and the build that is running now" : ""}. You can&apos;t undo
              this.
            </p>
            <div className="menu__ask-actions">
              <button type="button" className="button button--ink button--small" disabled={busy === "delete"} onClick={() => void remove()}>
                {busy === "delete" ? "Deleting…" : "Delete game"}
              </button>
              <button type="button" className="button button--quiet button--small" disabled={busy === "delete"} onClick={() => setAsking(false)}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <ul className="menu__list">
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  onRename();
                }}
              >
                <PencilSimple size={18} weight="bold" aria-hidden="true" />
                Rename
              </button>
            </li>
            <li>
              <button type="button" disabled={!project.buildId || running || busy === "download"} onClick={() => void download()}>
                <DownloadSimple size={18} weight="bold" aria-hidden="true" />
                <span>
                  {busy === "download" ? "Preparing the download…" : "Download the project"}
                  <small>
                    {!project.buildId
                      ? "There is nothing to download yet."
                      : running
                        ? "When this build is done."
                        : "A .zip to open in Godot 4.7. It's yours."}
                  </small>
                </span>
              </button>
            </li>
            {project.buildId && (
              <li className="menu__newtab">
                <a href={playUrl(project.buildId)} target="_blank" rel="noopener" onClick={close}>
                  <ArrowSquareOut size={18} weight="bold" aria-hidden="true" />
                  Play in a new tab
                </a>
              </li>
            )}
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  // The newest answer: the build a note is most likely about.
                  const last = project.messages.findLast((m) => m.role === "agent");
                  feedback.current?.open({ id: project.id, name: project.name, messageId: last?.id ?? null }, trigger.current);
                }}
              >
                <ChatCircleText size={18} weight="bold" aria-hidden="true" />
                Send feedback
              </button>
            </li>
            <li>
              <button type="button" className="menu__danger" onClick={() => setAsking(true)}>
                <Trash size={18} weight="bold" aria-hidden="true" />
                Delete game
              </button>
            </li>
          </ul>
        )}
        {error && (
          <p className="composer__error" role="alert">
            {error}
          </p>
        )}
      </div>
      <FeedbackDialog ref={feedback} email={session.status === "in" ? (session.me?.email ?? null) : null} />
    </>
  );
}
