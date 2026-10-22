import { resolveCta } from "@/lib/cta";
import type { ClosingSection, SiteConfig } from "@/lib/schema";

/**
 * Closing archetype: **banner** — one inverted band, the line and the button
 * on a single row.
 *
 * The compact closing, for a page that has already said everything and needs
 * a last prompt rather than a last screen. It inverts: ink becomes the
 * ground and paper the type, which is the only place in the kit that
 * happens, so it reads as the end of the page rather than another section.
 *
 * `--ink-900` as a surface stays inside the direction's own ramp, so the
 * inversion is that direction's dark rather than a generic black.
 */
export function ClosingBanner({
  section,
  config,
}: {
  section: ClosingSection;
  config: SiteConfig;
}) {
  const primary = resolveCta(section.ctaPrimary, config);

  return (
    <section
      id={section.id}
      style={{ background: "var(--ink-900)" }}
      className="py-[var(--section-y)] lg:py-[var(--section-y-lg)]"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div>
          <h2 className="t-h2-col max-w-[18ch] text-[var(--paper-50)]">
            {section.headline}
          </h2>
          {section.body !== undefined && (
            <p className="t-body measure mt-4 text-[var(--paper-300)]">{section.body}</p>
          )}
        </div>
        <a
          href={primary.href}
          className="btn-label inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius)] bg-[var(--paper-50)] px-8 text-[var(--ink-900)] transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--paper-50)] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {primary.label}
        </a>
      </div>
    </section>
  );
}
