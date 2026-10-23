import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { GameClient } from "./GameClient";

export const metadata: Metadata = { title: "Your game", robots: { index: false } };
// Android: the keyboard shrinks the page, so the chat box stays above it (iOS does this already).
export const viewport: Viewport = { themeColor: "#170d33", interactiveWidget: "resizes-content" };

// App builds only (.app.tsx). Everything here is the user's own: it loads in the browser with
// their sign-in, so the page itself is a static shell.
export default function GamePage() {
  return (
    <Suspense fallback={<main className="ws" data-app aria-busy="true" />}>
      <GameClient />
    </Suspense>
  );
}
