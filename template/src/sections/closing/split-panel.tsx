import { resolveCta } from "@/lib/cta";
import { formatPhoneTR, telHref, upperTR } from "@/lib/format";
import { hoursSummary } from "@/lib/hours-summary";
import type { ClosingSection, SiteConfig } from "@/lib/schema";

/**
 * Closing archetype: **split panel** — the ask on one side, the practical
 * facts on the other.
 *
 * Where `statement-cta` gives the whole screen to one line, this pairs the
 * line with the information someone needs to act on it. For a business whose
 * barrier is logistics rather than persuasion — "are they open now, where
 * are they" — that is the more useful last screen.
 */
export function ClosingSplitPanel({
  section,
  config,
}: {
  section: ClosingSection;
  config: SiteConfig;
}) {
  const primary = resolveCta(section.ctaPrimary, config);
  const hours = hoursSummary(config);
  const { address, district } = config.contact;
  const place = [address, district].filter(Boolean).join(", ");

  return (
    <section
      id={section.id}
      className="border-t bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
      style={{ borderTopWidth: "var(--rule-width)", borderTopColor: "var(--rule-color)" }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <div style={{ textAlign: "var(--text-align)" as never }}>
          <h2 className="t-h2 max-w-[13ch] text-[var(--ink-900)]">{section.headline}</h2>
          {section.body !== undefined && (
            <p className="t-lead measure mt-6 text-[var(--ink-700)]">{section.body}</p>
          )}
          <a
            href={primary.href}
            className="btn-label mt-9 inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--ink-900)] px-7 text-[var(--paper-50)] transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {primary.label}
          </a>
        </div>

        <dl className="space-y-6 lg:pl-10">
          <div>
            <dt className="meta text-[var(--ink-400)]">{upperTR("Telefon")}</dt>
            <dd className="t-h3 mt-2">
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
              <dt className="meta text-[var(--ink-400)]">{upperTR("Çalışma saatleri")}</dt>
              <dd className="t-body mt-2 text-[var(--ink-700)]">{hours}</dd>
            </div>
          )}
          {place !== "" && (
            <div>
              <dt className="meta text-[var(--ink-400)]">{upperTR("Adres")}</dt>
              <dd className="t-body mt-2 text-[var(--ink-700)]">{place}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
