// Anthropic list prices per million tokens (CLAUDE.md "Numbers that drive the design", 2026-10-06;
// cache writes are 1.25× input, cache reads as listed there). The key proxy meters each run's model
// calls with these from the usage figures in the model's own responses (src/runs/key-proxy.ts).
import type { ModelFamily } from "../runs/key-proxy.js";

export interface TokenUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const NO_USAGE: TokenUsage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

type Price = TokenUsage; // dollars per million tokens of each kind

const PRICES: Record<ModelFamily, Price> = {
  opus: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  sonnet: { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  haiku: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};

/** Haiku 5.5 costs 5× when one request carries more than this many input tokens. */
const HAIKU_LONG_INPUT = 100_000;

/** What one model call cost, in dollars. */
export function usageCostUsd(family: ModelFamily, u: TokenUsage): number {
  let p = PRICES[family];
  if (family === "haiku" && u.input + u.cacheWrite + u.cacheRead > HAIKU_LONG_INPUT) {
    p = { input: p.input * 5, output: p.output * 5, cacheWrite: p.cacheWrite * 5, cacheRead: p.cacheRead * 5 };
  }
  return (u.input * p.input + u.output * p.output + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead) / 1e6;
}

export const addUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  cacheRead: a.cacheRead + b.cacheRead,
});
