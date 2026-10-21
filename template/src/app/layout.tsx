import type { Metadata } from "next";
import type { CSSProperties } from "react";

import { ConsentBanner, CONSENT_PREPAINT_SCRIPT } from "@/components/consent-banner";
import { PreviewBanner } from "@/components/preview-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { StickyCta } from "@/components/sticky-cta";
import { buildLocalBusinessJsonLd } from "@/lib/jsonld";
import { fontVariables } from "@/lib/fonts";
import { buildMetadata } from "@/lib/seo";
import { SmoothScroll, SCROLL_INIT_SCRIPT } from "@/components/smooth-scroll";
import { usesSmoothScroll } from "@/lib/motion-policy";
import { siteConfig } from "~config";

import "./globals.css";

export const metadata: Metadata = buildMetadata(siteConfig);

export default function RootLayout({ children }: LayoutProps<"/">) {
  const jsonLd = buildLocalBusinessJsonLd(siteConfig);
  const main = (
    <>
      {/* pb-16 keeps the mobile sticky CTA bar from covering content. */}
      <div className="flex flex-1 flex-col pb-16 md:pb-0">{children}</div>
      <SiteFooter config={siteConfig} />
    </>
  );

  return (
    <html
      lang="tr"
      className={`${fontVariables} h-full antialiased`}
      /*
       * Brand wiring: tokens.css derives the whole --color-brand-* OKLCH ramp
       * from --brand-h / --brand-c. Overriding those two custom properties
       * inline here re-colors the entire site from site.config.ts alone.
       */
      style={
        {
          "--brand-h": String(siteConfig.brand.hue),
          "--brand-c": String(siteConfig.brand.chroma),
        } as CSSProperties
      }
      suppressHydrationWarning
    >
      <head>
        {/*
         * Pre-paint consent check: the banner is server-rendered (so it is
         * not a post-hydration LCP element); this hides it before the first
         * frame for visitors who already decided. Hence suppressHydrationWarning
         * on <html>: the script mutates the root dataset before React hydrates.
         */}
        <script dangerouslySetInnerHTML={{ __html: CONSENT_PREPAINT_SCRIPT }} />
        {/*
         * Scroll restoration, claimed before anything paints. The browser
         * restores the previous offset on reload while the page height is
         * still being decided by pins that have not been measured, so a
         * refresh lands in the middle of a pinned section — somewhere
         * different every time. An effect is too late: by the time React
         * hydrates the browser has already scrolled.
         */}
        <script dangerouslySetInnerHTML={{ __html: SCROLL_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <PreviewBanner />
        <SiteNav config={siteConfig} />
        {/*
          Lenis only when the direction asks for it (DECISIONS D10 §3.2).
          Wrapping every site unconditionally was K8: a `still` or `calm`
          direction shipped smooth scroll it had declared off, and DJ10
          failed a page that was built exactly as instructed. A direction
          without it also loses the Lenis bundle, which is the other reason
          §3.2 made it a flag.
        */}
        {usesSmoothScroll(siteConfig) ? (
          <SmoothScroll>{main}</SmoothScroll>
        ) : (
          main
        )}
        <StickyCta config={siteConfig} />
        <ConsentBanner />
      </body>
    </html>
  );
}
