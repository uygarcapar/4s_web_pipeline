import { upperTR } from "@/lib/format";
import type { ServicesSection, SiteConfig } from "@/lib/schema";

/**
 * Services archetype: **index** — the whole list visible at once, flowing
 * across columns.
 *
 * Composition from `data/corpus/shots/cerebrium-ai-.jpg` and
 * `www-offforum-com-.jpg`: a dense index where everything is readable
 * without interaction, set in columns so the eye travels down a short
 * measure rather than down a long page.
 *
 * **How it differs from `accordion`, which is the question §7.2 asks.** The
 * accordion is a single stack whose descriptions are hidden until asked
 * for; this flows the list across columns and shows every description. That
 * is a different composition, not the same one with a flag: the accordion
 * cannot be made to look like this by opening every row, because an opened
 * accordion is one column of full-width rows and this is two or three
 * columns of short ones.
 *
 * **When it is the right choice.** A business with many services that a
 * visitor wants to *compare* rather than step through — a salon's price
 * list, a workshop's capabilities. The accordion suits a long list someone
 * reads one item of; this suits a list someone reads all of.
 *
 * **`break-inside: avoid` is load-bearing.** Without it a column break lands
 * mid-entry and a service's name ends up at the foot of one column with its
 * description at the head of the next, which reads as two broken entries
 * rather than one.
 *
 * **Reads only tokens**, and takes no photographs at all — it is the
 * archetype for a client who has none.
 */
export function ServicesIndex({
  section,
}: {
  section: ServicesSection;
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

        {/*
          Columns, not a grid: a grid would give every entry the same height
          and leave ragged white space under the short ones. Flowed columns
          pack by content, which is what makes twenty services fit.
        */}
        <ul className="mt-10 gap-x-12 lg:mt-14 lg:columns-2 xl:columns-3 xl:gap-x-16">
          {section.items.map((item, i) => (
            <li
              key={item.title}
              className="mb-8 break-inside-avoid border-t pt-5"
              style={{
                borderTopWidth: "var(--rule-width)",
                borderTopColor: "var(--rule-color)",
              }}
            >
              <p className="meta text-[var(--ink-400)]">
                {upperTR(String(i + 1).padStart(2, "0"))}
              </p>
              <h3 className="t-h3 mt-2 text-[var(--ink-900)]">{item.title}</h3>
              {/*
                No `measure` here: the column is already narrower than 80ch,
                and capping again would leave a second ragged edge inside a
                column that already has one.
              */}
              <p className="t-body mt-3 text-[var(--ink-700)]">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
