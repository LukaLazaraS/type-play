// Paddle's catalog for one environment (docs/payments-design.md §5): the five products (Medium, High,
// Ultra, Ultra+, Credit pack) and their USD prices, exactly as credits.ts sells them, each price with
// custom_data { plan, credits } / { pack: true, credits }. Idempotent: lists first, creates what is
// missing, never changes or archives anything (an old price that no longer matches is reported).
// Prints the five PADDLE_PRICE_* lines for the root .env. Needs PADDLE_API_KEY (of that environment).
//   npm run paddle:catalog -w @typeplay/server -- --env sandbox|live [--tax-category saas|standard]
import { PADDLE_API_URL, PaddleClient, PaddleError } from "../src/billing/paddle.client.js";
import { expectedPrice, PAID_PLANS, priceProblems, type PaidPlan } from "../src/billing/paddle.service.js";
import type { PaddlePrice, PaddleProduct } from "../src/billing/paddle.types.js";
import { PLAN_NAME } from "../src/credits/credits.js";
import { config, paddleKeyEnv } from "../src/env.js";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const envName = flag("--env");
const taxCategory = flag("--tax-category") ?? "saas";
if (envName !== "sandbox" && envName !== "live") {
  console.error("usage: paddle-catalog --env sandbox|live [--tax-category saas|standard]");
  process.exit(2);
}
if (taxCategory !== "saas" && taxCategory !== "standard") {
  console.error("--tax-category is saas or standard");
  process.exit(2);
}
const key = config.paddle.apiKey;
if (!key) {
  console.error("PADDLE_API_KEY is not in the root .env (Paddle > My account > Settings > Authentication).");
  process.exit(2);
}
if (paddleKeyEnv(key) !== envName) {
  console.error(`PADDLE_API_KEY is a ${paddleKeyEnv(key) ?? "non-Paddle"} key, but --env says ${envName}.`);
  process.exit(2);
}
const client = new PaddleClient(config.paddle.apiUrl || PADDLE_API_URL[envName], key);

type Item = PaidPlan | "pack";
const ITEMS: Item[] = [...PAID_PLANS, "pack"];
const PRODUCT: Record<Item, { name: string; description: string }> = {
  medium: { name: "Medium", description: "TypePlay Medium plan: 100 credits a month for the AI game-building service (Fast, Smart and Best models, exports, version history)." },
  high: { name: "High", description: "TypePlay High plan: 275 credits a month for the AI game-building service, two builds at once." },
  ultra: { name: "Ultra", description: "TypePlay Ultra plan: 600 credits a month for the AI game-building service, new genres first." },
  ultraplus: { name: "Ultra+", description: "TypePlay Ultra+ plan: 1,300 credits a month for the AI game-building service, priority help by email." },
  pack: { name: "Credit pack", description: "40 extra credits for the TypePlay AI game-building service, good for 12 months (paid plans only)." },
};

async function product(item: Item, products: PaddleProduct[]): Promise<PaddleProduct> {
  const found = products.find((p) => p.custom_data?.typeplay === item) ?? products.find((p) => p.name === PRODUCT[item].name);
  if (found) {
    console.log(`  product ${PRODUCT[item].name}: ${found.id} (exists, tax category ${found.tax_category})`);
    return found;
  }
  const made = await client.post<PaddleProduct>("/products", { name: PRODUCT[item].name, description: PRODUCT[item].description, tax_category: taxCategory, custom_data: { typeplay: item } });
  console.log(`  product ${PRODUCT[item].name}: ${made.id} (created, tax category ${taxCategory})`);
  return made;
}

async function price(item: Item, productId: string): Promise<PaddlePrice> {
  const want = expectedPrice(item);
  const prices = await client.listAll<PaddlePrice>("/prices", { product_id: productId, status: "active" });
  const matching = prices.filter((p) => !priceProblems(item, p).length);
  if (matching.length) {
    if (matching.length > 1) console.log(`  ! ${matching.length} prices match for ${PRODUCT[item].name}: using ${matching[0].id}; archive the others in Paddle > Catalog`);
    console.log(`  price ${PRODUCT[item].name}: ${matching[0].id} (exists)`);
    return matching[0];
  }
  for (const p of prices) console.log(`  ! old price ${p.id} for ${PRODUCT[item].name} does not match (${priceProblems(item, p).join("; ")}): archive it in Paddle > Catalog`);
  const name = item === "pack" ? "Credit pack (40 credits)" : `${PLAN_NAME[item]} plan, monthly`;
  const made = await client.post<PaddlePrice>("/prices", {
    description: name,
    name,
    product_id: productId,
    unit_price: { amount: want.amount, currency_code: "USD" },
    billing_cycle: want.cycle,
    tax_mode: "external",
    quantity: { minimum: 1, maximum: item === "pack" ? 10 : 1 },
    custom_data: want.custom_data,
  });
  console.log(`  price ${PRODUCT[item].name}: ${made.id} (created: $${(Number(want.amount) / 100).toFixed(2)} ${want.cycle ? "a month" : "once"})`);
  return made;
}

async function main() {
  console.log(`Paddle ${envName} catalog (${client.baseUrl}), tax category ${taxCategory}`);
  const products = await client.listAll<PaddleProduct>("/products", { status: "active" });
  const ids: Record<string, string> = {};
  for (const item of ITEMS) {
    const p = await product(item, products);
    ids[item] = (await price(item, p.id)).id;
  }
  console.log("\nPut these in the root .env (and api.env goes with the next deploy):");
  for (const item of ITEMS) console.log(`PADDLE_PRICE_${item.toUpperCase()}=${ids[item]}`);
  console.log(`\nThen check Paddle > Catalog shows tax category "${taxCategory}" on each product; if the dashboard says it needs approval, run again with --tax-category standard (docs/payments-design.md §14(d)).`);
}

main().catch((e) => {
  console.error(e instanceof PaddleError ? `${e.message}${e.status === 403 ? " (the key lacks a permission: product.write, price.write, product.read, price.read)" : ""}` : (e as Error).message);
  process.exit(1);
});
