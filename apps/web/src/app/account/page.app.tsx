import type { Metadata } from "next";
import { StartsClean } from "@/components/app/StartsClean";
import { AccountClient } from "./AccountClient";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

// App builds only (.app.tsx). Everything here is the user's own: it loads in the browser with their
// sign-in, so the page itself is a static shell.
export default function Account() {
  return (
    <StartsClean>
      <AccountClient />
    </StartsClean>
  );
}
