import type { MapSection, SiteConfig } from "@/lib/schema";
import { cn } from "cn";

interface MapProps {
  section: MapSection;
  config: SiteConfig;
}

/**
 * Google Maps embed driven by config.contact.mapsEmbedQuery — the section
 * itself has no extra props. "tall" variant increases the embed height.
 */
export function MapEmbed({ section, config }: MapProps) {
  const query = encodeURIComponent(config.contact.mapsEmbedQuery);

  return (
    <section id={section.id} className="mx-auto max-w-5xl px-4 pb-16">
      <h2 className="sr-only">Konum</h2>
      <iframe
        src={`https://www.google.com/maps?q=${query}&output=embed&hl=tr`}
        title={`Harita: ${config.business.name} konumu`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className={cn(
          "w-full rounded-xl border border-brand-100",
          section.variant === "tall" ? "h-[480px]" : "h-[320px]",
        )}
      />
    </section>
  );
}
