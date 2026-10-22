import Image from "next/image";

import { resolveCta } from "@/lib/cta";
import { formatPhoneTR, telHref, upperTR } from "@/lib/format";
import type { HeroSection, SectionImage, SiteConfig } from "@/lib/schema";

/**
 * Hero archetype: **collage** — several of the business's own photographs,
 * arranged at different sizes and offsets rather than in a uniform grid.
 *
 * Composition from `data/corpus/shots/noho-ink-.jpg` (a cluster of pictures
 * at mixed sizes holding one half of the fold) and `belgradearbor-rs-en.jpg`
 * (type set into an image rather than beside it). Composition only.
 *
 * **The case it serves.** A business with five usable photographs and no
 * single great one. `photo-full` would pick the least bad and blow it up;
 * `split` shows one and wastes the rest. Several at modest size reads as a
 * practice with a real place, which is the argument those photographs are
 * actually making.
 *
 * **Where the pictures come from.** The hero's own `image` leads, and the
 * rest come from the gallery section's images via `config.sections` — the
 * same rule `index` follows for services: one source, no duplication, and
 * nothing stated here that the client did not publish.
 *
 * **It degrades rather than inventing.** With one picture it renders one;
 * the empty cells simply do not exist. That is D8 applied to composition.
 * The selector should still score this archetype away from a client whose
 * `photoProfile.usableCount` is below three (§6.2) — degrading gracefully is
 * not the same as being the right choice.
 *
 * **Not `offset grid`.** That archetype (still unbuilt) is a regular grid
 * whose cells are nudged off the baseline; this one is deliberately
 * irregular — different aspect per cell, no shared row. Two archetypes that
 * differ only in cell count would be one archetype with a prop (§7.2).
 */
export function HeroCollage({
  section,
  config,
}: {
  section: HeroSection;
  config: SiteConfig;
}) {
  const primary = resolveCta(section.ctaPrimary, config);

  const { district, city } = config.contact;
  const place = [district, city].filter(Boolean).join(", ");

  const gallery = config.sections.find((s) => s.type === "gallery");
  const pictures: SectionImage[] = [
    ...(section.image === undefined ? [] : [section.image]),
    ...(gallery?.images ?? []),
  ].slice(0, 3);

  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
        <div style={{ textAlign: "var(--text-align)" as never }}>
          {place !== "" && (
            <p className="meta text-[var(--ink-600)]">{upperTR(place)}</p>
          )}
          <h1 className="t-h2 mt-5 max-w-[13ch] text-[var(--ink-900)]">
            {section.headline}
          </h1>
          {section.subheadline !== undefined && (
            <p className="t-lead measure mt-6 text-[var(--ink-700)]">
              {section.subheadline}
            </p>
          )}

          <div
            className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4"
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
          </div>
        </div>

        {pictures.length > 0 && (
          /*
            Irregular on purpose: the first picture is tall and leads, the
            others are smaller and offset down the column. `--offset-y` is
            the direction's own asymmetry (0 unless the direction is
            asymmetric), so a `centered` direction gets the same cluster
            sitting square.
          */
          <div className="grid grid-cols-2 gap-4 sm:gap-5">
            <div
              className="relative col-span-1 row-span-2 w-full overflow-hidden"
              style={{
                aspectRatio: "3 / 4",
                borderRadius: "var(--image-radius)",
              }}
            >
              <Image
                src={pictures[0]!.src}
                alt={pictures[0]!.alt}
                fill
                priority
                sizes="(min-width: 1024px) 28vw, 50vw"
                className="object-cover"
              />
            </div>

            {pictures.slice(1).map((picture, i) => (
              <div
                key={picture.src}
                className="relative w-full overflow-hidden"
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: "var(--image-radius)",
                  marginTop: i === 0 ? "var(--offset-y)" : undefined,
                }}
              >
                <Image
                  src={picture.src}
                  alt={picture.alt}
                  fill
                  sizes="(min-width: 1024px) 24vw, 50vw"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
