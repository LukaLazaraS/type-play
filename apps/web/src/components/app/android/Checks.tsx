import { Check } from "@phosphor-icons/react";
import type { AndroidCheck } from "@typeplay/shared";

/** The checks list of a finished build: a tick, or the hot dot and one sentence on what is wrong. */
export function Checks({ checks }: { checks: AndroidCheck[] }) {
  return (
    <ul className="checks">
      {checks.map((c) => (
        <li key={c.id} className="checks__item" data-ok={c.ok || undefined}>
          {c.ok ? <Check size={16} weight="bold" aria-hidden="true" /> : <span className="checks__dot" aria-hidden="true" />}
          <span>
            {!c.ok && <span className="sr-only">Problem: </span>}
            {c.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
