"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageWidget } from "@/components/ui/PageWidget";
import { TextLink } from "@/components/ui/TextLink";

const KEY = "typeplay.draft";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}
function readSaved() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function CreateClient() {
  const params = useSearchParams();
  const fromUrl = params.get("prompt") ?? "";
  const plan = params.get("plan");
  const saved = useSyncExternalStore(subscribe, readSaved, () => "");
  const sentence = fromUrl || saved;

  useEffect(() => {
    if (!fromUrl) return;
    try {
      localStorage.setItem(KEY, fromUrl);
    } catch {
      /* private mode: nothing to keep */
    }
  }, [fromUrl]);

  return (
    <PageWidget
      site
      title="Your game is next."
      lead={
        sentence ? undefined : (
          <>
            Start on the <TextLink href="/#prompt">home page</TextLink> by typing the game you want.
          </>
        )
      }
    >
      {sentence && (
        <div className="saved">
          <q>{sentence}</q>
        </div>
      )}
      <p>
        The builder opens with the beta{plan ? ` (you picked the ${plan} plan)` : ""}. Your
        sentence is saved in this browser, so it will be here when you sign in.
      </p>
      <div className="create__actions">
        <Button disabled>Sign in with Google</Button>
        <ButtonLink href="/#games" look="quiet">
          See the games
        </ButtonLink>
      </div>
    </PageWidget>
  );
}
