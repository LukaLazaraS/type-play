import type { Metadata } from "next";
import { Suspense } from "react";
import { PageWidget } from "@/components/ui/PageWidget";
import { CreateClient } from "./CreateClient";

export const metadata: Metadata = { title: "Make your game", robots: { index: false } };

// The builder's front door. Package 4 (the web app) replaces this with sign-in and the real build.
export default function Create() {
  return (
    <Suspense fallback={<PageWidget site>Loading…</PageWidget>}>
      <CreateClient />
    </Suspense>
  );
}
