import Image from "next/image";

import { upperTR } from "@/lib/format";
import type { ServicesSection, SiteConfig } from "@/lib/schema";

/**
 * Services archetype: **alternating media** — each service a full row, its
 * photograph and its words swapping sides down the page.
 *
 * Composition from `data/corpus/shots/lpas-com-.jpg` and
 * `www-butter-video-.jpg`: wide rows, one picture each, the eye crossing the
 * page rather than scanning a grid of cards.
 *
 * **Why this one matters for these clients.** A Turkish SMB's services page
 * usually has a real photograph per treatment or job — and the card grid the
 * template shipped with renders them as thumbnails, which is where "bazı
 * fotolar yok" came from: at card size a missing picture is a hole, and at
 * row size a present one is the argument. This archetype gives each service
 * the room its photograph needs.
 *
 * **Degrades per row, not per section.** A service with no `image` renders
 * as a full-width text row rather than a gap or a placeholder — D8 applied
 * to composition, and §9's "drop empty sections" applied one level down.
 * Mixed is the normal case: three services photographed, two not.
 *
 * **Reads only tokens.** `--image-radius` and `--image-aspect` frame the
 * picture the way the direction frames pictures, `--rule-*` draws the row
 * divider, `--section-y` sets the rhythm. No branch on a direction's name.
 *
 * **Server component, no motion.** Row-by-row reveals are the fade-up §3
 * bans as a page's whole vocabulary.
 */
export function ServicesAlternating({
  section,
}: {
  section: ServicesSection;
  config: SiteConfig;
}) {
  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        {section.title !== undefined && (
          <h2
            className="t-h2 max-w-[16ch] text-[var(--ink-900)]"
            style={{ textAlign: "var(--text-align)" as never }}
          >
            {section.title}
          </h2>
        )}

        <ul className="mt-12 lg:mt-16">
          {section.items.map((item, i) => {
            /*
              Alternation counts PHOTOGRAPHED rows, not all rows. Keyed off
              the item index — as the first version was — two services with
              pictures at positions 0 and 2 both land on the left and the
              page stops alternating at all. Text-only rows are full width
              and have no side to take.
            */
            const photographedBefore = section.items
              .slice(0, i)
              .filter((earlier) => earlier.image !== undefined).length;
            return (
            <li
              key={item.title}
              className="grid gap-8 border-t py-10 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-14"
              style={{
                borderTopWidth: "var(--rule-width)",
                borderTopColor: "var(--rule-color)",
              }}
            >
              {/*
                Below `lg` the grid is one column and the picture always
                leads: a stacked row that sometimes starts with text and
                sometimes with an image reads as a mistake on a phone.
              */}
              {item.image !== undefined && (
                <div
                  className={`relative w-full overflow-hidden ${
                    photographedBefore % 2 === 1 ? "lg:order-last" : ""
                  }`}
                  style={{
                    aspectRatio: "var(--image-aspect)" as never,
                    borderRadius: "var(--image-radius)",
                  }}
                >
                  <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    fill
                    loading="lazy"
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )}

              {/* A service with no photograph takes the whole row rather than
                  leaving half of it empty. */}
              <div className={item.image === undefined ? "lg:col-span-2" : ""}>
                <p className="meta text-[var(--ink-400)]">
                  {upperTR(String(i + 1).padStart(2, "0"))}
                </p>
                <h3 className="t-h2-col mt-3 text-[var(--ink-900)]">
                  {item.title}
                </h3>
                <p className="t-body measure mt-5 text-[var(--ink-700)]">
                  {item.description}
                </p>
              </div>
            </li>
            );
          })}
          <li
            className="border-t"
            style={{
              borderTopWidth: "var(--rule-width)",
              borderTopColor: "var(--rule-color)",
            }}
          />
        </ul>
      </div>
    </section>
  );
}
