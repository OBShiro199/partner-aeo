import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://partneraeo.com";

// Only the marketing pages are for search engines; the app and embeds are private or third-party.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/login", "/signup"], disallow: ["/dashboard", "/clients", "/leads", "/strategy", "/widget", "/lab", "/billing", "/settings", "/onboarding", "/embed/", "/reset", "/unsubscribe"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
