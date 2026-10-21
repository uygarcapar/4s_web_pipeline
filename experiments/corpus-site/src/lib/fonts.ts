import localFont from "next/font/local";

/**
 * Self-hosted, not `next/font/google`.
 *
 * `template/corpus-findings.md` §1: 7 of 10 award-winning sites serve their
 * own font files, and the faces they serve are foundry faces the Google
 * catalogue does not carry. Swapping one Google face for another moves inside
 * that ceiling; self-hosting is what clears it.
 *
 * These three are Fontshare's commercially-free releases, downloaded as
 * variable woff2 into public/fonts — one file each, every weight.
 */
export const display = localFont({
  src: "../../public/fonts/clash-display.woff2",
  variable: "--font-display",
  display: "swap",
  // The variable range, so weight is a free choice rather than a fixed cut.
  weight: "200 700",
});

export const body = localFont({
  src: "../../public/fonts/satoshi.woff2",
  variable: "--font-body",
  display: "swap",
  weight: "300 900",
});

/**
 * The accent face. §7.2: four of the most-declared families across the corpus
 * are monospace — used for meta, labels and figures, not for code. We had no
 * mono at all, so every small element fell back to the body face.
 */
export const mono = localFont({
  src: "../../public/fonts/jet-brains-mono.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "100 800",
});

export const fontVariables = `${display.variable} ${body.variable} ${mono.variable}`;
