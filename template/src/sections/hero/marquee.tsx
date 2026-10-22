import { Marquee } from "@/sections/marquee";
import { resolveCta } from "@/lib/cta";
import { formatPhoneTR, telHref, upperTR } from "@/lib/format";
import { hoursSummary } from "@/lib/hours-summary";
import type { HeroSection, SiteConfig } from "@/lib/schema";

/**
 * Hero archetype: **marquee** — the headline with a running band of the
 * client's own phrases set into the fold rather than further down the page.
 *
 * Composition from `data/corpus/shots/hobro-digital-.jpg` (display type with
 * a mono micro-stack directly beneath it) and `aardvarkbookclub-com-.jpg`.
 * Composition only.
 *
 * **What the band is for here.** On the standalone `marquee` section it is a
 * divider between two parts of the page. In the fold it does a different
 * job: it shows the *breadth* of what the business does in the first screen,
 * which a headline cannot and a services list only does at length. For a
 * trade with many small services — a repair shop, a salon — that breadth is
 * the proposition.
 *
 * **It composes the `marquee` section rather than reimplementing it.** The
 * band's motion policy is not trivial: it runs only under `editorial` and
 * `kinetic`, pauses off-screen, duplicates its items `aria-hidden` for a
 * seamless loop, and degrades to a static wrapped row. Copying that into a
 * second component would mean two places to get it wrong, and the one that
 * drifts would be the one nobody is looking at.
 *
 * **Where the items come from.** The services section's titles via
 * `config.sections` — the same rule `index` and `collage` follow. If there
 * is no services section there is no band, and the hero is headline and
 * facts.
 */
export function HeroMarquee({
  section,
  config,
}: {
  section: HeroSection;
  config: SiteConfig;
}) {
  const primary = resolveCta(section.ctaPrimary, config);

  const { district, city } = config.contact;
  const place = [district, city].filter(Boolean).join(", ");
  const hours = hoursSummary(config);

  const services = config.sections.find((s) => s.type === "services");
  const items = services?.items.map((item) => item.title) ?? [];

  return (
    <section
      id={section.id}
      className="flex min-h-[80svh] flex-col justify-between bg-[var(--paper-100)] pt-[var(--section-y)] lg:pt-[var(--section-y-lg)]"
    >
      <div
        className="mx-auto w-full max-w-7xl flex-1 px-5 sm:px-8"
        style={{ textAlign: "var(--text-align)" as never }}
      >
        {place !== "" && (
          <p className="meta text-[var(--ink-600)]">{upperTR(place)}</p>
        )}

        <h1 className="t-display mt-6 max-w-[15ch] text-[var(--ink-900)]">
          {section.headline}
        </h1>

        {section.subheadline !== undefined && (
          <p className="t-lead measure mt-7 text-[var(--ink-700)]">
            {section.subheadline}
          </p>
        )}

        <div
          className="mt-10 flex flex-wrap items-center gap-x-9 gap-y-4"
          style={{ justifyContent: "var(--align-items)" as never }}
        >
          <a
            href={primary.href}
            className="btn-label inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--ink-900)] px-7 text-[var(--paper-50)] transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {primary.label}
          </a>
          <a
            href={telHref(config.contact.phoneE164)}
            className="t-body -my-3 inline-flex min-h-11 items-center whitespace-nowrap text-[var(--ink-900)] underline-offset-4 hover:underline"
          >
            {formatPhoneTR(config.contact.phoneE164)}
          </a>
          {hours !== null && (
            <span className="t-body text-[var(--ink-600)]">{hours}</span>
          )}
        </div>
      </div>

      {/*
        The band closes the fold. `marqueeSectionSchema` requires three items,
        so fewer than three is not a marquee — the hero simply ends at the
        facts rather than showing a band of one word, which is generic
        cluster 5 exactly.
      */}
      {items.length >= 3 && (
        <div className="mt-[var(--section-y)]">
          <Marquee
            section={{
              type: "marquee",
              id: `${section.id}-band`,
              variant: "ticker",
              items,
            }}
            config={config}
          />
        </div>
      )}
    </section>
  );
}
