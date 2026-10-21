import type { SiteConfig } from "@/lib/schema";
import { getSiteUrl } from "@/lib/seo";

/** schema.org DayOfWeek names indexed by ISO weekday (1 = Monday). */
const SCHEMA_ORG_DAYS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/**
 * Builds a schema.org LocalBusiness JSON-LD object from the site config.
 *
 * `@type` comes from `config.businessType` (defaults to "LocalBusiness" in
 * the schema). `geo` is intentionally omitted — we only have a free-text
 * maps query, not verified coordinates.
 */
export function buildLocalBusinessJsonLd(config: SiteConfig): Record<string, unknown> {
  const openingHoursSpecification = config.openingHours
    .filter((entry) => entry.opens !== null && entry.closes !== null)
    .map((entry) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: SCHEMA_ORG_DAYS[entry.day],
      opens: entry.opens,
      closes: entry.closes,
    }));

  // Unpublished facts are omitted rather than emitted as null: a null
  // `legalName` or an empty `openingHoursSpecification` is an invalid value
  // Google reports as a structured-data error, and `hoursNote` cannot be
  // expressed as an OpeningHoursSpecification without a day mapping
  // (DECISIONS D8).
  return {
    "@context": "https://schema.org",
    "@type": config.businessType,
    name: config.business.name,
    ...(config.business.legalName !== null
      ? { legalName: config.business.legalName }
      : {}),
    url: getSiteUrl(),
    telephone: config.contact.phoneE164,
    email: config.contact.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: config.contact.address,
      addressLocality: config.contact.district,
      addressRegion: config.contact.city,
      addressCountry: "TR",
    },
    ...(openingHoursSpecification.length > 0
      ? { openingHoursSpecification }
      : {}),
  };
}
