import { notFound } from "next/navigation";

import { siteConfig } from "~config";
import { DIRECTION_CSS } from "../directions.generated";
import { LIBRARY_ARCHETYPES } from "../archetypes";

/**
 * Driven entirely by `searchParams`, so there is nothing to prerender —
 * Next 16 blocks the build otherwise rather than guessing.
 */
export const instant = false;

/**
 * One archetype, under one direction.
 *
 * Rendered inside an iframe by the grid, which is what gives each cell a real
 * viewport width and complete CSS isolation — four directions on one document
 * would mean four sets of custom properties competing for `:root`.
 */
export default async function LibraryPreview({
  searchParams,
}: {
  searchParams: Promise<{ direction?: string; archetype?: string; variant?: string }>;
}) {
  const { direction = "", archetype = "", variant = "0" } = await searchParams;
  // A direction has a range, not a value: `variant` picks which candidate
  // of it this preview renders (D10 §6.3).
  const candidate = DIRECTION_CSS[direction]?.[Number(variant)];
  const css = candidate?.css;
  const entry = LIBRARY_ARCHETYPES.find((a) => a.id === archetype);
  if (css === undefined || candidate === undefined || entry === undefined) {
    notFound();
  }

  /*
    The direction's motion, not the template's. Archetypes gate their
    animation on `config.motion` rather than on a token, so a preview that
    only injected CSS rendered every direction with the template's own
    kinetic motion — a `calm` direction's band still scrolled, which is the
    exact failure K8 was about, reappearing in the review surface.
  */
  const config = {
    ...siteConfig,
    motion: candidate.motion as typeof siteConfig.motion,
  };

  const Component = entry.component;

  return (
    <>
      {/* The direction's own tokens, scoped to this document. Tailwind's
          utilities and the template's defaults come from globals.css; only
          what the direction changes is overridden here. */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <main className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
        <Component section={entry.section as never} config={config} />
      </main>
    </>
  );
}
