"use client";

/**
 * The on/off switch (Share: the link, the gallery), one component so every switch looks and works the same (Luka, 10-25:
 * the knob sat off-centre in one). Its name and the sentence saying its state are text beside it, by id. `busy`: the
 * change is being saved; the switch keeps the keyboard and ignores taps (a disabled button would drop the focus).
 * `disabled`: it can't be changed here at all.
 */
export function Toggle({
  on,
  onChange,
  labelledBy,
  describedBy,
  busy,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  labelledBy: string;
  describedBy?: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="toggle"
      aria-checked={on}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={() => !busy && onChange(!on)}
    >
      <span className="toggle__thumb" aria-hidden="true" />
    </button>
  );
}
