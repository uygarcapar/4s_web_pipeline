import Image from "next/image";

import { upperTR } from "@/lib/format";
import type { GallerySection, SiteConfig } from "@/lib/schema";

/**
 * Gallery archetype: **pairs** — two pictures per row, the second offset
 * down by the direction's own asymmetry.
 *
 * Composition from `data/corpus/shots/www-lxlcreative-co-uk-.jpg`.
 *
 * **The quiet one.** A mosaic insists on a hierarchy and a full-bleed stack
 * insists on scale; this just shows the pictures evenly, which is right for
 * a set where none is the hero — a salon's six treatment rooms, a workshop's
 * finished jobs. Under a centred or left-flush direction `--offset-y` is 0
 * and it becomes a plain two-column grid, which is the same archetype being
 * quiet rather than a different one.
 */
export function GalleryPairs({
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
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:mt-14 lg:gap-10">
          {section.images.map((image, i) => (
            <li key={image.src} style={{ marginTop: i % 2 === 1 ? "var(--offset-y)" : undefined }}>
              <div
                className="relative w-full overflow-hidden"
                style={{
                  aspectRatio: "var(--image-aspect)" as never,
                  borderRadius: "var(--image-radius)",
                  background: "var(--paper-50)",
                }}
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  loading={i < 2 ? "eager" : "lazy"}
                  sizes="(min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <p className="meta mt-3 text-[var(--ink-400)]">
                {upperTR(String(i + 1).padStart(2, "0"))}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
