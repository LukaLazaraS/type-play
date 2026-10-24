"use client";

import { useEffect, useRef, type ComponentType } from "react";
import { CaretDown, Check, CornersOut, DeviceMobile, DeviceTablet, Laptop, Monitor, type IconProps } from "@phosphor-icons/react";
import { usePopover } from "./usePopover";

// The game page's preview sizes (Luka, 10-24): the game runs at each device's own screen size in CSS pixels (drawn
// smaller when the stage is smaller), so a maker sees how it fits there before sending it to anyone.

export type DeviceKind = "phone" | "tablet" | "computer";
export type Device = {
  id: string;
  name: string;
  /** Under the name in the menu, before the size: the model a size stands for. */
  model?: string;
  /** Screen size in CSS pixels, held upright for phones and tablets; none: the stage as it is (Fill the window). */
  size?: { w: number; h: number };
  kind: DeviceKind;
  Icon: ComponentType<IconProps>;
};

export const DEVICES: { group: string; items: Device[] }[] = [
  {
    group: "Phones",
    items: [
      { id: "iphone", name: "iPhone", size: { w: 393, h: 852 }, kind: "phone", Icon: DeviceMobile },
      { id: "android", name: "Android", size: { w: 412, h: 915 }, kind: "phone", Icon: DeviceMobile },
      { id: "small", name: "Small phone", model: "iPhone SE", size: { w: 375, h: 667 }, kind: "phone", Icon: DeviceMobile },
    ],
  },
  { group: "Tablet", items: [{ id: "ipad", name: "iPad", size: { w: 820, h: 1180 }, kind: "tablet", Icon: DeviceTablet }] },
  {
    group: "Computer",
    items: [
      { id: "laptop", name: "Laptop", size: { w: 1366, h: 768 }, kind: "computer", Icon: Laptop },
      { id: "desktop", name: "Desktop", size: { w: 1920, h: 1080 }, kind: "computer", Icon: Monitor },
      { id: "fill", name: "Fill the window", kind: "computer", Icon: CornersOut },
    ],
  },
];
const ALL = DEVICES.flatMap((g) => g.items);
/** Fill the window: the stage as it was before the menu, and the default. */
export const FILL = ALL.find((d) => !d.size)!;

/** The stage bar's device button: the current device, and the list to pick another. */
export function DeviceMenu({ id, value, onChange }: { id: string; value: Device; onChange: (d: Device) => void }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  usePopover(trigger, panel);
  // Open, the keyboard goes to the chosen device (arrow-free: Tab moves on, Escape closes even if the game had the keys).
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") el.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true });
    };
    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, []);
  const menuId = `device-menu-${id}`;
  return (
    <>
      <button ref={trigger} type="button" className="inkpill devicepick" popoverTarget={menuId} aria-label={`Preview size: ${value.name}`} title="Preview size">
        <value.Icon size={18} weight="bold" aria-hidden="true" />
        <span className="inkpill__label">{value.name}</span>
        <CaretDown size={14} weight="bold" aria-hidden="true" className="devicepick__caret" />
      </button>
      <div ref={panel} id={menuId} popover="auto" className="pop menu devicemenu" data-width={280}>
        {DEVICES.map((g) => (
          <div key={g.group} role="group" aria-labelledby={`${menuId}-${g.group}`} className="devicemenu__group">
            <p id={`${menuId}-${g.group}`} className="devicemenu__label">
              {g.group}
            </p>
            <ul className="menu__list">
              {g.items.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    aria-pressed={d.id === value.id}
                    onClick={() => {
                      onChange(d);
                      panel.current?.hidePopover();
                    }}
                  >
                    <d.Icon size={18} weight="bold" aria-hidden="true" />
                    <span>
                      {d.name}
                      {d.size ? (
                        <small className="figures">{`${d.model ? `${d.model} · ` : ""}${d.size.w} × ${d.size.h}`}</small>
                      ) : (
                        <small>As big as fits, as before</small>
                      )}
                    </span>
                    {d.id === value.id && <Check size={18} weight="bold" aria-hidden="true" className="devicemenu__check" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
