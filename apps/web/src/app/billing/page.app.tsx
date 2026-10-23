import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingClient } from "./BillingClient";

export const metadata: Metadata = { title: "Plan and billing", robots: { index: false } };

// App builds only (.app.tsx). Everything here is the user's own (GET /billing with their sign-in),
// so the page itself is a static shell; ?change=1 opens the plan picker at once (useSearchParams).
export default function Billing() {
  return (
    <Suspense fallback={<main className="bill" data-app aria-busy="true" />}>
      <BillingClient />
    </Suspense>
  );
}
