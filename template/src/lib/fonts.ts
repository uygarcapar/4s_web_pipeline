// Generated from design.json by the design stage — do not hand-edit.
// direction: swiss-grid
//
// Self-hosted from public/fonts (D10 §11 C1); every face is free
// open-licence (§13 Q2) and its OFL.txt ships beside the woff2.
//
// Weights are NOT pinned: a variable face loaded at one weight cannot do an
// optical-size curve, which is what made earlier runs read as the same page
// whatever family was chosen.
//
// One declaration per FAMILY, not per role: display+body: Archivo · mono: JetBrains Mono
import localFont from "next/font/local";

/** Archivo — OFL, variable. */
export const displayFont = localFont({
  src: [
    { path: "../../public/fonts/archivo/archivo-tr.woff2", style: "normal" },
  ],
  variable: "--font-display-face",
  display: "swap",
  weight: "100 900",
  preload: true,
  // A metric-compatible stack: the swap from fallback to face should not
  // move the headline, which is both a CLS cost and visibly cheap.
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
  adjustFontFallback: false,
});

/** JetBrains Mono — OFL, variable. */
export const monoFont = localFont({
  src: [
    { path: "../../public/fonts/jetbrains-mono/jetbrains-mono-tr.woff2", style: "normal" },
  ],
  variable: "--font-mono-face",
  display: "swap",
  weight: "100 900",
  preload: false,
  // A metric-compatible stack: the swap from fallback to face should not
  // move the headline, which is both a CLS cost and visibly cheap.
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
  adjustFontFallback: false,
});

/** Every variable, for the <html> className. */
export const fontVariables = `${displayFont.variable} ${monoFont.variable}`;
