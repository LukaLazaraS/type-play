import type { ReactNode } from "react";
import { InviteGate } from "@/components/app/ClosedBeta";

// App builds only (.app.tsx): signed in but not let into the closed beta, the closed-beta screen instead of the page (a
// game invitation is no way past the beta: its code or invitation still is).
export default function Layout({ children }: { children: ReactNode }) {
  return <InviteGate>{children}</InviteGate>;
}
