import Image from "next/image";

import type { GallerySection, SiteConfig } from "@/lib/schema";

/**
 * Gallery archetype: **mosaic** — a deliberately uneven grid, the first
 * picture spanning two cells and the rest filling around it.
 *
 * Composition from `data/corpus/shots/noho-ink-.jpg`.
 *
 * **Why uneven.** A regular grid of identical tiles says every picture is
 * equally important, which is never true of a crawled set: there is usually
 * one wide shot of the premises and several details. Giving the first
 * picture the double cell makes the set read as a place rather than a
 * contact sheet. The plan stage orders images by usable size, so "first" is
 * already "largest".
 *
 * Reads only tokens; the frame radius is the direction's.
 */
export function GalleryMosaic({
  section,
}: {
  section: GallerySection;
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
        <ul className="mt-10 grid auto-rows-[14rem] grid-cols-2 gap-4 sm:auto-rows-[16rem] lg:mt-14 lg:grid-cols-4">
          {section.images.map((image, i) => (
            <li
              key={image.src}
              className={
                i === 0 ? "col-span-2 row-span-2" : i % 3 === 0 ? "col-span-2" : ""
              }
            >
              <div
                className="relative h-full w-full overflow-hidden"
                style={{ borderRadius: "var(--image-radius)", background: "var(--paper-50)" }}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  loading={i === 0 ? "eager" : "lazy"}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
