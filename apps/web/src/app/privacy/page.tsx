import type { Metadata } from "next";
import { LegalSheet } from "@/components/LegalSheet";
import { privacy } from "@/content/legal";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What TypePlay collects when you make and play games, why, which services process it, and how to see, export or delete your data.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return <LegalSheet doc={privacy} />;
}
