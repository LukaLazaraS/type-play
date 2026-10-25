"use client";

import { useImperativeHandle, useId, useRef, useState, type FormEvent, type Ref } from "react";
import type { ReportReason } from "@typeplay/shared";
import { Button } from "@/components/ui/Button";
import { ChoiceRows } from "@/components/ui/ChoiceRows";
import { Dialog, DialogActions, DialogBody, DialogForm, DialogText, DialogTitle, type DialogHandle } from "@/components/ui/Dialog";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { TextArea } from "@/components/ui/Field";
import { REPORT_TEXT_MAX, reportReasons } from "@/content/gallery";
import { reportGame } from "@/lib/gallery";

export type ReportTarget = { id: string; name: string };
/** What a page does with the dialog: open it for a game, from the button that was pressed. */
export type ReportHandle = { open: (game: ReportTarget) => void };

/**
 * "Report this game" (the share page and the gallery): what's wrong, from a short list, one optional line, and Send.
 * The shared Dialog: the form keeps the focus while it is open, Escape, Cancel or a tap beside it close it, and the
 * browser gives the focus back to the button that opened it. The API keeps the game, the reason and the line, nothing
 * about who sent it.
 */
export function ReportDialog({ ref }: { ref?: Ref<ReportHandle> }) {
  const dialog = useRef<DialogHandle>(null);
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
        dialog.current?.open();
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
    <Dialog ref={dialog} labelledBy={`${id}-title`}>
      {game &&
        (thanks ? (
          <DialogBody role="status">
            <DialogTitle id={`${id}-title`}>Thanks for telling us.</DialogTitle>
            <DialogText>{thanks}</DialogText>
            <DialogActions>
              <Button look="quiet" size="small" onClick={close} autoFocus>
                Close
              </Button>
            </DialogActions>
          </DialogBody>
        ) : (
          <DialogForm onSubmit={(e) => void send(e)} noValidate>
            <DialogTitle id={`${id}-title`}>Report {game.name}</DialogTitle>
            <DialogText>What&apos;s wrong with it? We look at every report and keep nothing about who sent it.</DialogText>
            <ChoiceRows
              name={`${id}-reason`}
              legend="What's wrong with it"
              value={reason}
              onChange={setReason}
              choices={reportReasons.map((r) => ({ value: r.id, title: r.name }))}
              disabled={busy}
            />
            <TextArea
              id={`${id}-text`}
              label="Anything else?"
              optional
              rows={2}
              maxLength={REPORT_TEXT_MAX}
              value={text}
              disabled={busy}
              onChange={(e) => setText(e.target.value)}
              placeholder="Where in the game, or what it copies"
            />
            {error && <ErrorLine>{error}</ErrorLine>}
            <DialogActions>
              <Button type="submit" size="small" disabled={!reason} busy={busy} busyLabel="Sending…">
                Send report
              </Button>
              <Button look="quiet" size="small" onClick={close} disabled={busy}>
                Cancel
              </Button>
            </DialogActions>
          </DialogForm>
        ))}
    </Dialog>
  );
}
