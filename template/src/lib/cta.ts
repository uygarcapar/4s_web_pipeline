import { telHref, waHref } from "@/lib/format";
import type { Cta, SiteConfig } from "@/lib/schema";

/**
 * Resolves a CTA to its href:
 * - "tel" dials the business phone from config.contact,
 * - "whatsapp" opens a wa.me chat with the business WhatsApp number, or
 *   dials the phone instead when the business advertises no WhatsApp
 *   (DECISIONS D8) — a "whatsapp" CTA should not be planned in that case,
 *   but a dead href must never reach the page,
 * - "link" uses the CTA's own href (schema guarantees it is present).
 */
export function resolveCtaHref(cta: Cta, config: SiteConfig): string {
  switch (cta.action) {
    case "tel":
      return telHref(config.contact.phoneE164);
    case "whatsapp":
      return config.contact.whatsappE164 === null
        ? telHref(config.contact.phoneE164)
        : waHref(config.contact.whatsappE164);
    case "link":
      return cta.href ?? "#";
  }
}
