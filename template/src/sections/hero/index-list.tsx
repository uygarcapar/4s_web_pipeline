import { resolveCta } from "@/lib/cta";
import { formatPhoneTR, telHref, upperTR } from "@/lib/format";
import { hoursSummary } from "@/lib/hours-summary";
import type { HeroSection, SiteConfig } from "@/lib/schema";

/**
 * Hero archetype: **index** — the headline over an enumerated list of what
 * the business does.
 *
 * Composition from `data/corpus/shots/www-aspensearch-com-.jpg` and
 * `cerebrium-ai-.jpg`: a numbered index set in the mono accent, each row
 * ruled, reading as a table of contents for the page rather than as a menu.
 * Composition only.
 *
 * **What it is for.** `type-only` says what the business is; this says what
 * it *does*, in the first viewport, without a photograph. For a business
 * whose services are the whole proposition — a repair shop, a clinic with
 * six named treatments — the services list is the most useful thing a
 * visitor can see first, and scrolling to find it is a cost.
 *
 * **Where the items come from.** The services section's own titles, read
 * from `config.sections`. Not duplicated into the hero's own props: the same
 * list in two places is the shape that drifts, and §9 forbids this section
 * stating anything the client did not. If there is no services section the
 * index is simply absent and the hero degrades to headline and facts (D8's
 * rule, applied to composition).
 *
 * **Server component, no motion.** The numbered reveal that would suit this
 * composition belongs to `editorial`/`kinetic` directions only, and a hero
 * that animates its own index competes with the statement section that
 * carries the page's text transformation.
 */
export function HeroIndex({
  section,
  config,
}: {
  section: HeroSection;
  config: SiteConfig;
}) {
  const primary = resolveCta(section.ctaPrimary, config);

  const { district, city } = config.contact;
  const place = [district, city].filter(Boolean).join(", ");
  const hours = hoursSummary(config);

  const services = config.sections.find((s) => s.type === "services");
  const items =
    services === undefined ? [] : services.items.map((item) => item.title).slice(0, 6);

  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div style={{ textAlign: "var(--text-align)" as never }}>
          {place !== "" && (
            <p className="meta text-[var(--ink-600)]">{upperTR(place)}</p>
          )}
          <h1 className="t-h2 mt-5 max-w-[18ch] text-[var(--ink-900)]">
            {section.headline}
          </h1>
          {section.subheadline !== undefined && (
            <p className="t-lead measure mt-6 text-[var(--ink-700)]">
              {section.subheadline}
            </p>
          )}
        </div>

        {items.length > 0 && (
          <ol className="mt-12">
            {items.map((title, i) => (
              <li
                key={title}
                className="flex items-baseline gap-5 border-t py-4 sm:gap-8"
                style={{
                  borderTopWidth: "var(--rule-width)",
                  borderTopColor: "var(--rule-color)",
                }}
              >
                {/*
                  The index number in the mono accent where the direction has
                  one. design-rules.md §2 cluster 5 fails decorative mono —
                  this is a real ordinal against a real list, which is the
                  distinction that rule is drawing.
                */}
                <span className="meta w-8 shrink-0 text-[var(--ink-400)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="t-h3 text-[var(--ink-900)]">{title}</span>
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
        )}

        <div
          className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-5"
          style={{ justifyContent: "var(--align-items)" as never }}
        >
          <a
            href={primary.href}
            className="btn-label inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--ink-900)] px-7 text-[var(--paper-50)] transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {primary.label}
          </a>

          {/* §8: the first viewport carries real facts. */}
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <div>
              <dt className="meta text-[var(--ink-400)]">Telefon</dt>
              <dd className="t-body mt-1">
                <a
                  href={telHref(config.contact.phoneE164)}
                  className="-my-3 inline-flex min-h-11 items-center whitespace-nowrap text-[var(--ink-900)] underline-offset-4 hover:underline"
                >
                  {formatPhoneTR(config.contact.phoneE164)}
                </a>
              </dd>
            </div>
            {hours !== null && (
              <div>
                <dt className="meta text-[var(--ink-400)]">Çalışma saatleri</dt>
                <dd className="t-body mt-1 text-[var(--ink-700)]">{hours}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </section>
  );
}
