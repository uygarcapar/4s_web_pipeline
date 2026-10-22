import Image from "next/image";

import { resolveCta } from "@/lib/cta";
import { formatPhoneTR, telHref, upperTR } from "@/lib/format";
import { hoursSummary } from "@/lib/hours-summary";
import type { HeroSection, SiteConfig } from "@/lib/schema";

/**
 * Hero archetype: **offset grid** — a regular twelve-column grid whose cells
 * are deliberately nudged off the baseline.
 *
 * Composition from `data/corpus/shots/www-aspensearch-com-.jpg`: hard cells
 * meeting on shared rules, the headline owning one and the supporting facts
 * filling the others, with one cell pushed down so the grid reads as
 * constructed rather than defaulted. Composition only.
 *
 * **Not `collage`.** That one is irregular by design — different aspect per
 * cell, no shared row. This one is regular: every cell sits on the same
 * twelve-column grid and shares its neighbours' rules, and the only
 * irregularity is a single vertical offset. §7.2 calls two archetypes that
 * differ only in cell count one archetype with a prop; these differ in
 * whether a grid exists at all.
 *
 * **The direction decides how much it offsets.** `--offset-y` is `4rem`
 * under an `asymmetric` direction and `0` under a centred or left-flush one,
 * so under `editorial-serif` this is a plain, square, ordered grid and under
 * `swiss-grid` it steps. The same markup, materially different — which is
 * the §7.2 property that matters.
 *
 * **Server component, no motion.** A grid that assembles on scroll is the
 * `editorial` profile's business and would be the page's third moving
 * element.
 */
export function HeroOffsetGrid({
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

  /*
    A surface as well as a border. A direction whose `rules` are `none` sets
    `--rule-width` to 0, and the first version of this archetype then had no
    visible grid at all — the one thing it is named for. The tint is what
    makes a cell a cell under `editorial-serif` and `quiet-luxury`; the
    border adds definition under the two directions that do use rules.
  */
  const cell = {
    borderWidth: "var(--rule-width)",
    borderColor: "var(--rule-color)",
    background: "var(--paper-200)",
  } as const;

  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="grid grid-cols-1 gap-px sm:grid-cols-12">
          {/* The headline cell: seven of twelve columns, so the grid is
              visibly uneven without the headline losing its measure. */}
          <div
            className="border p-6 sm:col-span-7 sm:p-8"
            style={{ ...cell, textAlign: "var(--text-align)" as never }}
          >
            {place !== "" && (
              <p className="meta text-[var(--ink-600)]">{upperTR(place)}</p>
            )}
            <h1 className="t-h2 mt-5 max-w-[13ch] text-[var(--ink-900)]">
              {section.headline}
            </h1>
          </div>

          {/* The picture cell, pushed down by the direction's own offset. */}
          <div
            className="relative min-h-56 overflow-hidden border sm:col-span-5"
            style={{ ...cell, marginTop: "var(--offset-y)" }}
          >
            {section.image !== undefined && (
              <Image
                src={section.image.src}
                alt={section.image.alt}
                fill
                priority
                sizes="(min-width: 640px) 40vw, 100vw"
                className="object-cover"
              />
            )}
          </div>

          {section.subheadline !== undefined && (
            <div className="border p-6 sm:col-span-5 sm:p-8" style={cell}>
              <p className="t-lead measure text-[var(--ink-700)]">
                {section.subheadline}
              </p>
            </div>
          )}

          {/* Facts fill the remaining cells: §8 wants them in the first
              viewport, and on a grid they are cells like any other rather
              than a footnote under it. */}
          <div className="border p-6 sm:col-span-4 sm:p-8" style={cell}>
            <p className="meta text-[var(--ink-400)]">Telefon</p>
            <p className="t-h3 mt-2">
              <a
                href={telHref(config.contact.phoneE164)}
                className="-my-3 inline-flex min-h-11 items-center whitespace-nowrap text-[var(--ink-900)] underline-offset-4 hover:underline"
              >
                {formatPhoneTR(config.contact.phoneE164)}
              </a>
            </p>
          </div>

          <div
            className="flex flex-col justify-between gap-5 border p-6 sm:col-span-3 sm:p-8"
            style={cell}
          >
            {hours !== null && (
              <div>
                <p className="meta text-[var(--ink-400)]">Çalışma saatleri</p>
                <p className="t-body mt-2 text-[var(--ink-700)]">{hours}</p>
              </div>
            )}
            <a
              href={primary.href}
              className="btn-label inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-[var(--ink-900)] px-6 text-[var(--paper-50)] transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {primary.label}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
