import type { MetadataRoute } from "next";

import { getSiteUrl, isPreview } from "@/lib/seo";

/**
 * robots.txt: preview deployments (SITE_PREVIEW set) are fully disallowed;
 * production allows everything and advertises the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  if (isPreview()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
