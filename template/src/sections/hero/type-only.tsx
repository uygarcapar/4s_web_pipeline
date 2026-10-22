import { resolveCta } from "@/lib/cta";
import { formatPhoneTR, telHref } from "@/lib/format";
import { hoursSummary } from "@/lib/hours-summary";
import { upperTR } from "@/lib/format";
import type { HeroSection, SiteConfig } from "@/lib/schema";

/**
 * Hero archetype: **type only**. No photograph at all.
 *
 * Composition taken from `data/corpus/shots/www-aspensearch-com-.jpg` (the
 * headline owning a whole cell with the supporting facts ruled off beneath
 * it) and `leoparpeix-com-.jpg` (a headline given most of a screen with
 * nothing else competing). Composition only — no copy, no branding, no
 * artwork.
 *
 * **Why this archetype matters more than its place in the list suggests.**
 * `photo-full` needs a photograph good enough to fill a screen, and most
 * crawled SMB sites do not have one; `quiet-luxury` already scores a
 * thin-imagery client away from itself for exactly this reason. Without a
 * type-only hero those clients get a full-bleed hero built on a weak
 * photograph, which is the single most visible way a generated site looks
 * cheap.
 *
 * **Server component, no motion.** The only motion available to a hero with
 * no photograph is the fade-up §3 bans as a page's whole vocabulary. The
 * statement and the pinned rail carry this site's motion instead.
 *
 * **Reads only tokens** (D10 §7.2): `--text-align` and `--align-items` for
 * the grid's anchor, `--rule-width`/`--rule-color` for the facts rule,
 * `--radius` for the CTA, the paper/ink ramp for colour, and the eight type
 * steps for size. There is no branch on the direction's name anywhere in
 * the file — which is the property that makes it look materially different
 * under `swiss-grid` and `quiet-luxury` rather than merely recoloured.
 */
export function HeroTypeOnly({
  section,
  config,
}: {
  section: HeroSection;
  config: SiteConfig;
}) {
  const primary = resolveCta(section.ctaPrimary, config);
  const secondary =
    section.ctaSecondary === undefined
      ? null
      : resolveCta(section.ctaSecondary, config);

  const { district, city } = config.contact;
  const place = [district, city].filter(Boolean).join(", ");
  // §8 wants hours in the first viewport. A business that publishes
  // day-mapped hours gets them summarised; one that publishes a note gets
  // the note verbatim; one that publishes neither shows nothing (D8).
  const hours = hoursSummary(config);

  return (
    <section
      id={section.id}
      className="flex min-h-[86svh] flex-col justify-between bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
      style={{ textAlign: "var(--text-align)" as never }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 sm:px-8">
        {place !== "" && (
          <p className="meta text-[var(--ink-600)]">{upperTR(place)}</p>
        )}

        {/*
          `break-word` and a ch-based cap, not a vw one: the headline is the
          one place a long Turkish compound reliably overflows, and §4 is
          explicit that a capped element may not be sized by the viewport.
        */}
        <h1 className="t-display mt-6 max-w-[16ch] text-[var(--ink-900)]">
          {section.headline}
        </h1>

        {section.subheadline !== undefined && (
          <p className="t-lead measure mt-8 text-[var(--ink-700)]">
            {section.subheadline}
          </p>
        )}

        <div
          className="mt-12 flex flex-wrap gap-4"
          style={{ justifyContent: "var(--align-items)" as never }}
        >
          <a
            href={primary.href}
            className="btn-label inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--ink-900)] px-7 text-[var(--paper-50)] transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {primary.label}
          </a>
          {secondary !== null && (
            <a
              href={secondary.href}
              // A tinted surface, not only a border: a direction whose
              // `rules` are `none` sets --rule-width to 0, and the first
              // render of this archetype left the secondary CTA with no
              // border and no background at all — indistinguishable from
              // body text. The border still adds definition where a
              // direction does use rules.
              className="btn-label inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--paper-200)] px-7 text-[var(--ink-900)] transition-colors hover:bg-[var(--paper-300)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
              style={{
                borderWidth: "var(--rule-width)",
                borderColor: "var(--rule-color)",
              }}
            >
              {secondary.label}
            </a>
          )}
        </div>
      </div>

      {/*
        The facts row, ruled off at the foot of the fold. This is what keeps a
        type-only hero from being a slogan on an empty page: §8 requires the
        first viewport to carry real facts, and with no photograph to carry
        them they have to be set.
      */}
      <div
        className="mx-auto mt-16 w-full max-w-7xl border-t px-5 pt-5 sm:px-8"
        style={{
          borderTopWidth: "var(--rule-width)",
          borderTopColor: "var(--rule-color)",
        }}
      >
        <dl className="flex flex-wrap gap-x-12 gap-y-3">
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
          {config.contact.address !== null && (
            <div>
              <dt className="meta text-[var(--ink-400)]">Adres</dt>
              <dd className="t-body mt-1 text-[var(--ink-700)]">
                {config.contact.address}
              </dd>
            </div>
          )}
          {hours !== null && (
            <div>
              <dt className="meta text-[var(--ink-400)]">Çalışma saatleri</dt>
              <dd className="t-body mt-1 text-[var(--ink-700)]">{hours}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
