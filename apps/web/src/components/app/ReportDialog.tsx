"use client";

import { useImperativeHandle, useId, useRef, useState, type FormEvent, type Ref } from "react";
import type { ReportReason } from "@typeplay/shared";
import { REPORT_TEXT_MAX, reportReasons } from "@/content/gallery";
import { reportGame } from "@/lib/gallery";

export type ReportTarget = { id: string; name: string };
/** What a page does with the dialog: open it for a game, from the button that was pressed. */
export type ReportHandle = { open: (game: ReportTarget) => void };

/**
 * "Report this game" (the share page and the gallery): what's wrong, from a short list, one optional line,
 * and Send. A modal <dialog>: the form keeps the focus while it is open, Escape, Cancel or a tap beside it
 * close it, and the browser gives the focus back to the button that opened it. The API keeps the game, the
 * reason and the line, nothing about who sent it.
 */
export function ReportDialog({ ref }: { ref?: Ref<ReportHandle> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [game, setGame] = useState<ReportTarget | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The thanks: our own words, or the API's when this device already reported this game lately.
  const [thanks, setThanks] = useState<string | null>(null);
  const id = useId();

  useImperativeHandle(
    ref,
    () => ({
      open: (g) => {
        setGame(g);
        setReason(null);
        setText("");
        setBusy(false);
        setError(null);
        setThanks(null);
        dialog.current?.showModal();
      },
    }),
    [],
  );

  const close = () => dialog.current?.close();

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!game || !reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { already } = await reportGame(game.id, { reason, text: text.trim() || undefined });
      setThanks(already ?? "We look at every report. If the game breaks our rules, we take it down.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className="report"
      aria-labelledby={`${id}-title`}
      // A tap on the backdrop (the dialog element itself, outside its box) closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {game &&
        (thanks ? (
          <div className="report__body" role="status">
            <h2 id={`${id}-title`} className="report__title">
              Thanks for telling us.
            </h2>
            <p className="report__text">{thanks}</p>
            <div className="report__actions">
              <button type="button" className="button button--quiet button--small" onClick={close} autoFocus>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form className="report__body" onSubmit={(e) => void send(e)} noValidate>
            <h2 id={`${id}-title`} className="report__title">
              Report {game.name}
            </h2>
            <p className="report__text">What&apos;s wrong with it? We look at every report and keep nothing about who sent it.</p>
            <fieldset className="report__reasons" disabled={busy}>
              <legend className="sr-only">What&apos;s wrong with it</legend>
              {reportReasons.map((r) => (
                <label key={r.id} className="report__reason" data-on={reason === r.id || undefined}>
                  <input type="radio" name={`${id}-reason`} value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="sr-only" />
                  <span>{r.name}</span>
                </label>
              ))}
            </fieldset>
            <label htmlFor={`${id}-text`} className="field-label report__label">
              Anything else? <span>Optional</span>
            </label>
            <div className="field">
              <textarea
                id={`${id}-text`}
                rows={2}
                maxLength={REPORT_TEXT_MAX}
                value={text}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
                placeholder="Where in the game, or what it copies"
              />
            </div>
            {error && (
              <p className="composer__error" role="alert">
                {error}
              </p>
            )}
            <div className="report__actions">
              <button type="submit" className="button button--small" disabled={!reason || busy}>
                {busy ? "Sending…" : "Send report"}
              </button>
              <button type="button" className="button button--quiet button--small" onClick={close} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        ))}
    </dialog>
  );
}
