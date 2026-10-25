"use client";

import { useImperativeHandle, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type Ref } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogActions, DialogBody, DialogForm, DialogText, DialogTitle, type DialogHandle } from "@/components/ui/Dialog";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextArea } from "@/components/ui/Field";
import { FEEDBACK_COUNT_FROM, FEEDBACK_TEXT_MAX } from "@/content/beta";
import { api, ApiFailure } from "@/lib/api";

/** The game a note can carry: the game page's, with its newest answer (the build Luka should look at). */
export type FeedbackGame = { id: string; name: string; messageId: string | null };
/** What an entry does with the dialog: open it, with the page's game when there is one, and the control the keyboard
 * goes back to when it closes (the entry itself sits in a menu that is gone by then). */
export type FeedbackHandle = { open: (game: FeedbackGame | null, returnTo?: HTMLElement | null) => void };

// The game page says which game is open (GameClient), so the account menu's Send feedback can offer to attach it too.
let openGame: FeedbackGame | null = null;
const listeners = new Set<() => void>();
export function setFeedbackGame(game: FeedbackGame | null) {
  openGame = game;
  listeners.forEach((l) => l());
}
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
/** The game open on this page, or null away from a game page. */
export function useFeedbackGame(): FeedbackGame | null {
  return useSyncExternalStore(
    subscribe,
    () => openGame,
    () => null,
  );
}

// Words typed and not sent wait in this browser: across a reload, and for the other entry's dialog too.
const DRAFT = "typeplay.feedback";
type Draft = { text: string; expected: string };
function readDraft(): Draft {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT) ?? "{}") as Partial<Draft>;
    return { text: typeof d.text === "string" ? d.text : "", expected: typeof d.expected === "string" ? d.expected : "" };
  } catch {
    return { text: "", expected: "" };
  }
}
function keepDraft(d: Draft) {
  try {
    if (d.text || d.expected) localStorage.setItem(DRAFT, JSON.stringify(d));
    else localStorage.removeItem(DRAFT);
  } catch {
    /* private mode: the words stay only while the page is open */
  }
}

const TEXT_MAX_PX = 240;
const EXPECTED_MAX_PX = 160;
/** Measured again once the dialog shows: while it is closed the boxes have no size, so the first measure was 0. */
function fit(el: HTMLTextAreaElement | null, max: number) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, max)}px`;
}
/** Letters left under a box, from 3,600 on; at the limit, a sentence. */
const count = { from: FEEDBACK_COUNT_FROM, max: FEEDBACK_TEXT_MAX, full: "That's the most one note holds: send it, then start another." };

/**
 * "Send feedback" (beta 1), from the account menu and the game page's More menu: what happened, what they expected
 * (optional), and on a game's page a tick box, on by default, that attaches the game and its newest answer so Luka can
 * play that version. The shared Dialog, wide. Words typed and closed without sending wait for the next open (and a
 * reload); a sent note clears them. Ctrl or Cmd + Enter sends.
 */
export function FeedbackDialog({ ref, email }: { ref?: Ref<FeedbackHandle>; email: string | null }) {
  const dialog = useRef<DialogHandle>(null);
  const textBox = useRef<HTMLTextAreaElement>(null);
  const expectedBox = useRef<HTMLTextAreaElement>(null);
  const [game, setGame] = useState<FeedbackGame | null>(null);
  const [attach, setAttach] = useState(true);
  const [text, setText] = useState("");
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The day's notes are used up (the API's 429): Send stays off until the next open; the words wait.
  const [full, setFull] = useState(false);
  const [sent, setSent] = useState<"with-game" | "note" | null>(null);
  const id = useId();

  useImperativeHandle(
    ref,
    () => ({
      open: (g, from) => {
        const draft = readDraft();
        setGame(g);
        setAttach(!!g);
        setText(draft.text);
        setExpected(draft.expected);
        setBusy(false);
        setError(null);
        setFull(false);
        setSent(null);
        dialog.current?.open(from);
        fit(textBox.current, TEXT_MAX_PX);
        fit(expectedBox.current, EXPECTED_MAX_PX);
      },
    }),
    [],
  );

  const close = () => dialog.current?.close();
  const changeText = (value: string) => {
    setText(value);
    keepDraft({ text: value, expected });
  };
  const changeExpected = (value: string) => {
    setExpected(value);
    keepDraft({ text, expected: value });
  };

  const send = async () => {
    const what = text.trim();
    if (!what || busy || full) return;
    setBusy(true);
    setError(null);
    try {
      const withGame = attach && game;
      await api.feedback({
        text: what,
        expected: expected.trim() || undefined,
        page: location.pathname,
        gameId: withGame ? game.id : undefined,
        messageId: withGame && game.messageId ? game.messageId : undefined,
      });
      setText("");
      setExpected("");
      keepDraft({ text: "", expected: "" });
      setSent(withGame ? "with-game" : "note");
    } catch (err) {
      if (err instanceof ApiFailure && err.code === "too_many") setFull(true);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <Dialog ref={dialog} labelledBy={`${id}-title`} wide className="feedback">
      {sent ? (
        <DialogBody role="status">
          <DialogTitle id={`${id}-title`}>Thanks for telling us.</DialogTitle>
          <DialogText>
            {sent === "with-game" ? "We have your note and the game." : "We have your note."}
            {email && (
              <>
                {" "}
                If we need to know more, we&apos;ll write to <b className="feedback__email">{email}</b>.
              </>
            )}
          </DialogText>
          <DialogActions>
            <Button look="quiet" size="small" onClick={close} autoFocus>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      ) : (
        <DialogForm onSubmit={submit} onKeyDown={onKey} noValidate>
          <DialogTitle id={`${id}-title`}>Send feedback</DialogTitle>
          <DialogText>Something broke, didn&apos;t make sense, or a game came out wrong? Tell us. We read every note.</DialogText>
          <div className="feedback__part">
            <TextArea
              ref={textBox}
              id={`${id}-text`}
              label="What happened?"
              className="feedback__text"
              grow={TEXT_MAX_PX}
              count={count}
              rows={3}
              maxLength={FEEDBACK_TEXT_MAX}
              value={text}
              disabled={busy}
              onChange={(e) => changeText(e.target.value)}
              placeholder="For example: the game froze after level 2."
            />
          </div>
          <div className="feedback__part">
            <TextArea
              ref={expectedBox}
              id={`${id}-expected`}
              label="What did you expect?"
              optional
              className="feedback__expected"
              grow={EXPECTED_MAX_PX}
              count={count}
              rows={2}
              maxLength={FEEDBACK_TEXT_MAX}
              value={expected}
              disabled={busy}
              onChange={(e) => changeExpected(e.target.value)}
              placeholder="For example: level 3 starts."
            />
          </div>
          {game && (
            <Checkbox checked={attach} disabled={busy} onChange={setAttach} note={game.name}>
              Attach this game, so we can play the version you see.
            </Checkbox>
          )}
          <p className="field-hint">We keep your note with your account, the page you&apos;re on, and your browser and device type.</p>
          {error && <ErrorLine>{error}</ErrorLine>}
          <DialogActions>
            <Button type="submit" size="small" disabled={!text.trim() || full} busy={busy} busyLabel="Sending…">
              Send feedback
            </Button>
            <Button look="quiet" size="small" onClick={close} disabled={busy}>
              Cancel
            </Button>
          </DialogActions>
        </DialogForm>
      )}
    </Dialog>
  );
}
