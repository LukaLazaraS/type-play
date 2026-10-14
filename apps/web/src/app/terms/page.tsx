import type { Metadata } from "next";
import { LegalSheet } from "@/components/LegalSheet";
import { terms } from "@/content/legal";

export const metadata: Metadata = { title: "Terms of service" };

export default function Terms() {
  return <LegalSheet doc={terms} />;
}
