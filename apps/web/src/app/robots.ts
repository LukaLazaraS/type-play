import type { MetadataRoute } from "next";
import { siteUrl } from "@/content/seo";

// Crawl everything public. Pages that shouldn't be in search (/create) say "noindex" themselves:
// a robots.txt block would hide that from crawlers. /app and /api are the signed-in app (later).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/api"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
