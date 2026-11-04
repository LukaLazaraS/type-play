"use client";

import type { Person } from "@typeplay/shared";
import { Avatar } from "./Avatar";
import { cx } from "./cx";

/**
 * Someone in a game (pair developing, 2026-11-04): their Google picture in an ink circle, or their first letter in white
 * on ink, with a paper edge so faces side by side stay apart. Decorative: the words beside it, or its button's label, say
 * who it is. `small` 20px (the chat's name line), 26px (the people button), `row` 36px (the People panel's rows).
 * `waiting`: someone invited who hasn't answered yet (Field with muted ink: not in the game yet).
 */
export function Face({ person, size, waiting, className }: { person: Pick<Person, "name" | "avatarUrl">; size?: "small" | "row"; waiting?: boolean; className?: string }) {
  return (
    <span className={cx("face", size && `face--${size}`, waiting && "face--waiting", className)} aria-hidden="true">
      <Avatar src={person.avatarUrl} name={person.name} />
    </span>
  );
}

/** The people in a game as overlapping faces: up to `max`, then "+n" for the rest. Decorative, as Face. */
export function Faces({ people, max = 3, className }: { people: Pick<Person, "id" | "name" | "avatarUrl">[]; max?: number; className?: string }) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <span className={cx("faces", className)} aria-hidden="true">
      {shown.map((p) => (
        <Face key={p.id} person={p} />
      ))}
      {more > 0 && <span className="faces__more">+{more}</span>}
    </span>
  );
}
