// Payments part 2 end to end (docs/payments-design.md §12): the Paddle webhook, the inbox and its
// handlers, the billing services and the admin's Paddle commands, against an API of our own on :3014
// (DEV_AUTH=1 AGENT_FAKE=1, billing in sandbox mode pointed at test/paddle-stub.mjs) and the tests' database
// (typeplay_test, emptied first: test/test-db.mjs).
//   npm run build -w @typeplay/server && npm run test:billing -w @typeplay/server
// Makes its own users (dev:bill-<time>-*@test.local), events (evt_bill<time>_*) and payments, and removes them.
import { spawn, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import pg from "pg";
import { PRICE_IDS, startStub } from "./paddle-stub.mjs";
import { useTestDatabase } from "./test-db.mjs";

const here = resolve(import.meta.dirname, "..");
const root = resolve(here, "../..");
await useTestDatabase();

const PORT = 3014;
const API = `http://127.0.0.1:${PORT}`;
const SECRET = "pdl_ntfset_test_secret_current_0000000000000000";
const PREVIOUS = "pdl_ntfset_test_secret_previous_000000000000000";
const stub = await startStub();
// The in-process services (checkout, plan change, refund lookups) read the same settings as the API we spawn.
const paddleEnv = {
  PADDLE_ENV: "sandbox",
  PADDLE_API_KEY: "pdl_sdbx_apikey_test00000000000000000000000_test0000000000000000000_000",
  PADDLE_API_URL: stub.url,
  PADDLE_WEBHOOK_SECRET: SECRET,
  PADDLE_WEBHOOK_SECRET_PREVIOUS: PREVIOUS,
  PADDLE_PRICE_MEDIUM: PRICE_IDS.medium,
  PADDLE_PRICE_HIGH: PRICE_IDS.high,
  PADDLE_PRICE_ULTRA: PRICE_IDS.ultra,
  PADDLE_PRICE_ULTRAPLUS: PRICE_IDS.ultraplus,
  PADDLE_PRICE_PACK: PRICE_IDS.pack,
  BILLING_JOBS: "0",
  DEV_AUTH: "1",
  AGENT_FAKE: "1",
};
Object.assign(process.env, paddleEnv);
const { signBody } = await import("../dist/billing/paddle.signature.js");
const { createPrisma } = await import("../dist/prisma.js");
const { LedgerService } = await import("../dist/credits/ledger.service.js");
const { PaddleService } = await import("../dist/billing/paddle.service.js");
const { BillingHandlers } = await import("../dist/billing/handlers.js");
const { BillingService, parseItem } = await import("../dist/billing/billing.service.js");

const stamp = Date.now().toString(36);
const startedAt = new Date();
const token = (letter) => `dev:bill-${stamp}-${letter}@test.local`;
const emailOf = (t) => t.slice(4);
const devId = (t) => `dev-${emailOf(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
let failures = 0;
let eventN = 0;
const projects = [];

function ok(cond, what) {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const monthLater = (d) => {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + 1);
  return x;
};
const daysBetween = (a, b) => Math.abs(new Date(a) - new Date(b)) / 86_400_000;

async function api(tok, method, path, body) {
  const send = () =>
    fetch(API + path, {
      method,
      headers: { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  const res = await send().catch((e) => (e?.cause?.code === "ECONNRESET" ? send() : Promise.reject(e)));
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** A webhook as Paddle sends it: the envelope, signed over the exact bytes. */
async function hook(envelope, { secret = SECRET, ts, header, raw, contentType = "application/json", base = API } = {}) {
  const body = raw ?? JSON.stringify(envelope);
  const signature = header === null ? undefined : (header ?? signBody(body, secret, ts ?? Math.floor(Date.now() / 1000)));
  const res = await fetch(`${base}/webhooks/paddle`, { method: "POST", headers: { "content-type": contentType, ...(signature ? { "paddle-signature": signature } : {}) }, body });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
function ev(type, data, { at = new Date(), id, notification } = {}) {
  eventN++;
  return { event_id: id ?? `evt_bill${stamp}_${eventN}`, event_type: type, occurred_at: new Date(at).toISOString(), notification_id: notification ?? `ntf_bill${stamp}_${eventN}`, data };
}
/** Sends an event and waits until the inbox has dealt with it; returns the stored row. */
async function deliver(envelope, opts) {
  const r = await hook(envelope, opts);
  if (r.status !== 200) throw new Error(`webhook ${envelope.event_type} ${envelope.event_id}: ${r.status} ${JSON.stringify(r.body)}`);
  return settled(envelope.event_id);
}
async function settled(id, ms = 20_000) {
  for (let i = 0; i < ms / 200; i++) {
    const row = (await db.query(`SELECT * FROM "PaddleEvent" WHERE id = $1`, [id])).rows[0];
    if (row && row.status !== "received") return row;
    await sleep(200);
  }
  throw new Error(`event ${id} still not processed after ${ms} ms`);
}
const eventRow = async (id) => (await db.query(`SELECT * FROM "PaddleEvent" WHERE id = $1`, [id])).rows[0];
const userRow = async (tok) => (await db.query(`SELECT * FROM "User" WHERE id = $1`, [devId(tok)])).rows[0];
const buckets = async (tok, where = "") => (await db.query(`SELECT * FROM "CreditBucket" WHERE "userId" = $1 ${where} ORDER BY "startsAt"`, [devId(tok)])).rows;
const history = async (tok, limit = 20) => (await api(tok, "GET", `/me/usage?limit=${limit}`)).body.entries;
const credits = async (tok) => (await api(tok, "GET", "/me")).body.credits.available;

/** The admin CLI, spawned (not spawnSync: the Paddle stub lives in this process and must keep answering it). */
const admin = (...args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: here, env: { ...process.env, ADMIN_NAME: "billtest" }, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
const auditOk = async (email) => {
  const r = await admin("audit", ...(email ? [email] : []));
  if (r.status !== 0) console.log(r.stdout, r.stderr);
  return r.status === 0 && /^ok:/m.test(r.stdout);
};

/** A fake run on the API, waited for (the SSE stream, as the site reads it). */
async function build(tok, prompt) {
  const made = await api(tok, "POST", "/projects", { prompt, model: "fast" });
  if (made.status !== 201) return made;
  projects.push(made.body.id);
  await waitIdle(tok, made.body.id);
  return made;
}
async function waitIdle(tok, id) {
  for (let i = 0; i < 100; i++) {
    const r = await api(tok, "GET", `/projects/${id}`);
    if (r.body?.status === "idle") return r.body;
    await sleep(300);
  }
  throw new Error(`project ${id} still running`);
}

// Prisma writes UTC into timestamp(3) columns; pg would read them as local time: read them as UTC.
pg.types.setTypeParser(1114, (s) => new Date(s.replace(" ", "T") + "Z"));
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

async function spawnApi(port, extraEnv = {}) {
  // Another test's API on this port (the Android e2e uses :3015, the e2e :3013) would answer our health polls as if ours had started.
  if (await fetch(`http://127.0.0.1:${port}/health`).then(() => true).catch(() => false)) throw new Error(`port ${port} is busy: something else answers /health there; pick another port`);
  const child = spawn(process.execPath, ["dist/main.js"], { cwd: here, env: { ...process.env, ...paddleEnv, PORT: String(port), ...extraEnv }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  for (let i = 0; i < 90; i++) {
    await sleep(500);
    if (child.exitCode !== null) return { exited: child.exitCode, output: () => output, kill: () => {} };
    const h = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json()).catch(() => null);
    if (h?.agent === "fake") return { url: `http://127.0.0.1:${port}`, health: h, kill: () => child.kill(), output: () => output, exited: null };
  }
  child.kill();
  throw new Error(`the test API on :${port} did not start: ${output.slice(-800)}`);
}

// The services in this process (as part 3's controller and the admin CLI build them), for what has no endpoint yet.
const prisma = createPrisma();
const ledger = new LedgerService(prisma);
const paddle = new PaddleService();
const handlers = new BillingHandlers(prisma, ledger, paddle);
const billing = new BillingService(prisma, ledger, paddle, handlers);
const consent = () => ({ version: "v1", at: new Date(), termsAcceptedAt: new Date() });
const fresh = (tok) => prisma.user.findUniqueOrThrow({ where: { id: devId(tok) } });
const caught = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
};

let apiProc = null;

