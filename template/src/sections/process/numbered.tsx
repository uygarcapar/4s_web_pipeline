import { upperTR } from "@/lib/format";
import type { ProcessSection, SiteConfig } from "@/lib/schema";

/**
 * Process archetype: **numbered** — the steps as a numbered grid.
 *
 * The plainest reading of a process: three or four columns, each a number, a
 * name and a sentence. For a short process this is the whole job, and
 * anything more elaborate is decoration on four sentences.
 *
 * `duration` is shown only where the client states one. §9 forbids
 * estimating how long someone else's appointment takes.
 */
export function ProcessNumbered({
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
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-12">
          {section.steps.map((step, i) => (
            <li
              key={step.title}
              className="border-t pt-5"
              style={{
                borderTopWidth: "var(--rule-width)",
                borderTopColor: "var(--rule-color)",
              }}
            >
              <p className="meta text-[var(--ink-400)]">
                {upperTR(String(i + 1).padStart(2, "0"))}
              </p>
              <h3 className="t-h3 mt-3 text-[var(--ink-900)]">{step.title}</h3>
              <p className="t-body mt-3 text-[var(--ink-700)]">{step.description}</p>
              {step.duration !== undefined && (
                <p className="meta mt-4 text-[var(--ink-600)]">{step.duration}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
