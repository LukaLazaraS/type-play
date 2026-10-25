"use client";

import { useRef, type ComponentType } from "react";
import { CaretDown, Check, CornersOut, DeviceMobile, DeviceTablet, Laptop, Monitor, type IconProps } from "@phosphor-icons/react";
import type { Platform } from "@typeplay/shared";
import { InkPill } from "@/components/ui/InkPill";
import { MenuGroup, MenuItem } from "@/components/ui/Menu";
import { Popover, type PopoverHandle } from "@/components/ui/Popover";

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
/** The device the preview opens on (Luka, 10-25): the one the game is made for; Fill the window for a game that fills
 * every screen, or one made before the choice. */
export const deviceFor = (platform: Platform | null): Device =>
  ALL.find((d) => d.id === (platform === "phone" ? "iphone" : platform === "computer" ? "laptop" : "fill")) ?? FILL;

// Open, the keyboard goes to the chosen device (arrow-free: Tab moves on, Escape closes even if the game had the keys).
const focusChosen = (panel: HTMLElement) => panel.querySelector<HTMLElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true });

/** The stage bar's device button: the current device, and the list to pick another. */
export function DeviceMenu({ id, value, onChange }: { id: string; value: Device; onChange: (d: Device) => void }) {
  const menu = useRef<PopoverHandle>(null);
  const menuId = `device-menu-${id}`;
  return (
    <Popover
      id={menuId}
      ref={menu}
      menu
      width={280}
      className="devicemenu"
      onOpen={focusChosen}
      trigger={(t) => (
        <InkPill
          {...t}
          className="devicepick"
          aria-label={`Preview size: ${value.name}`}
          title="Preview size"
          icon={<value.Icon size={18} weight="bold" aria-hidden="true" />}
          label={value.name}
        >
          <CaretDown size={14} weight="bold" aria-hidden="true" className="devicepick__caret" />
        </InkPill>
      )}
    >
      {DEVICES.map((g) => (
        <MenuGroup key={g.group} id={`${menuId}-${g.group}`} label={g.group}>
          {g.items.map((d) => (
            <MenuItem
              key={d.id}
              icon={<d.Icon size={18} weight="bold" aria-hidden="true" />}
              label={d.name}
              hint={d.size ? `${d.model ? `${d.model} · ` : ""}${d.size.w} × ${d.size.h}` : "As big as fits here"}
              figures={!!d.size}
              pressed={d.id === value.id}
              end={d.id === value.id && <Check size={18} weight="bold" aria-hidden="true" className="devicemenu__check" />}
              onClick={() => {
                onChange(d);
                menu.current?.close();
              }}
            />
          ))}
        </MenuGroup>
      ))}
    </Popover>
  );
}
