// The parts of Paddle's entities we read (docs/research/paddle-2026.md §3-6). Everything else in a
// payload is kept as JSON on the row and never interpreted. Money is strings in the lowest unit.
export interface PaddleEnvelope {
  event_id: string;
  event_type: string;
  occurred_at: string;
  notification_id: string;
  data: unknown;
}

export interface PaddleLineItem {
  id: string; // txnitm_…
  price_id: string;
  quantity: number;
  proration?: { rate: string | number; billing_period?: { starts_at: string; ends_at: string } } | null;
  totals?: { subtotal: string; discount?: string; tax: string; total: string };
}

export interface PaddleTransaction {
  id: string; // txn_…
  status: string;
  customer_id: string | null;
  address_id?: string | null;
  subscription_id: string | null;
  invoice_number?: string | null;
  origin: string;
  currency_code: string;
  custom_data?: Record<string, unknown> | null;
  collection_mode?: string;
  billing_period?: { starts_at: string; ends_at: string } | null;
  items?: { price?: { id: string; custom_data?: Record<string, unknown> | null } | null; quantity: number }[];
  details?: {
    line_items?: PaddleLineItem[];
    totals?: { subtotal: string; discount?: string; tax: string; total: string; grand_total?: string; currency_code?: string };
  };
  payments?: { status?: string; captured_at?: string | null; method_details?: { type?: string; card?: { type?: string; last4?: string } | null } | null }[];
  checkout?: { url: string | null } | null;
  created_at?: string;
  updated_at?: string;
  billed_at?: string | null;
}

export interface PaddleSubscription {
  id: string; // sub_…
  status: "active" | "canceled" | "past_due" | "paused" | "trialing" | string;
  customer_id: string;
  currency_code?: string;
  custom_data?: Record<string, unknown> | null;
  transaction_id?: string | null;
  current_billing_period?: { starts_at: string; ends_at: string } | null;
  next_billed_at?: string | null;
  canceled_at?: string | null;
  paused_at?: string | null;
  scheduled_change?: { action: "cancel" | "pause" | "resume" | string; effective_at: string; resume_at?: string | null } | null;
  items?: { status?: string; quantity: number; price?: { id: string } | null; next_billed_at?: string | null }[];
  updated_at?: string;
}

export interface PaddleAdjustment {
  id: string; // adj_…
  action: string; // refund | credit | chargeback | chargeback_warning | chargeback_reverse | chargeback_warning_reverse | credit_reverse
  type?: string; // full | partial
  status: string; // pending_approval | approved | rejected | reversed
  transaction_id: string;
  subscription_id?: string | null;
  customer_id?: string | null;
  currency_code: string;
  reason?: string | null;
  items?: { id?: string; item_id: string; type: string; amount: string | null }[];
  totals?: { subtotal: string; tax: string; total: string; fee?: string; earnings?: string; currency_code?: string };
  payout_totals?: { chargeback_fee?: string; retained_fee?: string } | null;
  created_at?: string;
  updated_at?: string;
}

export interface PaddlePrice {
  id: string;
  product_id: string;
  description?: string;
  name?: string | null;
  status?: string;
  unit_price: { amount: string; currency_code: string };
  billing_cycle: { interval: string; frequency: number } | null;
  tax_mode?: string;
  quantity?: { minimum: number; maximum: number };
  custom_data?: Record<string, unknown> | null;
}

export interface PaddleProduct {
  id: string;
  name: string;
  status?: string;
  tax_category?: string;
  custom_data?: Record<string, unknown> | null;
}

export interface PaddleCustomer {
  id: string; // ctm_…
  email: string;
  name?: string | null;
  status?: string;
}

export interface PaddleSubscriptionPreview {
  immediate_transaction?: { details?: PaddleTransaction["details"] } | null;
  next_transaction?: { billing_period?: { starts_at: string; ends_at: string }; details?: PaddleTransaction["details"] } | null;
  update_summary?: { result?: { action: string; amount: string; currency_code: string } } | null;
}

export interface PaddlePortalSession {
  id: string;
  urls: {
    general: { overview: string };
    subscriptions: { id: string; cancel_subscription: string; update_subscription_payment_method: string; view_subscription?: string }[];
  };
}
