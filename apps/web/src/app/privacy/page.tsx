import type { Metadata } from "next";
import { LegalSheet } from "@/components/LegalSheet";
import { privacy } from "@/content/legal";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return <LegalSheet doc={privacy} />;
}
