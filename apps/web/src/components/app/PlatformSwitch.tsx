"use client";

import { useSyncExternalStore } from "react";
import { Devices, DeviceMobile, Laptop, type Icon } from "@phosphor-icons/react";
import type { Platform } from "@typeplay/shared";
import { platforms } from "@/content/app";

const icons: Record<Platform, Icon> = { phone: DeviceMobile, computer: Laptop, fill: Devices };

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

/** The shape for the device a game is made on (Luka, 10-25): Phone on a phone or tablet, Computer otherwise. */
export function useDevicePlatform(): Platform | null {
  const touch = useMedia(TOUCH);
  return touch === null ? null : touch ? "phone" : "computer";
}

/** /create: Phone / Computer / Any screen as one segmented control, the picked one's line under it. Each option carries
 * its own line for screen readers (read as you arrow to it); the visible one follows the pick. */
export function PlatformSwitch({ value, onChange, disabled }: { value: Platform | null; onChange: (p: Platform) => void; disabled?: boolean }) {
  const line = platforms.find((p) => p.id === value)?.line;
  return (
    <fieldset className="made" disabled={disabled}>
      <legend className="field-label">Made for</legend>
      <div className="switch made__switch">
        {platforms.map((p) => {
          const Glyph = icons[p.id];
          return (
            <label key={p.id} className="switch__opt" data-on={value === p.id || undefined}>
              <input
                type="radio"
                name="platform"
                value={p.id}
                checked={value === p.id}
                onChange={() => onChange(p.id)}
                aria-describedby={`made-${p.id}`}
                className="sr-only"
              />
              <Glyph size={16} weight="bold" aria-hidden="true" />
              {p.name}
            </label>
          );
        })}
      </div>
      {/* Outside the labels, so a line describes its option instead of joining its name. */}
      {platforms.map((p) => (
        <span key={p.id} id={`made-${p.id}`} className="sr-only">
          {p.line}
        </span>
      ))}
      <p className="field-hint" aria-hidden="true">
        {line ?? " "}
      </p>
    </fieldset>
  );
}
