"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ShareNetwork } from "@phosphor-icons/react";
import type { Project, UpdateProjectBody } from "@typeplay/shared";
import { site } from "@/content/site";
import { api } from "@/lib/api";
import { playsWord } from "@/lib/format";
import { usePopover } from "./usePopover";

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
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const origin = useOrigin();
  const canShare = useCanShare();
  usePopover(trigger, panel);
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
      const input = panel.current?.querySelector("input");
      input?.focus();
      input?.select();
    }
  };

  const send = () => {
    navigator.share({ title: project.name, text: `Play ${project.name}, a game made with TypePlay`, url: link }).catch(() => {
      /* closed the share sheet */
    });
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="inkpill"
        popoverTarget={`share-${project.id}`}
        data-on={project.shared || undefined}
        aria-label={project.shared ? "Shared: change sharing" : "Share this game"}
      >
        <ShareNetwork size={18} weight={project.shared ? "fill" : "bold"} aria-hidden="true" />
        <span className="inkpill__label">{project.shared ? "Shared" : "Share"}</span>
      </button>
      <div ref={panel} id={`share-${project.id}`} popover="auto" className="pop share" data-width={340}>
        <div className="share__head">
          <div>
            <b id={`share-title-${project.id}`}>Share this game</b>
            <span id={`share-state-${project.id}`}>{project.shared ? "Anyone with the link can play it." : "Only you can play it now."}</span>
            {project.plays > 0 && <span className="figures share__plays">{playsWord(project.plays)}</span>}
          </div>
          <button
            type="button"
            role="switch"
            className="toggle"
            aria-checked={project.shared}
            aria-labelledby={`share-title-${project.id}`}
            aria-describedby={`share-state-${project.id}`}
            disabled={busy}
            onClick={() => void update({ shared: !project.shared })}
          >
            <span className="toggle__thumb" aria-hidden="true" />
          </button>
        </div>
        {project.shared ? (
          <>
            <div className="field share__link">
              <input
                readOnly
                value={shown}
                aria-label="Link to the game"
                onFocus={(e) => e.currentTarget.select()}
                spellCheck={false}
              />
            </div>
            <div className="share__actions">
              {canShare && (
                <button type="button" className="button button--small" onClick={send}>
                  Share…
                </button>
              )}
              <button type="button" className={`button button--small${canShare ? " button--quiet" : ""}`} onClick={() => void copy()}>
                {copied ? "Copied" : "Copy link"}
              </button>
              <a className="button button--quiet button--small" href={path} target="_blank" rel="noopener">
                Open
              </a>
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
              <button
                type="button"
                role="switch"
                className="toggle"
                aria-checked={project.listed && !project.galleryHidden}
                aria-labelledby={`gallery-title-${project.id}`}
                aria-describedby={`gallery-state-${project.id}`}
                disabled={busy || project.galleryHidden}
                onClick={() => void update({ listed: !project.listed })}
              >
                <span className="toggle__thumb" aria-hidden="true" />
              </button>
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
        {error && (
          <p className="composer__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
