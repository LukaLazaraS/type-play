// The status bar's account place, picked per build in next.config.ts (turbopack.resolveAlias):
// components/SignInPill.tsx in the public build, components/app/AccountSlot.tsx in app builds.
// Both export this one component.
declare module "@app-gate/account" {
  export function AccountSlot(): import("react").JSX.Element;
}
