import { telHref, waHref } from "@/lib/format";
import type { Cta, SiteConfig } from "@/lib/schema";

/**
 * The label a degraded WhatsApp CTA takes. Same wording the mobile sticky bar
 * uses for its call button (`components/sticky-cta.tsx`), so a visitor never
 * sees two different words for the same action on one page.
 */
const PHONE_CTA_LABEL = "Hemen Ara";

/** A CTA resolved to what the anchor actually renders. */
export interface ResolvedCta {
  href: string;
  label: string;
}

/**
 * Resolves a CTA to its href AND its label:
 * - "tel" dials the business phone from config.contact,
 * - "whatsapp" opens a wa.me chat, or degrades to the phone — **both** the
 *   href and the label — when the business advertises no WhatsApp (D8),
 * - "link" uses the CTA's own href (schema guarantees it is present).
 *
 * The label has to degrade with the href. Returning only the href left a
 * button reading "WhatsApp'tan Yaz" wired to `tel:`, which promises a channel
 * the business does not have and that nothing then catches: there is no dead
 * link for a gate to find, and the label is content, so the geometry and smoke
 * gates both pass it. Found while verifying A0 against a null-WhatsApp
 * fixture.
 *
 * The plan stage must not emit a "whatsapp" action for a business with no
 * number (`apps/orchestrator/src/stages/plan.ts`), so this is the second line
 * of defence rather than the first.
 */
export function resolveCta(cta: Cta, config: SiteConfig): ResolvedCta {
  switch (cta.action) {
    case "tel":
      return { href: telHref(config.contact.phoneE164), label: cta.label };
    case "whatsapp":
      return config.contact.whatsappE164 === null
        ? { href: telHref(config.contact.phoneE164), label: PHONE_CTA_LABEL }
        : { href: waHref(config.contact.whatsappE164), label: cta.label };
    case "link":
      return { href: cta.href ?? "#", label: cta.label };
  }
}

/** Href only, for call sites that render their own label. */
export function resolveCtaHref(cta: Cta, config: SiteConfig): string {
  return resolveCta(cta, config).href;
}
