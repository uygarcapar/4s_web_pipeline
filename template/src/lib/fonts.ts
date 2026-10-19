// Replaced per client by the design stage (apps/orchestrator/src/design/fonts.ts).
// This copy is the template's own default so that `pnpm dev` in template/
// works without a run; a generated site always gets the pairing chosen for
// its sector and checked against the design fingerprint ledger (D6).
import { Archivo, Inter } from "next/font/google";

/**
 * The display face. A grotesk needs weight 800 and negative tracking to read
 * as display rather than as a UI font — at 400 it reads timid at any size
 * (template/design-rules.md §4).
 *
 * latin-ext is not optional: without it ş/ğ/ı/İ/ç/ö/ü fall back mid-word.
 */
export const displayFont = Archivo({
  variable: "--font-display-face",
  subsets: ["latin", "latin-ext"],
  weight: ["800"],
  display: "swap",
});

export const bodyFont = Inter({
  variable: "--font-body-face",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/** Both variables, for the <html> className. */
export const fontVariables = `${displayFont.variable} ${bodyFont.variable}`;
