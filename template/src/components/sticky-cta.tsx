import { telHref, waHref } from "@/lib/format";
import type { SiteConfig } from "@/lib/schema";

/**
 * Mobile-only sticky CTA bar fixed to the bottom of the viewport with
 * call and WhatsApp shortcuts. Hidden on md+ screens; layout.tsx adds
 * matching bottom padding so content is never covered.
 */
export function StickyCta({ config }: { config: SiteConfig }) {
  return (
    <nav
      aria-label="Hızlı iletişim"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-px border-t border-brand-200 bg-brand-200 md:hidden"
    >
      <a
        href={telHref(config.contact.phoneE164)}
        className="flex items-center justify-center gap-2 bg-brand-600 py-3.5 text-base font-semibold text-brand-50"
      >
        Hemen Ara
      </a>
      <a
        href={waHref(
          config.contact.whatsappE164,
          "Merhaba, bilgi almak istiyorum.",
        )}
        className="flex items-center justify-center gap-2 bg-background py-3.5 text-base font-semibold text-brand-700"
      >
        WhatsApp
      </a>
    </nav>
  );
}
