import Image from "next/image";

import type { GallerySection, SiteConfig } from "@/lib/schema";

/**
 * Gallery archetype: **full bleed** — one picture per screen-wide band,
 * stacked, with its caption beneath.
 *
 * Composition from `data/corpus/shots/milledollars-fr-.jpg` and
 * `www-odysseeclinic-com-au-.jpg`.
 *
 * **For a client with few but good photographs.** Three strong pictures at
 * full width say more than nine at thumbnail size, and a `quiet-luxury` or
 * `kinetic-bold` site is carried by exactly that. The selector should prefer
 * `mosaic` or the strip when `photoProfile.usableCount` is high and this
 * when it is low but the quality is `pro` — the one case where *fewer*
 * pictures is the stronger page.
 *
 * The caption is the image's own alt text, which is the client's description
 * of their own room: §9 forbids writing a caption of ours.
 */
export function GalleryFullBleed({
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
      {section.title !== undefined && (
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <h2
            className="t-h2 max-w-[16ch] text-[var(--ink-900)]"
            style={{ textAlign: "var(--text-align)" as never }}
          >
            {section.title}
          </h2>
        </div>
      )}
      <ul className="mt-10 space-y-12 lg:mt-14 lg:space-y-16">
        {section.images.map((image, i) => (
          <li key={image.src}>
            <div
              className="relative w-full overflow-hidden"
              style={{ aspectRatio: "16 / 9", background: "var(--paper-50)" }}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                loading={i === 0 ? "eager" : "lazy"}
                sizes="100vw"
                className="object-cover"
              />
            </div>
            <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
              <p className="meta mt-4 text-[var(--ink-600)]">{image.alt}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
