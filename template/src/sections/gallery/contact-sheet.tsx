import Image from "next/image";

import type { GallerySection, SiteConfig } from "@/lib/schema";

/**
 * Gallery archetype: **contact sheet** — many small squares, evenly sized,
 * tight gutters.
 *
 * Composition from `data/corpus/shots/aardvarkbookclub-com-.jpg`.
 *
 * **For a client with a lot of pictures and no obvious best one** — the
 * crawl that returned twenty usable images of a workshop. Shown large they
 * would be twenty screens; shown as a sheet they are one texture that reads
 * as "this is a real working place", which is the argument the quantity is
 * making. The individual picture matters less than the mass, so they are
 * square-cropped and uniform on purpose: this is the one gallery archetype
 * where evenness is the point rather than a default.
 *
 * Still `next/image` with explicit sizes — twenty full-size downloads for a
 * texture would blow the LHCI budget that the whole verify gate turns on.
 */
export function GalleryContactSheet({
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
        <ul className="mt-10 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:mt-14 lg:grid-cols-6">
          {section.images.map((image, i) => (
            <li key={image.src}>
              <div
                className="relative w-full overflow-hidden"
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: "var(--image-radius)",
                  background: "var(--paper-50)",
                }}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  loading={i < 6 ? "eager" : "lazy"}
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 33vw"
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
