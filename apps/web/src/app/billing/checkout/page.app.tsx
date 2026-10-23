import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

// App builds only (.app.tsx): /billing/checkout?item=plan:<id>|pack&back=<path>. The page reads the
// address in the browser (useSearchParams), so the shell is static and the content waits for it.
export default function Checkout() {
  return (
    <Suspense fallback={<main className="widget make" data-app aria-busy="true" />}>
      <CheckoutClient />
    </Suspense>
  );
}
