import { telHref, waHref } from "@/lib/format";
import type { Cta, SiteConfig } from "@/lib/schema";

/**
 * Resolves a CTA to its href:
 * - "tel" dials the business phone from config.contact,
 * - "whatsapp" opens a wa.me chat with the business WhatsApp number,
 * - "link" uses the CTA's own href (schema guarantees it is present).
 */
export function resolveCtaHref(cta: Cta, config: SiteConfig): string {
  switch (cta.action) {
    case "tel":
      return telHref(config.contact.phoneE164);
    case "whatsapp":
      return waHref(config.contact.whatsappE164);
    case "link":
      return cta.href ?? "#";
  }
}
