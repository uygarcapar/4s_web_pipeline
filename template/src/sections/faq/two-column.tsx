import type { FaqSection, SiteConfig } from "@/lib/schema";

/**
 * FAQ archetype: **two column** — every answer visible, flowed across
 * columns.
 *
 * The accordion sibling hides answers until asked; this shows all of them,
 * which suits a short list someone will read in full. `break-inside: avoid`
 * keeps a question and its answer in the same column — without it the pair
 * splits across the break and reads as two fragments.
 */
export function FaqTwoColumn({
  section,
}: {
  section: FaqSection;
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
        <ul className="mt-10 gap-x-12 lg:mt-14 lg:columns-2 xl:gap-x-16">
          {section.items.map((item) => (
            <li
              key={item.question}
              className="mb-8 break-inside-avoid border-t pt-5"
              style={{
                borderTopWidth: "var(--rule-width)",
                borderTopColor: "var(--rule-color)",
              }}
            >
              <h3 className="t-h3 text-[var(--ink-900)]">{item.question}</h3>
              <p className="t-body mt-3 text-[var(--ink-700)]">{item.answer}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
