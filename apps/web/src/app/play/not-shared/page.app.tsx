import { notFound } from "next/navigation";

// Where the proxy sends a share link whose game isn't shared (src/proxy.app.ts). Prerendered as the
// not-found page (../not-found.app.tsx) with a real 404 status, which a streamed page can't set.
// The hyphen keeps it apart from game ids (lowercase letters and digits only).
export default function NotShared() {
  notFound();
}
