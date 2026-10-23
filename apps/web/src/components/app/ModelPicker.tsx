"use client";

import { Crown, Lightning, LockSimple, Sparkle, type Icon } from "@phosphor-icons/react";
import type { Effort, Estimate, ModelChoice } from "@typeplay/shared";
import { efforts, models } from "@/content/app";
import { creditsWord } from "@/lib/format";

const icons: Record<ModelChoice, Icon> = { fast: Lightning, smart: Sparkle, best: Crown };

type Props = {
  kind: "new" | "edit";
  value: ModelChoice;
  onChange: (m: ModelChoice) => void;
  /** Models the plan allows (Free: only Fast); the others show locked. */
  allowed: ModelChoice[];
  estimates: Partial<Record<ModelChoice, Estimate>>;
  disabled?: boolean;
};

/** /create: the three models as rows, each with its honest line and what it usually costs. */
export function ModelRows({ kind, value, onChange, allowed, estimates, disabled }: Props) {
  return (
    <fieldset className="models" disabled={disabled}>
      <legend className="field-label">Choose the AI</legend>
      {models.map((m) => {
        const locked = !allowed.includes(m.id);
        const est = estimates[m.id];
        const Glyph = icons[m.id];
        return (
          <label key={m.id} className="model" data-on={value === m.id || undefined} data-locked={locked || undefined}>
            <input
              type="radio"
              name={`model-${kind}`}
              value={m.id}
              checked={value === m.id}
              disabled={locked}
              onChange={() => onChange(m.id)}
              className="sr-only"
            />
            <span className={`model__icon model__icon--${m.id}`} aria-hidden="true">
              <Glyph size={22} weight="fill" />
            </span>
            <span className="model__text">
              <b>{m.name}</b>
              <span>{kind === "new" ? m.newGame : m.edit}</span>
            </span>
            {locked ? (
              <span className="model__side model__side--locked">
                <LockSimple size={14} weight="bold" aria-hidden="true" />
                On paid plans
              </span>
            ) : (
              <span className="model__side figures">{est ? `about ${creditsWord(est.typical)}` : ""}</span>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}

/** The chat's composer: Fast / Smart / Best as one segmented control (arrow keys move, like radios). */
export function ModelSwitch({ kind, value, onChange, allowed, disabled }: Omit<Props, "estimates">) {
  return (
    <fieldset className="switch" disabled={disabled}>
      <legend className="sr-only">Choose the AI</legend>
      {models.map((m) => {
        const locked = !allowed.includes(m.id);
        return (
          <label
            key={m.id}
            className="switch__opt"
            data-on={value === m.id || undefined}
            data-locked={locked || undefined}
            title={locked ? `${m.name} is on paid plans` : undefined}
          >
            <input
              type="radio"
              name={`switch-${kind}`}
              value={m.id}
              checked={value === m.id}
              disabled={locked}
              onChange={() => onChange(m.id)}
              className="sr-only"
            />
            {locked && <LockSimple size={12} weight="bold" aria-hidden="true" />}
            {m.name}
            {locked && <span className="sr-only">, on paid plans</span>}
          </label>
        );
      })}
    </fieldset>
  );
}

/** Low / Medium / High: how hard the AI thinks on this message (a smaller segmented control). */
export function EffortSwitch({
  value,
  onChange,
  disabled,
  name,
}: {
  value: Effort;
  onChange: (e: Effort) => void;
  disabled?: boolean;
  /** The radio group's name: unique per form. */
  name: string;
}) {
  return (
    <fieldset className="effort" disabled={disabled}>
      <legend className="sr-only">Effort</legend>
      <span className="effort__label" aria-hidden="true">
        Effort
      </span>
      <div className="switch switch--small">
        {efforts.map((e) => (
          <label key={e.id} className="switch__opt" data-on={value === e.id || undefined}>
            <input
              type="radio"
              name={name}
              value={e.id}
              checked={value === e.id}
              onChange={() => onChange(e.id)}
              className="sr-only"
            />
            {e.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const effortLine = (effort: Effort) => efforts.find((e) => e.id === effort)!.line;

/** The honest line for the picked model, plus the plan note on Free. */
export function modelLine(kind: "new" | "edit", model: ModelChoice, allowed: ModelChoice[]) {
  const m = models.find((x) => x.id === model)!;
  const line = `${m.name}: ${kind === "new" ? m.newGame : m.edit}`;
  return allowed.length < models.length ? `${line} Smart and Best come with paid plans.` : line;
}
