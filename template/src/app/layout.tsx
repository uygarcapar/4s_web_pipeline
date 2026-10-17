import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import type { CSSProperties } from "react";

import { ConsentBanner } from "@/components/consent-banner";
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
});

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
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
    >
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
