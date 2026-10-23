import type { MetadataRoute } from "next";
import { siteUrl, sitemapDate } from "@/content/seo";
import { site } from "@/content/site";

// Only the pages meant for search. A date only where we know it (search engines distrust dates
// that change on every visit): the legal pages carry their "last updated" date.
export default function sitemap(): MetadataRoute.Sitemap {
  const legal = sitemapDate(site.updated);
  return [
    { url: `${siteUrl}/` },
    { url: `${siteUrl}/pricing` },
    { url: `${siteUrl}/terms`, lastModified: legal },
    { url: `${siteUrl}/privacy`, lastModified: legal },
    { url: `${siteUrl}/refunds`, lastModified: legal },
  ];
}
