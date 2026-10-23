// Search and sharing: the site's description and the structured data search engines read.
// Prices and names come from site.ts, so a pricing change updates these too.
import { plans, site } from "./site";

export const siteUrl = `https://${site.domain}`;

export const description =
  "Describe a game in one sentence. TypePlay builds it in a real game engine in minutes; you play it in the browser, change it by chatting, and ship it to the web, Android, iOS and Steam.";

/** Schema.org graph for the home page: who runs the site, the site, and the app with its plans. */
export const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: site.name,
      url: siteUrl,
      logo: `${siteUrl}/icons/icon-512.png`,
      email: site.email,
      telephone: site.phone ?? undefined,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: site.name,
      url: siteUrl,
      inLanguage: "en",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#app`,
      name: site.name,
      url: siteUrl,
      description,
      applicationCategory: "GameApplication",
      operatingSystem: "Any (runs in a web browser)",
      publisher: { "@id": `${siteUrl}/#organization` },
      offers: plans.map((p) => ({
        "@type": "Offer",
        name: p.name,
        description: p.summary,
        price: p.price,
        priceCurrency: "USD",
        url: `${siteUrl}/pricing`,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: p.price,
          priceCurrency: "USD",
          unitCode: "MON",
        },
      })),
    },
  ],
};

/** A page's date for the sitemap, from a date written like "13 October 2026"; none if unreadable. */
export function sitemapDate(written: string): Date | undefined {
  const d = new Date(`${written} UTC`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
