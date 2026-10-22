import { formatPhoneTR, telHref } from "@/lib/format";
import type { SiteConfig } from "@/lib/schema";

/** Turkish label for each section type that is worth a nav entry. */
const NAV_LABELS: Partial<Record<SiteConfig["sections"][number]["type"], string>> = {
  services: "Hizmetler",
  gallery: "Galeri",
  team: "Ekibimiz",
  faq: "Sık Sorulanlar",
  hours: "Çalışma Saatleri",
  contact: "İletişim",
};

/**
 * Fixed top navigation, built from the sections the site actually has.
 *
 * `mix-blend-difference` is what lets one bar sit over a full-bleed hero
 * photograph and then over the pale sections below it without a background
 * plate of its own: it inverts against whatever is behind it. That is the
 * device the reference landings use, and it is why the bar needs no scrim.
 *
 * `pointer-events-none` on the header with `pointer-events-auto` on the
 * controls keeps the transparent band from swallowing clicks meant for the
 * hero underneath.
 *
 * Tracking stays at the scale's 0.07em rather than the references' 0.3em:
 * design-rules.md §4 caps uppercase tracking at 0.08em because that spread
 * slows reading of short agglutinated Turkish.
 */
export function SiteNav({ config }: { config: SiteConfig }) {
  const links = config.sections
    .map((section) => ({ id: section.id, label: NAV_LABELS[section.type] }))
    .filter((link): link is { id: string; label: string } => link.label !== undefined);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 mix-blend-difference">
      <nav
        aria-label="Ana menü"
        className="flex items-center justify-between gap-6 px-5 py-4 text-paper-50 sm:px-8"
      >
        {/*
          Hidden on the narrowest phones: `.btn-label` sets `nowrap`, so a
          long business name cannot wrap, and at 344px it would push the bar
          wider than the fold. The hero and the footer both carry the name
          there; what the bar must keep at every width is the call.

          `shrink-0`, not `min-w-0`: in a flex row the name was being crushed
          to **zero width** at 768–844px once a team section added another
          anchor — `nowrap` kept it on one line and the flex algorithm took
          the width away instead, which the geometry gate reads (correctly)
          as a 0×44 tap target. The link list moves to `lg` for the same
          reason: a crowded nav at tablet width is worse than a shorter one.
        */}
        <a
          href="#hero"
          className="btn-label pointer-events-auto -my-3 hidden min-h-11 shrink-0 items-center focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:outline-none min-[380px]:inline-flex"
        >
          {config.business.name}
        </a>

        <div className="pointer-events-auto flex shrink-0 items-center gap-6 sm:gap-8">
          <ul className="hidden items-center gap-6 lg:flex lg:gap-8">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  className="btn-label -my-3 inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap transition-opacity hover:opacity-60 focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:outline-none"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* The number stays reachable from every scroll position; on a
              phone the sticky bar carries the same call, so this collapses
              to the label alone rather than repeating a long number. */}
          <a
            href={telHref(config.contact.phoneE164)}
            // min-w-11: below sm this collapses to the word "Ara", which on
            // its own is a 29px-wide tap target — under the 44px floor.
            className="btn-label -my-3 inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap underline-offset-8 hover:underline focus-visible:ring-2 focus-visible:ring-paper-50 focus-visible:outline-none"
          >
            <span className="hidden tabular-nums sm:inline">
              {formatPhoneTR(config.contact.phoneE164)}
            </span>
            <span className="sm:hidden">Ara</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
