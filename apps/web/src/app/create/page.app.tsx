import type { Metadata } from "next";
import { Suspense } from "react";
import { PageWidget } from "@/components/ui/PageWidget";
import { StartsClean } from "@/components/app/StartsClean";
import { CreateApp } from "./CreateApp";

export const metadata: Metadata = { title: "Make your game", robots: { index: false } };

// App builds only (.app.tsx): the real front door. The public build keeps page.site.tsx.
export default function Create() {
  return (
    <Suspense fallback={<PageWidget busy />}>
      <StartsClean>
        <CreateApp />
      </StartsClean>
    </Suspense>
  );
}
