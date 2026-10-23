import type { Metadata } from "next";
import { LegalSheet } from "@/components/LegalSheet";
import { refunds } from "@/content/legal";

export const metadata: Metadata = {
  title: "Refund policy",
  description:
    "How refunds work for TypePlay plans and credits, how to ask for one, and how Paddle, our reseller, processes it.",
  alternates: { canonical: "/refunds" },
};

export default function Refunds() {
  return <LegalSheet doc={refunds} />;
}
