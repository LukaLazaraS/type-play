"use client";

import { useSyncExternalStore, type ComponentPropsWithRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { cx } from "./cx";
import { IconButton } from "./IconButton";

/**
 * A toast (DESIGN.md "Toast"): the ink pill at the foot of the page that says what happened away from the page the
 * player is on (the build pill, 2026-10-26; a build that ended, 2026-10-29). Its words and one action are `children`;
 * `onClose` adds the round close button at its end. It never takes the focus and never goes by itself: the player
 * closes it. Live-region duty belongs to whoever says it (a `role` on the toast, or an announcer of its own).
 */
export function Toast({ onClose, closeLabel = "Close", className, children, ...rest }: Omit<ComponentPropsWithRef<"div">, "className"> & { onClose?: () => void; closeLabel?: string; className?: string }) {
  return (
    <div {...rest} className={cx("toast", className)}>
      {children}
      {onClose && (
        <IconButton label={closeLabel} className="toast__close" onClick={onClose}>
          <X size={16} weight="bold" aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );
}

const noop = () => () => {};

/**
 * Where toasts sit: the bottom of the page, centred, above the safe area, the newest nearest the edge. Put on the page
 * itself (a portal), not inside whatever mounts it (the status bar's phone layout hides its links); nothing on the
 * server, where there is no page yet.
 */
export function Toasts({ children }: { children: ReactNode }) {
  const client = useSyncExternalStore(noop, () => true, () => false);
  return client ? createPortal(<div className="toasts">{children}</div>, document.body) : null;
}
