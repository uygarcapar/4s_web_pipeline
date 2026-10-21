import { LIBRARY_DIRECTIONS } from "./directions.generated";
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
export default function Library() {
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
                        title={`${a.id} — ${direction} — ${label}`}
                        src={`/preview?direction=${direction}&archetype=${encodeURIComponent(a.id)}`}
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
