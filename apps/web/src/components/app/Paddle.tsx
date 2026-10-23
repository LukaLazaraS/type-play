"use client";

// Paddle.js (docs/payments-design.md §8): loaded once, on the billing pages only (never on public
// pages), pointed at the sandbox when NEXT_PUBLIC_PADDLE_ENV says so, initialised once with the
// client token. Checkout events (checkout.completed, checkout.closed, …) reach whoever listens with
// usePaddleEvents(). Tests put their own window.Paddle in place before the page runs; then nothing
// is downloaded (scripts/shot-app.mjs).
import { useEffect, useState } from "react";
import { app } from "@/content/app";

export interface PaddleEvent {
  /** "checkout.completed", "checkout.closed", "checkout.error", "checkout.loaded", … */
  name: string;
  data?: { transaction_id?: string; [key: string]: unknown } | null;
  error?: { detail?: string; type?: string } | null;
}

interface PaddleJs {
  Environment: { set(env: "sandbox" | "production"): void };
  Initialize(options: { token: string; eventCallback?: (event: PaddleEvent) => void }): void;
  Checkout: { open(options: { transactionId: string; settings?: Record<string, unknown> }): void };
}

declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

const SRC = "https://cdn.paddle.com/paddle/v2/paddle.js";
const COULD_NOT_LOAD = "Paddle's checkout couldn't load. Check your connection and try again.";

/** Paddle can run on this build: the client token was set when it was built. */
export const paddleOn = app.paddle.clientToken.length > 0;

const listeners = new Set<(event: PaddleEvent) => void>();
let loading: Promise<PaddleJs> | null = null;

function load(): Promise<PaddleJs> {
  loading ??= new Promise<PaddleJs>((resolve, reject) => {
    if (window.Paddle) return resolve(window.Paddle);
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error(COULD_NOT_LOAD)));
    script.onerror = () => {
      script.remove();
      reject(new Error(COULD_NOT_LOAD));
    };
    document.head.append(script);
  })
    .then((paddle) => {
      if (app.paddle.env === "sandbox") paddle.Environment.set("sandbox");
      paddle.Initialize({ token: app.paddle.clientToken, eventCallback: (event) => listeners.forEach((listen) => listen(event)) });
      return paddle;
    })
    .catch((e: Error) => {
      loading = null; // the next try loads it again
      throw e;
    });
  return loading;
}

/** Loads Paddle.js for this page: `ready` once it is initialised, `problem` when it couldn't load. */
export function usePaddle(enabled: boolean): { ready: boolean; problem: string | null } {
  const [state, setState] = useState<{ ready: boolean; problem: string | null }>({ ready: false, problem: null });
  useEffect(() => {
    if (!enabled || !paddleOn) return;
    let live = true;
    load().then(
      () => live && setState({ ready: true, problem: null }),
      (e: Error) => live && setState({ ready: false, problem: e.message }),
    );
    return () => {
      live = false;
    };
  }, [enabled]);
  return state;
}

/** Hears every checkout event while mounted. */
export function usePaddleEvents(onEvent: (event: PaddleEvent) => void) {
  useEffect(() => {
    listeners.add(onEvent);
    return () => {
      listeners.delete(onEvent);
    };
  }, [onEvent]);
}

/** Opens Paddle's overlay for a transaction the API made (POST /billing/checkout). */
export async function openCheckout(transactionId: string): Promise<void> {
  const paddle = await load();
  paddle.Checkout.open({ transactionId, settings: { displayMode: "overlay", theme: "light", locale: "en", allowLogout: false } });
}
