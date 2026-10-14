import { useId } from "react";

// The ground: sun and flat dunes, anchored to the bottom of the section that owns it (the home
// hero, and the end of every page). Kept out of the fixed wallpaper so text never crosses it.
// A "wave" edge ends the band with a drawn curve and sky beneath it; "flat" runs to the page end.
export function Ground({
  sun = true,
  edge = "wave",
  className = "",
}: {
  sun?: boolean;
  edge?: "wave" | "flat";
  className?: string;
}) {
  const clipId = `ground-${useId().replace(/:/g, "")}`;
  const bottom =
    edge === "wave"
      ? "L1440 372 C1250 396 1040 376 820 392 C600 408 330 384 0 404 Z"
      : "L1440 420 L0 420 Z";
  return (
    <svg
      className={`ground ${className}`.trim()}
      viewBox="0 0 1440 420"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={`M0 0 L1440 0 ${bottom}`} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {sun && (
          <>
            <circle cx="1100" cy="220" r="120" fill="#ff8a4a" opacity=".35" />
            <circle cx="1100" cy="220" r="92" fill="#ffb347" />
          </>
        )}
        <path
          d="M0 240 C180 180 330 210 470 235 C620 262 760 188 930 196 C1100 204 1250 240 1440 210 L1440 420 L0 420Z"
          fill="#a63e68"
        />
        <path
          d="M0 292 C220 262 380 290 560 302 C760 315 900 270 1080 272 C1240 274 1350 296 1440 290 L1440 420 L0 420Z"
          fill="#d9645a"
        />
        <path
          d="M0 342 C300 326 520 346 760 348 C1000 350 1220 332 1440 338 L1440 420 L0 420Z"
          fill="#f3a35c"
        />
      </g>
    </svg>
  );
}
