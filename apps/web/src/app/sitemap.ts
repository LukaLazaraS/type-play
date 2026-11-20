import type { MetadataRoute } from "next";
import { app } from "@/content/app";
import { siteUrl, sitemapDate } from "@/content/seo";
import { site } from "@/content/site";
import { gallerySitemap } from "@/lib/public";

// Only the pages meant for search. A date only where we know it (search engines distrust dates
// that change on every visit): the legal pages carry their "last updated" date, a game when its
// page last changed (its playing version, or its going into the gallery, whichever is later; the
// page's own dateModified says the same). In app builds also the gallery (/explore) and every game in it
// (2026-11-20: a share page is in search only while its game is in the gallery), read from the
// API at request time; a public build (no API) is the site's own pages, built at deploy. An API
// that doesn't answer leaves the games out, never an error.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const legal = sitemapDate(site.updated);
  const pages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/` },
    { url: `${siteUrl}/pricing` },
    { url: `${siteUrl}/terms`, lastModified: legal },
    { url: `${siteUrl}/privacy`, lastModified: legal },
    { url: `${siteUrl}/refunds`, lastModified: legal },
  ];
  if (!app.enabled) return pages;
  const games = (await gallerySitemap()) ?? [];
  return [...pages, { url: `${siteUrl}/explore` }, ...games.map((g) => ({ url: `${siteUrl}/play/${g.id}`, lastModified: g.updatedAt }))];
}
