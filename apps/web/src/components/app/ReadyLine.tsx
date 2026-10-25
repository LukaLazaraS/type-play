"use client";

import { Play } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";

/**
 * "Spike Cat is ready." with its hot Play it (a first build that finished while the player was elsewhere: another game
 * in the stage, or the gallery). A long name gives way; "is ready." always shows. Play it starts the game (`onPlay`) or
 * goes to its page (`href`).
 */
export function ReadyLine({ name, onPlay, href }: { name: string; onPlay?: () => void; href?: string }) {
  const play = (
    <>
      <Play size={16} weight="fill" aria-hidden="true" />
      Play it
    </>
  );
  return (
    <>
      <span className="readyline">
        <b>{name}</b>
        <span>&nbsp;is ready.</span>
      </span>
      {href ? (
        <ButtonLink href={href} size="small">
          {play}
        </ButtonLink>
      ) : (
        <Button size="small" onClick={onPlay}>
          {play}
        </Button>
      )}
    </>
  );
}
