import { renderCard } from "../card";

// /play/<id>/preview.png: the share page's link preview (card.tsx); 404 when the game isn't shared.
// A route handler rather than the opengraph-image file convention, which doesn't serve under the
// app gate's `.app.tsx` names (Next 16.4 links /opengraph-image.app and then answers 404).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return renderCard((await params).id);
}
