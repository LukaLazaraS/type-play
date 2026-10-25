"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ShareNetwork } from "@phosphor-icons/react";
import type { Project, UpdateProjectBody } from "@typeplay/shared";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextField } from "@/components/ui/Field";
import { InkPill } from "@/components/ui/InkPill";
import { Popover } from "@/components/ui/Popover";
import { Toggle } from "@/components/ui/Toggle";
import { site } from "@/content/site";
import { api } from "@/lib/api";
import { playsWord } from "@/lib/format";

const noop = () => () => {};
/** The page's own address (http://localhost:3000 in dev, https://typeplay.app live). */
const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => "");
const useCanShare = () => useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);

/**
 * Share: a switch that makes the game public at /play/<id>, and its link to copy or send; then, while it is
 * shared, a second switch that also shows it in the public gallery (/explore), and how often it was played.
 * Private by default; turning sharing off makes the page disappear (404) at once and takes it out of the gallery.
 */
export function ShareMenu({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const field = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const origin = useOrigin();
  const canShare = useCanShare();
  const path = `/play/${project.id}`;
  const link = `${origin}${path}`;
  const shown = link.replace(/^https?:\/\//, "");

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const update = async (body: UpdateProjectBody) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await api.update(project.id, body));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // No clipboard here (an old browser, or permission): select it so a long-press or Ctrl+C copies it.
      field.current?.focus();
      field.current?.select();
    }
  };

  const send = () => {
    navigator.share({ title: project.name, text: `Play ${project.name}, a game made with TypePlay`, url: link }).catch(() => {
      /* closed the share sheet */
    });
  };

  return (
    <Popover
      id={`share-${project.id}`}
      width={340}
      className="share"
      trigger={(t) => (
        <InkPill
          {...t}
          on={project.shared}
          aria-label={project.shared ? "Shared: change sharing" : "Share this game"}
          icon={<ShareNetwork size={18} weight={project.shared ? "fill" : "bold"} aria-hidden="true" />}
          label={project.shared ? "Shared" : "Share"}
        />
      )}
    >
      <div className="share__head">
        <div>
          <b id={`share-title-${project.id}`}>Share this game</b>
          <span id={`share-state-${project.id}`}>{project.shared ? "Anyone with the link can play it." : "Only you can play it now."}</span>
          {project.plays > 0 && <span className="figures share__plays">{playsWord(project.plays)}</span>}
        </div>
        <Toggle
          on={project.shared}
          onChange={(shared) => void update({ shared })}
          labelledBy={`share-title-${project.id}`}
          describedBy={`share-state-${project.id}`}
          busy={busy}
        />
      </div>
      {project.shared ? (
        <>
          <TextField
            ref={field}
            id={`share-link-${project.id}`}
            boxClassName="share__link"
            readOnly
            value={shown}
            aria-label="Link to the game"
            onFocus={(e) => e.currentTarget.select()}
            spellCheck={false}
          />
          <div className="share__actions">
            {canShare && (
              <Button size="small" onClick={send}>
                Share…
              </Button>
            )}
            <Button size="small" look={canShare ? "quiet" : "hot"} onClick={() => void copy()}>
              {copied ? "Copied" : "Copy link"}
            </Button>
            <ButtonLink look="quiet" size="small" href={path} newTab>
              Open
            </ButtonLink>
          </div>
          <div className="share__head share__gallery">
            <div>
              <b id={`gallery-title-${project.id}`}>Show it in the gallery</b>
              <span id={`gallery-state-${project.id}`}>
                {project.galleryHidden
                  ? "We took it out of the gallery after a report."
                  : project.listed
                    ? "Anyone can find it on Explore."
                    : "Off: only people with the link find it."}
              </span>
            </div>
            {/* Taken out by an admin: the switch reads off and waits (writing to us is the way back). */}
            <Toggle
              on={project.listed && !project.galleryHidden}
              onChange={(listed) => void update({ listed })}
              labelledBy={`gallery-title-${project.id}`}
              describedBy={`gallery-state-${project.id}`}
              busy={busy}
              disabled={project.galleryHidden}
            />
          </div>
          <p className="share__note">
            {project.galleryHidden
              ? `Its link still works. If you think that's a mistake, write to ${site.email}.`
              : `${project.listed ? "Anyone on Explore sees" : "Friends see"} the game, its name and its plays. Your chat, your ideas and your account stay private.`}
          </p>
        </>
      ) : (
        <p className="share__note">Turn it on to get a link for friends. Turn it off any time and the link stops working.</p>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </Popover>
  );
}
