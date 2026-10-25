"use client";

import type { ReactNode } from "react";

/**
 * The tick box (DESIGN.md: the checkout's tick box): a Field panel, the 22px box in light colours on paper (the page's
 * colour scheme is the sky's), its sentence in 600 15px, and a muted 13px note under it when there is one.
 */
export function Checkbox({
  checked,
  onChange,
  disabled,
  required,
  note,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} disabled={disabled} required={required} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {children}
        {note !== undefined && <span className="checkbox__note">{note}</span>}
      </span>
    </label>
  );
}
