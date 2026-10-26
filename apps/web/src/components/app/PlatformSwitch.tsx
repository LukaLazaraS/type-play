"use client";

import { useSyncExternalStore } from "react";
import { Devices, DeviceMobile, Laptop, MagicWand, type Icon } from "@phosphor-icons/react";
import { HintLines } from "@/components/ui/HintLines";
import { Segmented } from "@/components/ui/Segmented";
import { platforms, type PlatformChoice } from "@/content/app";

const icons: Record<PlatformChoice, Icon> = { auto: MagicWand, phone: DeviceMobile, computer: Laptop, fill: Devices };

/** A media query's answer, null until the page runs in the browser (the server can't know the device). */
export function useMedia(query: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}

/** Phones and tablets, as GameFrame decides it: no hover, a finger for a pointer. */
export const TOUCH = "(hover: none) and (pointer: coarse)";

/** /create: Best fit / Phone / Computer / Any screen as one segmented control, the picked one's line under it. All four
 * lines sit in one place, the others hidden, so the box keeps the longest line's height and nothing below moves when the
 * pick changes. Each radio is described by its own line (read as you arrow to it); the box itself is hidden from screen
 * readers, so no line is read twice. */
export function PlatformSwitch({ value, onChange, disabled }: { value: PlatformChoice; onChange: (p: PlatformChoice) => void; disabled?: boolean }) {
  return (
    <Segmented
      name="platform"
      legend="Made for"
      legendLook="label"
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="made"
      trackClassName="made__switch"
      options={platforms.map((p) => {
        const Glyph = icons[p.id];
        return { value: p.id, label: p.name, icon: <Glyph size={16} weight="bold" aria-hidden="true" />, describedBy: `made-${p.id}` };
      })}
    >
      {/* Outside the labels, so a line describes its option instead of joining its name. */}
      <HintLines lines={platforms.map((p) => ({ id: `made-${p.id}`, text: p.line }))} current={`made-${value}`} />
    </Segmented>
  );
}
