"use client";

import { useImperativeHandle, useRef, useSyncExternalStore, type ComponentPropsWithRef, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";

/** What an opener does with the dialog: open it, saying which control the keyboard goes back to when it closes (when that
 * control won't be there to get it back by itself: an entry in a menu that has closed meanwhile); close it. */
export type DialogHandle = { open: (returnTo?: HTMLElement | null) => void; close: () => void };

const noop = () => () => {};

/**
 * A modal dialog (DESIGN.md: the report dialog): paper at the popovers' 24px radius, arriving and leaving as they do
 * (opacity and scale 0.97, 160 ms in, 120 ms out; reduced motion keeps only the fade) over ink at 60%. The browser keeps
 * the keyboard in it while open; Escape, a tap beside it or the caller's own button close it. Put straight in <body>, so
 * no page's styles reach it. `wide`: 480px instead of 440px.
 */
export function Dialog({ ref, labelledBy, wide, className, children }: { ref?: Ref<DialogHandle>; labelledBy: string; wide?: boolean; className?: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  // In the browser only: there is no <body> to put it in while the server renders.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  useImperativeHandle(
    ref,
    () => ({
      open: (from) => {
        returnTo.current = from ?? null;
        dialog.current?.showModal();
      },
      close: () => dialog.current?.close(),
    }),
    [],
  );
  if (!mounted) return null;
  return createPortal(
    <dialog
      ref={dialog}
      className={cx("dialog", wide && "dialog--wide", className)}
      aria-labelledby={labelledBy}
      // A tap on the backdrop (the dialog element itself, outside its box) closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) dialog.current?.close();
      }}
      onClose={() => {
        if (returnTo.current?.isConnected) returnTo.current.focus();
        returnTo.current = null;
      }}
    >
      {children}
    </dialog>,
    document.body,
  );
}

/** The dialog's content: its parts 14px apart, 22px in from the edge. A form when it sends something. */
export function DialogBody({ className, ...rest }: ComponentPropsWithRef<"div">) {
  return <div {...rest} className={cx("dialog__body", className)} />;
}
export function DialogForm({ className, ...rest }: ComponentPropsWithRef<"form">) {
  return <form {...rest} className={cx("dialog__body", className)} />;
}
/** Its title, Onest 700 19px, by id for the dialog's name. */
export function DialogTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="dialog__title">
      {children}
    </h2>
  );
}
/** A muted 15px line. */
export function DialogText({ children }: { children: ReactNode }) {
  return <p className="dialog__text">{children}</p>;
}
/** Its buttons, one row that wraps. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="dialog__actions">{children}</div>;
}
