import { useMemo } from "react";
import { qrModules, qrPath } from "@/lib/qr";

/**
 * The phone link as a QR code: ink modules on paper, a quiet zone of four modules, crisp at any
 * size. Null when the text is too long for a code a phone can read off a screen (the encoder stops
 * at 213 bytes): the panel then shows the link alone. The API's phone link is always the short
 * `/android/dl/<token>` (~80 characters, even where builds live in R2), so this is a safety net.
 */
export function QrCode({ text, label }: { text: string; label: string }) {
  const code = useMemo(() => {
    try {
      return qrPath(qrModules(text));
    } catch {
      return null;
    }
  }, [text]);
  if (!code) return null;
  return (
    <svg className="qr" viewBox={`0 0 ${code.size} ${code.size}`} role="img" aria-label={label} data-text={text} shapeRendering="crispEdges">
      <rect width={code.size} height={code.size} />
      <path d={code.d} />
    </svg>
  );
}
