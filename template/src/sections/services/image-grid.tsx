import Image from "next/image";

import { upperTR } from "@/lib/format";
import type { ServicesSection, SiteConfig } from "@/lib/schema";

/**
 * Services archetype: **image grid** — each service a cell, its photograph
 * filling it and its name sitting on the picture.
 *
 * Composition from `data/corpus/shots/noho-ink-.jpg` (a grid of pictures at
 * one size, read as a set rather than a list) and `lxlcreative-co-uk-.jpg`.
 *
 * **Not the card grid this template shipped with.** That one put a
 * thumbnail, a title and a paragraph inside a bordered card, which makes the
 * photograph an illustration of the text. Here the photograph *is* the cell:
 * the name sits on it, and the description is a line underneath rather than
 * a block beside it. For a trade whose work is visual — a salon, a tiler, a
 * clinic with before/after rooms — the pictures are what a visitor is
 * scanning for.
 *
 * **It needs photographs, and says so by rendering text cells when they are
 * absent.** A service with no `image` gets a flat `--paper-50` cell with
 * the same name and line, so a half-photographed list still reads as one
 * grid rather than a grid with holes. The selector should prefer
 * `accordion` or `alternating` for a client whose `photoProfile` is thin
 * (§6.2) — this archetype degrades, but degrading is not the same as being
 * the right choice.
 *
 * **Scrim, not a tint.** Text on a photograph needs a dark gradient at the
 * foot of the cell: a flat overlay washes the picture out, and a page of
 * washed-out pictures is the "stock-photo luxury" cluster §2 fails. The
 * scrim is strongest exactly where the text sits.
 *
 * **Server component, no motion.** A grid that reveals cell by cell is the
 * fade-up §3 bans as a page's whole vocabulary.
 */
export function ServicesImageGrid({
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

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {section.items.map((item, i) => (
            <li key={item.title}>
              <div
                className="relative w-full overflow-hidden"
                style={{
                  aspectRatio: "var(--image-aspect)" as never,
                  borderRadius: "var(--image-radius)",
                  /*
                    `--paper-50`, not `--paper-200`. The ramp inverts for a
                    dark direction, so paper-200 is *darker* than the
                    paper-100 page there and an unphotographed cell
                    disappeared into the background — a hole in the grid,
                    which is the one thing this archetype must not have.
                    paper-50 is a step away from the page in both modes.
                  */
                  background: "var(--paper-50)",
                  borderWidth: "var(--rule-width)",
                  borderColor: "var(--rule-color)",
                }}
              >
                {item.image !== undefined && (
                  <Image
                    src={item.image.src}
                    alt={item.image.alt}
                    fill
                    loading={i < 3 ? "eager" : "lazy"}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                )}

                {/* The scrim only exists where there is a photograph to
                    darken; over a flat cell it would be a grey smear. */}
                {item.image !== undefined && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1/2"
                    style={{
                      background:
                        "linear-gradient(to top, oklch(0.18 0 0 / 0.72), transparent)",
                    }}
                  />
                )}

                <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5">
                  <span
                    className="meta"
                    style={{
                      color:
                        item.image === undefined
                          ? "var(--ink-400)"
                          : "oklch(1 0 0 / 0.72)",
                    }}
                  >
                    {upperTR(String(i + 1).padStart(2, "0"))}
                  </span>
                  <h3
                    className="t-h3 flex-1"
                    style={{
                      color:
                        item.image === undefined
                          ? "var(--ink-900)"
                          : "oklch(1 0 0)",
                    }}
                  >
                    {item.title}
                  </h3>
                </div>
              </div>

              {/* The description sits under the cell, not on the picture:
                  a paragraph over a photograph is unreadable at any scrim
                  strength that leaves the photograph visible. */}
              <p className="t-body mt-4 text-[var(--ink-700)]">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
