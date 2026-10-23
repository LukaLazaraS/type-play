"use client";

import { useImperativeHandle, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type Ref } from "react";
import { createPortal } from "react-dom";
import { FEEDBACK_COUNT_FROM, FEEDBACK_TEXT_MAX } from "@/content/beta";
import { api, ApiFailure } from "@/lib/api";
import { useAutoGrow } from "./useAutoGrow";

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
/** Measured again once the dialog shows: while it is closed the boxes have no size, so the hook's first measure was 0. */
function fit(el: HTMLTextAreaElement | null, max: number) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, max)}px`;
}
/** The counter under a box, once the words get near the limit: letters left in figures; at the end, a sentence. */
function Counter({ id, n }: { id: string; n: number }) {
  if (n <= 0) {
    return (
      <p id={id} className="field-hint">
        That&apos;s the most one note holds: send it, then start another.
      </p>
    );
  }
  return (
    <p id={id} className="figures feedback__count">
      {n.toLocaleString("en-US")} {n === 1 ? "letter" : "letters"} left
    </p>
  );
}

/**
 * "Send feedback" (beta 1), from the account menu and the game page's More menu: what happened, what they expected
 * (optional), and on a game's page a tick box, on by default, that attaches the game and its newest answer so Luka can
 * play that version. A modal <dialog> in the report dialog's box, put straight in <body> so the status bar's or the
 * stage's styles don't reach it. Words typed and closed without sending wait for the next open (and a reload); a sent
 * note clears them. Ctrl or Cmd + Enter sends.
 */
export function FeedbackDialog({ ref, email }: { ref?: Ref<FeedbackHandle>; email: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const textBox = useRef<HTMLTextAreaElement>(null);
  const expectedBox = useRef<HTMLTextAreaElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
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
  useAutoGrow(textBox, text, TEXT_MAX_PX);
  useAutoGrow(expectedBox, expected, EXPECTED_MAX_PX);

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
        returnTo.current = from ?? null;
        dialog.current?.showModal();
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

  if (typeof document === "undefined") return null;
  const textCount = text.length >= FEEDBACK_COUNT_FROM ? `${id}-text-count` : undefined;
  const expectedCount = expected.length >= FEEDBACK_COUNT_FROM ? `${id}-expected-count` : undefined;
  return createPortal(
    <dialog
      ref={dialog}
      className="report feedback"
      aria-labelledby={`${id}-title`}
      // A tap on the backdrop (the dialog element itself, outside its box) closes it; the words wait for next time.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      // The entry that opened it was in a menu, closed by now: the keyboard goes back to that menu's button.
      onClose={() => {
        if (returnTo.current?.isConnected) returnTo.current.focus();
      }}
    >
      {sent ? (
        <div className="report__body" role="status">
          <h2 id={`${id}-title`} className="report__title">
            Thanks for telling us.
          </h2>
          <p className="report__text">
            {sent === "with-game" ? "We have your note and the game." : "We have your note."}
            {email && (
              <>
                {" "}
                If we need to know more, we&apos;ll write to <b className="feedback__email">{email}</b>.
              </>
            )}
          </p>
          <div className="report__actions">
            <button type="button" className="button button--quiet button--small" onClick={close} autoFocus>
              Close
            </button>
          </div>
        </div>
      ) : (
        <form className="report__body" onSubmit={submit} onKeyDown={onKey} noValidate>
          <h2 id={`${id}-title`} className="report__title">
            Send feedback
          </h2>
          <p className="report__text">Something broke, didn&apos;t make sense, or a game came out wrong? Tell us. We read every note.</p>
          <div className="feedback__part">
            <label htmlFor={`${id}-text`} className="field-label">
              What happened?
            </label>
            <div className="field">
              <textarea
                ref={textBox}
                id={`${id}-text`}
                className="feedback__text"
                rows={3}
                maxLength={FEEDBACK_TEXT_MAX}
                value={text}
                disabled={busy}
                aria-describedby={textCount}
                onChange={(e) => changeText(e.target.value)}
                placeholder="For example: the game froze after level 2."
              />
            </div>
            {textCount && <Counter id={textCount} n={FEEDBACK_TEXT_MAX - text.length} />}
          </div>
          <div className="feedback__part">
            <label htmlFor={`${id}-expected`} className="field-label report__label">
              What did you expect? <span>Optional</span>
            </label>
            <div className="field">
              <textarea
                ref={expectedBox}
                id={`${id}-expected`}
                className="feedback__expected"
                rows={2}
                maxLength={FEEDBACK_TEXT_MAX}
                value={expected}
                disabled={busy}
                aria-describedby={expectedCount}
                onChange={(e) => changeExpected(e.target.value)}
                placeholder="For example: level 3 starts."
              />
            </div>
            {expectedCount && <Counter id={expectedCount} n={FEEDBACK_TEXT_MAX - expected.length} />}
          </div>
          {game && (
            <label className="consent feedback__attach">
              <input type="checkbox" checked={attach} disabled={busy} onChange={(e) => setAttach(e.target.checked)} />
              <span>
                Attach this game, so we can play the version you see.
                <span className="feedback__game">{game.name}</span>
              </span>
            </label>
          )}
          <p className="field-hint">We keep your note with your account, the page you&apos;re on, and your browser and device type.</p>
          {error && (
            <p className="composer__error" role="alert">
              {error}
            </p>
          )}
          <div className="report__actions">
            <button type="submit" className="button button--small" disabled={!text.trim() || busy || full}>
              {busy ? "Sending…" : "Send feedback"}
            </button>
            <button type="button" className="button button--quiet button--small" onClick={close} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </dialog>,
    document.body,
  );
}
