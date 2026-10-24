// A stand-in for Paddle's API (docs/payments-design.md §12): every endpoint the API calls (§5's table),
// with Paddle's shapes, recording each call, and switches for what can go wrong: a 409 on
// POST /customers, a timeout on any route, a declined card on a plan change, the 30-minute lock on a
// cancel, a catalog that doesn't match. The billing test runs it in-process; on its own it prints its
// address so a hand-started API can be pointed at it:
//   node test/paddle-stub.mjs      (PADDLE_API_URL=http://127.0.0.1:<port>)
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const id = (prefix) => `${prefix}_${randomBytes(8).toString("hex")}`;
const iso = (d = new Date()) => new Date(d).toISOString();
const monthLater = (d) => {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + 1);
  return x;
};

/** The five prices as credits.ts expects them; the test passes the same ids as PADDLE_PRICE_*. */
export const PRICE_IDS = { medium: "pri_test_medium", high: "pri_test_high", ultra: "pri_test_ultra", ultraplus: "pri_test_ultraplus", pack: "pri_test_pack" };
const PLAN_OF_PRICE = Object.fromEntries(Object.entries(PRICE_IDS).map(([k, v]) => [v, k]));
const CENTS = { medium: 2000, high: 5000, ultra: 10000, ultraplus: 20000, pack: 1000 };
const CREDITS = { medium: 100, high: 275, ultra: 600, ultraplus: 1300, pack: 40 };

export function makePrice(item, overrides = {}) {
  const plan = item !== "pack";
  return {
    id: PRICE_IDS[item],
    product_id: `pro_test_${item}`,
    description: `${item} price`,
    name: item,
    status: "active",
    unit_price: { amount: String(CENTS[item]), currency_code: "USD" },
    billing_cycle: plan ? { interval: "month", frequency: 1 } : null,
    tax_mode: "external",
    quantity: { minimum: 1, maximum: plan ? 1 : 10 },
    custom_data: plan ? { plan: item, credits: CREDITS[item] } : { pack: true, credits: CREDITS.pack },
    ...overrides,
  };
}

