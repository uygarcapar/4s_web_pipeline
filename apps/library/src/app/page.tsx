import { DIRECTION_CSS, LIBRARY_DIRECTIONS, LIBRARY_VARIANTS } from "./directions.generated";
import { LIBRARY_ARCHETYPES } from "./archetypes";

/** Desktop and mobile — the two widths B4 reviews at (D10 §12). */
const WIDTHS = [
  { label: "desktop", w: 1440, h: 900, scale: 0.34 },
  { label: "mobile", w: 390, h: 844, scale: 0.42 },
] as const;

/**
 * `/` — every archetype under every direction (D10 §12 B1).
 *
 * One row per archetype, one column per direction, each cell an iframe of
 * `/preview`. Scaled iframes rather than inline rendering: it is the only way
 * to show a real 1440px layout and a real 390px layout at once without lying
 * about either, and it keeps four token sets from fighting over `:root`.
 *
 * This is the surface B4 reviews. Its value is that a rejection can point at
 * a composition instead of at a diff.
 */
/** Driven by `searchParams` (the candidate selector), so nothing to prerender. */
export const instant = false;

export default async function Library({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant = "0" } = await searchParams;
  const v = Math.min(Math.max(Number(variant) || 0, 0), LIBRARY_VARIANTS - 1);

  return (
    <main className="library-shell min-h-dvh p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Archetype library</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">
          {LIBRARY_ARCHETYPES.length} archetypes × {LIBRARY_DIRECTIONS.length}{" "}
          directions. D10 §7.1 targets 45 across eleven section types; the gap
          is what B3 and B4 build. An archetype that looks the same under{" "}
          <code>swiss-grid</code> and <code>quiet-luxury</code> is reading
          something other than tokens — the B2 failure this view exists to
          expose.
        </p>

        {/*
          A direction is a range, not a value. Showing only candidate 0 —
          which this page did until now — meant radius, image frame, colour
          mode and type pairing never varied inside a direction, and an
          archetype was approved against roughly a quarter of what its
          direction can produce.
        */}
        <nav className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-neutral-500">candidate:</span>
          {Array.from({ length: LIBRARY_VARIANTS }, (_, i) => (
            <a
              key={i}
              href={`/?variant=${i}`}
              className={
                i === v
                  ? "rounded bg-neutral-900 px-3 py-1 font-mono text-white"
                  : "rounded border border-neutral-300 px-3 py-1 font-mono hover:bg-neutral-100"
              }
            >
              {i}
            </a>
          ))}
        </nav>

        <dl className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs text-neutral-600 sm:grid-cols-2">
          {LIBRARY_DIRECTIONS.map((d) => (
            <div key={d} className="flex gap-2">
              <dt className="shrink-0 font-semibold">{d}</dt>
              <dd>{DIRECTION_CSS[d]?.[v]?.summary}</dd>
            </div>
          ))}
        </dl>
      </header>

      {LIBRARY_ARCHETYPES.map((a) => (
        <section key={a.id} className="mb-12">
          <h2 className="mb-3 font-mono text-sm font-semibold">{a.id}</h2>
          {WIDTHS.map(({ label, w, h, scale }) => (
            <div key={label} className="mb-4">
              <div className="mb-1 font-mono text-xs text-neutral-500">
                {label} · {w}×{h}
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {LIBRARY_DIRECTIONS.map((direction) => (
                  <figure key={direction} className="shrink-0">
                    <figcaption className="mb-1 font-mono text-xs text-neutral-600">
                      {direction}
                    </figcaption>
                    <div
                      className="overflow-hidden border border-neutral-300 bg-white"
                      style={{ width: w * scale, height: h * scale }}
                    >
                      <iframe
                        title={`${a.id} — ${direction} — ${label} — candidate ${v}`}
                        src={`/preview?direction=${direction}&archetype=${encodeURIComponent(a.id)}&variant=${v}`}
                        width={w}
                        height={h}
                        loading="lazy"
                        style={{
                          transform: `scale(${scale})`,
                          transformOrigin: "top left",
                          border: 0,
                        }}
                      />
                    </div>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
