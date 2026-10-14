import type { Metadata } from "next";
import { LegalSheet } from "@/components/LegalSheet";
import { refunds } from "@/content/legal";

export const metadata: Metadata = { title: "Refund policy" };

export default function Refunds() {
  return <LegalSheet doc={refunds} />;
}
