"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";

type Props = {
  accept: string;
  disabled?: boolean;
  /** Several files at once (the picker lets the player pick more than one): `onFiles` gets them all, in order. */
  multiple?: boolean;
  onFile?: (file: File | undefined) => void;
  onFiles?: (files: File[]) => void;
} & (
  | { icon?: undefined; label?: undefined; children: ReactNode }
  /** A round icon button in a Field box (IconButton's field look) named `label`, instead of the quiet small button. */
  | { icon: ReactNode; label: string; children?: undefined }
);

/**
 * Picks a file: a quiet small button (or, with `icon`, a round icon button in a Field box) that opens the browser's file
 * picker. The file input itself stays out of sight, out of the tab order (it has no visible focus) and out of the page's
 * layout (pinned to the screen's corner, 1px, invisible: in a grid it could stretch the page sideways); the button is
 * what the keyboard reaches.
 */
export function FileButton({ accept, disabled, multiple, onFile, onFiles, icon, label, children }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const pick = () => input.current?.click();
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="filebutton__input"
        tabIndex={-1}
        disabled={disabled}
        aria-hidden="true"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (onFiles) onFiles(files);
          else onFile?.(files[0]);
          e.target.value = "";
        }}
      />
      {icon ? (
        <IconButton look="field" label={label} title={label} disabled={disabled} onClick={pick}>
          {icon}
        </IconButton>
      ) : (
        <Button look="quiet" size="small" disabled={disabled} onClick={pick}>
          {children}
        </Button>
      )}
    </>
  );
}
