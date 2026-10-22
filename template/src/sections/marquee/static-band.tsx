import { upperTR } from "@/lib/format";
import type { MarqueeSection, SiteConfig } from "@/lib/schema";

/**
 * Marquee archetype: **static band** — the same phrases, never moving.
 *
 * The `ticker` sibling scrolls under `editorial` and `kinetic` and falls
 * back to a static row elsewhere. This one is static by design, which is a
 * different thing: a `still` or `calm` direction can choose it deliberately
 * rather than receiving a degraded ticker, and it ships no client JavaScript
 * at all — a server component where the ticker must be a client one.
 *
 * Items are the client's own words; cluster 5 fails a band of `A · B · C`
 * with nothing behind it, which is why the schema requires three.
 */
export function MarqueeStaticBand({
  section,
}: {
  section: MarqueeSection;
  config: SiteConfig;
}) {
  return (
    <section
      id={section.id}
      aria-label={section.items.join(", ")}
      className="border-y bg-[var(--paper-200)] py-6"
      style={{
        borderTopWidth: "var(--rule-width)",
        borderBottomWidth: "var(--rule-width)",
        borderColor: "var(--rule-color)",
      }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 sm:px-8">
        {section.items.map((item) => (
          <span key={item} className="meta text-[var(--ink-700)]">
            {upperTR(item)}
          </span>
        ))}
      </div>
    </section>
  );
}
