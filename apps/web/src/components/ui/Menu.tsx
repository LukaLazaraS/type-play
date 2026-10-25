import type { ReactNode } from "react";
import { Anchor } from "./Anchor";

/** The rows of a menu (a Popover with `menu`): each a MenuItem. */
export function Menu({ children }: { children: ReactNode }) {
  return <ul className="menu__list">{children}</ul>;
}

/** Rows under a small muted label (Phones, Tablet, Computer). */
export function MenuGroup({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className="menu__group">
      <p id={id} className="menu__label">
        {label}
      </p>
      <Menu>{children}</Menu>
    </div>
  );
}

type ItemProps = {
  /** A bold 18px Phosphor icon before the words. */
  icon: ReactNode;
  label: ReactNode;
  /** A muted 13px line under the words; `figures` sets it in the figures face. */
  hint?: ReactNode;
  figures?: boolean;
  /** At the end of the row (the chosen device's tick). */
  end?: ReactNode;
  /** Only on a phone's width (Play in a new tab, where the bar has no room for its pill). */
  phoneOnly?: boolean;
} & ({ href: string; newTab?: boolean; onClick?: () => void } | { href?: undefined; onClick?: () => void; disabled?: boolean; pressed?: boolean });

/**
 * A menu row (DESIGN.md: the game's More menu): the icon, the words in 600 15px and its hint, Field under a pointer and
 * when pressed, muted when disabled; `pressed` marks the one chosen (on Field). A link with `href`.
 */
export function MenuItem(props: ItemProps) {
  const { icon, label, hint, figures, end, phoneOnly } = props;
  const content = (
    <>
      {icon}
      {hint !== undefined ? (
        <span>
          {label}
          <small className={figures ? "figures" : undefined}>{hint}</small>
        </span>
      ) : (
        label
      )}
      {end}
    </>
  );
  return (
    <li className={phoneOnly ? "menu__item--phone" : undefined}>
      {props.href !== undefined ? (
        <Anchor href={props.href} newTab={props.newTab} onClick={props.onClick}>
          {content}
        </Anchor>
      ) : (
        <button type="button" aria-pressed={props.pressed} disabled={props.disabled} onClick={props.onClick}>
          {content}
        </button>
      )}
    </li>
  );
}

/** A last question inside the menu, in place of its rows (Delete …? with Delete game and Keep it). */
export function MenuAsk({ id, question, actions }: { id: string; question: ReactNode; actions: ReactNode }) {
  return (
    <div className="menu__ask" role="group" aria-labelledby={id}>
      <p id={id}>{question}</p>
      <div className="menu__ask-actions">{actions}</div>
    </div>
  );
}
