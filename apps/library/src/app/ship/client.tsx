"use client";

import { useState } from "react";

export interface ShippedSite {
  domain: string;
  direction: string;
  seed: string;
  desktop: string;
  mobile: string | null;
}

/**
 * Every shipped fold in one grid, the way §12 asks the question.
 *
 * Clicking a site marks it as part of a group you think looks the same.
 * That is the test's actual output — not a score, but "these two, and they
 * turned out to be X and Y" — and it is worth capturing while looking
 * rather than remembering afterwards.
 */
export function ShipClient({ sites }: { sites: ShippedSite[] }) {
  const [showDirections, setShowDirections] = useState(false);
  const [fold, setFold] = useState<"desktop" | "mobile">("desktop");
  const [grouped, setGrouped] = useState<Set<string>>(new Set());

  const toggle = (domain: string) =>
    setGrouped((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });

  const picked = sites.filter((s) => grouped.has(s.domain));
  const directions = new Set(picked.map((s) => s.direction));

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-neutral-950/90 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="text-sm font-semibold tracking-wide uppercase">
            §12 ship test
          </h1>
          <p className="mt-1 text-xs opacity-60">
            {sites.length} shipped {sites.length === 1 ? "site" : "sites"} ·
            can you group any two as the same site?
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setFold((f) => (f === "desktop" ? "mobile" : "desktop"))}
            className="rounded border border-white/20 px-3 py-1.5 hover:bg-white/10"
          >
            {fold}
          </button>
          <button
            type="button"
            onClick={() => setShowDirections((v) => !v)}
            className="rounded border border-white/20 px-3 py-1.5 hover:bg-white/10"
          >
            {showDirections ? "hide" : "reveal"} directions
          </button>
        </div>
      </header>

      {picked.length > 0 && (
        <div className="border-b border-white/10 bg-amber-400/10 px-6 py-3 text-xs">
          <strong>{picked.length} grouped:</strong>{" "}
          {picked.map((s) => s.domain).join(", ")}
          {showDirections && (
            <>
              {" — "}
              {directions.size === 1 ? (
                <span className="text-amber-300">
                  all {[...directions][0]}: the direction repeated
                </span>
              ) : (
                <span className="text-emerald-300">
                  {directions.size} different directions:{" "}
                  {[...directions].join(", ")} — the distance gate passed them
                  and they still read alike
                </span>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 xl:grid-cols-3">
        {sites.map((site) => {
          const src = fold === "mobile" && site.mobile ? site.mobile : site.desktop;
          const on = grouped.has(site.domain);
          return (
            <button
              key={site.domain}
              type="button"
              onClick={() => toggle(site.domain)}
              className={`overflow-hidden rounded border text-left transition ${
                on ? "border-amber-400 ring-2 ring-amber-400" : "border-white/10"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={site.domain} className="w-full bg-white" />
              <div className="flex items-baseline justify-between gap-3 px-3 py-2 text-xs">
                <span className="truncate opacity-80">{site.domain}</span>
                {showDirections && (
                  <span className="shrink-0 opacity-50">{site.direction}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}