async function main() {
  console.log(`billing test: API on :${PORT}, Paddle stub on ${stub.url}`);
  apiProc = await spawnApi(PORT);
  ok(apiProc.health.billing?.mode === "sandbox" && apiProc.health.billing.ready === true, `GET /health: billing sandbox, ready (${JSON.stringify(apiProc.health.billing)})`);
  ok(stub.callsTo("GET", /^\/prices\//).length === 5 && stub.calls.every((c) => c.version === "1" && /^Bearer pdl_sdbx_apikey_/.test(c.auth)), "the API fetched the five prices at start, with Bearer and Paddle-Version: 1");
  await paddle.check(true);
  ok(paddle.ready, "the in-process PaddleService passed the same catalog check");

  // ---- Signatures ----------------------------------------------------------------------------
  console.log("webhook signatures");
  const A = token("a");
  const meA = await api(A, "GET", "/me");
  ok(meA.body.billing?.mode === "sandbox" && meA.body.billing.status === "free" && meA.body.billing.hold === null, "GET /me carries billing { mode sandbox, status free, hold null }");
  const probe = ev("customer.created", { id: "ctm_probe", email: "x@test.local" });
  const good = await hook(probe);
  ok(good.status === 200 && good.body.ok === true, "good signature: 200 { ok: true }");
  const probeRow = await eventRow(probe.event_id);
  ok(probeRow?.status === "ignored" && /not handled/.test(probeRow.error ?? ""), "an event type we don't subscribe to is stored as ignored, and says so");
  ok(probeRow.payload.event_id === probe.event_id && probeRow.payload.data === undefined && !JSON.stringify(probeRow.payload).includes("x@test.local"), "an ignored event keeps its envelope only: no customer payload (no email) is stored");
  ok((await hook(ev("customer.created", { id: "x" }), { secret: "pdl_ntfset_wrong" })).status === 401, "wrong secret: 401");
  ok((await hook(ev("customer.created", { id: "x" }), { ts: Math.floor(Date.now() / 1000) - 600 })).status === 401, "a timestamp 10 minutes old: 401");
  ok((await hook(ev("customer.created", { id: "x" }), { header: null })).status === 401, "no Paddle-Signature header: 401");
  {
    const e = ev("customer.created", { id: "x" });
    const body = JSON.stringify(e);
    const ts = Math.floor(Date.now() / 1000);
    const right = signBody(body, SECRET, ts).split(";h1=")[1];
    ok((await hook(e, { raw: body, header: `ts=${ts};h1=${"0".repeat(64)};h1=${right}` })).status === 200, "two h1 values (rotation): the second one matches: 200");
    const tampered = body.replace('"id":"x"', '"id":"y"');
    ok((await hook(e, { raw: tampered, header: signBody(body, SECRET, ts) })).status === 401, "a body changed after signing: 401");
  }
  ok((await hook(ev("customer.created", { id: "x" }), { secret: PREVIOUS })).status === 200, "the previous secret (PADDLE_WEBHOOK_SECRET_PREVIOUS) still verifies: 200");
  {
    const e = ev("customer.created", { id: "x" });
    ok((await hook(e, { contentType: "text/plain" })).status === 200, "a body sent without application/json still verifies and stores (Paddle's Content-Type is undocumented)");
  }
  ok((await hook(null, { raw: "{not json" })).status === 400, "bad JSON: 400");
  ok((await hook({ event_id: "evt_x", event_type: "transaction.completed" })).status === 400, "an envelope without occurred_at, notification_id and data: 400");

  // ---- A new plan: the simulator's "subscription created" sequence ------------------------------
  console.log("a new plan: checkout, then the webhooks in order");
  const userA = await fresh(A);
  const e403 = await caught(async () => billing.createCheckout(userA, parseItem("pack"), consent()));
  ok(e403?.status === 403 && e403.code === "plan_required", "a pack on Free: 403 plan_required");
  ok((await caught(async () => parseItem("plan:free")))?.status === 400 && (await caught(async () => parseItem("gold")))?.status === 400, "plan:free and nonsense items: 400");
  const coA = await billing.createCheckout(userA, parseItem("plan:medium"), consent());
  ok(/^txn_/.test(coA.transactionId), `POST /billing/checkout (service): a Paddle transaction ${coA.transactionId}`);
  const custA = stub.callsTo("POST", /^\/customers$/).at(-1);
  const txnA = stub.callsTo("POST", /^\/transactions$/).at(-1);
  ok(custA?.body.email === emailOf(A) && custA.body.custom_data.userId === devId(A), "the customer was made with our email and custom_data.userId");
  ok(txnA?.body.items[0].price_id === PRICE_IDS.medium && txnA.body.custom_data.userId === devId(A) && txnA.body.custom_data.item === "plan:medium" && txnA.body.custom_data.consentVersion === "v1" && txnA.body.collection_mode === "automatic", "the transaction names the price, the user, the item and the consent");
  ok(/^ctm_/.test((await userRow(A)).paddleCustomerId ?? ""), "User.paddleCustomerId stored");
  ok((await billing.checkoutStatus(userA, coA.transactionId)).status === "open", "checkout status: open");
  ok((await caught(async () => billing.createCheckout(await fresh(A), parseItem("plan:medium"), consent()))) === null && (await db.query(`SELECT count(*)::int AS n FROM "CheckoutSession" WHERE "userId" = $1 AND status = 'abandoned'`, [devId(A)])).rows[0].n === 1, "a second checkout abandons the first session");
  const coA2 = (await db.query(`SELECT id FROM "CheckoutSession" WHERE "userId" = $1 AND status = 'open'`, [devId(A)])).rows[0].id;
  // Paddle's side: the buyer pays. The simulator's order: subscription.created, subscription.activated, transaction.completed (plus noise).
  const tA = stub.complete(coA2);
  ok(tA.status === "completed" && /^sub_/.test(tA.subscription_id), "stub: the transaction completed and a subscription exists");
  const subA = stub.state.subscriptions.get(tA.subscription_id);
  const t0 = Date.now();
  await deliver(ev("transaction.updated", { ...tA, status: "paid" }, { at: t0 }));
  const sc = await deliver(ev("subscription.created", { ...subA, transaction_id: tA.id }, { at: t0 + 1000 }));
  ok(sc.status === "processed" && sc.userId === devId(A), `subscription.created processed for the user (${sc.error ?? "ok"})`);
  let uA = await userRow(A);
  ok(uA.plan === "free" && uA.paddleSubscriptionId === subA.id && uA.subscriptionStatus === "active", "after subscription.created: ids and status set, the plan still Free (money sets the plan)");
  await deliver(ev("subscription.activated", subA, { at: t0 + 2000 }));
  const tc = await deliver(ev("transaction.completed", tA, { at: t0 + 3000 }));
  ok(tc.status === "processed", `transaction.completed processed (${tc.error})`);
  uA = await userRow(A);
  const meA2 = await api(A, "GET", "/me");
  ok(uA.plan === "medium" && meA2.body.plan === "medium" && meA2.body.credits.available === 120, "A is on Medium with 20 + 100 = 120 credits");
  ok(meA2.body.billing.status === "active" && daysBetween(meA2.body.billing.periodEndsAt, monthLater(new Date())) < 1 && meA2.body.billing.pendingPlan === null, "Me.billing: active, the period ends in a month");
  ok(uA.paymentMethod === "Visa ending 4242" && uA.subscriptionStatus === "active", "payment method 'Visa ending 4242'");
  const payA = (await db.query(`SELECT * FROM "Payment" WHERE id = $1`, [tA.id])).rows[0];
  ok(payA && payA.kind === "plan" && payA.paidCents === 2000 && payA.taxCents === 200 && payA.totalCents === 2200 && payA.consentVersion === "v1" && payA.consentAt && payA.eventId === tc.id && payA.invoiceNumber, "Payment row: plan, $20.00 + $2.00 tax, the consent copied from the CheckoutSession, the event id");
  ok(daysBetween(payA.refundableUntil, Date.now() + 14 * 86_400_000) < 0.01, "refundable for 14 days");
  const bA = await buckets(A, `AND source = 'plan'`);
  ok(bA.length === 1 && bA[0].grantedTenths === 1000 && bA[0].paymentId === tA.id && daysBetween(bA[0].expiresAt, monthLater(monthLater(new Date()))) < 1, "one plan bucket of 100, named by its payment, ending a month after the period (the carried month)");
  ok((await billing.checkoutStatus(userA, coA2)).status === "completed" && (await db.query(`SELECT status FROM "CheckoutSession" WHERE id = $1`, [coA2])).rows[0].status === "completed", "checkout status: completed");
  ok((await history(A)).map((h) => `${h.kind}:${h.what}:${h.amount}`).join("|") === "grant:Medium plan:100|grant:Free plan credits:20", 'history: "Medium plan" +100');
  ok(await auditOk(emailOf(A)), "audit holds after the plan purchase");

  console.log("duplicates and replays");
  const again = await hook(ev("transaction.completed", tA, { at: t0 + 3000, id: tc.id, notification: tc.notificationId }));
  ok(again.status === 200, "the same notification delivered again: 200");
  const replay = await hook(ev("transaction.completed", tA, { at: t0 + 3000, id: tc.id }));
  ok(replay.status === 200, "a replay (same event_id, new notification_id): 200");
  await sleep(1500);
  const tcRow = await eventRow(tc.id);
  ok(tcRow.deliveries === 3 && tcRow.status === "processed" && (await credits(A)) === 120, "stored once with deliveries 3; the credits were granted exactly once");
  ok((await db.query(`SELECT payload->>'event_id' AS e FROM "PaddleEvent" WHERE id = $1`, [tc.id])).rows[0].e === tc.id, "the stored payload is the first one (never changed)");
  ok(await auditOk(), "audit over everyone holds");

  // ---- Shuffled order, another user -------------------------------------------------------------
  console.log("the same sequence shuffled (transaction.completed first)");
  const B = token("b");
  await api(B, "GET", "/me");
  stub.state.fail.customers409 = true;
  const coB = await billing.createCheckout(await fresh(B), parseItem("plan:high"), consent());
  stub.state.fail.customers409 = false;
  ok(stub.callsTo("GET", /^\/customers$/).at(-1)?.query.email === emailOf(B) && /^ctm_/.test((await userRow(B)).paddleCustomerId ?? ""), "POST /customers 409 → GET /customers?email= → the existing id stored");
  const tB = stub.complete(coB.transactionId);
  const subB = stub.state.subscriptions.get(tB.subscription_id);
  const t1 = Date.now();
  const tcB = await deliver(ev("transaction.completed", tB, { at: t1 + 3000 }));
  ok(tcB.status === "processed" && (await credits(B)) === 295 && (await userRow(B)).plan === "high", "transaction.completed alone: High, 20 + 275 credits");
  await deliver(ev("subscription.activated", subB, { at: t1 + 2000 }));
  const scB = await deliver(ev("subscription.created", { ...subB, transaction_id: tB.id }, { at: t1 + 1000 }));
  ok(/older than the last/.test(scB.error ?? ""), "subscription.created older than the activated one applied: skipped");
  const uB = await userRow(B);
  ok(uB.plan === "high" && (await credits(B)) === 295 && uB.paddleSubscriptionId === subB.id && daysBetween(uB.periodEndsAt, subB.current_billing_period.ends_at) < 0.01, "shuffled: still High, 275 credits exactly once, the subscription's period on the user");
  const bB = await buckets(B, `AND source = 'plan'`);
  ok(daysBetween(bB[0].expiresAt, monthLater(subB.current_billing_period.ends_at)) < 0.01, "the plan bucket's end was corrected to a month after the subscription's period");
  ok(await auditOk(emailOf(B)), "audit holds for B");

  // ---- The verify pull ---------------------------------------------------------------------------
  console.log("the verify pull (no webhook in 20 s)");
  const C = token("c");
  await api(C, "GET", "/me");
  const coC = await billing.createCheckout(await fresh(C), parseItem("plan:medium"), consent());
  ok((await billing.verifyCheckout(await fresh(C), coC.transactionId)).status === "open", "before paying: verify says open");
  const tC = stub.complete(coC.transactionId);
  const vC = await billing.verifyCheckout(await fresh(C), coC.transactionId);
  ok(vC.status === "completed" && (await credits(C)) === 120 && (await userRow(C)).plan === "medium", "verify pulled GET /transactions/:id and applied it: Medium, 120 credits");
  ok((await db.query(`SELECT "eventId" FROM "Payment" WHERE id = $1`, [tC.id])).rows[0].eventId === `txn:${tC.id}`, "the Payment names the pull as its source (txn:<id>)");
  const lateC = await deliver(ev("transaction.completed", tC));
  ok(lateC.status === "processed" && /already recorded/.test(lateC.error ?? "") && (await credits(C)) === 120, "the webhook that lands later is a no-op");
  const other = await caught(async () => billing.checkoutStatus(await fresh(A), coC.transactionId));
  ok(other?.status === 404, "another user's checkout: 404");

  // ---- Renewals and the carry-over cap -------------------------------------------------------------
  console.log("renewal: the cap, then the grant");
  const periodEndA = new Date(subA.current_billing_period.ends_at);
  const period2 = { starts_at: periodEndA.toISOString(), ends_at: monthLater(periodEndA).toISOString() };
  const r1 = stub.makeTransaction({ origin: "subscription_recurring", customerId: tA.customer_id, subscriptionId: subA.id, customData: tA.custom_data, lines: [{ price_id: PRICE_IDS.medium }], billingPeriod: period2 });
  subA.current_billing_period = period2;
  subA.next_billed_at = period2.ends_at;
  await deliver(ev("subscription.updated", subA, { at: Date.now() - 1000 }));
  const rr1 = await deliver(ev("transaction.completed", r1));
  ok(rr1.status === "processed" && (await credits(A)) === 220, "renewal 1: +100 (the 100 carried fit under Medium's cap): 220");
  ok((await userRow(A)).periodEndsAt.toISOString() === period2.ends_at && (await userRow(A)).lastPaymentFailedAt === null, "the period moved on");
  const bA1 = await buckets(A, `AND source = 'plan'`);
  ok(bA1.length === 2 && daysBetween(bA1[0].expiresAt, monthLater(period2.starts_at)) < 0.01, "the first period's bucket now ends a month after that period ended");
  const period3 = { starts_at: period2.ends_at, ends_at: monthLater(period2.ends_at).toISOString() };
  const r2 = stub.makeTransaction({ origin: "subscription_recurring", customerId: tA.customer_id, subscriptionId: subA.id, customData: tA.custom_data, lines: [{ price_id: PRICE_IDS.medium }], billingPeriod: period3 });
  const rr2 = await deliver(ev("transaction.completed", r2));
  ok(rr2.status === "processed" && (await credits(A)) === 220, "renewal 2: 200 carried capped at 100 (100 expired, oldest first), then +100: 220");
  const hA = await history(A, 3);
  ok(hA[0].kind === "grant" && hA[0].what === "Renewal: Medium" && hA[0].amount === 100 && hA[1].kind === "expire" && hA[1].amount === -100 && /^Credits from \w+ ended$/.test(hA[1].what), `history: "${hA[1].what}" -100, then "Renewal: Medium" +100`);
  ok((await buckets(A, `AND source = 'plan' AND "closedAt" IS NULL`)).length === 2, "two open plan buckets (the oldest closed by the cap)");
  ok(await auditOk(emailOf(A)), "audit holds after the renewals");

  // ---- Upgrade ----------------------------------------------------------------------------------
  console.log("upgrade: preview, apply, the credits with its transaction");
  const pv = await billing.previewPlanChange(await fresh(A), "high");
  ok(pv.direction === "up" && pv.chargeNowUsd === 16.5 && pv.taxNowUsd === 1.5 && pv.creditsNow === 87.5 && pv.nextRenewalUsd === 50, `preview Medium -> High at half a period: $16.50 now of which $1.50 tax ($15.00 plus tax), 87.5 credits, then $50 (${JSON.stringify(pv)})`);
  ok(stub.callsTo("PATCH", /\/preview$/).at(-1)?.body.proration_billing_mode === "prorated_immediately" && stub.callsTo("PATCH", /\/preview$/).at(-1)?.body.on_payment_failure === "prevent_change", "the preview asked for prorated_immediately with prevent_change");
  const same = await caught(async () => billing.previewPlanChange(await fresh(A), "medium"));
  ok(same?.status === 400, "a change to the plan you're on: 400");
  const applied = await billing.applyPlanChange(await fresh(A), "high");
  ok(applied.direction === "up" && stub.callsTo("PATCH", /^\/subscriptions\/sub_[^/]+$/).at(-1)?.body.items[0].price_id === PRICE_IDS.high, "PATCH /subscriptions/:id with the High price");
  const up = stub.makeTransaction({ origin: "subscription_update", customerId: tA.customer_id, subscriptionId: subA.id, customData: tA.custom_data, lines: [{ price_id: PRICE_IDS.high, rate: 0.5 }, { price_id: PRICE_IDS.medium, rate: 0.5, negative: true }] });
  const upRow = await deliver(ev("transaction.completed", up));
  ok(upRow.status === "processed" && (await credits(A)) === 307.5 && (await userRow(A)).plan === "high", "subscription_update: 275 × 0.5 − 100 × 0.5 = 87.5 credits, the plan High: 307.5");
  const upBucket = (await buckets(A, `AND source = 'upgrade'`))[0];
  const currentPlan = (await buckets(A, `AND source = 'plan' AND "closedAt" IS NULL`)).at(-1);
  ok(upBucket && upBucket.expiresAt.getTime() === currentPlan.expiresAt.getTime() && (await db.query(`SELECT "paidCents", kind FROM "Payment" WHERE id = $1`, [up.id])).rows[0].paidCents === 1500, "the upgrade bucket ends with the period's plan bucket; the payment is $15.00 before tax, kind upgrade");
  ok((await history(A, 1))[0].what === "Upgrade to High", 'history: "Upgrade to High"');
  stub.state.fail.decline = true;
  const declined = await caught(async () => billing.applyPlanChange(await fresh(A), "ultra"));
  stub.state.fail.decline = false;
  ok(declined?.status === 409 && declined.code === "billing_busy" && /declined/.test(declined.message), "a declined card (prevent_change): 409 billing_busy, says so");
  ok(await auditOk(emailOf(A)), "audit holds after the upgrade");

  // ---- Downgrade at renewal ------------------------------------------------------------------------
  console.log("downgrade: pending until the renewal at the new price");
  await db.query(`UPDATE "User" SET "nextBilledAt" = now() + interval '10 minutes' WHERE id = $1`, [devId(B)]);
  const soon = await caught(async () => billing.previewPlanChange(await fresh(B), "medium"));
  ok(soon?.status === 409 && /about to run/.test(soon.message), "within 30 minutes of the renewal: 409 billing_busy");
  await db.query(`UPDATE "User" SET "nextBilledAt" = $2 WHERE id = $1`, [devId(B), subB.next_billed_at]);
  const down = await billing.previewPlanChange(await fresh(B), "medium");
  ok(down.direction === "down" && down.chargeNowUsd === 0 && down.creditsNow === 0 && down.nextRenewalUsd === 20 && down.effectiveAt === new Date(subB.next_billed_at).toISOString(), "preview High -> Medium: nothing now, $20 at the renewal");
  await billing.applyPlanChange(await fresh(B), "medium");
  const patchDown = stub.callsTo("PATCH", /^\/subscriptions\/sub_[^/]+$/).at(-1);
  ok(patchDown.body.proration_billing_mode === "do_not_bill" && patchDown.body.items[0].price_id === PRICE_IDS.medium, "PATCH with do_not_bill and the Medium price");
  ok((await userRow(B)).pendingPlan === "medium" && (await userRow(B)).plan === "high" && (await credits(B)) === 295 && (await api(B, "GET", "/me")).body.billing.pendingPlan === "medium", "pendingPlan medium; the plan and the credits unchanged until the renewal");
  const busy = await caught(async () => billing.previewPlanChange(await fresh(B), "ultra"));
  ok(busy?.status === 409 && /Undo your change to Medium/.test(busy.message), "an upgrade while a downgrade waits: 409 'Undo your change to Medium first'");
  const undo = await admin("downgrade", emailOf(B), "cancel");
  ok(undo.status === 0 && (await userRow(B)).pendingPlan === null && stub.callsTo("PATCH", /^\/subscriptions\/sub_[^/]+$/).at(-1)?.body.items[0].price_id === PRICE_IDS.high, `admin downgrade cancel: PATCH back to High, pendingPlan cleared (${undo.stdout.trim()})`);
  await billing.applyPlanChange(await fresh(B), "medium");
  const periodEndB = new Date(subB.current_billing_period.ends_at);
  const periodB2 = { starts_at: periodEndB.toISOString(), ends_at: monthLater(periodEndB).toISOString() };
  const rB = stub.makeTransaction({ origin: "subscription_recurring", customerId: tB.customer_id, subscriptionId: subB.id, customData: tB.custom_data, lines: [{ price_id: PRICE_IDS.medium }], billingPeriod: periodB2 });
  await deliver(ev("transaction.completed", rB));
  const uB2 = await userRow(B);
  ok(uB2.plan === "medium" && uB2.pendingPlan === null && (await credits(B)) === 220, "the renewal at Medium's price flips the plan: 275 carried capped at 100 (175 expired), +100: 20 + 200 = 220");
  ok(await auditOk(emailOf(B)), "audit holds after the downgrade");

  // ---- Cancel, keep, the canceled sequence; packs survive ----------------------------------------------
  console.log("cancel and keep; canceled: Free, packs survive");
  const coPack = await billing.createCheckout(await fresh(A), parseItem("pack"), consent());
  const tPack = stub.complete(coPack.transactionId);
  await deliver(ev("transaction.completed", tPack));
  ok((await credits(A)) === 347.5 && (await history(A, 1))[0].what === "Credit pack" && daysBetween((await buckets(A, `AND source = 'pack'`))[0].expiresAt, Date.now() + 365 * 86_400_000) < 2, "a pack: +40 for 12 months: 347.5");
  const cancelled = await billing.cancel(await fresh(A));
  ok(cancelled.cancelsAt === period2.ends_at && stub.callsTo("POST", /\/cancel$/).at(-1)?.body.effective_from === "next_billing_period", "POST /billing/cancel (service): Paddle cancels at the period's end; cancelsAt from its answer");
  ok((await api(A, "GET", "/me")).body.billing.status === "canceling" && (await api(A, "GET", "/me")).body.billing.cancelsAt === period2.ends_at, "Me.billing: canceling");
  await billing.keep(await fresh(A));
  ok(stub.callsTo("PATCH", /^\/subscriptions\/sub_[^/]+$/).at(-1)?.body.scheduled_change === null && (await api(A, "GET", "/me")).body.billing.status === "active", "Keep my plan: PATCH { scheduled_change: null }, active again");
  await billing.cancel(await fresh(A));
  const subACanceled = { ...stub.state.subscriptions.get(subA.id), status: "canceled", canceled_at: new Date().toISOString(), scheduled_change: null, current_billing_period: null, next_billed_at: null };
  await deliver(ev("subscription.updated", subACanceled, { at: Date.now() + 1000 }));
  const sCan = await deliver(ev("subscription.canceled", subACanceled, { at: Date.now() + 2000 }));
  ok(/already|older/.test(sCan.error ?? "") || sCan.status === "processed", "subscription.canceled after the updated one: processed");
  const uA3 = await userRow(A);
  const meA3 = await api(A, "GET", "/me");
  ok(uA3.plan === "free" && uA3.subscriptionStatus === "canceled" && meA3.body.billing.status === "free" && meA3.body.credits.available === 60, "canceled: Free; the plan and upgrade credits ended, the free 20 and the pack's 40 stay: 60");
  ok((await buckets(A, `AND source IN ('plan', 'upgrade') AND "closedAt" IS NULL`)).length === 0 && (await buckets(A, `AND "closedWhy" = 'canceled'`)).length === 3, "every plan and upgrade bucket closed (canceled)");
  ok(meA3.body.credits.todayLeft === 5 && meA3.body.models.join() === "fast", "back on Free's rules (5 a day, Fast)");
  ok(await auditOk(emailOf(A)), "audit holds after the cancel");

  // ---- Past due and the lapse ----------------------------------------------------------------------------
  console.log("past due: the banner, the lapse after 24 h, a recovered renewal");
  const failB = { ...rB, id: `txn_fail_${stamp}`, status: "past_due", payments: [{ status: "error", error_code: "declined", method_details: { type: "card", card: { type: "visa", last4: "4242" } } }] };
  const pf = await deliver(ev("transaction.payment_failed", failB));
  ok(pf.status === "processed" && (await userRow(B)).lastPaymentFailedAt !== null, "transaction.payment_failed: lastPaymentFailedAt set");
  const subBPastDue = { ...stub.state.subscriptions.get(subB.id), status: "past_due", current_billing_period: { starts_at: periodB2.ends_at, ends_at: monthLater(periodB2.ends_at).toISOString() } };
  await deliver(ev("subscription.past_due", subBPastDue, { at: Date.now() + 1000 }));
  const uB3 = await userRow(B);
  ok(uB3.subscriptionStatus === "past_due" && uB3.plan === "medium" && uB3.periodEndsAt.toISOString() === periodB2.ends_at && (await api(B, "GET", "/me")).body.billing.status === "past_due", "past_due: status only; the paid period's end kept (not the unpaid period's); the plan and credits stay");
  ok((await credits(B)) === 220, "credits untouched while Paddle retries");
  await db.query(`UPDATE "User" SET "periodEndsAt" = now() - interval '25 hours', "nextSettleAt" = now() - interval '1 hour' WHERE id = $1`, [devId(B)]);
  const lapsed = await api(B, "GET", "/me");
  ok(lapsed.body.plan === "free" && lapsed.body.billing.status === "past_due" && lapsed.body.credits.available === 20 && (await buckets(B, `AND source = 'plan' AND "closedAt" IS NULL`)).length === 0, `25 h past the period: the plan lapsed to Free in the same GET /me, plan credits ended, the free 20 stay (plan ${lapsed.body.plan}, ${lapsed.body.credits.available})`);
  const periodB3 = { starts_at: periodB2.ends_at, ends_at: monthLater(periodB2.ends_at).toISOString() };
  const recovered = stub.makeTransaction({ origin: "subscription_recurring", customerId: tB.customer_id, subscriptionId: subB.id, customData: tB.custom_data, lines: [{ price_id: PRICE_IDS.medium }], billingPeriod: periodB3 });
  await deliver(ev("transaction.completed", recovered));
  const uB4 = await userRow(B);
  ok(uB4.plan === "medium" && uB4.subscriptionStatus === "active" && uB4.lastPaymentFailedAt === null && (await credits(B)) === 120, "a recovered renewal restores the plan by money: Medium, +100, active, the failure cleared");
  ok(await auditOk(emailOf(B)), "audit holds after the lapse and recovery");

  // ---- Refunds (admin) ---------------------------------------------------------------------------------
  console.log("admin refund: quote, freeze, pending, approved / rejected / $0 / during a build / timeout");
  const D = token("d");
  await api(D, "GET", "/me");
  const coD = await billing.createCheckout(await fresh(D), parseItem("plan:medium"), consent());
  const tD = stub.complete(coD.transactionId);
  await deliver(ev("transaction.completed", tD));
  ok((await admin("grant", emailOf(D), "-20", "empty the free bucket")).status === 0 && (await credits(D)) === 100, "D: Medium with the free 20 taken away: 100 plan credits");
  ok((await build(D, "D's game")).status === 201 && (await credits(D)) === 98.3, "a build charged 1.7 from the plan credits: 98.3");
  const refundD = await admin("refund", emailOf(D), "last", "changed my mind");
  ok(refundD.status === 0 && /\$19\.66 before tax for 98\.3 unused credits, now pending/.test(refundD.stdout), `admin refund D last: $19.66 for 98.3 credits, pending (${refundD.stdout.trim().split("\n").filter((l) => !l.includes("[Nest]")).join(" | ")} ${refundD.stderr.trim()})`);
  const postD = stub.callsTo("POST", /^\/adjustments$/).at(-1);
  ok(postD?.body.action === "refund" && postD.body.type === "partial" && postD.body.tax_mode === "external" && postD.body.transaction_id === tD.id && postD.body.items[0].amount === "1966" && /^txnitm_/.test(postD.body.items[0].item_id) && postD.body.reason === "changed my mind", "POST /adjustments: partial, external tax, the line item, 1966 cents, the reason");
  const refundRowD = (await db.query(`SELECT * FROM "Refund" WHERE "userId" = $1`, [devId(D)])).rows[0];
  ok(refundRowD.status === "pending" && refundRowD.quoteCents === 1966 && refundRowD.quoteTenths === 983 && /^adj_/.test(refundRowD.adjustmentId), "Refund row: pending, linked to the adjustment");
  ok((await buckets(D, `AND source = 'plan'`))[0].frozenAt !== null && (await credits(D)) === 0, "the bucket is frozen: 0 credits to spend meanwhile");
  ok((await api(D, "POST", "/projects", { prompt: "another", model: "fast" })).body?.error === "no_credits", "a build while the refund is pending: 402 no_credits");
  const twice = await admin("refund", emailOf(D), "last");
  ok(twice.status === 1 && /already pending/.test(twice.stderr), "a second refund of the same payment: refused (already pending)");
  stub.settleAdjustment(refundRowD.adjustmentId, "approved");
  const apD = await deliver(ev("adjustment.updated", stub.state.adjustments.get(refundRowD.adjustmentId)));
  ok(apD.status === "processed" && (await db.query(`SELECT status FROM "Refund" WHERE id = $1`, [refundRowD.id])).rows[0].status === "approved", "adjustment.updated approved: the Refund is approved");
  const payD = (await db.query(`SELECT * FROM "Payment" WHERE id = $1`, [tD.id])).rows[0];
  const bD = (await buckets(D, `AND source = 'plan'`))[0];
  ok(payD.refundedCents === 1966 && payD.status === "partly_refunded" && bD.closedAt !== null && bD.closedWhy === "refunded" && bD.remainingTenths === 0 && bD.frozenAt === null, "Payment refunded $19.66 (partly_refunded); the bucket closed (refunded) with 0 left");
  ok((await history(D, 1))[0].kind === "reversal" && (await history(D, 1))[0].what === "Refunded" && (await history(D, 1))[0].amount === -98.3, 'history: "Refunded" -98.3');
  const apDagain = await deliver(ev("adjustment.created", { ...stub.state.adjustments.get(refundRowD.adjustmentId), status: "pending_approval" }, { at: Date.now() - 60_000 }));
  ok(/already applied/.test(apDagain.error ?? "") && payD.refundedCents === 1966 && (await db.query(`SELECT count(*)::int AS n FROM "CreditEntry" WHERE "paddleAdjustmentId" = $1`, [refundRowD.adjustmentId])).rows[0].n === 1, "the older adjustment.created arriving after: a no-op (one reversal per adjustment)");
  ok(await auditOk(emailOf(D)), "audit holds after the refund");
  // A refund means they don't want the plan any more (Luka, 2026-10-25): the month's payment cancels its subscription now.
  const adjD = (await db.query(`SELECT * FROM "Adjustment" WHERE id = $1`, [refundRowD.adjustmentId])).rows[0];
  ok(adjD.cancelSubscription === "immediately" && adjD.cancelSubscriptionId === tD.subscription_id && adjD.canceledAt === null && (await userRow(D)).subscriptionStatus === "active", "the approved refund of the month's payment marks its subscription to cancel now (Paddle is called after the lock)");
  const cancelsD = await billing.refundCancels(undefined, "admin:billtest");
  const cancelCallD = stub.callsTo("POST", /^\/subscriptions\/[^/]+\/cancel$/).at(-1);
  const uD = await userRow(D);
  ok(cancelsD.length === 1 && cancelCallD?.path === `/subscriptions/${tD.subscription_id}/cancel` && cancelCallD.body.effective_from === "immediately" && uD.subscriptionStatus === "canceled" && uD.plan === "free", `refundCancels: POST /subscriptions/:id/cancel immediately; D canceled, on Free (${cancelsD.join(" | ")})`);
  ok((await db.query(`SELECT "canceledAt" FROM "Adjustment" WHERE id = $1`, [refundRowD.adjustmentId])).rows[0].canceledAt !== null && (await billing.refundCancels(undefined, "admin:billtest")).length === 0, "done once: canceledAt set, a second pass has nothing to do");
  ok(await auditOk(emailOf(D)), "audit holds after the cancel");
  // $0: every credit used.
  const E = token("e");
  await api(E, "GET", "/me");
  const coE = await billing.createCheckout(await fresh(E), parseItem("plan:medium"), consent());
  const tE = stub.complete(coE.transactionId);
  await deliver(ev("transaction.completed", tE));
  ok((await admin("grant", emailOf(E), "-120")).status === 0 && (await credits(E)) === 0, "E: all 120 credits used");
  const zero = await admin("refund", emailOf(E), tE.id);
  ok(zero.status === 1 && /\$0 \(refused\)/.test(zero.stderr), "a refund with every credit used: $0, refused");
  // 409 during a build.
  const F = token("f");
  await api(F, "GET", "/me");
  const coF = await billing.createCheckout(await fresh(F), parseItem("plan:medium"), consent());
  const tF = stub.complete(coF.transactionId);
  await deliver(ev("transaction.completed", tF));
  const slowF = await api(F, "POST", "/projects", { prompt: "F's game SLOW", model: "fast" });
  projects.push(slowF.body.id);
  const during = await admin("refund", emailOf(F), "last");
  ok(during.status === 1 && /has a build going/.test(during.stderr), "a refund while a build is going: refused (409 billing_busy)");
  await waitIdle(F, slowF.body.id);
  ok((await credits(F)) === 118.3, "F's build charged 1.7 from the free credits first: 118.3");
  const refundF = await admin("refund", emailOf(F), "last", "test rejected");
  ok(refundF.status === 0 && /\$20\.00 before tax for 100 unused credits/.test(refundF.stdout) && (await credits(F)) === 18.3, "admin refund F: the whole $20.00 (plan credits untouched), frozen: 18.3 to spend");
  const refundRowF = (await db.query(`SELECT * FROM "Refund" WHERE "userId" = $1`, [devId(F)])).rows[0];
  stub.settleAdjustment(refundRowF.adjustmentId, "rejected");
  await deliver(ev("adjustment.updated", stub.state.adjustments.get(refundRowF.adjustmentId)));
  ok((await db.query(`SELECT status FROM "Refund" WHERE id = $1`, [refundRowF.id])).rows[0].status === "rejected" && (await credits(F)) === 118.3 && (await buckets(F, `AND source = 'plan'`))[0].frozenAt === null, "rejected: the Refund is rejected, the bucket unfrozen: 118.3 again");
  ok(await auditOk(emailOf(F)), "audit holds after the rejection");
  // Timeout → lookup; the job posts again only when Paddle has nothing.
  const G = token("g");
  await api(G, "GET", "/me");
  const coG = await billing.createCheckout(await fresh(G), parseItem("plan:medium"), consent());
  const tG = stub.complete(coG.transactionId);
  await deliver(ev("transaction.completed", tG));
  stub.state.fail.timeout = /^POST \/adjustments$/;
  const postsBefore = stub.callsTo("POST", /^\/adjustments$/).length;
  const refundG = await admin("refund", emailOf(G), "last", "timeout");
  stub.state.fail.timeout = null;
  ok(refundG.status === 0 && /lookup/.test(refundG.stdout) && (await db.query(`SELECT status FROM "Refund" WHERE "userId" = $1`, [devId(G)])).rows[0].status === "lookup", "POST /adjustments timed out (10 s): the Refund is in lookup, the bucket stays frozen");
  const n1 = await billing.refundLookups("admin:billtest");
  const refundRowG = (await db.query(`SELECT * FROM "Refund" WHERE "userId" = $1`, [devId(G)])).rows[0];
  ok(n1 === 1 && stub.callsTo("GET", /^\/adjustments$/).at(-1)?.query.transaction_id === tG.id && stub.callsTo("POST", /^\/adjustments$/).length === postsBefore + 2 && refundRowG.status === "pending" && /^adj_/.test(refundRowG.adjustmentId), "the lookup job: GET /adjustments?transaction_id= found nothing, posted again, now pending");
  // The other branch: Paddle took the POST but the answer was lost.
  const H = token("h");
  await api(H, "GET", "/me");
  const coH = await billing.createCheckout(await fresh(H), parseItem("plan:medium"), consent());
  const tH = stub.complete(coH.transactionId);
  await deliver(ev("transaction.completed", tH));
  stub.state.fail.timeout = /^POST \/adjustments$/;
  await admin("refund", emailOf(H), "last", "lost answer");
  stub.state.fail.timeout = null;
  const landed = await fetch(`${stub.url}/adjustments`, { method: "POST", headers: { authorization: "Bearer pdl_sdbx_apikey_test", "content-type": "application/json" }, body: JSON.stringify({ action: "refund", type: "partial", transaction_id: tH.id, tax_mode: "external", reason: "lost answer", items: [{ item_id: tH.details.line_items[0].id, type: "partial", amount: "2000" }] }) }).then((r) => r.json());
  const postsH = stub.callsTo("POST", /^\/adjustments$/).length;
  await billing.refundLookups("admin:billtest");
  const refundRowH = (await db.query(`SELECT * FROM "Refund" WHERE "userId" = $1`, [devId(H)])).rows[0];
  ok(refundRowH.status === "pending" && refundRowH.adjustmentId === landed.data.id && stub.callsTo("POST", /^\/adjustments$/).length === postsH, "the lookup job found the adjustment Paddle had taken: linked, nothing posted again");
  ok(await auditOk(), "audit over everyone holds after the refund cases");

  // ---- A refund Paddle made itself; chargeback → hold --------------------------------------------------
  console.log("a Paddle-initiated refund; a chargeback holds the account");
  const paddleRefund = { id: `adj_paddle_${stamp}`, action: "refund", type: "partial", status: "approved", transaction_id: tPack.id, subscription_id: null, customer_id: tPack.customer_id, currency_code: "USD", reason: "support", items: [{ item_id: tPack.details.line_items[0].id, type: "partial", amount: "500" }], totals: { subtotal: "500", tax: "50", total: "550", fee: "0", earnings: "-500", currency_code: "USD" }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const prA = await deliver(ev("adjustment.created", paddleRefund));
  const packA = (await buckets(A, `AND source = 'pack'`))[0];
  const payPack = (await db.query(`SELECT * FROM "Payment" WHERE id = $1`, [tPack.id])).rows[0];
  ok(prA.status === "processed" && packA.remainingTenths === 200 && packA.closedAt === null && payPack.refundedCents === 500 && payPack.status === "partly_refunded" && (await userRow(A)).billingFlag === null, "Paddle refunded $5 of the $10 pack: 20 of the 40 credits removed, the bucket stays open, no flag");
  ok((await credits(A)) === 40, "A: 20 free + 20 pack = 40");
  const tooMuch = { ...paddleRefund, id: `adj_paddle2_${stamp}`, items: [{ item_id: tPack.details.line_items[0].id, type: "partial", amount: "800" }], totals: { subtotal: "800", tax: "80", total: "880", fee: "0", earnings: "-800", currency_code: "USD" } };
  await deliver(ev("adjustment.created", tooMuch));
  const payPack2 = (await db.query(`SELECT * FROM "Payment" WHERE id = $1`, [tPack.id])).rows[0];
  ok(payPack2.refundedCents === 1000 && payPack2.status === "refunded" && (await userRow(A)).billingFlag === "refund_review" && (await buckets(A, `AND source = 'pack'`))[0].remainingTenths === 0, "a second refund beyond the unused share: capped at what was paid, the rest of the credits removed, flag refund_review for a person");
  ok(await auditOk(emailOf(A)), "audit holds (refundedCents ≤ paidCents)");
  const cb = { id: `adj_cb_${stamp}`, action: "chargeback", type: "full", status: "approved", transaction_id: tC.id, customer_id: tC.customer_id, currency_code: "USD", items: [{ item_id: tC.details.line_items[0].id, type: "full", amount: null }], totals: { subtotal: "2000", tax: "200", total: "2200", fee: "0", earnings: "-2200", currency_code: "USD" }, payout_totals: { chargeback_fee: "2000" }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const cbRow = await deliver(ev("adjustment.created", cb));
  const meC = await api(C, "GET", "/me");
  ok(cbRow.status === "processed" && meC.body.billing.hold === "chargeback" && meC.body.credits.available === 20 && (await db.query(`SELECT status FROM "Payment" WHERE id = $1`, [tC.id])).rows[0].status === "charged_back", "chargeback: the payment's 100 credits removed, Payment charged_back, Me.billing.hold = chargeback");
  const held = await api(C, "POST", "/projects", { prompt: "C's game", model: "fast" });
  ok(held.status === 403 && held.body.error === "billing_hold", "a build on hold: 403 billing_hold");
  const heldBuy = await caught(async () => billing.createCheckout(await fresh(C), parseItem("pack"), consent()));
  ok(heldBuy?.status === 403 && heldBuy.code === "billing_hold", "a checkout on hold: 403 billing_hold");
  ok((await admin("flag", emailOf(C), "clear")).status === 0 && (await api(C, "POST", "/projects", { prompt: "C's game", model: "fast" })).status === 201, "admin flag clear lifts the hold: the build starts");
  projects.push((await api(C, "GET", "/projects")).body[0]?.id);
  await waitIdle(C, projects.at(-1));
  ok((await history(C, 2)).some((h) => h.what === "Removed after a chargeback" && h.amount === -100), 'history: "Removed after a chargeback" -100');
  ok(await auditOk(emailOf(C)), "audit holds after the chargeback");

  // ---- A renewal while a build holds credits ----------------------------------------------------------
  console.log("a renewal lands while a build is going");
  const slowF2 = await api(F, "POST", "/projects", { prompt: "F again SLOW", model: "fast" });
  projects.push(slowF2.body.id);
  const subF = stub.state.subscriptions.get(tF.subscription_id);
  const periodF2 = { starts_at: subF.current_billing_period.ends_at, ends_at: monthLater(subF.current_billing_period.ends_at).toISOString() };
  const rF = stub.makeTransaction({ origin: "subscription_recurring", customerId: tF.customer_id, subscriptionId: subF.id, customData: tF.custom_data, lines: [{ price_id: PRICE_IDS.medium }], billingPeriod: periodF2 });
  const rFRow = await deliver(ev("transaction.completed", rF));
  await waitIdle(F, slowF2.body.id);
  ok(rFRow.status === "processed" && (await credits(F)) === 216.6, "the renewal (+100) and the build's charge (−1.7) both landed under the lock: 118.3 + 100 − 1.7 = 216.6");
  ok(await auditOk(emailOf(F)), "audit holds");

  // ---- Parked, failed, retry, admin events ----------------------------------------------------------------
  console.log("parked and failed events; admin events / event / retry");
  // Made for user E and a customer nobody has, so `admin sync` of B below sees only B's real transactions.
  const unknownPrice = stub.makeTransaction({ origin: "web", customerId: "ctm_elsewhere", subscriptionId: null, customData: { userId: devId(E) }, lines: [{ price_id: "pri_unknown" }] });
  const parkedRow = await deliver(ev("transaction.completed", unknownPrice));
  ok(parkedRow.status === "parked" && /unknown price/.test(parkedRow.error), "a transaction on a price we don't sell: parked");
  const eur = { ...stub.makeTransaction({ origin: "web", customerId: "ctm_elsewhere", customData: { userId: devId(E) }, lines: [{ price_id: PRICE_IDS.medium }] }), currency_code: "EUR" };
  ok((await deliver(ev("transaction.completed", eur))).status === "parked", "a EUR transaction: parked");
  const nobody = stub.makeTransaction({ origin: "web", customerId: "ctm_nobody", customData: { userId: "dev-nobody" }, lines: [{ price_id: PRICE_IDS.medium }] });
  ok((await deliver(ev("transaction.completed", nobody))).status === "parked", "a transaction for nobody we know: parked");
  const list = await admin("events", "--status", "parked");
  ok(list.status === 0 && list.stdout.includes(parkedRow.id) && list.stdout.includes("unknown price"), "admin events --status parked lists it with the reason");
  const one = await admin("event", parkedRow.id);
  ok(one.status === 0 && one.stdout.includes("pri_unknown") && one.stdout.includes("delivered 1x"), "admin event <id> prints the row and its payload");
  const retried = await admin("retry", parkedRow.id);
  ok(retried.status === 1 && /parked/.test(retried.stdout), "admin retry: still parked (the price is still unknown), exit 1");
  // A checkout of ours (E is on Medium, so a pack) whose completed payload can't be read.
  const coBroken = await billing.createCheckout(await fresh(E), parseItem("pack"), consent());
  const broken = { ...stub.complete(coBroken.transactionId), details: { line_items: [], totals: { subtotal: "x", tax: "y", total: "not-cents" } } };
  const brokenEv = ev("transaction.completed", broken);
  await hook(brokenEv);
  await sleep(1500);
  let brokenRow = await eventRow(brokenEv.event_id);
  ok(brokenRow.status === "received" && brokenRow.attempts === 1 && brokenRow.nextTryAt > new Date(Date.now() + 100_000) && /not an amount/.test(brokenRow.error), "a payload the handler can't read: attempt 1 failed, next try in ~2 min (backoff)");
  await db.query(`UPDATE "PaddleEvent" SET attempts = 19, "nextTryAt" = now() - interval '1 second' WHERE id = $1`, [brokenEv.event_id]);
  await deliver(ev("transaction.payment_failed", { id: "txn_kick", custom_data: { userId: "dev-nobody" } })); // any subscribed event stored kicks the loop (this one parks)
  await sleep(1500);
  brokenRow = await eventRow(brokenEv.event_id);
  ok(brokenRow.status === "failed" && brokenRow.attempts === 20, "after 20 attempts: failed");
  await hook({ ...brokenEv, notification_id: `ntf_replay_${stamp}` });
  await sleep(1500);
  brokenRow = await eventRow(brokenEv.event_id);
  ok(brokenRow.deliveries === 2 && brokenRow.attempts === 1 && brokenRow.status === "received", "a replay of a failed event: queued again from attempt 0 (one more try done)");
  const health = await (await fetch(`${API}/health`)).json();
  ok(health.billing.parked === 4 && health.billing.received >= 1 && typeof health.billing.lastEventAt === "string", `GET /health billing: ${JSON.stringify(health.billing)}`);

  // ---- admin sync, portal ------------------------------------------------------------------------------------
  console.log("admin sync; portal links");
  const before = await credits(B);
  const sync = await admin("sync", emailOf(B));
  ok(sync.status === 0 && /subscription sub_\w+ active: processed/.test(sync.stdout) && (sync.stdout.match(/already recorded/g) ?? []).length >= 3 && (await credits(B)) === before, `admin sync: the subscription applied, every payment already recorded, nothing granted twice`);
  ok(stub.callsTo("GET", /^\/subscriptions\//).length >= 1 && stub.callsTo("GET", /^\/transactions$/).at(-1)?.query.customer_id === tB.customer_id && stub.callsTo("GET", /^\/adjustments$/).at(-1)?.query.customer_id === tB.customer_id, "sync fetched the subscription, the transactions and the adjustments by customer");
  const links = await billing.portal(await fresh(B));
  ok(/overview/.test(links.overview) && /cancel/.test(links.cancel) && /update-payment-method/.test(links.updatePaymentMethod) && stub.callsTo("POST", /\/portal-sessions$/).at(-1)?.body.subscription_ids[0] === subB.id, "a portal session per click, with the subscription's links");

  // ---- Account close -----------------------------------------------------------------------------------------
  console.log("DELETE /me cancels at Paddle first");
  stub.state.fail.cancelCode = "subscription_cancel_not_allowed";
  const refusedClose = await api(F, "DELETE", "/me", { confirm: "DELETE" });
  stub.state.fail.cancelCode = null;
  ok(refusedClose.status === 409 && refusedClose.body.error === "billing_busy" && (await api(F, "GET", "/me")).status === 200, "a cancel refused with another code that has 'cancel' in it (subscription_cancel_not_allowed): 409, the account stays (only subscription_already_canceled and 404 let it go)");
  stub.state.fail.lock30 = true;
  const locked = await api(F, "DELETE", "/me", { confirm: "DELETE" });
  stub.state.fail.lock30 = false;
  ok(locked.status === 409 && locked.body.error === "billing_busy" && /hour/.test(locked.body.message) && (await api(F, "GET", "/me")).status === 200, "inside Paddle's 30-minute lock: 409 'try again in an hour', the account stays");
  stub.state.fail.timeout = /^POST \/subscriptions\/[^/]+\/cancel$/;
  const unreachable = await api(F, "DELETE", "/me", { confirm: "DELETE" });
  stub.state.fail.timeout = null;
  ok(unreachable.status === 503 && unreachable.body.error === "billing_off" && /hour/.test(unreachable.body.message) && (await api(F, "GET", "/me")).status === 200, "Paddle not answering: 503, the account stays");
  const closed = await api(F, "DELETE", "/me", { confirm: "DELETE" });
  const cancelCall = stub.callsTo("POST", /\/cancel$/).at(-1);
  ok(closed.status === 200 && cancelCall.path.includes(subF.id) && cancelCall.body.effective_from === "immediately", "closed: POST /subscriptions/:id/cancel { effective_from: immediately } first");
  ok((await api(F, "GET", "/me")).status === 401, "the account is gone");
  const left = (await db.query(`SELECT (SELECT count(*)::int FROM "Payment" WHERE id IN ($1, $2) AND "userId" IS NULL) AS payments, (SELECT count(*)::int FROM "Adjustment" WHERE "paymentId" = $1 AND "userId" IS NULL) AS adjustments, (SELECT count(*)::int FROM "PaddleEvent" WHERE "userId" = $3) AS events, (SELECT count(*)::int FROM "PaddleEvent" WHERE payload->'data'->>'id' IN ($1, $2) AND "userId" IS NULL) AS anonymised`, [tF.id, rF.id, devId(F)])).rows[0];
  ok(left.payments === 2 && left.adjustments === 1 && left.events === 0 && left.anonymised >= 2, "its payments, adjustment and events stay with userId null");
  const lateF = await deliver(ev("subscription.canceled", { ...subF, status: "canceled" }, { at: Date.now() + 5000 }));
  ok(lateF.status === "ignored" && /closed their account/.test(lateF.error), "a later event for that customer: ignored");
  ok(await auditOk(), "audit over everyone holds after the close");
  // Paddle says the subscription is already canceled (its own words): the close goes on.
  const M = token("m");
  await api(M, "GET", "/me");
  const coM = await billing.createCheckout(await fresh(M), parseItem("plan:medium"), consent());
  const tM = stub.complete(coM.transactionId);
  await deliver(ev("transaction.completed", tM));
  stub.state.subscriptions.get(tM.subscription_id).status = "canceled";
  const closedM = await api(M, "DELETE", "/me", { confirm: "DELETE" });
  ok(closedM.status === 200 && (await api(M, "GET", "/me")).status === 401, "Paddle answers subscription_already_canceled: treated as cancelled, the account closes");

  // ---- Forged checkouts, a second subscription, full refunds, a chargeback on nothing --------------------------
  console.log("a checkout we did not open grants nothing; a second subscription never replaces the first");
  // From a browser console anyone can open a Paddle checkout naming B (custom_data.userId, or B's email so Paddle
  // reuses B's customer) and pay for a second subscription. Without a CheckoutSession of ours it is parked.
  const uBBefore = await userRow(B);
  const creditsBBefore = await credits(B);
  const forgedSub = stub.makeSubscription({ customerId: tB.customer_id, priceId: PRICE_IDS.medium, customData: { userId: devId(B) } });
  const forged = stub.makeTransaction({ origin: "web", customerId: tB.customer_id, subscriptionId: forgedSub.id, customData: { userId: devId(B) }, lines: [{ price_id: PRICE_IDS.medium }] });
  const forgedRow = await deliver(ev("transaction.completed", forged));
  let uB5 = await userRow(B);
  ok(forgedRow.status === "parked" && /a checkout we did not open/.test(forgedRow.error) && forgedRow.userId === null, `a web transaction with no CheckoutSession: parked ("${forgedRow.error?.slice(0, 48)}…")`);
  ok(
    (await db.query(`SELECT count(*)::int AS n FROM "Payment" WHERE id = $1`, [forged.id])).rows[0].n === 0 && (await credits(B)) === creditsBBefore && uB5.plan === uBBefore.plan && uB5.paddleSubscriptionId === subB.id && uB5.periodEndsAt.getTime() === uBBefore.periodEndsAt.getTime() && uB5.billingFlag === null,
    "B: no Payment, the credits, the plan, the subscription id and the period unchanged",
  );
  const forgedSubRow = await deliver(ev("subscription.created", { ...forgedSub, transaction_id: forged.id }, { at: Date.now() + 1000 }));
  uB5 = await userRow(B);
  ok(forgedSubRow.status === "ignored" && /not the user's/.test(forgedSubRow.error) && uB5.paddleSubscriptionId === subB.id && uB5.billingFlag === "two_subscriptions", "subscription.created for the second subscription: ignored, B keeps subB, flag two_subscriptions for a person");
  const forgedRenewal = stub.makeTransaction({ origin: "subscription_recurring", customerId: tB.customer_id, subscriptionId: forgedSub.id, customData: { userId: devId(B) }, lines: [{ price_id: PRICE_IDS.medium }], billingPeriod: { starts_at: forgedSub.current_billing_period.ends_at, ends_at: monthLater(forgedSub.current_billing_period.ends_at).toISOString() } });
  const forgedRenewalRow = await deliver(ev("transaction.completed", forgedRenewal));
  ok(forgedRenewalRow.status === "parked" && /not the user's/.test(forgedRenewalRow.error) && forgedRenewalRow.userId === devId(B) && (await credits(B)) === creditsBBefore && (await userRow(B)).paddleSubscriptionId === subB.id, "a renewal on the second subscription: parked for B, nothing granted, subB stays");
  const periodB4 = { starts_at: periodB3.ends_at, ends_at: monthLater(periodB3.ends_at).toISOString() };
  const rB4 = stub.makeTransaction({ origin: "subscription_recurring", customerId: tB.customer_id, subscriptionId: subB.id, customData: tB.custom_data, lines: [{ price_id: PRICE_IDS.medium }], billingPeriod: periodB4 });
  const rB4Row = await deliver(ev("transaction.completed", rB4));
  ok(rB4Row.status === "processed" && (await credits(B)) === creditsBBefore + 100 && (await userRow(B)).periodEndsAt.toISOString() === periodB4.ends_at, "B's real renewal still applies: +100, the period moved on");
  ok((await admin("flag", emailOf(B), "clear")).status === 0 && (await userRow(B)).billingFlag === null, "admin flag clear once a person has looked");
  ok(await auditOk(emailOf(B)), "audit holds for B");
  // A Free user: a stranger's subscription naming them attaches nothing; a forged pack checkout grants nothing.
  const J = token("j");
  await api(J, "GET", "/me");
  const strangerSub = stub.makeSubscription({ customerId: "ctm_stranger", priceId: PRICE_IDS.medium, customData: { userId: devId(J) } });
  const strangerRow = await deliver(ev("subscription.created", { ...strangerSub, transaction_id: `txn_stranger_${stamp}` }));
  const uJ = await userRow(J);
  ok(strangerRow.status === "ignored" && /not from a checkout we opened/.test(strangerRow.error) && uJ.paddleSubscriptionId === null && uJ.subscriptionStatus === null, "a stranger's subscription naming a Free user: ignored, nothing attached");
  const forgedPack = stub.makeTransaction({ origin: "web", customerId: null, subscriptionId: null, customData: { userId: devId(J) }, lines: [{ price_id: PRICE_IDS.pack }] });
  const forgedPackRow = await deliver(ev("transaction.completed", forgedPack));
  ok(forgedPackRow.status === "parked" && (await credits(J)) === 20 && (await db.query(`SELECT count(*)::int AS n FROM "Payment" WHERE "userId" = $1`, [devId(J)])).rows[0].n === 0, "a pack checkout forged on Free (no tick box, no plan): parked, 20 credits, no Payment");
  ok((await caught(async () => billing.createCheckout(await fresh(J), parseItem("plan:medium"), consent()))) === null, "J can still open a plan checkout of their own");

  console.log("a full refund (Paddle's, then ours): the credits go, the plan ends, no flag");
  const K = token("k");
  await api(K, "GET", "/me");
  const coK = await billing.createCheckout(await fresh(K), parseItem("plan:medium"), consent());
  const tK = stub.complete(coK.transactionId);
  await deliver(ev("transaction.completed", tK));
  const subK = stub.state.subscriptions.get(tK.subscription_id);
  await deliver(ev("subscription.activated", subK));
  ok((await credits(K)) === 120 && (await userRow(K)).plan === "medium", "K: Medium, 120 credits, nothing used");
  const fullK = { id: `adj_full_${stamp}`, action: "refund", type: "full", status: "approved", transaction_id: tK.id, subscription_id: subK.id, customer_id: tK.customer_id, currency_code: "USD", reason: "withdrawal", items: [{ item_id: tK.details.line_items[0].id, type: "full", amount: null }], totals: { subtotal: "2000", tax: "200", total: "2200", fee: "0", earnings: "-2000", currency_code: "USD" }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const fullKRow = await deliver(ev("adjustment.created", fullK));
  const payK = (await db.query(`SELECT * FROM "Payment" WHERE id = $1`, [tK.id])).rows[0];
  const bK = (await buckets(K, `AND source = 'plan'`))[0];
  const uK = await userRow(K);
  ok(fullKRow.status === "processed" && payK.refundedCents === 2000 && payK.status === "refunded" && bK.remainingTenths === 0 && bK.closedWhy === "refunded" && uK.billingFlag === null, `Paddle refunded the untouched $20 in full: 100 credits removed, Payment refunded, no flag (exactly the unused share) (${fullKRow.error})`);
  ok(uK.plan === "free" && uK.paddleSubscriptionId === subK.id && (await credits(K)) === 20 && (await api(K, "GET", "/me")).body.models.join() === "fast", "the month was given back, so the plan ended: Free (Fast only), the free 20 stay");
  ok((await db.query(`SELECT count(*)::int AS n FROM "BillingAudit" WHERE "userId" = $1 AND action = 'plan_ended' AND details->>'why' = 'refunded'`, [devId(K)])).rows[0].n === 1, "BillingAudit: plan_ended (refunded)");
  // A refund Paddle made itself cancels the subscription too: no renewal buys the plan again next month.
  const cancelsK = await billing.refundCancels(undefined, "admin:billtest");
  const uK2 = await userRow(K);
  ok(
    cancelsK.length === 1 && stub.callsTo("POST", /^\/subscriptions\/[^/]+\/cancel$/).at(-1)?.path === `/subscriptions/${subK.id}/cancel` && stub.state.subscriptions.get(subK.id).status === "canceled" && uK2.subscriptionStatus === "canceled" && uK2.plan === "free" && (await credits(K)) === 20,
    `Paddle's own full refund: the subscription cancelled at Paddle now, K stays on Free with the free 20 (${cancelsK.join(" | ")})`,
  );
  ok(await auditOk(emailOf(K)), "audit holds for K");
  const L = token("l");
  await api(L, "GET", "/me");
  const coL = await billing.createCheckout(await fresh(L), parseItem("plan:medium"), consent());
  const tL = stub.complete(coL.transactionId);
  await deliver(ev("transaction.completed", tL));
  ok((await admin("grant", emailOf(L), "-20", "free gone")).status === 0 && (await credits(L)) === 100, "L: Medium, the free 20 taken away: 100 plan credits, none used");
  const refundL = await admin("refund", emailOf(L), "last", "whole month back");
  const postL = stub.callsTo("POST", /^\/adjustments$/).at(-1);
  ok(refundL.status === 0 && /\$20\.00 before tax for 100 unused credits/.test(refundL.stdout) && postL?.body.type === "full" && postL.body.items === undefined && postL.body.tax_mode === undefined && postL.body.transaction_id === tL.id, `admin refund of an untouched $20: POST /adjustments type full, no items, no amount (not a partial equal to the total) (${JSON.stringify(postL?.body)})`);
  const refundRowL = (await db.query(`SELECT * FROM "Refund" WHERE "userId" = $1`, [devId(L)])).rows[0];
  stub.settleAdjustment(refundRowL.adjustmentId, "approved");
  await deliver(ev("adjustment.updated", stub.state.adjustments.get(refundRowL.adjustmentId)));
  const payL = (await db.query(`SELECT * FROM "Payment" WHERE id = $1`, [tL.id])).rows[0];
  const uL = await userRow(L);
  ok((await db.query(`SELECT status FROM "Refund" WHERE id = $1`, [refundRowL.id])).rows[0].status === "approved" && payL.refundedCents === 2000 && payL.status === "refunded" && uL.plan === "free" && uL.billingFlag === null && (await credits(L)) === 0, "approved: Payment refunded in full, the plan ended (Free), no flag, 0 credits to spend");
  ok((await history(L, 1))[0].what === "Refunded" && (await history(L, 1))[0].amount === -100, 'history: "Refunded" -100');
  const cancelsL = await billing.refundCancels(undefined, "admin:billtest");
  ok(cancelsL.length === 1 && stub.callsTo("POST", /^\/subscriptions\/[^/]+\/cancel$/).at(-1)?.body.effective_from === "immediately" && (await userRow(L)).subscriptionStatus === "canceled", `admin refund of the month: the subscription cancelled at Paddle now (${cancelsL.join(" | ")})`);
  ok(await auditOk(emailOf(L)), "audit holds for L");

  console.log("the refund rule (14 days, only the unused share) for a plan and a pack; a pack's refund keeps the plan, an upgrade's ends it with the period");
  // Most credits used: only the unused share comes back, and the subscription ends now.
  const O = token("o");
  await api(O, "GET", "/me");
  const coO = await billing.createCheckout(await fresh(O), parseItem("plan:medium"), consent());
  const tO = stub.complete(coO.transactionId);
  await deliver(ev("transaction.completed", tO));
  ok((await admin("grant", emailOf(O), "-110", "used the free 20 and 90 plan credits")).status === 0 && (await credits(O)) === 10, "O: Medium, 110 of 120 credits used: 10 plan credits left");
  const refundO = await admin("refund", emailOf(O), "last", "most used");
  const postO = stub.callsTo("POST", /^\/adjustments$/).at(-1);
  ok(refundO.status === 0 && /\$2\.00 before tax for 10 unused credits/.test(refundO.stdout) && postO?.body.type === "partial" && postO.body.items[0].amount === "200", `90 of 100 plan credits used: only the unused share, $20 × 10/100 = $2.00, partial (${JSON.stringify(postO?.body.items)})`);
  const refundRowO = (await db.query(`SELECT * FROM "Refund" WHERE "userId" = $1`, [devId(O)])).rows[0];
  stub.settleAdjustment(refundRowO.adjustmentId, "approved");
  await deliver(ev("adjustment.updated", stub.state.adjustments.get(refundRowO.adjustmentId)));
  const cancelsO = await billing.refundCancels(undefined, "admin:billtest");
  const payO = (await db.query(`SELECT * FROM "Payment" WHERE id = $1`, [tO.id])).rows[0];
  const uO = await userRow(O);
  ok(payO.refundedCents === 200 && payO.status === "partly_refunded" && cancelsO.length === 1 && uO.subscriptionStatus === "canceled" && uO.plan === "free" && (await credits(O)) === 0, `approved: $2.00 back, the subscription cancelled now, Free with nothing left (no second free 20 this month) (${await credits(O)})`);
  ok(await auditOk(emailOf(O)), "audit holds for O");
  // A pack mostly used: the unused share, the plan and its subscription untouched; past 14 days: refused.
  const P = token("p");
  await api(P, "GET", "/me");
  const coP = await billing.createCheckout(await fresh(P), parseItem("plan:medium"), consent());
  const tP = stub.complete(coP.transactionId);
  await deliver(ev("transaction.completed", tP));
  const coPPack = await billing.createCheckout(await fresh(P), parseItem("pack"), consent());
  const tPPack = stub.complete(coPPack.transactionId);
  await deliver(ev("transaction.completed", tPPack));
  ok((await admin("grant", emailOf(P), "-150", "used the free 20, the plan's 100, 30 of the pack")).status === 0 && (await credits(P)) === 10 && (await buckets(P, `AND source = 'pack'`))[0].remainingTenths === 100, "P: Medium and a pack, 150 of 160 used (the pack last): 10 pack credits left");
  const refundP = await admin("refund", emailOf(P), tPPack.id, "pack mostly used");
  ok(refundP.status === 0 && /\$2\.50 before tax for 10 unused credits/.test(refundP.stdout) && stub.callsTo("POST", /^\/adjustments$/).at(-1)?.body.items[0].amount === "250", "a pack with 30 of 40 used: only the unused share, $10 × 10/40 = $2.50");
  const refundRowP = (await db.query(`SELECT * FROM "Refund" WHERE "userId" = $1`, [devId(P)])).rows[0];
  stub.settleAdjustment(refundRowP.adjustmentId, "approved");
  await deliver(ev("adjustment.updated", stub.state.adjustments.get(refundRowP.adjustmentId)));
  const cancelCallsP = stub.callsTo("POST", /^\/subscriptions\/[^/]+\/cancel$/).length;
  const cancelsP = await billing.refundCancels(undefined, "admin:billtest");
  const uP = await userRow(P);
  ok(
    cancelsP.length === 0 && stub.callsTo("POST", /^\/subscriptions\/[^/]+\/cancel$/).length === cancelCallsP && uP.plan === "medium" && uP.subscriptionStatus === "active" && (await db.query(`SELECT "cancelSubscription" FROM "Adjustment" WHERE id = $1`, [refundRowP.adjustmentId])).rows[0].cancelSubscription === null,
    "a pack's refund takes the pack's credits only: the plan and its subscription stay",
  );
  ok(await auditOk(emailOf(P)), "audit holds for P");
  await db.query(`UPDATE "Payment" SET "paidAt" = now() - interval '15 days', "refundableUntil" = now() - interval '1 day' WHERE id = $1`, [tP.id]);
  const lateP = await admin("refund", emailOf(P), tP.id);
  ok(lateP.status === 1 && /the 14 days are over/.test(lateP.stderr), "a payment older than 14 days: the refund is refused");
  // An upgrade's refund: its credits go, and the subscription ends with the period (the month paid for stays).
  const Q = token("q");
  await api(Q, "GET", "/me");
  const coQ = await billing.createCheckout(await fresh(Q), parseItem("plan:medium"), consent());
  const tQ = stub.complete(coQ.transactionId);
  await deliver(ev("transaction.completed", tQ));
  const subQ = stub.state.subscriptions.get(tQ.subscription_id);
  await billing.applyPlanChange(await fresh(Q), "high");
  const upQ = stub.makeTransaction({ origin: "subscription_update", customerId: tQ.customer_id, subscriptionId: subQ.id, customData: tQ.custom_data, lines: [{ price_id: PRICE_IDS.high, rate: 0.5 }, { price_id: PRICE_IDS.medium, rate: 0.5, negative: true }] });
  await deliver(ev("transaction.completed", upQ));
  ok((await userRow(Q)).plan === "high" && (await buckets(Q, `AND source = 'upgrade'`))[0]?.remainingTenths === 875, "Q: Medium, then High: 87.5 upgrade credits");
  const refundQ = await admin("refund", emailOf(Q), upQ.id, "no High after all");
  const refundRowQ = (await db.query(`SELECT * FROM "Refund" WHERE "userId" = $1`, [devId(Q)])).rows[0];
  stub.settleAdjustment(refundRowQ.adjustmentId, "approved");
  await deliver(ev("adjustment.updated", stub.state.adjustments.get(refundRowQ.adjustmentId)));
  const cancelsQ = await billing.refundCancels(undefined, "admin:billtest");
  const uQ = await userRow(Q);
  ok(
    refundQ.status === 0 && cancelsQ.length === 1 && stub.callsTo("POST", /^\/subscriptions\/[^/]+\/cancel$/).at(-1)?.body.effective_from === "next_billing_period" && uQ.subscriptionStatus === "active" && uQ.cancelsAt?.toISOString() === subQ.current_billing_period.ends_at && (await buckets(Q, `AND source = 'upgrade'`))[0].remainingTenths === 0 && (await buckets(Q, `AND source = 'plan' AND "closedAt" IS NULL`)).length === 1,
    `an upgrade's refund: its 87.5 credits gone, the subscription ends at the period's end, the month's plan credits stay (${cancelsQ.join(" | ")})`,
  );
  ok(await auditOk(emailOf(Q)), "audit holds for Q");

  console.log("a chargeback on a payment whose credits are all used: no 'Removed 0' row");
  const cbE = { id: `adj_cbE_${stamp}`, action: "chargeback", type: "full", status: "approved", transaction_id: tE.id, customer_id: tE.customer_id, currency_code: "USD", items: [{ item_id: tE.details.line_items[0].id, type: "full", amount: null }], totals: { subtotal: "2000", tax: "200", total: "2200", fee: "0", earnings: "-2200", currency_code: "USD" }, payout_totals: { chargeback_fee: "2000" }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const cbERow = await deliver(ev("adjustment.created", cbE));
  const payE = (await db.query(`SELECT status FROM "Payment" WHERE id = $1`, [tE.id])).rows[0];
  ok(cbERow.status === "processed" && /0 credits removed/.test(cbERow.error) && payE.status === "charged_back" && (await userRow(E)).billingFlag === "chargeback", "chargeback: Payment charged_back, the hold, 0 credits removed");
  ok((await db.query(`SELECT count(*)::int AS n FROM "CreditEntry" WHERE "paddleAdjustmentId" = $1`, [cbE.id])).rows[0].n === 0 && (await history(E, 10)).every((h) => h.amount !== 0), "no reversal row of 0 in the history");
  ok((await buckets(E, `AND source = 'plan'`))[0].closedWhy === "charged_back", "the empty bucket is closed (charged_back)");
  ok(await auditOk(emailOf(E)), "audit holds for E");

  // ---- The billing endpoints (part 3) ------------------------------------------------------------------------
  console.log("the billing endpoints: info, checkout → status → verify, plan change, cancel / keep, portal, billing_off");
  const I = token("i");
  const meI = await api(I, "GET", "/me");
  ok(typeof meI.body.billing.freeRefillAt === "string" && daysBetween(meI.body.billing.freeRefillAt, monthLater(new Date())) < 1, "Me.billing.freeRefillAt: the next free 20 arrive in a month");
  ok((await api(null, "GET", "/billing")).status === 401, "GET /billing without a token: 401");
  const infoFree = await api(I, "GET", "/billing");
  ok(
    infoFree.status === 200 && infoFree.body.mode === "sandbox" && infoFree.body.plan === "free" && infoFree.body.subscription === null && infoFree.body.canBuyPack === false && infoFree.body.payments.length === 0 && infoFree.body.consent === null && infoFree.body.hold === null,
    `GET /billing on Free: sandbox, no subscription, no pack, no payments, no consent (${JSON.stringify(infoFree.body).slice(0, 160)})`,
  );
  const partsFree = infoFree.body.credits.parts;
  ok(partsFree.length === 1 && partsFree[0].source === "free" && partsFree[0].left === 20 && daysBetween(partsFree[0].expiresAt, monthLater(new Date())) < 1, "credits.parts: the free 20, ending in a month");
  const packOnFree = await api(I, "POST", "/billing/checkout", { item: "pack", consentVersion: "v1", acceptedTerms: true });
  ok(packOnFree.status === 403 && packOnFree.body.error === "plan_required", "POST /billing/checkout pack on Free: 403 plan_required");
  ok((await api(I, "POST", "/billing/checkout", { item: "plan:medium", consentVersion: "v0", acceptedTerms: true })).status === 400, "a stale wording version: 400");
  ok((await api(I, "POST", "/billing/checkout", { item: "plan:medium", consentVersion: "v1" })).status === 400, "acceptedTerms missing: 400");
  ok((await api(I, "POST", "/billing/checkout", { item: "plan:free", consentVersion: "v1", acceptedTerms: true })).status === 400 && (await api(I, "POST", "/billing/checkout", { consentVersion: "v1", acceptedTerms: true })).status === 400, "plan:free and no item: 400");
  const coI = await api(I, "POST", "/billing/checkout", { item: "plan:medium", consentVersion: "v1", acceptedTerms: true });
  ok(coI.status === 201 && /^txn_/.test(coI.body.transactionId ?? ""), `POST /billing/checkout plan:medium: 201 { transactionId } (${coI.body.transactionId})`);
  const sessionI = (await db.query(`SELECT * FROM "CheckoutSession" WHERE id = $1`, [coI.body.transactionId])).rows[0];
  ok(sessionI?.consentVersion === "v1" && sessionI.consentAt !== null && sessionI.termsAcceptedAt !== null && sessionI.item === "plan:medium", "the CheckoutSession stores the wording version, the time and the item");
  ok((await api(I, "GET", `/billing/checkout/${coI.body.transactionId}`)).body.status === "open", "GET /billing/checkout/:id before paying: open");
  ok((await api(I, "POST", `/billing/checkout/${coI.body.transactionId}/verify`)).body.status === "open", "POST …/verify before paying: open");
  ok((await api(A, "GET", `/billing/checkout/${coI.body.transactionId}`)).status === 404, "another user's checkout: 404");
  const tI = stub.complete(coI.body.transactionId);
  const vI = await api(I, "POST", `/billing/checkout/${coI.body.transactionId}/verify`);
  ok(vI.status === 200 && vI.body.status === "completed" && (await api(I, "GET", `/billing/checkout/${coI.body.transactionId}`)).body.status === "completed", "verify after paying: completed (the pull applied the payment)");
  const subI = stub.state.subscriptions.get(tI.subscription_id);
  await deliver(ev("subscription.activated", subI));
  const infoPaid = await api(I, "GET", "/billing");
  const sI = infoPaid.body.subscription;
  ok(
    infoPaid.body.plan === "medium" && sI?.status === "active" && sI.renewsAt === subI.next_billed_at && sI.endsAt === subI.current_billing_period.ends_at && sI.cancelsAt === null && sI.pendingPlan === null && sI.paymentFailedAt === null && sI.paymentMethod === "Visa ending 4242" && sI.lastPlan === "medium",
    `GET /billing on Medium: the subscription (${JSON.stringify(sI)})`,
  );
  ok(infoPaid.body.canBuyPack === true && infoPaid.body.credits.parts.map((p) => `${p.source}:${p.left}`).join("|") === "free:20|plan:100", "canBuyPack; parts: free 20, then plan 100");
  const payI = infoPaid.body.payments[0];
  ok(
    infoPaid.body.payments.length === 1 && payI.id === tI.id && payI.what === "Medium plan" && payI.amountUsd === 20 && payI.taxUsd === 2 && payI.invoiceNumber === tI.invoice_number && payI.status === "paid" && payI.refundedUsd === 0 && payI.refundPendingUsd === null && daysBetween(payI.refundableUntil, Date.now() + 14 * 86_400_000) < 0.01,
    `payments: "Medium plan", $20 + $2 tax, paid, refundable for 14 days (${JSON.stringify(payI)})`,
  );
  ok(infoPaid.body.consent?.version === "v1" && typeof infoPaid.body.consent.at === "string", "the consent record: wording v1 and when");
  const secondPlan = await api(I, "POST", "/billing/checkout", { item: "plan:high", consentVersion: "v1", acceptedTerms: true });
  ok(secondPlan.status === 409 && secondPlan.body.error === "billing_busy", "a plan while subscribed: 409 billing_busy (change it instead)");
  // Plan change: preview, apply, the credits with the upgrade's transaction; then down, and undo.
  ok((await api(I, "GET", "/billing/plan-change?plan=medium")).status === 400 && (await api(I, "GET", "/billing/plan-change?plan=gold")).status === 400 && (await api(I, "GET", "/billing/plan-change")).status === 400, "plan-change preview: the plan you're on, nonsense, no plan: 400");
  const pvI = await api(I, "GET", "/billing/plan-change?plan=high");
  ok(pvI.status === 200 && pvI.body.direction === "up" && pvI.body.chargeNowUsd === 16.5 && pvI.body.creditsNow === 87.5 && pvI.body.nextRenewalUsd === 50 && typeof pvI.body.effectiveAt === "string" && !("subscriptionId" in pvI.body), `GET /billing/plan-change?plan=high: up, $16.50 now, 87.5 credits, then $50 (${JSON.stringify(pvI.body)})`);
  ok(pvI.body.taxNowUsd === 1.5 || pvI.body.taxNowUsd === undefined, `the preview's taxNowUsd ($1.50 of the $16.50) once part 3's controller passes it on (${pvI.body.taxNowUsd})`);
  const upI = await api(I, "POST", "/billing/plan-change", { plan: "high" });
  ok(upI.status === 200 && upI.body.direction === "up" && stub.callsTo("PATCH", /^\/subscriptions\/sub_[^/]+$/).at(-1)?.body.items[0].price_id === PRICE_IDS.high, "POST /billing/plan-change { plan: high }: 200, PATCHed at Paddle");
  ok((await api(I, "POST", "/billing/plan-change", { plan: "free" })).status === 400 && (await api(I, "POST", "/billing/plan-change", {})).status === 400, "POST /billing/plan-change free or nothing: 400");
  const upTxnI = stub.makeTransaction({ origin: "subscription_update", customerId: tI.customer_id, subscriptionId: subI.id, customData: tI.custom_data, lines: [{ price_id: PRICE_IDS.high, rate: 0.5 }, { price_id: PRICE_IDS.medium, rate: 0.5, negative: true }] });
  await deliver(ev("transaction.completed", upTxnI));
  const infoHigh = await api(I, "GET", "/billing");
  ok(
    infoHigh.body.plan === "high" && infoHigh.body.payments[0].what === "Upgrade to High" && infoHigh.body.payments[0].amountUsd === 15 && infoHigh.body.subscription.lastPlan === "high" && infoHigh.body.credits.parts.map((p) => `${p.source}:${p.left}`).join("|") === "free:20|plan:100|upgrade:87.5",
    "after the upgrade's transaction: High, 'Upgrade to High' $15 first in the list, parts free | plan | upgrade",
  );
  const downI = await api(I, "GET", "/billing/plan-change?plan=medium");
  ok(downI.body.direction === "down" && downI.body.chargeNowUsd === 0 && downI.body.creditsNow === 0 && downI.body.nextRenewalUsd === 20 && downI.body.effectiveAt === new Date(subI.next_billed_at).toISOString(), "preview High → Medium: down, nothing now, $20 from the renewal date");
  ok((await api(I, "DELETE", "/billing/plan-change")).status === 400, "DELETE /billing/plan-change with nothing waiting: 400");
  await api(I, "POST", "/billing/plan-change", { plan: "medium" });
  ok((await api(I, "GET", "/billing")).body.subscription.pendingPlan === "medium" && (await api(I, "GET", "/me")).body.plan === "high", "the downgrade waits: pendingPlan medium, still High");
  const busyI = await api(I, "POST", "/billing/plan-change", { plan: "ultra" });
  ok(busyI.status === 409 && busyI.body.error === "billing_busy" && /Undo your change to Medium/.test(busyI.body.message), "an upgrade while a downgrade waits: 409 'Undo your change to Medium first'");
  const undoI = await api(I, "DELETE", "/billing/plan-change");
  ok(undoI.status === 200 && undoI.body.ok === true && (await api(I, "GET", "/billing")).body.subscription.pendingPlan === null && stub.callsTo("PATCH", /^\/subscriptions\/sub_[^/]+$/).at(-1)?.body.items[0].price_id === PRICE_IDS.high, "DELETE /billing/plan-change: PATCHed back to High, nothing waiting");
  // Cancel and keep.
  const cancelI = await api(I, "POST", "/billing/cancel");
  ok(cancelI.status === 200 && cancelI.body.cancelsAt === subI.current_billing_period.ends_at, "POST /billing/cancel: cancelsAt = the period's end");
  const infoCanceling = await api(I, "GET", "/billing");
  ok(infoCanceling.body.subscription.cancelsAt === subI.current_billing_period.ends_at && infoCanceling.body.subscription.renewsAt === null && infoCanceling.body.subscription.status === "active" && infoCanceling.body.plan === "high", "GET /billing while a cancel waits: cancelsAt set, no renewal date, still High");
  const cancelsBefore = stub.callsTo("POST", /\/cancel$/).length;
  ok((await api(I, "POST", "/billing/cancel")).body.cancelsAt === subI.current_billing_period.ends_at && stub.callsTo("POST", /\/cancel$/).length === cancelsBefore, "POST /billing/cancel again: the same date, nothing new at Paddle");
  const keepI = await api(I, "DELETE", "/billing/cancel");
  const infoKept = await api(I, "GET", "/billing");
  ok(keepI.status === 200 && keepI.body.ok === true && infoKept.body.subscription.cancelsAt === null && infoKept.body.subscription.renewsAt === subI.current_billing_period.ends_at, "DELETE /billing/cancel: the cancel is gone, the renewal date is back");
  ok((await api(I, "DELETE", "/billing/cancel")).status === 200, "DELETE /billing/cancel with nothing to keep: 200 (nothing to do)");
  // A pack through the endpoint; the portal; Paddle not answering.
  const coPackI = await api(I, "POST", "/billing/checkout", { item: "pack", consentVersion: "v1", acceptedTerms: true });
  ok(coPackI.status === 201 && stub.callsTo("POST", /^\/transactions$/).at(-1)?.body.items[0].price_id === PRICE_IDS.pack, "POST /billing/checkout pack on a paid plan: 201 with the pack price");
  const portalI = await api(I, "POST", "/billing/portal");
  ok(portalI.status === 200 && /overview/.test(portalI.body.overview) && /cancel/.test(portalI.body.cancel) && /update-payment-method/.test(portalI.body.updatePaymentMethod), "POST /billing/portal: fresh links");
  stub.state.fail.down = true;
  const downInfo = await api(I, "GET", "/billing");
  const downPortal = await api(I, "POST", "/billing/portal");
  stub.state.fail.down = false;
  ok(downInfo.status === 200 && downPortal.status === 503 && downPortal.body.error === "billing_off", "Paddle not answering: GET /billing still answers (our rows), POST /billing/portal 503 billing_off");
  ok(await auditOk(emailOf(I)), "audit holds after the endpoint flow");
  const expI = await api(I, "GET", "/me/export");
  ok(
    expI.status === 200 && expI.body.payments?.length === 2 && expI.body.payments[1].id === tI.id && expI.body.payments[1].what === "Medium plan" && expI.body.payments[1].consentVersion === "v1" && typeof expI.body.payments[1].consentAt === "string" && expI.body.payments[0].what === "Upgrade to High",
    "GET /me/export lists the payments, each with the tick box's wording version and time",
  );
  ok(expI.body.billing?.subscriptionStatus === "active" && expI.body.billing.paymentMethod === "Visa ending 4242" && expI.body.notes.some((n) => /payments/.test(n)), "and the subscription as our rows have it, with a note on where the invoices are");
  // No keys at all: every billing route is 503 billing_off, and the rest of the API works.
  const offApi = await spawnApi(3026, { PADDLE_ENV: "", PADDLE_API_KEY: "" });
  ok(offApi.health?.billing?.mode === "off", "an API without Paddle keys: billing off");
  const offHeaders = { Authorization: `Bearer ${I}`, "content-type": "application/json" };
  const offInfo = await fetch(`${offApi.url}/billing`, { headers: offHeaders });
  ok(offInfo.status === 503 && (await offInfo.json()).error === "billing_off", "GET /billing with billing off: 503 billing_off");
  const offCo = await fetch(`${offApi.url}/billing/checkout`, { method: "POST", headers: offHeaders, body: JSON.stringify({ item: "pack", consentVersion: "v1", acceptedTerms: true }) });
  ok(offCo.status === 503 && (await offCo.json()).error === "billing_off", "POST /billing/checkout with billing off: 503 billing_off");
  const offMe = await fetch(`${offApi.url}/me`, { headers: offHeaders }).then((r) => r.json());
  ok(offMe.billing?.mode === "off" && offMe.plan === "high", "GET /me still works: Me.billing.mode off, the plan as it is");
  offApi.kill();

  // ---- Paddle's clock ahead of ours (this PC ran 32 s slow in the sandbox, 2026-10-25) ------------------------
  console.log("Paddle's clock ahead of ours: a change applied from Paddle's answer is ordered by Paddle's time");
  const N = token("n");
  const coN = await api(N, "POST", "/billing/checkout", { item: "plan:medium", consentVersion: "v1", acceptedTerms: true });
  const tN = stub.complete(coN.body.transactionId);
  await api(N, "POST", `/billing/checkout/${coN.body.transactionId}/verify`);
  stub.state.clockAheadMs = 30_000;
  const subN = stub.state.subscriptions.get(tN.subscription_id);
  await deliver(ev("subscription.updated", { ...subN, updated_at: new Date(Date.now() + 30_000).toISOString() }, { at: Date.now() + 30_000 }));
  const cancelN = await api(N, "POST", "/billing/cancel");
  stub.state.clockAheadMs = 0;
  ok(cancelN.status === 200 && cancelN.body.cancelsAt === subN.current_billing_period.ends_at, `a cancel right after a webhook stamped 30 s ahead: applied from Paddle's answer at once, not skipped as older (${JSON.stringify(cancelN.body)})`);

  // ---- The start-up guards -----------------------------------------------------------------------------------
  console.log("start-up: a catalog mismatch refuses to start; Paddle down means 503 until it answers");
  stub.state.fail.priceMismatch = { [PRICE_IDS.high]: { unit_price: { amount: "4500", currency_code: "USD" } } };
  const bad = await spawnApi(3025);
  stub.state.fail.priceMismatch = null;
  ok(bad.exited !== null && bad.exited !== 0 && /does not match credits\.ts/.test(bad.output()) && /high .*amount 4500 \(want 5000\)/.test(bad.output()), `a price that doesn't match credits.ts: the API refuses to start and says which (exit ${bad.exited})`);
  bad.kill();
  // A key Paddle refuses (403: expired, revoked, a permission missing) must not take the API down.
  stub.state.fail.unauthorized = true;
  const refusedKey = await spawnApi(3027);
  stub.state.fail.unauthorized = false;
  ok(refusedKey.exited === null && refusedKey.health?.billing?.mode === "sandbox" && refusedKey.health.billing.ready === false && /key was refused \(403 forbidden\)/.test(refusedKey.health.billing.problem ?? ""), `a key Paddle refuses: the API starts, GET /health says why (${refusedKey.health?.billing?.problem})`);
  const refusedHeaders = { Authorization: `Bearer ${I}` };
  const refusedPortal = await fetch(`${refusedKey.url}/billing/portal`, { method: "POST", headers: refusedHeaders });
  ok(refusedPortal.status === 503 && (await refusedPortal.json()).error === "billing_off" && (await fetch(`${refusedKey.url}/billing`, { headers: refusedHeaders })).status === 200 && (await fetch(`${refusedKey.url}/me`, { headers: refusedHeaders })).status === 200, "billing actions 503 billing_off, GET /billing (our rows) and GET /me still answer");
  ok(/ERROR.*catalog check: the key was refused/.test(refusedKey.output()), "the log says so loudly (ERROR)");
  refusedKey.kill();
  // A simulated event (ntfsimevt_…) on the live account is ignored; on the sandbox it is an event like any other.
  const liveApi = await spawnApi(3028, { PADDLE_ENV: "live", PADDLE_API_KEY: "pdl_live_apikey_test00000000000000000000000_test0000000000000000000_000" });
  ok(liveApi.exited === null && liveApi.health?.billing?.mode === "live" && liveApi.health.billing.ready === true, "an API in live mode against the stub (a live key; PADDLE_API_URL is allowed off production)");
  const sim = ev("transaction.completed", { ...tB, custom_data: { userId: devId(B) } }, { id: `ntfsimevt_bill${stamp}_live` });
  ok((await hook(sim, { base: liveApi.url })).status === 200, "a ntfsimevt_ event on live: 200 (Paddle must not retry it)");
  await sleep(500);
  const simRow = await eventRow(sim.event_id);
  ok(simRow?.status === "ignored" && /simulated event on the live account/.test(simRow.error ?? "") && simRow.payload.data === undefined, "stored as ignored ('a simulated event on the live account'), the payload dropped, nothing applied");
  const simSandbox = await deliver(ev("transaction.payment_failed", { id: "txn_sim", custom_data: { userId: "dev-nobody" } }, { id: `ntfsimevt_bill${stamp}_sandbox` }));
  ok(simSandbox.status === "parked", "the same id prefix on the sandbox API: handled like any event (the simulator is for the sandbox)");
  liveApi.kill();
  stub.state.fail.down = true;
  const p2 = new PaddleService();
  await p2.check(true);
  ok(p2.ready === false && (await caught(async () => p2.require()))?.status === 503 && (await caught(async () => p2.require()))?.code === "billing_off", "Paddle answering 503: not ready, billing calls answer 503 billing_off");
  stub.state.fail.down = false;
  await sleep(10_500);
  ok((await caught(async () => p2.require())) === null && p2.ready === true, "once Paddle answers again, the next billing call gets through (recheck after 10 s)");
  const keyEnv = spawnSync(process.execPath, ["-e", "import('./dist/env.js').then(m => { m.assertPaddleConfig(); console.log('started') }).catch(e => { console.error(e.message); process.exit(1) })"], { cwd: here, encoding: "utf8", env: { ...process.env, PADDLE_ENV: "live" } });
  ok(keyEnv.status === 1 && /sandbox key but PADDLE_ENV is live/.test(keyEnv.stderr), "a sandbox key with PADDLE_ENV=live: refused");
  const prodUrl = spawnSync(process.execPath, ["-e", "import('./dist/env.js').then(m => { m.assertPaddleConfig(); console.log('started') }).catch(e => { console.error(e.message); process.exit(1) })"], { cwd: here, encoding: "utf8", env: { ...process.env, NODE_ENV: "production" } });
  ok(prodUrl.status === 1 && /PADDLE_API_URL is for tests only/.test(prodUrl.stderr), "PADDLE_API_URL in production: refused");
  const off = spawnSync(process.execPath, ["-e", "import('./dist/env.js').then(m => { m.assertPaddleConfig(); console.log(m.paddleMode()) })"], { cwd: here, encoding: "utf8", env: { ...process.env, PADDLE_ENV: "", PADDLE_API_KEY: "" } });
  ok(off.status === 0 && off.stdout.trim() === "off", "no key: mode off");
}

async function cleanup() {
  apiProc?.kill();
  const ids = [...stub.state.transactions.keys()];
  // What this run's Free builds added to today's FreeSpend comes out again before their rows go with the users
  // (the dev database's kill switch must not trip on tests).
  // The day in SQL: Prisma writes UTC into timestamp(3) columns, while pg would send a JS Date in local time.
  const utcToday = `date_trunc('day', now() AT TIME ZONE 'UTC')`;
  const spent = await db.query(`SELECT coalesce(sum(m."costUsd"), 0)::float AS usd FROM "Message" m JOIN "Project" p ON p.id = m."projectId" WHERE p."ownerId" LIKE $1 AND m.plan = 'free' AND m."createdAt" >= ${utcToday}`, [`dev-bill-${stamp}-%`]);
  if (spent.rows[0].usd > 0) await db.query(`UPDATE "FreeSpend" SET usd = greatest(0, usd - $1) WHERE day = ${utcToday}`, [spent.rows[0].usd]);
  await db.query(`DELETE FROM "User" WHERE id LIKE $1`, [`dev-bill-${stamp}-%`]);
  await db.query(`DELETE FROM "ClosedAccount" WHERE id LIKE $1`, [`dev-bill-${stamp}-%`]);
  await db.query(`DELETE FROM "Payment" WHERE id = ANY($1::text[]) OR id LIKE $2`, [ids, `txn_fail_${stamp}%`]);
  await db.query(`DELETE FROM "PaddleEvent" WHERE id LIKE $1 OR id LIKE $2`, [`evt_bill${stamp}%`, `ntfsimevt_bill${stamp}%`]);
  await db.query(`DELETE FROM "BillingAudit" WHERE "userId" LIKE $1 OR ("userId" IS NULL AND at >= $2) OR actor LIKE $3`, [`dev-bill-${stamp}-%`, startedAt, `webhook:evt_bill${stamp}%`]);
  await db.end();
  await prisma.$disconnect();
  await stub.close();
  const { rmSync, existsSync, readdirSync } = await import("node:fs");
  const DATA = resolve(process.env.DATA_DIR || join(root, "data"));
  const BUILDS = resolve(process.env.GAMES_BUILDS_DIR || join(root, "apps/games/builds"));
  for (const id of projects.filter(Boolean)) {
    rmSync(join(DATA, "projects", id), { recursive: true, force: true });
    if (existsSync(BUILDS)) for (const b of readdirSync(BUILDS)) if (b.startsWith(`${id}-v`)) rmSync(join(BUILDS, b), { recursive: true, force: true });
    if (existsSync(join(DATA, "logs"))) for (const f of readdirSync(join(DATA, "logs"))) if (f.startsWith(id)) rmSync(join(DATA, "logs", f), { force: true });
  }
  console.log(`cleaned up: ${ids.length} payments, ${projects.length} games`);
}

try {
  await main();
} catch (e) {
  failures++;
  console.error("  FAIL", e);
  if (apiProc?.output) console.error(apiProc.output().slice(-3000));
} finally {
  await cleanup();
}
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
