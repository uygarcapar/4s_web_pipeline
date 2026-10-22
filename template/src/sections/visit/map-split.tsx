import { formatPhoneTR, telHref, upperTR } from "@/lib/format";
import { hoursSummary } from "@/lib/hours-summary";
import { MapFacade } from "@/components/map-facade";
import type { SiteConfig, VisitSection } from "@/lib/schema";

/**
 * Visit archetype: **map split** — the map on one side, the facts on the
 * other.
 *
 * The map is a facade, not an embed: KVKK forbids a third-party script
 * before consent, and Google's iframe sets cookies on load. It becomes a
 * real map only when someone asks for one.
 */
export function VisitMapSplit({
  section,
  config,
}: {
  section: VisitSection;
  config: SiteConfig;
}) {
  const hours = hoursSummary(config);
  const { address, district, city } = config.contact;

  return (
    <section
      id={section.id}
      className="bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div style={{ textAlign: "var(--text-align)" as never }}>
          {section.title !== undefined && (
            <h2 className="t-h2 max-w-[14ch] text-[var(--ink-900)]">{section.title}</h2>
          )}
          <dl className="mt-8 space-y-6">
            {address !== null && (
              <div>
                <dt className="meta text-[var(--ink-400)]">{upperTR("Adres")}</dt>
                <dd className="t-body mt-2 text-[var(--ink-700)]">
                  {[address, district, city].filter(Boolean).join(", ")}
                </dd>
              </div>
            )}
            {hours !== null && (
              <div>
                <dt className="meta text-[var(--ink-400)]">{upperTR("Çalışma saatleri")}</dt>
                <dd className="t-body mt-2 text-[var(--ink-700)]">{hours}</dd>
              </div>
            )}
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
          </dl>
        </div>
        <div
          className="overflow-hidden"
          style={{ borderRadius: "var(--image-radius)" }}
        >
          <MapFacade
            embedUrl={`https://www.google.com/maps?q=${encodeURIComponent(
              config.contact.mapsEmbedQuery ?? "",
            )}&output=embed&hl=tr`}
            title={`Harita: ${config.business.name} konumu`}
            address={address}
            className="h-full w-full"
          />
        </div>
      </div>
    </section>
  );
}
