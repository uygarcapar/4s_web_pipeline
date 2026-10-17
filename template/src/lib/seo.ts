import type { Metadata } from "next";

import type { SiteConfig } from "@/lib/schema";

/**
 * Canonical site origin, used for metadataBase, canonical links, OG URLs
 * and the sitemap. SITE_URL is set by the deploy stage;
 * VERCEL_PROJECT_PRODUCTION_URL is injected by Vercel itself, so a site
 * deployed by hand still never ships a localhost canonical. Localhost is
 * only the local-build fallback.
 */
export function getSiteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
}

/** True when this deployment is a draft preview (SITE_PREVIEW env set). */
export function isPreview(): boolean {
  return Boolean(process.env.SITE_PREVIEW);
}

/**
 * Builds the root metadata for the site from the validated config.
 *
 * - `metadataBase` from SITE_URL (localhost fallback) so OG URLs resolve.
 * - `title.template` suffixes inner pages with the business name.
 * - Turkish locale throughout (`openGraph.locale: "tr_TR"`, tr-TR alternates).
 * - Preview deployments are marked noindex/nofollow.
 */
export function buildMetadata(config: SiteConfig): Metadata {
  const metadata: Metadata = {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: config.seo.title,
      template: `%s | ${config.business.name}`,
    },
    description: config.seo.description,
    openGraph: {
      type: "website",
      locale: "tr_TR",
      siteName: config.business.name,
      title: config.seo.title,
      description: config.seo.description,
      url: "/",
    },
    alternates: {
      canonical: "/",
      languages: {
        "tr-TR": "/",
        "x-default": "/",
      },
    },
  };

  if (isPreview()) {
    metadata.robots = { index: false, follow: false };
  }

  return metadata;
}
