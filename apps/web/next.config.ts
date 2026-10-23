import type { NextConfig } from "next";

// The signed-in app (package 4) is built only with NEXT_PUBLIC_APP=1 (apps/web/.env.development
// sets it for `next dev`). Its route files end in `.app.tsx` / `.app.ts` (page, route handler,
// proxy) and the placeholder /create in `.site.tsx`, so each build contains exactly one of them:
// without the flag the build is the public site alone, with no app routes at all.
const appOn = process.env.NEXT_PUBLIC_APP === "1";

// Dev sign-in accepts `dev:<email>` as a login. It must never reach a production build.
if (process.env.NEXT_PUBLIC_DEV_AUTH === "1" && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_DEV_AUTH=1 is for `next dev` only: refusing to build for production.");
}

// Paddle's client token (payments part 3) is public, but its prefix must match the environment it
// is for (test_ sandbox, live_ live), and a live one builds only for production: a dev build never
// talks to live Paddle. Without a token the billing pages say "opens here soon".
const paddleToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
const paddleEnv = process.env.NEXT_PUBLIC_PADDLE_ENV ?? "";
if (paddleToken) {
  if (paddleEnv !== "sandbox" && paddleEnv !== "live") throw new Error("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN needs NEXT_PUBLIC_PADDLE_ENV=sandbox or live.");
  const prefix = paddleEnv === "sandbox" ? "test_" : "live_";
  if (!paddleToken.startsWith(prefix)) throw new Error(`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN should start with ${prefix} for NEXT_PUBLIC_PADDLE_ENV=${paddleEnv}: refusing to build.`);
  if (paddleEnv === "live" && process.env.NODE_ENV !== "production") throw new Error("A live Paddle client token is for production builds only: refusing to build.");
}

const nextConfig: NextConfig = {
  pageExtensions: appOn ? ["app.tsx", "app.ts", "tsx", "ts"] : ["site.tsx", "tsx", "ts"],
  // Tests can run a second `next dev` beside the one on :3000 (each dev server locks its folder):
  // NEXT_DIST_DIR=.next/test. Unset everywhere else.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Live: a self-contained server bundle for the Docker image (deploy/server/web.Dockerfile).
  output: "standalone",
  // The share pages' link-preview pictures read the site's fonts at run time (app/play/[id]/card.tsx).
  outputFileTracingIncludes: { "/play/**": ["./assets/fonts/*.ttf"] },
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // Next's defaults plus 160 and 192, so the home icons (76-112px) get a close width on 1.5-2x
    // screens instead of jumping from 128 to 256.
    imageSizes: [32, 48, 64, 96, 128, 160, 192, 256, 384],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // The status bar's account place: the plain Sign in pill in the public build, so the live site
    // carries none of the sign-in code; sign-in, credits and the account menu in app builds.
    // (Its type for tsc: src/app-gate.d.ts.)
    resolveAlias: {
      "@app-gate/account": appOn ? "./src/components/app/AccountSlot.tsx" : "./src/components/SignInPill.tsx",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
