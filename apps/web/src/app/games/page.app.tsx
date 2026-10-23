import type { Metadata } from "next";
import { GamesClient } from "./GamesClient";

export const metadata: Metadata = { title: "Your games", robots: { index: false } };

// App builds only (.app.tsx).
export default function Games() {
  return <GamesClient />;
}
