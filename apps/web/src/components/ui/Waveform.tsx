import { cx } from "./cx";

/**
 * A sound's shape (2026-11-04, the Assets tab): its loudness in bars from left to right (the API measures 40 for a WAV),
 * round-ended, centred on a line, in the text's colour. Drawn, not an image; hidden from screen readers (the sound's name
 * and length say what it is). Stretches to its box.
 */
export function Waveform({ peaks, className }: { peaks: number[]; className?: string }) {
  const bar = 4;
  const gap = 2;
  const height = 40;
  const width = Math.max(1, peaks.length * (bar + gap) - gap);
  return (
    <svg className={cx("waveform", className)} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {peaks.map((p, i) => {
        const h = Math.max(3, Math.min(1, Math.max(0, p)) * height);
        return <rect key={i} x={i * (bar + gap)} y={(height - h) / 2} width={bar} height={h} rx={bar / 2} />;
      })}
    </svg>
  );
}
