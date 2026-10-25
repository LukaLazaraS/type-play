"use client";

import { Flag } from "@phosphor-icons/react";
import { TextButton } from "@/components/ui/TextButton";

/** "Report this game" under a shared game's frame (the share page, the gallery's first game): opens the report dialog. */
export function ReportGameButton({ onClick }: { onClick: () => void }) {
  return (
    <TextButton look="sky" onClick={onClick}>
      <Flag size={16} weight="bold" aria-hidden="true" />
      Report this game
    </TextButton>
  );
}
