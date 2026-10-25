"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "./Button";

/**
 * Picks a file: a quiet small button that opens the browser's file picker. The file input itself stays out of sight and
 * out of the tab order (it has no visible focus); the button is what the keyboard reaches.
 */
export function FileButton({ accept, disabled, onFile, children }: { accept: string; disabled?: boolean; onFile: (file: File | undefined) => void; children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        aria-hidden="true"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button look="quiet" size="small" disabled={disabled} onClick={() => input.current?.click()}>
        {children}
      </Button>
    </>
  );
}