export function startStub({ port = 0 } = {}) {
  const state = {
    calls: [],
    prices: Object.fromEntries(Object.keys(PRICE_IDS).map((k) => [PRICE_IDS[k], makePrice(k)])),
    products: [],
    customers: new Map(), // id -> customer
    transactions: new Map(),
    subscriptions: new Map(),
    adjustments: new Map(),
    // How far Paddle's clock runs ahead of ours (the test flips it): a changed subscription's updated_at.
    clockAheadMs: 0,
    // Switches (the test flips them): a timeout on routes matching this regexp; 409 on POST /customers;
    // a declined card on PATCH /subscriptions/:id; the 30-minute lock on cancel; a cancel refused with
    // this error code (one with "cancel" in it, which is not "already canceled"); the key refused (403).
    fail: { timeout: null, down: false, customers409: false, decline: false, lock30: false, cancelCode: null, unauthorized: false, priceMismatch: null },
    log: false,
  };

  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const ok = (res, data, meta = {}) => json(res, 200, { data, meta: { request_id: id("req"), ...meta } });
  const created = (res, data) => json(res, 201, { data, meta: { request_id: id("req") } });
  const error = (res, status, code, detail) => json(res, status, { error: { type: status >= 500 ? "api_error" : "request_error", code, detail }, meta: { request_id: id("req") } });
  const list = (res, items) => ok(res, items, { pagination: { per_page: 50, next: null, has_more: false, estimated_total: items.length } });

  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const url = new URL(req.url, "http://stub");
      const call = { method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : null, auth: req.headers.authorization ?? null, version: req.headers["paddle-version"] ?? null };
      state.calls.push(call);
      if (state.log) console.log(`  stub ${call.method} ${call.path}`);
      const route = `${req.method} ${url.pathname}`;
      if (state.fail.timeout && state.fail.timeout.test(route)) return; // never answers: the client times out
      if (state.fail.down) return error(res, 503, "service_unavailable", "Paddle is down (stub)");
      if (state.fail.unauthorized || !/^Bearer pdl_(sdbx|live)_apikey_/.test(call.auth ?? "")) return error(res, 403, "forbidden", "You aren't permitted to perform this request.");
      try {
        handle(route, url, call, res);
      } catch (e) {
        error(res, 500, "stub_error", e.stack);
      }
    });
  });

  function handle(route, url, call, res) {
    let m;
    // Catalog
    if ((m = /^GET \/prices\/([^/]+)$/.exec(route))) {
      const p = state.prices[m[1]];
      if (!p) return error(res, 404, "entity_not_found", `Price ${m[1]} not found`);
      return ok(res, state.fail.priceMismatch?.[m[1]] ? { ...p, ...state.fail.priceMismatch[m[1]] } : p);
    }
    if (route === "GET /prices") {
      const items = Object.values(state.prices).filter((p) => !url.searchParams.get("product_id") || p.product_id === url.searchParams.get("product_id"));
      return list(res, items);
    }
    if (route === "POST /prices") {
      const p = { id: id("pri"), status: "active", ...call.body };
      state.prices[p.id] = p;
      return created(res, p);
    }
    if (route === "GET /products") return list(res, state.products);
    if (route === "POST /products") {
      const p = { id: id("pro"), status: "active", ...call.body };
      state.products.push(p);
      return created(res, p);
    }
    // Customers
    if (route === "POST /customers") {
      const email = call.body?.email?.toLowerCase();
      let existing = [...state.customers.values()].find((c) => c.email.toLowerCase() === email);
      if (!existing && state.fail.customers409) {
        // As if a checkout before ours had made the customer: Paddle answers 409 with the id in the detail.
        existing = { id: id("ctm"), email: call.body.email, name: null, custom_data: null, status: "active", created_at: iso() };
        state.customers.set(existing.id, existing);
      }
      if (existing) return error(res, 409, "customer_already_exists", `customer email conflicts with customer of id ${existing.id}`);
      const c = { id: id("ctm"), email: call.body.email, name: call.body.name ?? null, custom_data: call.body.custom_data ?? null, status: "active", created_at: iso() };
      state.customers.set(c.id, c);
      return created(res, c);
    }
    if (route === "GET /customers") {
      const email = url.searchParams.get("email")?.toLowerCase();
      return list(res, [...state.customers.values()].filter((c) => !email || c.email.toLowerCase() === email));
    }
    if ((m = /^POST \/customers\/([^/]+)\/portal-sessions$/.exec(route))) {
      if (!state.customers.has(m[1])) return error(res, 404, "entity_not_found", "customer not found");
      const subs = call.body?.subscription_ids ?? [];
      return created(res, {
        id: id("cpls"),
        customer_id: m[1],
        urls: {
          general: { overview: `https://customer-portal.paddle.test/${m[1]}/overview?token=${id("tok")}` },
          subscriptions: subs.map((s) => ({ id: s, cancel_subscription: `https://customer-portal.paddle.test/${m[1]}/subscriptions/${s}/cancel`, update_subscription_payment_method: `https://customer-portal.paddle.test/${m[1]}/subscriptions/${s}/update-payment-method`, view_subscription: `https://customer-portal.paddle.test/${m[1]}/subscriptions/${s}` })),
        },
        created_at: iso(),
      });
    }
    // Transactions
    if (route === "POST /transactions") {
      const t = {
        id: id("txn"),
        status: "ready",
        customer_id: call.body.customer_id ?? null,
        address_id: null,
        subscription_id: null,
        invoice_number: null,
        origin: "api",
        currency_code: "USD",
        custom_data: call.body.custom_data ?? null,
        collection_mode: call.body.collection_mode ?? "automatic",
        billing_period: null,
        items: call.body.items.map((i) => ({ price: state.prices[i.price_id] ?? { id: i.price_id }, quantity: i.quantity })),
        details: { line_items: call.body.items.map((i) => lineFor(i.price_id, i.quantity)), totals: totalsFor(call.body.items) },
        payments: [],
        checkout: { url: `https://typeplay.app/billing?_ptxn=${id("txn")}` },
        created_at: iso(),
        updated_at: iso(),
        billed_at: null,
      };
      state.transactions.set(t.id, t);
      return created(res, t);
    }
    if ((m = /^GET \/transactions\/([^/]+)$/.exec(route))) {
      const t = state.transactions.get(m[1]);
      return t ? ok(res, t) : error(res, 404, "entity_not_found", "transaction not found");
    }
    if (route === "GET /transactions") {
      const c = url.searchParams.get("customer_id");
      const s = url.searchParams.get("status");
      return list(res, [...state.transactions.values()].filter((t) => (!c || t.customer_id === c) && (!s || s.split(",").includes(t.status))));
    }
    // Subscriptions
    if ((m = /^GET \/subscriptions\/([^/]+)$/.exec(route))) {
      const s = state.subscriptions.get(m[1]);
      return s ? ok(res, s) : error(res, 404, "entity_not_found", "subscription not found");
    }
    if ((m = /^PATCH \/subscriptions\/([^/]+)\/preview$/.exec(route))) {
      const s = state.subscriptions.get(m[1]);
      if (!s) return error(res, 404, "entity_not_found", "subscription not found");
      return ok(res, previewFor(s, call.body));
    }
    if ((m = /^PATCH \/subscriptions\/([^/]+)$/.exec(route))) {
      const s = state.subscriptions.get(m[1]);
      if (!s) return error(res, 404, "entity_not_found", "subscription not found");
      if (call.body && "scheduled_change" in call.body && call.body.scheduled_change === null) {
        s.scheduled_change = null;
        s.next_billed_at = s.current_billing_period?.ends_at ?? null;
        s.updated_at = iso(Date.now() + state.clockAheadMs);
        return ok(res, s);
      }
      if (call.body?.items) {
        if (call.body.proration_billing_mode === "prorated_immediately" && state.fail.decline) {
          return error(res, 400, "subscription_payment_declined", "The payment for the update was declined (prevent_change).");
        }
        s.items = call.body.items.map((i) => ({ status: "active", quantity: i.quantity, price: state.prices[i.price_id] ?? { id: i.price_id }, next_billed_at: s.next_billed_at }));
        s.updated_at = iso(Date.now() + state.clockAheadMs);
        // Billed now: Paddle creates a subscription_update transaction; the test sends its transaction.completed itself.
        if (call.body.proration_billing_mode === "prorated_immediately") s.last_update_preview = previewFor(s, call.body);
        return ok(res, s);
      }
      return error(res, 400, "bad_request", "nothing to change");
    }
    if ((m = /^POST \/subscriptions\/([^/]+)\/cancel$/.exec(route))) {
      const s = state.subscriptions.get(m[1]);
      if (!s) return error(res, 404, "entity_not_found", "subscription not found");
      if (state.fail.lock30) return error(res, 400, "subscription_locked_renewal", "Subscriptions cannot be changed within 30 minutes of the next billing date.");
      if (state.fail.cancelCode) return error(res, 400, state.fail.cancelCode, "This subscription cannot be canceled right now (stub).");
      if (s.status === "canceled") return error(res, 400, "subscription_already_canceled", "already canceled");
      if (call.body?.effective_from === "immediately") {
        s.status = "canceled";
        s.canceled_at = iso();
        s.scheduled_change = null;
        s.current_billing_period = null;
        s.next_billed_at = null;
      } else {
        s.scheduled_change = { action: "cancel", effective_at: s.current_billing_period?.ends_at ?? iso(monthLater(new Date())), resume_at: null };
        s.next_billed_at = null;
      }
      s.updated_at = iso(Date.now() + state.clockAheadMs);
      return ok(res, s);
    }
    // Adjustments
    if (route === "POST /adjustments") {
      const t = state.transactions.get(call.body?.transaction_id);
      if (!t) return error(res, 404, "entity_not_found", "transaction not found");
      const pending = [...state.adjustments.values()].find((a) => a.transaction_id === t.id && a.status === "pending_approval");
      if (pending) return error(res, 400, "adjustment_transaction_has_pending_refund", "transaction has a refund pending approval");
      // Both shapes: `full` (no items: every line of the transaction, with its tax) and `partial` (items
      // with amounts before tax in external tax mode, Paddle adding the tax share).
      const full = call.body.type === "full";
      if (!full && !call.body.items?.length) return error(res, 400, "adjustment_items_required", "items are required for a partial adjustment");
      const items = full ? t.details.line_items.map((l) => ({ item_id: l.id, type: "full", amount: null })) : call.body.items;
      const lineOf = (itemId) => t.details.line_items.find((l) => l.id === itemId);
      const subtotal = items.reduce((s, i) => s + (i.type === "full" ? Number(lineOf(i.item_id)?.totals.subtotal ?? 0) : Number(i.amount)), 0);
      const tax = Math.round(subtotal * 0.1);
      const a = {
        id: id("adj"),
        action: call.body.action,
        type: call.body.type ?? "partial",
        status: "pending_approval",
        transaction_id: t.id,
        subscription_id: t.subscription_id,
        customer_id: t.customer_id,
        currency_code: "USD",
        reason: call.body.reason,
        items: items.map((i) => ({ id: id("adjitm"), item_id: i.item_id, type: i.type, amount: i.amount })),
        totals: { subtotal: String(subtotal), tax: String(tax), total: String(subtotal + tax), fee: "0", earnings: String(-subtotal), currency_code: "USD" },
        payout_totals: { subtotal: String(subtotal), tax: String(tax), total: String(subtotal + tax), fee: "0", chargeback_fee: "0", earnings: String(-subtotal), currency_code: "USD" },
        created_at: iso(),
        updated_at: iso(),
      };
      state.adjustments.set(a.id, a);
      return created(res, a);
    }
    if (route === "GET /adjustments") {
      const t = url.searchParams.get("transaction_id");
      const c = url.searchParams.get("customer_id");
      const action = url.searchParams.get("action");
      return list(res, [...state.adjustments.values()].filter((a) => (!t || a.transaction_id === t) && (!c || a.customer_id === c) && (!action || a.action === action)));
    }
    return error(res, 404, "not_found", `the stub has no ${route}`);
  }

  function lineFor(priceId, quantity, rate = null) {
    const item = PLAN_OF_PRICE[priceId];
    const unit = item ? CENTS[item] : 0;
    const subtotal = Math.round(unit * quantity * (rate ?? 1));
    const tax = Math.round(subtotal * 0.1);
    return { id: id("txnitm"), price_id: priceId, quantity, proration: rate === null ? null : { rate: String(rate), billing_period: null }, tax_rate: "0.1", unit_totals: { subtotal: String(unit), discount: "0", tax: String(Math.round(unit * 0.1)), total: String(unit + Math.round(unit * 0.1)) }, totals: { subtotal: String(subtotal), discount: "0", tax: String(tax), total: String(subtotal + tax) } };
  }
  function totalsFor(items) {
    const lines = items.map((i) => lineFor(i.price_id, i.quantity, i.rate ?? null));
    const subtotal = lines.reduce((s, l) => s + Number(l.totals.subtotal), 0);
    const tax = lines.reduce((s, l) => s + Number(l.totals.tax), 0);
    return { subtotal: String(subtotal), discount: "0", tax: String(tax), total: String(subtotal + tax), grand_total: String(subtotal + tax), credit: "0", credit_to_balance: "0", balance: String(subtotal + tax), fee: null, earnings: null, currency_code: "USD" };
  }
  /** The preview of an item change: an upgrade prorated at half a period, a downgrade with nothing now. */
  function previewFor(s, body) {
    const newPrice = body.items[0].price_id;
    const oldPrice = s.items[0].price.id;
    const nextLines = [lineFor(newPrice, 1)];
    const next = { billing_period: { starts_at: s.current_billing_period?.ends_at ?? iso(), ends_at: iso(monthLater(s.current_billing_period?.ends_at ?? new Date())) }, details: { line_items: nextLines, totals: totalsFor([{ price_id: newPrice, quantity: 1 }]) } };
    if (body.proration_billing_mode !== "prorated_immediately") return { immediate_transaction: null, next_transaction: next, recurring_transaction_details: next.details, update_summary: { credit: { amount: "0", currency_code: "USD" }, charge: { amount: "0", currency_code: "USD" }, result: { action: "charge", amount: "0", currency_code: "USD" } } };
    const rate = state.prorationRate ?? 0.5;
    // Paddle's shape (sandbox 2026-10-25): the old plan's unused share is a line of quantity -1 with negative totals.
    const lines = [lineFor(newPrice, 1, rate), lineFor(oldPrice, -1, rate)];
    const subtotal = lines.reduce((x, l) => x + Number(l.totals.subtotal), 0);
    const tax = lines.reduce((x, l) => x + Number(l.totals.tax), 0);
    return {
      immediate_transaction: { billing_period: s.current_billing_period, details: { line_items: lines, totals: { subtotal: String(subtotal), discount: "0", tax: String(tax), total: String(subtotal + tax), grand_total: String(subtotal + tax), currency_code: "USD" } } },
      next_transaction: next,
      recurring_transaction_details: next.details,
      update_summary: { credit: { amount: "0", currency_code: "USD" }, charge: { amount: String(subtotal + tax), currency_code: "USD" }, result: { action: "charge", amount: String(subtotal + tax), currency_code: "USD" } },
    };
  }

  // ---- What the test uses to play Paddle's side ----------------------------------------------

  /** Completes a checkout transaction as Paddle would: paid, a subscription made for a plan, the fields a webhook carries. */
  function complete(transactionId, { origin = "web", billedAt = new Date(), card = { type: "visa", last4: "4242" } } = {}) {
    const t = state.transactions.get(transactionId);
    if (!t) throw new Error(`no transaction ${transactionId}`);
    const plan = PLAN_OF_PRICE[t.items[0].price.id];
    t.status = "completed";
    t.origin = origin;
    t.billed_at = iso(billedAt);
    t.updated_at = iso(billedAt);
    t.invoice_number = `TP-${state.transactions.size}`;
    t.payments = [{ payment_attempt_id: id("pay"), status: "captured", captured_at: iso(billedAt), method_details: { type: "card", card: { type: card.type, last4: card.last4, expiry_month: 1, expiry_year: 2030 } } }];
    if (plan && plan !== "pack" && !t.subscription_id) {
      const sub = makeSubscription({ customerId: t.customer_id, priceId: t.items[0].price.id, customData: t.custom_data, startedAt: billedAt, transactionId: t.id });
      t.subscription_id = sub.id;
    }
    return t;
  }

  function makeSubscription({ customerId, priceId, customData, startedAt = new Date(), transactionId = null }) {
    const starts = new Date(startedAt);
    const ends = monthLater(starts);
    const s = {
      id: id("sub"),
      status: "active",
      customer_id: customerId,
      address_id: null,
      currency_code: "USD",
      created_at: iso(starts),
      updated_at: iso(starts),
      started_at: iso(starts),
      first_billed_at: iso(starts),
      next_billed_at: iso(ends),
      paused_at: null,
      canceled_at: null,
      collection_mode: "automatic",
      billing_cycle: { interval: "month", frequency: 1 },
      scheduled_change: null,
      current_billing_period: { starts_at: iso(starts), ends_at: iso(ends) },
      items: [{ status: "active", quantity: 1, price: state.prices[priceId], product: null, previously_billed_at: iso(starts), next_billed_at: iso(ends) }],
      custom_data: customData,
      transaction_id: transactionId,
    };
    state.subscriptions.set(s.id, s);
    return s;
  }

  /** A transaction Paddle made itself (a renewal, an upgrade's charge, a one-time charge), completed. */
  function makeTransaction({ origin, customerId, subscriptionId, customData, lines, billingPeriod = null, billedAt = new Date() }) {
    // A negative line is the old plan's credit on an upgrade, as Paddle sends it: quantity -1, negative totals.
    const lineItems = lines.map((l) => lineFor(l.price_id, l.negative ? -(l.quantity ?? 1) : (l.quantity ?? 1), l.rate ?? null));
    const subtotal = lineItems.reduce((x, l) => x + Number(l.totals.subtotal), 0);
    const tax = lineItems.reduce((x, l) => x + Number(l.totals.tax), 0);
    const t = {
      id: id("txn"),
      status: "completed",
      customer_id: customerId,
      subscription_id: subscriptionId ?? null,
      invoice_number: `TP-${state.transactions.size + 1}`,
      origin,
      currency_code: "USD",
      custom_data: customData ?? null,
      collection_mode: "automatic",
      billing_period: billingPeriod,
      items: lines.map((l) => ({ price: state.prices[l.price_id] ?? { id: l.price_id }, quantity: l.quantity ?? 1, proration: l.rate == null ? null : { rate: String(l.rate) } })),
      details: { line_items: lineItems, totals: { subtotal: String(subtotal), discount: "0", tax: String(tax), total: String(subtotal + tax), grand_total: String(subtotal + tax), credit: "0", credit_to_balance: "0", balance: "0", fee: "0", earnings: String(subtotal), currency_code: "USD" } },
      payments: [{ payment_attempt_id: id("pay"), status: "captured", captured_at: iso(billedAt), method_details: { type: "card", card: { type: "visa", last4: "4242", expiry_month: 1, expiry_year: 2030 } } }],
      created_at: iso(billedAt),
      updated_at: iso(billedAt),
      billed_at: iso(billedAt),
    };
    state.transactions.set(t.id, t);
    return t;
  }

  /** The sandbox's approval cycle, by hand: an adjustment's status moves on. */
  function settleAdjustment(adjustmentId, status) {
    const a = state.adjustments.get(adjustmentId);
    if (!a) throw new Error(`no adjustment ${adjustmentId}`);
    a.status = status;
    a.updated_at = iso();
    return a;
  }

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        state,
        calls: state.calls,
        complete,
        makeSubscription,
        makeTransaction,
        settleAdjustment,
        lineFor,
        callsTo: (method, pathRe) => state.calls.filter((c) => c.method === method && pathRe.test(c.path)),
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href) {
  const stub = await startStub({ port: Number(process.env.PORT ?? 0) });
  stub.state.log = true;
  console.log(`Paddle stub on ${stub.url}: PADDLE_API_URL=${stub.url} PADDLE_ENV=sandbox PADDLE_API_KEY=pdl_sdbx_apikey_stub ${Object.entries(PRICE_IDS).map(([k, v]) => `PADDLE_PRICE_${k.toUpperCase()}=${v}`).join(" ")}`);
}
