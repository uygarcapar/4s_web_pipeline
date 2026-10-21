import Image from "next/image";

import { buttonVariants } from "@/components/ui/button";
import { resolveCta } from "@/lib/cta";
import type { Cta, HeroSection, SiteConfig } from "@/lib/schema";
import { cn } from "cn";

interface HeroProps {
  section: HeroSection;
  config: SiteConfig;
}

function CtaLink({
  cta,
  config,
  kind,
}: {
  cta: Cta;
  config: SiteConfig;
  kind: "primary" | "secondary";
}) {
  const { href, label } = resolveCta(cta, config);
  return (
    <a
      href={href}
      className={cn(
        buttonVariants({
          variant: kind === "primary" ? "default" : "outline",
          size: "lg",
        }),
        "px-6 text-base",
      )}
    >
      {label}
    </a>
  );
}

/** Opening section: headline, subheadline, primary/secondary CTA, image. */
export function Hero({ section, config }: HeroProps) {
  const centered = section.variant === "centered" || section.image === undefined;

  return (
    <section
      id={section.id}
      className="border-b border-brand-100 bg-gradient-to-b from-brand-50 to-background"
    >
      <div
        className={cn(
          "mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 sm:py-24",
          centered ? "text-center" : "md:grid-cols-2",
        )}
      >
        <div className={cn("flex flex-col gap-5", centered && "items-center")}>
          <p className="text-sm font-semibold tracking-wide text-brand-700">
            {config.business.name} · {config.contact.district}
          </p>
          <h1 className="font-heading text-4xl leading-tight font-semibold text-balance text-foreground sm:text-5xl">
            {section.headline}
          </h1>
          {section.subheadline !== undefined && (
            <p className="max-w-prose text-lg text-muted-foreground">
              {section.subheadline}
            </p>
          )}
          <div
            className={cn(
              "mt-2 flex flex-wrap gap-3",
              centered && "justify-center",
            )}
          >
            <CtaLink cta={section.ctaPrimary} config={config} kind="primary" />
            {section.ctaSecondary !== undefined && (
              <CtaLink
                cta={section.ctaSecondary}
                config={config}
                kind="secondary"
              />
            )}
          </div>
        </div>
        {!centered && section.image !== undefined && (
          <Image
            src={section.image.src}
            alt={section.image.alt}
            width={1200}
            height={900}
            priority
            className="w-full rounded-2xl object-cover shadow-lg ring-1 ring-brand-200"
          />
        )}
      </div>
    </section>
  );
}
