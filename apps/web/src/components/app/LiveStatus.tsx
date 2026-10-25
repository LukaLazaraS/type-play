"use client";

import type { ApiFailure, StreamState } from "@/lib/api";
import { TextButton } from "@/components/ui/TextButton";
import { TextLink } from "@/components/ui/TextLink";

/**
 * A game's live updates, when they stopped or dropped (the game page, its Android page): the game is gone (with the way
 * to the others), the updates stopped for good (with Retry), or they are coming back by themselves. Nothing while live.
 */
export function LiveStatus({ fatal, stream, onRetry, className }: { fatal: { code: ApiFailure["code"] | "server_error" } | null; stream: StreamState; onRetry: () => void; className: string }) {
  if (fatal) {
    return (
      <p className={className} role="alert">
        {fatal.code === "not_found" ? (
          <>
            This game was deleted. <TextLink href="/games">Your games</TextLink>
          </>
        ) : (
          <>
            Live updates stopped. <TextButton onClick={onRetry}>Retry</TextButton>
          </>
        )}
      </p>
    );
  }
  if (stream !== "retrying") return null;
  return (
    <p className={className} role="status">
      Lost the live updates. Reconnecting…
    </p>
  );
}
