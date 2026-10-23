import type { Metadata } from "next";
import { LegalSheet } from "@/components/LegalSheet";
import { terms } from "@/content/legal";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms for using TypePlay: your account, the games you make and own, plans and credits, and payments, which Paddle handles as our reseller.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return <LegalSheet doc={terms} />;
}
