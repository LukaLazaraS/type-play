"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, ChatCircleText, DotsThree, DownloadSimple, PencilSimple, Trash } from "@phosphor-icons/react";
import type { Project } from "@typeplay/shared";
import { playUrl } from "@/components/GameFrame";
import { Button } from "@/components/ui/Button";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { InkPill } from "@/components/ui/InkPill";
import { Menu, MenuAsk, MenuItem } from "@/components/ui/Menu";
import { Popover, type PopoverHandle } from "@/components/ui/Popover";
import { api, saveFile } from "@/lib/api";
import { useSession } from "@/lib/session";
import { FeedbackDialog, type FeedbackHandle } from "./Feedback";

/** The game's own menu: rename, download the project, open in a new tab, send feedback about it, delete (asks first). */
export function GameMenu({ project, onRename }: { project: Project; onRename: () => void }) {
  const router = useRouter();
  const session = useSession();
  const menu = useRef<PopoverHandle>(null);
  const feedback = useRef<FeedbackHandle>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<"download" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reset = useCallback(() => {
    setAsking(false);
    setError(null);
  }, []);
  const close = () => menu.current?.close();
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
      <Popover
        id={`game-menu-${project.id}`}
        ref={menu}
        menu
        width={300}
        onClose={reset}
        trigger={(t) => (
          <InkPill {...t} aria-label="More: rename, download, feedback, delete" icon={<DotsThree size={20} weight="bold" aria-hidden="true" />} label="More" />
        )}
      >
        {asking ? (
          <MenuAsk
            id={`delete-q-${project.id}`}
            question={
              <>
                <b>Delete {project.name}?</b> Every version goes, and its share page{running ? ", and the build that is running now" : ""}. You can&apos;t
                undo this.
              </>
            }
            actions={
              <>
                <Button look="ink" size="small" busy={busy === "delete"} busyLabel="Deleting…" onClick={() => void remove()}>
                  Delete game
                </Button>
                <Button look="quiet" size="small" disabled={busy === "delete"} onClick={() => setAsking(false)}>
                  Keep it
                </Button>
              </>
            }
          />
        ) : (
          <Menu>
            <MenuItem
              icon={<PencilSimple size={18} weight="bold" aria-hidden="true" />}
              label="Rename"
              onClick={() => {
                close();
                onRename();
              }}
            />
            <MenuItem
              icon={<DownloadSimple size={18} weight="bold" aria-hidden="true" />}
              label={busy === "download" ? "Preparing the download…" : "Download the project"}
              hint={!project.buildId ? "There is nothing to download yet." : running ? "When this build is done." : "A .zip to open in Godot 4.7. It's yours."}
              disabled={!project.buildId || running || busy === "download"}
              onClick={() => void download()}
            />
            {project.buildId && (
              <MenuItem
                icon={<ArrowSquareOut size={18} weight="bold" aria-hidden="true" />}
                label="Play in a new tab"
                href={playUrl(project.buildId)}
                newTab
                phoneOnly
                onClick={close}
              />
            )}
            <MenuItem
              icon={<ChatCircleText size={18} weight="bold" aria-hidden="true" />}
              label="Send feedback"
              onClick={() => {
                close();
                // The newest answer: the build a note is most likely about.
                const last = project.messages.findLast((m) => m.role === "agent");
                feedback.current?.open({ id: project.id, name: project.name, messageId: last?.id ?? null }, menu.current?.trigger);
              }}
            />
            <MenuItem icon={<Trash size={18} weight="bold" aria-hidden="true" />} label="Delete game" onClick={() => setAsking(true)} />
          </Menu>
        )}
        {error && <ErrorLine>{error}</ErrorLine>}
      </Popover>
      <FeedbackDialog ref={feedback} email={session.status === "in" ? (session.me?.email ?? null) : null} />
    </>
  );
}
