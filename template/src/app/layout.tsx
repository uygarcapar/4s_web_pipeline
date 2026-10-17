import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import type { CSSProperties } from "react";

import { ConsentBanner, CONSENT_PREPAINT_SCRIPT } from "@/components/consent-banner";
import { PreviewBanner } from "@/components/preview-banner";
import { SiteFooter } from "@/components/site-footer";
import { StickyCta } from "@/components/sticky-cta";
import { buildLocalBusinessJsonLd } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/seo";
import { siteConfig } from "~config";

import "./globals.css";

/*
 * Fonts: a serif heading face and a sans body face, both loaded with the
 * "latin-ext" subset so Turkish characters (ğ, ş, İ, ...) render correctly.
 * The CSS variables are consumed by src/styles/tokens.css (--font-heading /
 * --font-sans Tailwind tokens).
 */
const headingFont = Lora({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext"],
  // Static instances only. Without `weight`, next/font ships the full
  // variable font (~192 KB for both families), which delayed the text LCP
  // past the 2.5 s gate. The template uses semibold headings and regular
  // body copy; add a weight here only when a section actually needs it.
  weight: ["600"],
  display: "swap",
});

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = buildMetadata(siteConfig);

export default function RootLayout({ children }: LayoutProps<"/">) {
  const jsonLd = buildLocalBusinessJsonLd(siteConfig);

  return (
    <html
      lang="tr"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
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
      </head>
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <PreviewBanner />
        {/* pb-16 keeps the mobile sticky CTA bar from covering content. */}
        <div className="flex flex-1 flex-col pb-16 md:pb-0">{children}</div>
        <SiteFooter config={siteConfig} />
        <StickyCta config={siteConfig} />
        <ConsentBanner />
      </body>
    </html>
  );
}
