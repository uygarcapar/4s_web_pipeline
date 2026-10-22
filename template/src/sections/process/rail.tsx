import { upperTR } from "@/lib/format";
import type { ProcessSection, SiteConfig } from "@/lib/schema";

/**
 * Process archetype: **rail** — the steps as wide rows, number held in a
 * left column at display size.
 *
 * For a process whose steps need a paragraph each rather than a sentence: a
 * legal matter, a long treatment. `numbered` would make three columns of
 * dense text and `timeline` would make a very tall rule; a row gives each
 * step the measure it needs.
 *
 * The numeral is at `t-h2-col` rather than `.meta`, which makes the sequence
 * the loudest thing in the section — correct here, because the one question
 * this archetype answers is "how many steps and what order".
 */
export function ProcessRail({
  section,
}: {
  section: ProcessSection;
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
        <ol className="mt-10 lg:mt-14">
          {section.steps.map((step, i) => (
            <li
              key={step.title}
              className="grid gap-4 border-t py-8 sm:grid-cols-[8rem_1fr] sm:gap-10"
              style={{
                borderTopWidth: "var(--rule-width)",
                borderTopColor: "var(--rule-color)",
              }}
            >
              <p className="t-h2-col text-[var(--ink-400)]">
                {String(i + 1).padStart(2, "0")}
              </p>
              <div>
                <h3 className="t-h3 text-[var(--ink-900)]">{step.title}</h3>
                <p className="t-body measure mt-3 text-[var(--ink-700)]">
                  {step.description}
                </p>
                {step.duration !== undefined && (
                  <p className="meta mt-4 text-[var(--ink-600)]">
                    {upperTR(step.duration)}
                  </p>
                )}
              </div>
            </li>
          ))}
          <li
            className="border-t"
            style={{
              borderTopWidth: "var(--rule-width)",
              borderTopColor: "var(--rule-color)",
            }}
          />
        </ol>
      </div>
    </section>
  );
}
