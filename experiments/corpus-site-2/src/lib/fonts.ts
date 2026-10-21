import localFont from "next/font/local";

/**
 * A deliberately different branch of the same corpus from site one.
 *
 * Site one took the grotesk-at-400 reading (corpus-findings §2 median).
 * This one takes the other documented end: a serif display at 700. Both are
 * in the measured distribution — 9 of 51 sites set display at 700, and the
 * corpus carries serif display faces (Ivar Headline, Reckless Neue, Cardinal
 * Classic). Two valid readings of one dataset is the point: the corpus is a
 * range to choose inside, not a single answer to copy.
 */
export const display = localFont({
  src: "../../public/fonts/boska.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "300 900",
});

export const body = localFont({
  src: "../../public/fonts/switzer.woff2",
  variable: "--font-body",
  display: "swap",
  weight: "300 900",
});

export const mono = localFont({
  src: "../../public/fonts/jet-brains-mono.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "100 800",
});

export const fontVariables = `${display.variable} ${body.variable} ${mono.variable}`;
