import { resolveCta } from "@/lib/cta";
import { formatPhoneTR, telHref } from "@/lib/format";
import type { ClosingSection, SiteConfig } from "@/lib/schema";

/**
 * The last screen: one display line and the ask.
 *
 * A visitor who has read the whole page should not have to scroll back to
 * the hero to find the number, and a footer of links is not a call to
 * action. `t-display` is shared with the hero by design — design-rules.md §4
 * gives that step to "hero + closing statement", so a site has exactly two
 * places where type is allowed to be this large.
 *
 * A server component. It has no state, no motion of its own and no reason to
 * ship JavaScript: every reveal here would be the fade-up that §3 names as
 * the thing a page must not be built from.
 *
 * Reads only tokens — `--radius`, `--rule-width`, paper/ink/accent — so the
 * same markup is a dark poster under `quiet-luxury` and a light left-flush
 * block under `editorial-serif` (D10 §7.2).
 */
export function Closing({
  section,
  config,
}: {
  section: ClosingSection;
  config: SiteConfig;
}) {
  const primary = resolveCta(section.ctaPrimary, config);
  const secondary =
    section.ctaSecondary === undefined
      ? null
      : resolveCta(section.ctaSecondary, config);

  return (
    <section
      id={section.id}
      className="border-t bg-[var(--paper-100)] py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
      style={{
        borderTopWidth: "var(--rule-width)",
        borderTopColor: "var(--rule-color)",
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <h2 className="t-display max-w-[14ch] text-[var(--ink-900)]">
          {section.headline}
        </h2>

        {section.body !== undefined && (
          <p className="t-lead measure mt-6 text-[var(--ink-700)]">
            {section.body}
          </p>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={primary.href}
            className="btn-label inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--ink-900)] px-7 text-[var(--paper-50)] transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {primary.label}
          </a>

          {secondary !== null && (
            <a
              href={secondary.href}
              className="btn-label inline-flex min-h-11 items-center rounded-[var(--radius)] px-7 text-[var(--ink-900)] transition-colors hover:bg-[var(--paper-200)] focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
              style={{
                borderWidth: "var(--rule-width)",
                borderColor: "var(--rule-color)",
              }}
            >
              {secondary.label}
            </a>
          )}
        </div>

        {/*
          The number in full, readable without tapping anything. `nowrap` is
          the §7 invariant: a Turkish phone number broken across two lines
          stops being one number.
        */}
        <p className="t-body mt-8 text-[var(--ink-600)]">
          <a
            href={telHref(config.contact.phoneE164)}
            className="-my-3 inline-flex min-h-11 items-center whitespace-nowrap underline-offset-4 hover:underline"
          >
            {formatPhoneTR(config.contact.phoneE164)}
          </a>
        </p>
      </div>
    </section>
  );
}
