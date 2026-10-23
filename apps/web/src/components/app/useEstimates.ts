"use client";

import { useEffect, useState } from "react";
import type { Effort, Estimate, ModelChoice, PlanId } from "@typeplay/shared";
import { api } from "@/lib/api";

const MODELS: ModelChoice[] = ["fast", "smart", "best"];
// Estimates depend only on the kind, the model, the effort and the plan (its ask-first limit):
// ask once per page load.
const cache = new Map<string, Promise<Estimate | null>>();

function estimate(kind: "new" | "edit", model: ModelChoice, effort: Effort, plan: PlanId) {
  const key = `${plan}:${kind}:${model}:${effort}`;
  let p = cache.get(key);
  if (!p) {
    p = api.estimate(kind, model, effort).catch(() => {
      cache.delete(key); // try again next time
      return null;
    });
    cache.set(key, p);
  }
  return p;
}

/** What a message will probably cost on each model at this effort, for the picker and the send button. */
export function useEstimates(kind: "new" | "edit", plan: PlanId | null, effort: Effort = "medium") {
  const [found, setFound] = useState<{ key: string; byModel: Partial<Record<ModelChoice, Estimate>> }>({ key: "", byModel: {} });
  const key = plan ? `${plan}:${kind}:${effort}` : "";

  useEffect(() => {
    if (!plan) return;
    let live = true;
    let retry: ReturnType<typeof setTimeout> | null = null;
    // A failed estimate (a dropped request) is asked again after 5 s, then 15 s, so the cost
    // labels don't stay blank until the player changes something.
    const load = (attempt: number) =>
      void Promise.all(MODELS.map((m) => estimate(kind, m, effort, plan))).then((list) => {
        if (!live) return;
        const byModel: Partial<Record<ModelChoice, Estimate>> = {};
        list.forEach((e, i) => {
          if (e) byModel[MODELS[i]] = e;
        });
        setFound({ key: `${plan}:${kind}:${effort}`, byModel });
        if (list.some((e) => !e) && attempt < 2) retry = setTimeout(() => load(attempt + 1), attempt ? 15_000 : 5_000);
      });
    load(0);
    return () => {
      live = false;
      if (retry) clearTimeout(retry);
    };
  }, [kind, plan, effort]);

  // While another effort's numbers load (a moment), keep showing the last ones rather than none.
  return found.key === key || (plan && found.key.startsWith(`${plan}:${kind}:`)) ? found.byModel : {};
}
