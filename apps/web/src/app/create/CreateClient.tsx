"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
    <main className="widget create">
      <h1 className="title">Your game is next.</h1>
      {sentence ? (
        <div className="saved">
          <q>{sentence}</q>
        </div>
      ) : (
        <p className="create__text">
          Start on the{" "}
          <Link href="/#prompt" className="link">
            home page
          </Link>{" "}
          by typing the game you want.
        </p>
      )}
      <p>
        The builder opens with the beta{plan ? ` (you picked the ${plan} plan)` : ""}. Your
        sentence is saved in this browser, so it will be here when you sign in.
      </p>
      <div className="create__actions">
        <button className="button" type="button" disabled>
          Sign in with Google
        </button>
        <Link href="/#games" className="button button--quiet">
          See the games
        </Link>
      </div>
    </main>
  );
}
