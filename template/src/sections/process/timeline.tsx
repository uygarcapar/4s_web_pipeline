import { upperTR } from "@/lib/format";
import type { ProcessSection, SiteConfig } from "@/lib/schema";

/**
 * Process archetype: **timeline** — the steps down a single rule, each
 * marked on it.
 *
 * Composition from `data/corpus/shots/www-seasats-com-.jpg`.
 *
 * Where `numbered` lays the steps out as peers, this says they happen in
 * order and take time — right for a treatment plan or a build, where the
 * sequence is the information. The marker is a square on the rule rather
 * than a circle: a circle on a line is the one shape every template
 * timeline uses, and generic cluster 4 is about exactly that reflex.
 *
 * The rule is `--rule-color`, so under a direction with `rules: none` it
 * disappears and the steps fall back to a plain indented stack — the
 * timeline reading is the direction's to grant.
 */
export function ProcessTimeline({
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
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        {section.title !== undefined && (
          <h2
            className="t-h2 max-w-[16ch] text-[var(--ink-900)]"
            style={{ textAlign: "var(--text-align)" as never }}
          >
            {section.title}
          </h2>
        )}
        <ol
          className="mt-10 space-y-10 pl-8 lg:mt-14"
          style={{
            borderLeftWidth: "var(--rule-width)",
            borderLeftColor: "var(--rule-color)",
          }}
        >
          {section.steps.map((step, i) => (
            <li key={step.title} className="relative">
              <span
                aria-hidden="true"
                className="absolute top-2 -left-[calc(2rem+var(--rule-width)/2)] block size-2 -translate-x-1/2"
                style={{ background: "var(--ink-900)" }}
              />
              <p className="meta text-[var(--ink-400)]">
                {upperTR(String(i + 1).padStart(2, "0"))}
                {step.duration !== undefined ? ` · ${step.duration}` : ""}
              </p>
              <h3 className="t-h3 mt-2 text-[var(--ink-900)]">{step.title}</h3>
              <p className="t-body measure mt-3 text-[var(--ink-700)]">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
