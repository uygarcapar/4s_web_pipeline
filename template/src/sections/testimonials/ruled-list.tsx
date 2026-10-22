import { upperTR } from "@/lib/format";
import type { SiteConfig, TestimonialsSection } from "@/lib/schema";

/**
 * Testimonials archetype: **ruled list** — every review in full, stacked
 * between rules, author first.
 *
 * Where `single-large` picks one, this shows them all — right for a business
 * with several substantial reviews, where the volume is itself the argument.
 * Author before quote so a scanning reader sees the names, which is what
 * makes local reviews persuasive in a neighbourhood trade.
 */
export function TestimonialsRuledList({
  section,
}: {
  section: TestimonialsSection;
  config: SiteConfig;
}) {
  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        {section.title !== undefined && (
          <h2
            className="t-h2 max-w-[16ch] text-[var(--ink-900)]"
            style={{ textAlign: "var(--text-align)" as never }}
          >
            {section.title}
          </h2>
        )}
        <ul className="mt-10 lg:mt-14">
          {section.items.map((item) => (
            <li
              key={item.author}
              className="border-t py-7"
              style={{
                borderTopWidth: "var(--rule-width)",
                borderTopColor: "var(--rule-color)",
              }}
            >
              <p className="meta text-[var(--ink-400)]">{upperTR(item.author)}</p>
              <blockquote className="t-lead measure mt-3 text-[var(--ink-800)]">
                {item.quote}
              </blockquote>
            </li>
          ))}
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
