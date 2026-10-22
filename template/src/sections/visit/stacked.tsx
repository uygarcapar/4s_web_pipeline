import { formatPhoneTR, telHref, upperTR } from "@/lib/format";
import { hoursSummary } from "@/lib/hours-summary";
import type { SiteConfig, VisitSection } from "@/lib/schema";

/**
 * Visit archetype: **stacked** — address, hours and number as three ruled
 * bands at full width, no map.
 *
 * **For a business whose location is not the point.** A mobile trade, a
 * practice people phone rather than visit, a clinic in a building nobody
 * needs directions to. A map there is furniture: it costs a consent prompt
 * under KVKK and tells a visitor nothing they wanted. The address is still
 * here, in full and selectable.
 *
 * Each band is a 44px row with the value at heading size, so the number is
 * readable across a room — which is how a phone number on a phone is
 * actually used.
 */
export function VisitStacked({
  section,
  config,
}: {
  section: VisitSection;
  config: SiteConfig;
}) {
  const hours = hoursSummary(config);
  const { address, district, city } = config.contact;
  const place = [address, district, city].filter(Boolean).join(", ");

  const bands: Array<{ label: string; value: React.ReactNode }> = [
    ...(place !== "" ? [{ label: "Adres", value: place }] : []),
    ...(hours !== null ? [{ label: "Çalışma saatleri", value: hours }] : []),
    {
      label: "Telefon",
      value: (
        <a
          href={telHref(config.contact.phoneE164)}
          className="-my-3 inline-flex min-h-11 items-center whitespace-nowrap underline-offset-4 hover:underline"
        >
          {formatPhoneTR(config.contact.phoneE164)}
        </a>
      ),
    },
  ];

  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        {section.title !== undefined && (
          <h2
            className="t-h2 max-w-[14ch] text-[var(--ink-900)]"
            style={{ textAlign: "var(--text-align)" as never }}
          >
            {section.title}
          </h2>
        )}
        <dl className="mt-10 lg:mt-14">
          {bands.map((band) => (
            <div
              key={band.label}
              className="grid gap-2 border-t py-6 sm:grid-cols-[16rem_1fr] sm:gap-8"
              style={{
                borderTopWidth: "var(--rule-width)",
                borderTopColor: "var(--rule-color)",
              }}
            >
              <dt className="meta text-[var(--ink-400)]">{upperTR(band.label)}</dt>
              <dd className="t-h3 text-[var(--ink-900)]">{band.value}</dd>
            </div>
          ))}
          <div
            className="border-t"
            style={{
              borderTopWidth: "var(--rule-width)",
              borderTopColor: "var(--rule-color)",
            }}
          />
        </dl>
      </div>
    </section>
  );
}
