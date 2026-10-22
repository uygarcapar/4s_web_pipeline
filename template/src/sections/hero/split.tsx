import Image from "next/image";

import { resolveCta } from "@/lib/cta";
import { formatPhoneTR, telHref, upperTR } from "@/lib/format";
import { hoursSummary } from "@/lib/hours-summary";
import type { HeroSection, SiteConfig } from "@/lib/schema";

/**
 * Hero archetype: **split** — the headline and the photograph side by side.
 *
 * Composition from `data/corpus/shots/noho-ink-.jpg` (a left-flush display
 * block against a picture that owns the other half, neither crowding the
 * other). Composition only.
 *
 * **The case this exists for.** `photo-full` needs a photograph good enough
 * to fill a screen; `type-only` needs none at all. Most crawled SMB sites
 * sit between: one or two usable interior shots, fine at half a screen and
 * poor at full bleed. Without this archetype those clients get pushed to one
 * extreme or the other, and the full-bleed extreme is the one that looks
 * cheap.
 *
 * **Not `hero/default` rebuilt.** The legacy component hardcodes `text-4xl`,
 * a `brand-*` gradient and its own spacing, so it looks identical under every
 * direction — which is why the design stage was never allowed to pick it
 * (`ARCHETYPES` in `design/dna.ts`). This reads only tokens.
 *
 * **Server component, no motion.** The scroll choreography belongs to
 * `photo-full`'s pinned hand-off and the statement's word reveal; a third
 * moving hero would make the motion profile meaningless.
 */
export function HeroSplit({
  section,
  config,
}: {
  section: HeroSection;
  config: SiteConfig;
}) {
  const primary = resolveCta(section.ctaPrimary, config);
  const secondary =
    section.ctaSecondary === undefined
      ? null
      : resolveCta(section.ctaSecondary, config);

  const { district, city } = config.contact;
  const place = [district, city].filter(Boolean).join(", ");
  const hours = hoursSummary(config);

  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div style={{ textAlign: "var(--text-align)" as never }}>
          {place !== "" && (
            <p className="meta text-[var(--ink-600)]">{upperTR(place)}</p>
          )}

          <h1 className="t-h2 mt-5 max-w-[14ch] text-[var(--ink-900)]">
            {section.headline}
          </h1>

          {section.subheadline !== undefined && (
            <p className="t-lead measure mt-6 text-[var(--ink-700)]">
              {section.subheadline}
            </p>
          )}

          <div
            className="mt-9 flex flex-wrap gap-4"
            style={{ justifyContent: "var(--align-items)" as never }}
          >
            <a
              href={primary.href}
              className="btn-label inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--ink-900)] px-7 text-[var(--paper-50)] transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {primary.label}
            </a>
            {secondary !== null && (
              <a
                href={secondary.href}
                className="btn-label inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--paper-200)] px-7 text-[var(--ink-900)] transition-colors hover:bg-[var(--paper-300)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
                style={{
                  borderWidth: "var(--rule-width)",
                  borderColor: "var(--rule-color)",
                }}
              >
                {secondary.label}
              </a>
            )}
          </div>

          {/*
            §8: the first viewport carries real facts. Two here rather than
            the three `type-only` sets — the photograph is taking the room,
            and the visit section carries the address in full.
          */}
          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <dt className="meta text-[var(--ink-400)]">Telefon</dt>
              <dd className="t-body mt-1">
                <a
                  href={telHref(config.contact.phoneE164)}
                  className="-my-3 inline-flex min-h-11 items-center whitespace-nowrap text-[var(--ink-900)] underline-offset-4 hover:underline"
                >
                  {formatPhoneTR(config.contact.phoneE164)}
                </a>
              </dd>
            </div>
            {hours !== null && (
              <div>
                <dt className="meta text-[var(--ink-400)]">Çalışma saatleri</dt>
                <dd className="t-body mt-1 text-[var(--ink-700)]">{hours}</dd>
              </div>
            )}
          </dl>
        </div>

        {/*
          The photograph, framed the way the direction frames photographs.
          `--image-aspect` is what makes this archetype read differently
          rather than merely recoloured: `masked` gives a tall window,
          `bleed` a wide one, and the text column re-flows around it.
        */}
        {section.image !== undefined && (
          <div
            className="relative w-full overflow-hidden"
            style={{
              aspectRatio: "var(--image-aspect)" as never,
              borderRadius: "var(--image-radius)",
              marginInline: "calc(var(--image-inset) * -1)",
            }}
          >
            <Image
              src={section.image.src}
              alt={section.image.alt}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        )}
      </div>
    </section>
  );
}
