import type { SiteConfig, StatementSection } from "@/lib/schema";

/**
 * Statement archetype: **static display** — the client's sentence at display
 * size, no motion at all.
 *
 * The `word-reveal` sibling lights the sentence word by word as it scrolls.
 * This one does not move, which makes it the statement archetype a `still`
 * or `calm` direction can actually use: §7.2 asks an archetype to declare
 * which profiles it supports, and word-reveal supports two of the four.
 *
 * The sentence is the client's own, trimmed at punctuation and never
 * rewritten (§9).
 */
export function StatementStatic({
  section,
}: {
  section: StatementSection;
  config: SiteConfig;
}) {
  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        <p
          className="t-h2 text-[var(--ink-900)]"
          style={{ textAlign: "var(--text-align)" as never }}
        >
          {section.text}
        </p>
      </div>
    </section>
  );
}
