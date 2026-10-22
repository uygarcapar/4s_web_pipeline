import { upperTR } from "@/lib/format";
import type { ServicesSection, SiteConfig } from "@/lib/schema";

/**
 * Services archetype: **accordion** — every service a closed row, opening to
 * its description.
 *
 * Composition from `data/corpus/shots/www-seasats-com-.jpg` and
 * `heronaiapp-com-.jpg`: a stack of ruled rows with an index and a title,
 * each one openable, reading as a contents list rather than a set of cards.
 *
 * **The case it serves: a lot of services.** The clinic this pipeline was
 * built against publishes nineteen treatments. `rail-pinned` handles about
 * five before it becomes a scroll endurance test, and `alternating` wants a
 * photograph per row. Nineteen cards is a wall; nineteen closed rows is a
 * list someone can actually read, and §8's density rule is explicit that a
 * business with a lot of content should not have it flattened into a grid.
 *
 * **Native `<details>`, no JavaScript.** The open/close is the browser's, so
 * it works before hydration, under `prefers-reduced-motion`, and with the
 * keyboard without anything from us. An archetype that ships a client bundle
 * to toggle a boolean is paying the 250 KB budget for nothing.
 *
 * **Every row is a 44px tap target** (§7), with the negative margin that
 * gives the added height back so the closed rhythm is unchanged — the same
 * idiom `faq` uses, and the rule that this template failed on eighteen
 * elements before A0b.
 *
 * **Reads only tokens.** Rules, radius, rhythm and the type steps; the index
 * numeral takes the mono accent wherever the direction has one.
 */
export function ServicesAccordion({
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
      <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        {section.title !== undefined && (
          <h2
            className="t-h2 max-w-[16ch] text-[var(--ink-900)]"
            style={{ textAlign: "var(--text-align)" as never }}
          >
            {section.title}
          </h2>
        )}

        <div className="mt-10 lg:mt-14">
          {section.items.map((item, i) => (
            <details
              key={item.title}
              name={section.id}
              className="group border-t open:pb-6"
              style={{
                borderTopWidth: "var(--rule-width)",
                borderTopColor: "var(--rule-color)",
              }}
            >
              {/*
                §7: a 44px hit area, with `-my-2.5` returning the 20px it adds
                so the closed row keeps its rhythm. The hit area extends into
                the row's own padding rather than growing the row.
              */}
              <summary className="-my-2.5 flex min-h-11 cursor-pointer list-none items-baseline gap-5 py-6 marker:hidden sm:gap-8">
                <span className="meta w-8 shrink-0 text-[var(--ink-400)]">
                  {upperTR(String(i + 1).padStart(2, "0"))}
                </span>
                <span className="t-h3 flex-1 text-[var(--ink-900)]">
                  {item.title}
                </span>
                {/*
                  A rotating caret, not a swapped glyph: `transform` is one of
                  the two properties §3 allows, and a `+`/`−` swap would
                  change the row's text content for a screen reader on every
                  toggle.
                */}
                <span
                  aria-hidden="true"
                  className="t-h3 shrink-0 text-[var(--ink-400)] transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                >
                  +
                </span>
              </summary>

              <p className="t-body measure pl-[calc(2rem+1.25rem)] text-[var(--ink-700)] sm:pl-[calc(2rem+2rem)]">
                {item.description}
              </p>
            </details>
          ))}
          <div
            className="border-t"
            style={{
              borderTopWidth: "var(--rule-width)",
              borderTopColor: "var(--rule-color)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
