import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://partneraeo.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
