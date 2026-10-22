import { cn } from "@/lib/utils";
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
 * Hero archetypes that put a full-bleed photograph behind the top of the
 * viewport, and therefore behind the nav.
 *
 * Only `photo-full` does: it is the one with `absolute inset-0` over
 * `bg-ink-900`. The other six place their pictures inside the layout, below
 * the bar, on ordinary paper. The nav has to know which, because its colour
 * is not the same decision in the two cases — see below.
 */
const PHOTO_BACKED_HEROES = new Set(["photo-full"]);

/**
 * Fixed top navigation, built from the sections the site actually has.
 *
 * **Why the colour branches.** Over a full-bleed hero photograph the bar is
 * `text-paper-50` with `mix-blend-difference`, which inverts against
 * whatever is behind it and needs no scrim — the device the reference
 * landings use. Over any other hero it is plain `text-ink-900`.
 *
 * It used to be blend-mode for every hero, and that was only ever legible
 * by accident: `--paper-50` was not defined anywhere in the template, so the
 * declaration was invalid and the bar inherited near-black text. The moment
 * the generated ramp defined the token, a `type-only` hero rendered
 * near-white-on-near-white as far as the contrast gate could tell — and axe
 * cannot see through `mix-blend-mode`, so it reported it, correctly, as
 * unreadable. Three of the four directions prefer a non-photo hero, so this
 * would have failed most real runs.
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
  const hero = config.sections[0];
  const overPhoto =
    hero?.type === "hero" && PHOTO_BACKED_HEROES.has(hero.variant ?? "");
  const links = config.sections
    .map((section) => ({ id: section.id, label: NAV_LABELS[section.type] }))
    .filter((link): link is { id: string; label: string } => link.label !== undefined);

  return (
    <header
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50",
        overPhoto && "mix-blend-difference",
      )}
    >
      <nav
        aria-label="Ana menü"
        className={cn(
          "flex items-center justify-between gap-6 px-5 py-4 sm:px-8",
          overPhoto ? "text-paper-50" : "text-ink-900",
        )}
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
          className="btn-label pointer-events-auto -my-3 hidden min-h-11 shrink-0 items-center focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none min-[380px]:inline-flex"
        >
          {config.business.name}
        </a>

        <div className="pointer-events-auto flex shrink-0 items-center gap-6 sm:gap-8">
          <ul className="hidden items-center gap-6 lg:flex lg:gap-8">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  className="btn-label -my-3 inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap transition-opacity hover:opacity-60 focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none"
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
            className="btn-label -my-3 inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap underline-offset-8 hover:underline focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none"
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
