import { upperTR } from "@/lib/format";
import type { SiteConfig, TestimonialsSection } from "@/lib/schema";

/**
 * Testimonials archetype: **single large** — one review at display size,
 * the rest as attributions beneath.
 *
 * **For a business with few but strong reviews**, which is most of them: a
 * grid of three short quotes reads as filler, while one real sentence at
 * size reads as a person. The first is shown because the plan stage orders
 * them from the crawl; nothing is ranked by us.
 *
 * Quotes are verbatim from the client's own site (§9). Nothing here is
 * written, trimmed or improved.
 */
export function TestimonialsSingleLarge({
  section,
}: {
  section: TestimonialsSection;
  config: SiteConfig;
}) {
  const [lead, ...rest] = section.items;
  if (lead === undefined) return null;

  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        {section.title !== undefined && (
          <h2 className="meta text-[var(--ink-400)]">{upperTR(section.title)}</h2>
        )}
        <blockquote className="mt-8">
          <p
            className="t-h2-col text-[var(--ink-900)]"
            style={{ textAlign: "var(--text-align)" as never }}
          >
            {lead.quote}
          </p>
          <footer className="meta mt-6 text-[var(--ink-600)]">{lead.author}</footer>
        </blockquote>

        {rest.length > 0 && (
          <ul className="mt-12 flex flex-wrap gap-x-10 gap-y-3">
            {rest.map((item) => (
              <li key={item.author} className="meta text-[var(--ink-400)]">
                {item.author}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
