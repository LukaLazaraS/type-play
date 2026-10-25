"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import type { ButtonLook } from "./ButtonLink";
import { ErrorLine } from "./ErrorLine";
import { TextButton } from "./TextButton";

/**
 * A button that runs one call: busy while it runs (its words say so), then what went wrong beside it if it failed.
 * `text`: words in a sentence instead (a TextButton, disabled while it runs). `run` starts inside the press, so it may
 * open a tab first (a popup blocker allows that only there).
 */
export function ActionButton({
  look = "quiet",
  label,
  busyLabel,
  run,
  onDone,
}: {
  look?: ButtonLook | "text";
  label: ReactNode;
  busyLabel?: ReactNode;
  run: () => Promise<unknown>;
  onDone?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await run();
      await onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="act">
      {look === "text" ? (
        <TextButton disabled={busy} onClick={() => void go()}>
          {label}
        </TextButton>
      ) : (
        <Button look={look} size="small" busy={busy} busyLabel={busyLabel} onClick={() => void go()}>
          {label}
        </Button>
      )}
      {error && <ErrorLine as="span">{error}</ErrorLine>}
    </span>
  );
}
