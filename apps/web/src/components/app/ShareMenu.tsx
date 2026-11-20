"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ShareNetwork } from "@phosphor-icons/react";
import type { Project, UpdateProjectBody } from "@typeplay/shared";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextArea, TextField } from "@/components/ui/Field";
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

/** The gallery switch's line, off and on: what it does, in both. */
const GALLERY_OFF = "Off. Turn it on and anyone can find it on Explore and in search engines like Google.";
const GALLERY_ON = "On. Anyone can find it on Explore and in search engines like Google.";

/**
 * The description's most letters: the API's (apps/server src/games/pitch.ts PITCH_MAX), counted as it counts them (code
 * points: an emoji is one letter). The letters left show from 120.
 */
const LINE_MAX = 150;
const letters = (s: string) => [...s].length;
const LINE_COUNT = { from: 120, max: LINE_MAX, full: "That's the most a description holds.", of: letters };

/**
 * The game's description (2026-11-20): the one sentence its share page shows under its name, and its link previews and,
 * in the gallery, search results use. The AI writes it from the game after each build (packages/agent/tools/pitch.mjs)
 * and may rewrite it when a change makes a different game; the owner can write their own, which builds leave alone, and
 * go back to the AI's. Shown before the game is shared too, so the owner knows what goes public.
 */
function Description({ project, onChange }: { project: Project; onChange: (p: Project) => void }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = project.ownerPitch ?? project.pitch;
  const id = `share-line-${project.id}`;
  const where = !project.shared
    ? "Its page shows it once you share the game."
    : project.listed && !project.galleryHidden
      ? "Its page, link previews and search show it."
      : "Its page and link previews show it.";

  // The keyboard goes into the box on Edit, and back to Edit once the box closes (saved or cancelled), not to the page.
  useEffect(() => {
    if (editing) box.current?.focus();
    else if (wasEditing.current) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const save = async (ownerPitch: string | null) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await api.update(project.id, { ownerPitch }));
      setEditing(false);
      // Use the AI's goes away once pressed: the keyboard moves to Edit, not to the page.
      if (ownerPitch === null) requestAnimationFrame(() => editButton.current?.focus());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const submit = (e?: Pick<FormEvent, "preventDefault">) => {
    e?.preventDefault();
    // Enter again while it saves (the box stays focused, read-only): one save.
    if (busy) return;
    const line = draft.replace(/\s+/g, " ").trim();
    if (!line || line === shown) return setEditing(false);
    void save(line);
  };
  const edit = () => {
    setDraft(shown ?? "");
    setError(null);
    setEditing(true);
  };

  return (
    <div className="share__line">
      <div className="share__head">
        <div>
          <b id={`${id}-title`}>Description</b>
          <span>{where}</span>
        </div>
      </div>
      {editing ? (
        <form className="share__edit" onSubmit={submit} noValidate>
          <TextArea
            ref={box}
            id={id}
            label="Description"
            labelHidden
            rows={3}
            grow={140}
            count={LINE_COUNT}
            // maxLength counts UTF-16 units: each emoji already in the box gets its second unit on top, so 150 letters fit.
            maxLength={LINE_MAX + draft.length - letters(draft)}
            value={draft}
            // Read-only while it saves, not disabled: the keyboard stays in the box, so after the API's no it is there
            // to fix the words.
            readOnly={busy}
            error={error}
            enterKeyHint="done"
            placeholder="What the player does, and what makes it fun."
            // One sentence: Enter saves (a new line has no place in it), and a pasted one comes in as one line. Escape
            // cancels the edit and leaves the menu open, as the other inline edits do (ManageList's rename).
            onChange={(e) => setDraft(e.target.value.replace(/[\r\n]+/g, " "))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(e);
              if (e.key === "Escape") {
                e.preventDefault();
                if (!busy) setEditing(false);
              }
            }}
          />
          <div className="share__actions">
            <Button type="submit" size="small" disabled={!draft.trim()} busy={busy} busyLabel="Saving…">
              Save
            </Button>
            <Button look="quiet" size="small" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          {shown ? (
            <p className="share__pitch">{shown}</p>
          ) : (
            <p className="share__note">None yet. Your next change to the game writes one, or write your own.</p>
          )}
          {shown && (
            <p className="share__note">
              {project.ownerPitch !== null
                ? "Yours. Changes to the game leave it as it is."
                : "Written by the AI from your game. A change that makes a different game rewrites it."}
            </p>
          )}
          <div className="share__actions">
            {/* Not while Use the AI's saves: its answer would close a box opened meanwhile, and the words in it. */}
            <Button ref={editButton} look="quiet" size="small" disabled={busy} onClick={edit} aria-describedby={`${id}-title`}>
              {shown ? "Edit" : "Write one"}
            </Button>
            {project.ownerPitch !== null && project.pitch && (
              <Button look="quiet" size="small" busy={busy} busyLabel="Saving…" onClick={() => void save(null)}>
                Use the AI&apos;s
              </Button>
            )}
          </div>
          {error && <ErrorLine>{error}</ErrorLine>}
        </>
      )}
    </div>
  );
}

/**
 * Share: a switch that makes the game public at /play/<id>, and its link to copy or send; then, while it is
 * shared, a second switch that also shows it in the public gallery (/explore), which lets search engines list its page
 * too (2026-11-20), and how often it was played; and the game's description, which its page shows (Description).
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
              {project.galleryHidden ? (
                <span id={`gallery-state-${project.id}`}>We took it out of the gallery after a report.</span>
              ) : (
                // What the switch does, said before it is on. Both lines take the room of the longer one (the other is
                // there unseen), so the switch beside them stays put when it flips.
                <span className="share__states">
                  <span id={`gallery-state-${project.id}`}>{project.listed ? GALLERY_ON : GALLERY_OFF}</span>
                  <span aria-hidden="true">{project.listed ? GALLERY_OFF : GALLERY_ON}</span>
                </span>
              )}
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
              : `${project.listed ? "Anyone on Explore sees" : "Friends see"} the game, its name, its description and its plays. Your chat, your ideas and your account stay private.`}
          </p>
        </>
      ) : (
        <p className="share__note">Turn it on to get a link for friends. Turn it off any time and the link stops working.</p>
      )}
      <Description project={project} onChange={onChange} />
      {error && <ErrorLine>{error}</ErrorLine>}
    </Popover>
  );
}
