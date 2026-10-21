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
  searchParams: Promise<{ direction?: string; archetype?: string }>;
}) {
  const { direction = "", archetype = "" } = await searchParams;
  const css = DIRECTION_CSS[direction];
  const entry = LIBRARY_ARCHETYPES.find((a) => a.id === archetype);
  if (css === undefined || entry === undefined) notFound();

  const Component = entry.component;

  return (
    <>
      {/* The direction's own tokens, scoped to this document. Tailwind's
          utilities and the template's defaults come from globals.css; only
          what the direction changes is overridden here. */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <main className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
        <Component section={entry.section as never} config={siteConfig} />
      </main>
    </>
  );
}
