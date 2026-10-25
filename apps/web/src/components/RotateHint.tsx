"use client";

import { useId } from "react";
import type { Orientation } from "@/content/games";
import { InkPill } from "@/components/ui/InkPill";

/**
 * Over a full-screen game whose orientation differs from the phone's: a drawn phone turns to the
 * game's way, with the game's scene on its screen sideways until it does. "Play upright" (or
 * "Play sideways") keeps the phone as it is and shows the game letterboxed.
 */
export function RotateHint({ to, onStay }: { to: Orientation; onStay: () => void }) {
  const clip = useId();
  const wide = to === "landscape";
  // The screen shows the game the way it is played: a landscape scene sits rotated on the
  // upright phone, so it stands level once the phone turns.
  const w = wide ? 64 : 36;
  const h = wide ? 36 : 64;
  return (
    <div className="rotate" role="status">
      <svg className="rotate__art" data-to={to} viewBox="-60 -60 120 120" aria-hidden="true">
        <path
          className="rotate__arrow"
          d="M39.8 -33.4A52 52 0 0 0 -39.8 -33.4M-30.1 -36L-39.8 -33.4L-38.9 -43.4"
          transform={wide ? undefined : "scale(-1 1)"}
        />
        <g className="rotate__phone">
          <rect x="-24" y="-40" width="48" height="80" rx="10" fill="#ffffff" />
          <clipPath id={clip}>
            <rect x="-19" y="-34" width="38" height="68" rx="5" />
          </clipPath>
          <g clipPath={`url(#${clip})`}>
            <g transform={wide ? "rotate(90)" : undefined}>
              <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#3d206b" />
              <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.28} fill="#2a1858" />
              <circle cx={w * 0.2} cy={h * 0.02} r={h * 0.15} fill="#ffb347" />
              <path
                d={`M${-w / 2} ${h * 0.2}C${-w * 0.2} ${h * 0.02} ${w * 0.05} ${h * 0.16} ${w / 2} ${h * 0.12}V${h / 2}H${-w / 2}Z`}
                fill="#d9645a"
              />
              <rect x={-w / 2} y={h * 0.3} width={w} height={h * 0.2} fill="#f3a35c" />
              <rect x={-w * 0.3} y={h * 0.3 - 7} width="5" height="7" rx="1" fill="#ff5a36" />
            </g>
          </g>
        </g>
      </svg>
      <p className="rotate__title">{wide ? "Turn your phone sideways" : "Turn your phone upright"}</p>
      <InkPill onClick={onStay}>{wide ? "Play upright" : "Play sideways"}</InkPill>
    </div>
  );
}
