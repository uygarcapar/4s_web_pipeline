import { formatPhoneTR, telHref, upperTR } from "@/lib/format";
import { hoursSummary } from "@/lib/hours-summary";
import { resolveCta } from "@/lib/cta";
import type { SiteConfig, VisitSection } from "@/lib/schema";

/**
 * Visit archetype: **card** — everything a visitor needs to turn up, in one
 * block with the call as its foot.
 *
 * **The compact one**, for a page that already carries the address in a
 * hero or a footer and needs the visit section to be an action rather than a
 * repeat. It is the only visit archetype with a CTA: the others state facts,
 * this one asks.
 */
export function VisitCard({
  section,
  config,
}: {
  section: VisitSection;
  config: SiteConfig;
}) {
  const hours = hoursSummary(config);
  const { address, district, city } = config.contact;
  const place = [address, district, city].filter(Boolean).join(", ");
  const call = resolveCta({ label: "Hemen Ara", action: "tel" }, config);

  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
        <div
          className="p-8 sm:p-10"
          style={{
            background: "var(--paper-50)",
            borderRadius: "var(--radius)",
            borderWidth: "var(--rule-width)",
            borderColor: "var(--rule-color)",
          }}
        >
          {section.title !== undefined && (
            <h2 className="t-h2-col text-[var(--ink-900)]">{section.title}</h2>
          )}
          <dl className="mt-7 space-y-5">
            {place !== "" && (
              <div>
                <dt className="meta text-[var(--ink-400)]">{upperTR("Adres")}</dt>
                <dd className="t-body mt-1 text-[var(--ink-700)]">{place}</dd>
              </div>
            )}
            {hours !== null && (
              <div>
                <dt className="meta text-[var(--ink-400)]">{upperTR("Çalışma saatleri")}</dt>
                <dd className="t-body mt-1 text-[var(--ink-700)]">{hours}</dd>
              </div>
            )}
          </dl>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <a
              href={call.href}
              className="btn-label inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--ink-900)] px-7 text-[var(--paper-50)] transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {call.label}
            </a>
            <a
              href={telHref(config.contact.phoneE164)}
              className="t-body -my-3 inline-flex min-h-11 items-center whitespace-nowrap text-[var(--ink-700)] underline-offset-4 hover:underline"
            >
              {formatPhoneTR(config.contact.phoneE164)}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
