import { upperTR } from "@/lib/format";
import type { SiteConfig, StatementSection } from "@/lib/schema";

/**
 * Statement archetype: **quote split** — the sentence beside an attribution
 * rail rather than centred on its own.
 *
 * Composition from `data/corpus/shots/brand-squarespace-com-.jpg`.
 *
 * Attribution is the business itself, from `config.business` — this section
 * carries no copy of its own beyond the client's sentence, so the rail is
 * built from facts rather than written.
 */
export function StatementQuoteSplit({
  section,
  config,
}: {
  section: StatementSection;
  config: SiteConfig;
}) {
  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div
          className="border-t pt-5 lg:border-t-0 lg:pt-0"
          style={{
            borderTopWidth: "var(--rule-width)",
            borderTopColor: "var(--rule-color)",
          }}
        >
          <p className="meta text-[var(--ink-400)]">
            {upperTR(config.business.name)}
          </p>
          {config.contact.district !== null && (
            <p className="meta mt-2 text-[var(--ink-400)]">
              {upperTR(config.contact.district)}
            </p>
          )}
        </div>
        <p className="t-h2-col text-[var(--ink-900)]">{section.text}</p>
      </div>
    </section>
  );
}
