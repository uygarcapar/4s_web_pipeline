"use client";

import { useCallback, useEffect, useState } from "react";

export interface CalibrationPair {
  a: string;
  b: string;
  shots: { aDesktop: string; bDesktop: string; aMobile: string; bMobile: string };
}

type Label = "alike" | "different";

const STORAGE_KEY = "d10-calibration-labels";

/** Labels from a previous session, or none. Runs on the client only. */
function restore(): Record<string, Label> {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Record<string, Label>) : {};
  } catch {
    // A corrupt entry is not worth failing over; start clean.
    return {};
  }
}

/**
 * One pair at a time, two buttons, keyboard-driven.
 *
 * Deliberately not a grid of every pair: §8.3 wants a judgement per pair and
 * a grid invites comparing pairs against each other, which is a different
 * question. Progress is kept in localStorage so a session can be abandoned
 * halfway — thirty considered judgements is an hour, and an hour is a thing
 * people get interrupted during.
 */
export function CalibrateClient({
  pairs,
  summary,
}: {
  pairs: CalibrationPair[];
  summary: string;
}) {
  // Read once, lazily, instead of in an effect: an effect would render the
  // empty state first and then re-render with the saved labels, which flashes
  // "0 labelled" at someone returning to finish a session.
  const [labels, setLabels] = useState<Record<string, Label>>(restore);
  const [at, setAt] = useState(0);
  const [fold, setFold] = useState<"desktop" | "mobile">("desktop");

  const pair = pairs[at];
  const key = pair ? `${pair.a}|${pair.b}` : "";

  const label = useCallback(
    (value: Label) => {
      if (!pair) return;
      setLabels((prev) => {
        const next = { ...prev, [`${pair.a}|${pair.b}`]: value };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      setAt((i) => Math.min(i + 1, pairs.length - 1));
    },
    [pair, pairs.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "ArrowLeft") label("alike");
      else if (e.key === "d" || e.key === "ArrowRight") label("different");
      else if (e.key === "m") setFold((f) => (f === "desktop" ? "mobile" : "desktop"));
      else if (e.key === "[") setAt((i) => Math.max(0, i - 1));
      else if (e.key === "]") setAt((i) => Math.min(pairs.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [label, pairs.length]);

  const download = () => {
    const blob = new Blob([JSON.stringify(labels, null, 2) + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "labels.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!pair) return null;

  const done = Object.keys(labels).length;
  const current = labels[key];
  const shotA = fold === "desktop" ? pair.shots.aDesktop : pair.shots.aMobile;
  const shotB = fold === "desktop" ? pair.shots.bDesktop : pair.shots.bMobile;

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <h1 className="text-sm font-semibold tracking-wide uppercase">
            §8.3 calibration
          </h1>
          <p className="mt-1 text-xs opacity-60">{summary}</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="opacity-60">
            {at + 1} / {pairs.length} · {done} labelled
          </span>
          <button
            type="button"
            onClick={() => setFold((f) => (f === "desktop" ? "mobile" : "desktop"))}
            className="rounded border border-white/20 px-3 py-1.5 hover:bg-white/10"
          >
            {fold} (m)
          </button>
          <button
            type="button"
            onClick={download}
            disabled={done === 0}
            className="rounded bg-white px-3 py-1.5 font-semibold text-neutral-950 disabled:opacity-40"
          >
            Download labels.json
          </button>
        </div>
      </header>

      <div className="px-6 py-6">
        <p className="text-center text-sm">
          Would you group these two as <strong>the same site</strong>?
          <span className="ml-3 opacity-50">
            a / ← alike · d / → different · m fold · [ ] move
          </span>
        </p>

        <div
          className={`mt-6 grid gap-4 ${fold === "desktop" ? "lg:grid-cols-2" : "mx-auto max-w-2xl grid-cols-2"}`}
        >
          {[shotA, shotB].map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${key}-${i}`}
              src={`/calibration/${src}`}
              alt={i === 0 ? pair.a : pair.b}
              className="w-full rounded border border-white/10 bg-white"
            />
          ))}
        </div>

        <div className="sticky bottom-6 mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => label("alike")}
            className={`rounded-full px-8 py-3 text-sm font-semibold ${
              current === "alike"
                ? "bg-amber-400 text-neutral-950"
                : "border border-white/25 hover:bg-white/10"
            }`}
          >
            Same site
          </button>
          <button
            type="button"
            onClick={() => label("different")}
            className={`rounded-full px-8 py-3 text-sm font-semibold ${
              current === "different"
                ? "bg-emerald-400 text-neutral-950"
                : "border border-white/25 hover:bg-white/10"
            }`}
          >
            Different
          </button>
        </div>
      </div>
    </main>
  );
}
