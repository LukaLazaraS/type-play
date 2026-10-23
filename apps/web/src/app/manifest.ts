import type { MetadataRoute } from "next";
import { description } from "@/content/seo";
import { site } from "@/content/site";

// For "Add to home screen" and the browser's app name and colours. Icons: scripts/brand.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    description,
    start_url: "/",
    display: "standalone",
    background_color: "#170d33",
    theme_color: "#170d33",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
