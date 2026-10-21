import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    /*
     * The template ships SVG placeholder images (public/images/*) rendered
     * through next/image. The restrictive CSP below is the documented safe
     * combination; once the fill stage swaps in real photos (jpg/webp) this
     * block can be removed.
     */
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    // Belt-and-braces with src/proxy.ts: preview deployments must never be
    // indexed, even if a response bypasses the proxy.
    if (!process.env.SITE_PREVIEW) {
      return [];
    }
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
