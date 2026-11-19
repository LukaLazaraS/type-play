// The pricing page's numbers against the API's (part of `npm run check`): the credits table and the plan cards
// (apps/web/src/content/site.ts `estimates`, `plans`, `credits`) must say what the app charges and shows next to Send
// (apps/server/src/credits/credits.ts: `estimate()` from its TABLE, the plans' credits and prices, Free's limits, the
// pack). The web can't read the API's numbers at build time (two deployables; @typeplay/shared is types only), so the
// page keeps its own copy and this check fails the moment the two differ. No server, no browser:
//   node --experimental-strip-types apps/web/scripts/numbers-check.mjs
// apps/web/turbo.json lists credits.ts among the web check's inputs, so a change there alone reruns this check.
import {
  CREDIT_USD,
  estimate,
  FREE_DAILY_CREDITS,
  FREE_MONTHLY_CREDITS,
  MODELS,
  PACK_CREDITS,
  PACK_MONTHS,
  PACK_PRICE_CENTS,
  PLAN_CREDITS,
  PLAN_PRICE_CENTS,
  PLANS,
} from "../../server/src/credits/credits.ts";
import { about, credits, creditRows, estimates, plans } from "../src/content/site.ts";

let failures = 0;
const ok = (cond, what, got) => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}${cond ? "" : `: ${got}`}`);
  if (!cond) failures++;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The credits table: per kind and AI, the "usually" and the range the app shows at the usual (medium) effort.
for (const kind of ["edit", "new"]) {
  for (const model of MODELS) {
    const api = estimate(kind, model, "medium", "medium");
    const page = estimates[kind]?.[model];
    ok(same(page, [api.typical, api.low, api.high]), `${kind} on ${model}: page ${JSON.stringify(page)} = the app's estimate`, `the app says [${api.typical}, ${api.low}, ${api.high}]`);
  }
}

// The table's rows (site.ts `creditRows`, components/CreditsTable.tsx): a change and a simple new game at the estimate's
// "usually" (what the plan cards count games by), a big new game at the top of its range ("up to").
const cell = {
  change: (m) => estimate("edit", m, "medium", "medium").typical,
  simple: (m) => estimate("new", m, "medium", "medium").typical,
  big: (m) => estimate("new", m, "medium", "medium").high,
};
ok(same(creditRows.map((r) => r.id), Object.keys(cell)), "the table's rows: a change, a simple new game, a big new game", creditRows.map((r) => r.id).join(", "));
for (const row of creditRows) {
  const page = MODELS.map((m) => row.cost(m));
  const api = MODELS.map((m) => cell[row.id]?.(m));
  ok(same(page, api), `the table's "${row.name}": ${page.join(" / ")} credits on Fast / Smart / Best`, `the app's estimate says ${api.join(" / ")}`);
}
ok(creditRows.every((r) => r.upTo === (r.id === "big")), 'only the big new game says "up to"', creditRows.map((r) => `${r.id}:${r.upTo}`).join(", "));

// The plans: the same ids, credits and prices (site.ts writes Ultra+ as "ultra-plus", the API "ultraplus").
const apiId = (id) => (id === "ultra-plus" ? "ultraplus" : id);
ok(same(plans.map((p) => apiId(p.id)), PLANS), "the same plans, in the same order", plans.map((p) => p.id).join(", "));
for (const p of plans) {
  const id = apiId(p.id);
  ok(p.credits === PLAN_CREDITS[id], `${p.name}: ${p.credits} credits a month`, `the API grants ${PLAN_CREDITS[id]}`);
  ok(p.price * 100 === PLAN_PRICE_CENTS[id], `${p.name}: $${p.price} a month`, `the API charges ${PLAN_PRICE_CENTS[id]} cents`);
}

// Free's limits, the pack and the credit's worth.
ok(credits.freePerMonth === FREE_MONTHLY_CREDITS, `Free: ${credits.freePerMonth} credits a month`, `the API: ${FREE_MONTHLY_CREDITS}`);
ok(credits.freePerDay === FREE_DAILY_CREDITS, `Free: at most ${credits.freePerDay} a day`, `the API: ${FREE_DAILY_CREDITS}`);
ok(credits.pack.credits === PACK_CREDITS && credits.pack.price * 100 === PACK_PRICE_CENTS && credits.pack.months === PACK_MONTHS, `the pack: $${credits.pack.price} for ${credits.pack.credits} credits, ${credits.pack.months} months`, `the API: ${PACK_PRICE_CENTS} cents, ${PACK_CREDITS} credits, ${PACK_MONTHS} months`);
ok(credits.aiCostPerCredit === CREDIT_USD, `1 credit = $${credits.aiCostPerCredit} of AI`, `the API: $${CREDIT_USD}`);

// "About N" never promises more than the credits buy (docs/pricing.md "What a plan buys").
ok(about(100, 15) === 6 && about(100, 0.4) === 250 && about(1300, 15) === 85 && about(1300, 45) === 28 && about(20, 4.5) === 4, "about(): rounded down, from 50 on to a multiple of 5", [about(100, 15), about(100, 0.4), about(1300, 15), about(1300, 45), about(20, 4.5)].join(", "));

if (failures) {
  console.log(`\n${failures} failed. The API's numbers (apps/server/src/credits/credits.ts) are what users are charged: change`);
  console.log("apps/web/src/content/site.ts to match them (and docs/pricing.md), never the other way round without that decision.");
  process.exit(1);
}
console.log("\nThe pricing page's numbers match the API's.");
