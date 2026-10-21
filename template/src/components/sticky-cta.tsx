import { telHref, waHref } from "@/lib/format";
import type { SiteConfig } from "@/lib/schema";
import { cn } from "cn";

/**
 * Mobile-only sticky CTA bar fixed to the bottom of the viewport with
 * call and WhatsApp shortcuts. Hidden on md+ screens; layout.tsx adds
 * matching bottom padding so content is never covered.
 *
 * When the business advertises no WhatsApp number the bar becomes a single
 * full-width call button rather than promising a channel nobody reads
 * (DECISIONS D8).
 */
export function StickyCta({ config }: { config: SiteConfig }) {
  const whatsapp = config.contact.whatsappE164;

  return (
    <nav
      aria-label="Hızlı iletişim"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid gap-px border-t border-brand-200 bg-brand-200 md:hidden",
        whatsapp === null ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      <a
        href={telHref(config.contact.phoneE164)}
        className="flex items-center justify-center gap-2 bg-brand-600 py-3.5 text-base font-semibold text-brand-50"
      >
        Hemen Ara
      </a>
      {whatsapp !== null && (
        <a
          href={waHref(whatsapp, "Merhaba, bilgi almak istiyorum.")}
          className="flex items-center justify-center gap-2 bg-background py-3.5 text-base font-semibold text-brand-700"
        >
          WhatsApp
        </a>
      )}
    </nav>
  );
}
