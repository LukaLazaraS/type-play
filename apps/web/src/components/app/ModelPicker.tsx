"use client";

import { LockSimple } from "@phosphor-icons/react";
import type { Effort, Estimate, ModelChoice } from "@typeplay/shared";
import { ChoiceRows } from "@/components/ui/ChoiceRows";
import { ModelTile } from "@/components/ui/ModelTile";
import { Segmented } from "@/components/ui/Segmented";
import { efforts, models } from "@/content/app";
import { creditsWord } from "@/lib/format";

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
    <ChoiceRows
      name={`model-${kind}`}
      legend="Choose the AI"
      legendLook="label"
      value={value}
      onChange={onChange}
      disabled={disabled}
      choices={models.map((m) => {
        const locked = !allowed.includes(m.id);
        const est = estimates[m.id];
        return {
          value: m.id,
          title: m.name,
          text: kind === "new" ? m.newGame : m.edit,
          tile: <ModelTile model={m.id} />,
          locked,
          side: locked ? (
            <>
              <LockSimple size={14} weight="bold" aria-hidden="true" />
              On paid plans
            </>
          ) : est ? (
            `about ${creditsWord(est.typical)}`
          ) : (
            ""
          ),
        };
      })}
    />
  );
}

/** The chat's composer: Fast / Smart / Best as one segmented control (arrow keys move, like radios). */
export function ModelSwitch({ kind, value, onChange, allowed, disabled }: Omit<Props, "estimates">) {
  return (
    <Segmented
      name={`switch-${kind}`}
      legend="Choose the AI"
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={models.map((m) => {
        const locked = !allowed.includes(m.id);
        return {
          value: m.id,
          label: m.name,
          locked,
          icon: locked ? <LockSimple size={12} weight="bold" aria-hidden="true" /> : undefined,
          title: locked ? `${m.name} is on paid plans` : undefined,
          note: locked ? ", on paid plans" : undefined,
        };
      })}
    />
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
    <Segmented
      name={name}
      legend="Effort"
      value={value}
      onChange={onChange}
      disabled={disabled}
      size="small"
      className="effort"
      before={
        <span className="effort__label" aria-hidden="true">
          Effort
        </span>
      }
      options={efforts.map((e) => ({ value: e.id, label: e.name }))}
    />
  );
}

export const effortLine = (effort: Effort) => efforts.find((e) => e.id === effort)!.line;

/** The honest line for the picked model, plus the plan note on Free. */
export function modelLine(kind: "new" | "edit", model: ModelChoice, allowed: ModelChoice[]) {
  const m = models.find((x) => x.id === model)!;
  const line = `${m.name}: ${kind === "new" ? m.newGame : m.edit}`;
  return allowed.length < models.length ? `${line} Smart and Best come with paid plans.` : line;
}
