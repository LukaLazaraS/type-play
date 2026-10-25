"use client";

import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref, type RefObject } from "react";
import { cx } from "./cx";

/**
 * Pins a `popover="auto"` panel under its trigger, right edges lined up, and keeps it on the screen (a narrow phone pushes
 * it right, 12px from the edge). CSS reads --pop-top, --pop-right, --pop-width and --pop-origin (`.pop`); the panel's own
 * width is its `data-width` (px). `onOpen` runs once it is open (to move the keyboard into it), `onClose` when it closes,
 * however that happens.
 */
function usePlacement(
  trigger: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
  { place, onOpen, onClose }: { place: boolean; onOpen?: (panel: HTMLElement) => void; onClose?: () => void },
) {
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const position = () => {
      const t = trigger.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const width = Math.min(Number(el.dataset.width) || 340, vw - 24);
      const right = Math.min(Math.max(12, vw - r.right), vw - 12 - width);
      el.style.setProperty("--pop-top", `${Math.round(r.bottom + 8)}px`);
      el.style.setProperty("--pop-right", `${Math.round(right)}px`);
      el.style.setProperty("--pop-width", `${Math.round(width)}px`);
      // It grows out of its button, wherever the button sits along its top edge.
      const left = vw - right - width;
      el.style.setProperty("--pop-origin", `${Math.round(Math.min(width, Math.max(0, r.left + r.width / 2 - left)))}px 0`);
    };
    const before = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") {
        if (place) {
          position();
          window.addEventListener("resize", position);
        }
      } else {
        window.removeEventListener("resize", position);
        onClose?.();
      }
    };
    const after = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") onOpen?.(el);
    };
    el.addEventListener("beforetoggle", before);
    el.addEventListener("toggle", after);
    return () => {
      el.removeEventListener("beforetoggle", before);
      el.removeEventListener("toggle", after);
      window.removeEventListener("resize", position);
    };
  }, [trigger, panel, place, onOpen, onClose]);
}

/** Close it; its trigger, for the keyboard to go back to after something it opened (a dialog) closes. */
export type PopoverHandle = { close: () => void; readonly trigger: HTMLButtonElement | null };
/** What the trigger needs: its ref (for the placement) and the panel it opens. Spread onto a ui button. */
export type PopoverTrigger = { ref: RefObject<HTMLButtonElement | null>; popoverTarget: string };

/**
 * A panel that opens from a button (DESIGN.md: Share, More, the device list, the account menu): paper at 24px radius in
 * the top layer, so no clipped panel cuts it off; it grows out of its button (opacity and scale 0.97, 160 ms in, 120 ms
 * out; reduced motion keeps only the fade), scrolls when taller than the screen, and the browser closes it on Escape or a
 * tap outside. Under its trigger; `bar`: pinned under the status bar at the right (the account menu), which also dims the
 * page behind it on a phone. `menu`: rows instead of a panel's content (8px around them).
 */
export function Popover({
  id,
  ref,
  width,
  menu,
  bar,
  className,
  onOpen,
  onClose,
  trigger,
  children,
}: {
  id: string;
  ref?: Ref<PopoverHandle>;
  /** Its width in px (340 if not given), never wider than the screen less 24px. */
  width?: number;
  menu?: boolean;
  bar?: boolean;
  className?: string;
  onOpen?: (panel: HTMLElement) => void;
  onClose?: () => void;
  trigger: (props: PopoverTrigger) => ReactNode;
  children: ReactNode;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  usePlacement(button, panel, { place: !bar, onOpen, onClose });
  useImperativeHandle(
    ref,
    () => ({
      close: () => panel.current?.hidePopover(),
      get trigger() {
        return button.current;
      },
    }),
    [],
  );
  return (
    <>
      {trigger({ ref: button, popoverTarget: id })}
      <div ref={panel} id={id} popover="auto" className={cx("pop", menu && "pop--menu", bar && "pop--bar", className)} data-width={width}>
        {children}
      </div>
    </>
  );
}
