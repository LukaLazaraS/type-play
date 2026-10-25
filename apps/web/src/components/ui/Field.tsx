"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithRef, type ReactNode } from "react";
import { cx } from "./cx";
import { ErrorLine } from "./ErrorLine";

type FieldProps = {
  id: string;
  /** The field's name above it (600 15px); `labelHidden` keeps it for screen readers only. Without one, give aria-label. */
  label?: ReactNode;
  labelHidden?: boolean;
  /** "Optional", muted, after the label. */
  optional?: boolean;
  /** A muted line under the box, read with the field. */
  hint?: ReactNode;
  /** What is wrong, in the hint's place: ink 600 after the hot dot, announced, and the field marked invalid. */
  error?: ReactNode;
  /** More lines that describe the field, by id. */
  describedBy?: string;
  /** The Field box's look: a one-line box (2px 16px, for an input) or the roomy one (6px 20px, for words); on a Field
   * panel the box is paper; on ink it is Ink Recess with white words (the game's name in its bar). `dim`: muted words. */
  line?: boolean;
  tone?: "field" | "paper" | "ink";
  dim?: boolean;
  /** The box's own extras (its fonts, its flex). */
  boxClassName?: string;
};

const boxClass = ({ line, tone, dim, boxClassName }: Pick<FieldProps, "line" | "tone" | "dim" | "boxClassName">) =>
  cx("field", line && "field--line", tone === "paper" && "field--paper", tone === "ink" && "field--ink", dim && "field--dim", boxClassName);

/** The field's name, for a box laid out apart from it (the beta code's label over its row). */
export function FieldLabel({ htmlFor, optional, hidden, children }: { htmlFor: string; optional?: boolean; hidden?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={hidden ? "sr-only" : "field-label"}>
      {children}
      {optional && (
        <>
          {" "}
          <span className="field-optional">Optional</span>
        </>
      )}
    </label>
  );
}

/** The ids the control is described by: the error or the hint, then any others. */
const describe = (id: string, { hint, error, describedBy }: Pick<FieldProps, "hint" | "error" | "describedBy">, more?: string) =>
  [error ? `${id}-error` : hint ? `${id}-hint` : null, more, describedBy].filter(Boolean).join(" ") || undefined;

function Below({ id, hint, error }: Pick<FieldProps, "id" | "hint" | "error">) {
  if (error) return <ErrorLine id={`${id}-error`}>{error}</ErrorLine>;
  if (hint !== undefined && hint !== null && hint !== false)
    return (
      <p id={`${id}-hint`} className="field-hint">
        {hint}
      </p>
    );
  return null;
}

/**
 * A one-line text box (DESIGN.md: the Field box): its label, the box (Field, the field radius, the amber ring while the
 * keyboard is in it, the hot caret, 17px words so a phone doesn't zoom in), then a hint or the error. No wrapper of its
 * own: the parts go where its parent lays them out.
 */
export function TextField({ id, label, labelHidden, optional, hint, error, describedBy, line = true, tone, dim, boxClassName, ...input }: FieldProps & Omit<ComponentPropsWithRef<"input">, "id">) {
  return (
    <>
      {label !== undefined && (
        <FieldLabel htmlFor={id} optional={optional} hidden={labelHidden}>
          {label}
        </FieldLabel>
      )}
      <div className={boxClass({ line, tone, dim, boxClassName })}>
        <input {...input} id={id} aria-describedby={describe(id, { hint, error, describedBy })} aria-invalid={error ? true : input["aria-invalid"]} />
      </div>
      <Below id={id} hint={hint} error={error} />
    </>
  );
}

/** A choice from a list, in the Field box (an Android build's version). */
export function Select({ id, label, labelHidden, optional, hint, error, describedBy, tone, dim, boxClassName, children, ...select }: FieldProps & Omit<ComponentPropsWithRef<"select">, "id">) {
  return (
    <>
      {label !== undefined && (
        <FieldLabel htmlFor={id} optional={optional} hidden={labelHidden}>
          {label}
        </FieldLabel>
      )}
      <div className={boxClass({ line: true, tone, dim, boxClassName })}>
        <select {...select} id={id} aria-describedby={describe(id, { hint, error, describedBy })}>
          {children}
        </select>
      </div>
      <Below id={id} hint={hint} error={error} />
    </>
  );
}

/** Letters left, from `from` letters on; at the limit a sentence instead. */
export type Count = { from: number; max: number; full: ReactNode };

/**
 * Words over more than one line (the idea, a change, a note): the Field box with a textarea that grows with its words up
 * to `grow` pixels, then scrolls. `count` shows the letters left near the limit; `action` sits in the box after the
 * words (the home page's Make my game).
 */
export function TextArea({
  id,
  label,
  labelHidden,
  optional,
  hint,
  error,
  describedBy,
  line,
  tone,
  dim,
  boxClassName,
  grow,
  count,
  action,
  value,
  ref,
  ...area
}: FieldProps & Omit<ComponentPropsWithRef<"textarea">, "id" | "value"> & { value: string; grow?: number; count?: Count; action?: ReactNode }) {
  const own = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = own.current;
    if (!el || !grow) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, grow)}px`;
  }, [value, grow]);
  const left = count && value.length >= count.from ? count.max - value.length : null;
  const countId = left !== null ? `${id}-count` : undefined;
  return (
    <>
      {label !== undefined && (
        <FieldLabel htmlFor={id} optional={optional} hidden={labelHidden}>
          {label}
        </FieldLabel>
      )}
      <div className={boxClass({ line, tone, dim, boxClassName })}>
        <textarea
          {...area}
          ref={(el) => {
            own.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) (ref as { current: HTMLTextAreaElement | null }).current = el;
          }}
          id={id}
          value={value}
          aria-describedby={describe(id, { hint, error, describedBy }, countId)}
          aria-invalid={error ? true : area["aria-invalid"]}
        />
        {action}
      </div>
      {left !== null &&
        (left <= 0 ? (
          <p id={countId} className="field-hint">
            {count!.full}
          </p>
        ) : (
          <p id={countId} className="figures field-count">
            {left.toLocaleString("en-US")} {left === 1 ? "letter" : "letters"} left
          </p>
        ))}
      <Below id={id} hint={hint} error={error} />
    </>
  );
}
