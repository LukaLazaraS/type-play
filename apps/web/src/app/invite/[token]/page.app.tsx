import type { Metadata } from "next";
import { Suspense } from "react";
import { PageWidget } from "@/components/ui/PageWidget";
import { InviteClient } from "./InviteClient";

// The link an owner sends to invite someone to build a game with them (pair developing, 2026-11-04). App builds only
// (.app.tsx); the invitation loads in the browser with the sign-in, so the page itself is a static shell. Never indexed:
// the address holds the invitation's secret.
export const metadata: Metadata = { title: "Your invitation", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function InvitePage() {
  return (
    <Suspense fallback={<PageWidget busy />}>
      <InviteClient />
    </Suspense>
  );
}
