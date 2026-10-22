// Replaced per client by the design stage (apps/orchestrator/src/design/local-fonts.ts).
// This copy is the template's own default so that `pnpm dev` in template/
// works without a run; a generated site gets the faces its direction chose.
import localFont from "next/font/local";

/**
 * Self-hosted, from `public/fonts` (D10 §11 C1, §13 Q2: free open-licence
 * faces only — Archivo and Inter Tight are both OFL and ship their licence
 * beside the woff2).
 *
 * **No weight is pinned, and that is the whole point.** This file used to
 * load Archivo at `weight: ["800"]`. A variable face loaded at one weight
 * cannot do an optical-size curve, so every direction rendered the same
 * glyphs however light its range said it was — a direction asking for 300
 * got 800, while `getComputedStyle` dutifully reported 300 and DJ16 passed
 * a page that visibly contradicted its own direction. `weight: "100 900"`
 * hands the whole axis to the CSS.
 *
 * `preload` on the display face: it sets the largest text on the page, so it
 * is on the critical path for LCP. The body face is not preloaded — it
 * resolves below the fold often enough that the extra request costs more
 * than it saves.
 */
export const displayFont = localFont({
  src: [
    { path: "../../public/fonts/archivo/archivo-latin.woff2", style: "normal" },
    { path: "../../public/fonts/archivo/archivo-latin-ext.woff2", style: "normal" },
  ],
  variable: "--font-display-face",
  weight: "100 900",
  display: "swap",
  preload: true,
  // A metric-compatible stack: the swap from fallback to face should not
  // move the headline, which is both a CLS cost and visibly cheap.
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
  adjustFontFallback: false,
});

export const bodyFont = localFont({
  src: [
    { path: "../../public/fonts/inter-tight/inter-tight-latin.woff2", style: "normal" },
    { path: "../../public/fonts/inter-tight/inter-tight-latin-ext.woff2", style: "normal" },
  ],
  variable: "--font-body-face",
  weight: "100 900",
  display: "swap",
  preload: false,
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
  adjustFontFallback: false,
});

/** Both variables, for the <html> className. */
export const fontVariables = `${displayFont.variable} ${bodyFont.variable}`;
