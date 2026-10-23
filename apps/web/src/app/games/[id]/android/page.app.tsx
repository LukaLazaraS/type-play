import type { Metadata } from "next";
import { Suspense } from "react";
import { AndroidClient } from "./AndroidClient";

export const metadata: Metadata = { title: "Android", robots: { index: false } };

// App builds only (.app.tsx). The game's Android page: everything loads in the browser with the
// user's sign-in (GET /projects/:id/android), so the page itself is a static shell.
export default function AndroidPage() {
  return (
    <Suspense fallback={<main className="droid" data-app aria-busy="true" />}>
      <AndroidClient />
    </Suspense>
  );
}
