"use client";

import { useEffect, useRef, useState } from "react";
import { mountGoogleButton, type GoogleButtonLook, type OnGoogleToken } from "@/lib/google-button";
import { cx } from "./cx";

const LOOKS: Record<"dark" | "light", GoogleButtonLook> = {
  dark: { theme: "filled_black", size: "large", text: "signin_with", needs: 194 },
  light: { theme: "outline", size: "medium", text: "continue_with", needs: 191 },
};

/**
 * Google's own sign-in button (DESIGN.md "Google's button"; app builds with NEXT_PUBLIC_GOOGLE_BUTTON=1 only). Google
 * draws it, in its own frame and look, as Google's branding rules ask; this piece holds its place while Google's script
 * loads, so nothing moves when it arrives. `dark`: the page's sign-in, 40px ("Sign in with Google", or "Continue as …"
 * for someone who signed in here before). `light`: beside quiet buttons, 32px, "Continue with Google", never showing an
 * account. `onToken` gets Google's ID token and the nonce to check it with; `onUnavailable` runs when Google's script
 * can't load (a blocker, offline), and the caller shows its fallback instead. `busy` (signing in with the token): no
 * second press, by pointer or keyboard, until the page moves on or says what went wrong.
 */
export function GoogleButton({
  look = "dark",
  busy = false,
  onToken,
  onUnavailable,
  className,
}: {
  look?: "dark" | "light";
  busy?: boolean;
  onToken: OnGoogleToken;
  onUnavailable: () => void;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // The latest callbacks, without drawing Google's button again each time the caller renders.
  const calls = useRef({ onToken, onUnavailable });
  useEffect(() => {
    calls.current = { onToken, onUnavailable };
  });

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    return mountGoogleButton(
      el,
      LOOKS[look],
      (credential, nonce) => calls.current.onToken(credential, nonce),
      (state) => (state === "ready" ? setReady(true) : calls.current.onUnavailable()),
    );
  }, [look]);

  return (
    <div className={cx("googlebutton", `googlebutton--${look}`, busy && "googlebutton--busy", className)} aria-busy={!ready || busy || undefined} inert={busy}>
      {!ready && (
        <span className="googlebutton__hold">
          <span>Loading Google sign-in…</span>
        </span>
      )}
      <div ref={frame} className="googlebutton__frame" />
    </div>
  );
}
