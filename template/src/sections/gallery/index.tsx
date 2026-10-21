import Image from "next/image";

import type { GallerySection, SiteConfig } from "@/lib/schema";
import { cn } from "cn";

interface GalleryProps {
  section: GallerySection;
  config: SiteConfig;
}

/** Image gallery; "strip" variant renders a horizontally scrolling row. */
export function Gallery({ section }: GalleryProps) {
  const isStrip = section.variant === "strip";

  return (
    <section id={section.id} className="bg-brand-50/60">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="font-heading text-3xl font-semibold text-foreground">
          {section.title ?? "Galeri"}
        </h2>
        <div
          className={cn(
            "mt-8 gap-4",
            isStrip
              ? "flex snap-x overflow-x-auto pb-2"
              : "grid grid-cols-2 lg:grid-cols-4",
          )}
        >
          {section.images.map((image) => (
            <Image
              key={image.src}
              src={image.src}
              alt={image.alt}
              width={800}
              height={600}
              className={cn(
                "aspect-[4/3] rounded-[var(--radius)] object-cover ring-1 ring-brand-200",
                isStrip ? "w-64 shrink-0 snap-start" : "w-full",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
