import type { SiteConfig, TestimonialsSection } from "@/lib/schema";
import { cn } from "cn";

interface TestimonialsProps {
  section: TestimonialsSection;
  config: SiteConfig;
}

/** Customer quotes; "compact" variant tightens the layout to a single column. */
export function Testimonials({ section }: TestimonialsProps) {
  const isCompact = section.variant === "compact";

  return (
    <section id={section.id} className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="font-heading text-3xl font-semibold text-foreground">
        {section.title ?? "Müşterilerimiz Ne Diyor?"}
      </h2>
      <div
        className={cn(
          "mt-8 grid gap-4",
          !isCompact && "md:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {section.items.map((item) => (
          <figure
            key={item.author}
            className="flex flex-col justify-between gap-4 rounded-[var(--radius)] border border-brand-100 bg-card p-6"
          >
            <blockquote className="text-base text-foreground">
              “{item.quote}”
            </blockquote>
            <figcaption className="text-sm font-semibold text-brand-700">
              — {item.author}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
