import { upperTR } from "@/lib/format";
import type { FaqSection, SiteConfig } from "@/lib/schema";

/**
 * FAQ archetype: **rows** — question and answer side by side per row, all
 * open.
 *
 * Composition from `data/corpus/shots/www-seasats-com-.jpg`.
 *
 * Where `two-column` packs for density, this gives each pair a full-width
 * row with the question held in a narrow left column, so a reader scanning
 * only the questions can do so down a single edge. For five or six
 * substantial answers it reads better than columns; past that the page gets
 * long and the accordion is the better pick.
 */
export function FaqRows({ section }: { section: FaqSection; config: SiteConfig }) {
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
        <dl className="mt-10 lg:mt-14">
          {section.items.map((item, i) => (
            <div
              key={item.question}
              className="grid gap-3 border-t py-7 lg:grid-cols-[1fr_2fr] lg:gap-12"
              style={{
                borderTopWidth: "var(--rule-width)",
                borderTopColor: "var(--rule-color)",
              }}
            >
              <dt>
                <span className="meta text-[var(--ink-400)]">
                  {upperTR(String(i + 1).padStart(2, "0"))}
                </span>
                <h3 className="t-h3 mt-2 text-[var(--ink-900)]">{item.question}</h3>
              </dt>
              <dd className="t-body measure text-[var(--ink-700)]">{item.answer}</dd>
            </div>
          ))}
          <div
            className="border-t"
            style={{
              borderTopWidth: "var(--rule-width)",
              borderTopColor: "var(--rule-color)",
            }}
          />
        </dl>
      </div>
    </section>
  );
}
