"use client";

import { useRef, type ComponentPropsWithRef } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { cx } from "./cx";
import { FieldLabel } from "./Field";
import { IconButton } from "./IconButton";

/**
 * A search box on the sky (the gallery's): the pill bar's ink, fully round, 52px, a magnifying glass, white 17px words (a
 * phone doesn't zoom in), the hot caret and the amber ring while the keyboard is in it. Once there are words, a clear
 * button (the ghost IconButton) at its end; Escape clears it too. The label is for screen readers.
 */
export function SearchField({
  id,
  label,
  value,
  onClear,
  className,
  ...input
}: Omit<ComponentPropsWithRef<"input">, "id" | "type" | "value" | "className"> & {
  id: string;
  label: string;
  value: string;
  /** Empties the box (the clear button, Escape); the keyboard stays in it. */
  onClear: () => void;
  className?: string;
}) {
  const own = useRef<HTMLInputElement>(null);
  return (
    <div className={cx("searchfield", className)}>
      <MagnifyingGlass size={18} weight="bold" aria-hidden="true" className="searchfield__icon" />
      <FieldLabel htmlFor={id} hidden>
        {label}
      </FieldLabel>
      <input
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        {...input}
        ref={own}
        id={id}
        type="search"
        value={value}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onClear();
          }
          input.onKeyDown?.(e);
        }}
      />
      {value && (
        <IconButton
          label="Clear the search"
          className="searchfield__clear"
          onClick={() => {
            onClear();
            own.current?.focus();
          }}
        >
          <X size={16} weight="bold" aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );
}
