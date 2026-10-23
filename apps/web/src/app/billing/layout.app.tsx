import type { ReactNode } from "react";
import { InviteGate } from "@/components/app/ClosedBeta";

// App builds only (.app.tsx): signed in but not invited to the closed beta, the closed-beta screen instead of the page.
export default function Layout({ children }: { children: ReactNode }) {
  return <InviteGate>{children}</InviteGate>;
}
