import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/seo";

/** Sitemap for the single-page site plus its legal pages. */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    {
      url: `${siteUrl}/`,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteUrl}/kvkk-aydinlatma`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/cerez-politikasi`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
