/**
 * The self-hosted face registry (D10 §11 C1, A5).
 *
 * Every face a direction may list appears here with its licence, because
 * §13 Q2 is settled as **free open-licence faces only**: no foundry licence
 * is bought, so a per-domain or pageview-capped licence disqualifies a face
 * outright. The pipeline ships one site per client across unlimited domains
 * and nobody reviews a licence per run.
 *
 * Faces are vendored as woff2 under `data/fonts/<slug>/` by
 * `scripts/vendor-fonts.mjs` and copied into a run's `public/fonts/` by the
 * design stage, rather than shipped in every template copy: a client site
 * needs the two or three faces its direction chose, not all eleven.
 *
 * Turkish coverage is **not** recorded here as a claim. It is asserted by
 * rendering, in `faces.turkish.test.ts` — design-rules.md §6 and
 * build-rules.md §4 both require that a catalogue page is not evidence, and
 * a display face advertising `latin-ext` can still ship a dotless ı that is
 * really a fallback.
 */

/** Licences that satisfy Q2. Anything else is not vendorable. */
export const FREE_LICENCES = ["OFL", "Apache-2.0", "UFL"] as const;
export type FreeLicence = (typeof FREE_LICENCES)[number];

export interface Face {
  /** As `next/font/google` and the Google CSS API name it. */
  family: string;
  /** Directory name under `data/fonts/`. */
  slug: string;
  licence: FreeLicence;
  /**
   * The Google CSS2 axis query used to vendor it. Variable faces carry their
   * full range — pinning a weight is what made every earlier run read as a
   * 2014 web page, because a variable face loaded at one weight cannot do an
   * optical-size curve (docs/STATUS.md, "faces that are actually modern").
   */
  axes: string;
  /** True when the vendored file is a variable font. */
  variable: boolean;
  /**
   * True when the face has no lowercase glyphs, so every string renders as
   * capitals whatever the markup says.
   *
   * It matters for line-height, not for taste. Turkish capitals carry marks
   * above the cap height — Ü, Ö, Ğ, İ — and at display scale those marks
   * collide with the line above unless the leading is opened up. The spec's
   * `displayCase` cannot answer this: a spec can say `sentence`, the
   * component can render sentence case, and Anton will still draw capitals.
   */
  uppercaseOnly?: boolean;
}

export const FACES: Face[] = [
  // Display
  { family: "Archivo", slug: "archivo", licence: "OFL", axes: "wdth,wght@62..125,100..900", variable: true },
  { family: "Anton", slug: "anton", licence: "OFL", axes: "", variable: false, uppercaseOnly: true },
  { family: "Bebas Neue", slug: "bebas-neue", licence: "OFL", axes: "", variable: false, uppercaseOnly: true },
  { family: "Fraunces", slug: "fraunces", licence: "OFL", axes: "opsz,wght@9..144,100..900", variable: true },
  { family: "Newsreader", slug: "newsreader", licence: "OFL", axes: "opsz,wght@6..72,200..800", variable: true },
  { family: "Instrument Serif", slug: "instrument-serif", licence: "OFL", axes: "", variable: false },

  // Body
  { family: "Karla", slug: "karla", licence: "OFL", axes: "wght@200..800", variable: true },
  { family: "Public Sans", slug: "public-sans", licence: "OFL", axes: "wght@100..900", variable: true },
  { family: "Inter Tight", slug: "inter-tight", licence: "OFL", axes: "wght@100..900", variable: true },

  // Mono accent
  { family: "Space Mono", slug: "space-mono", licence: "OFL", axes: "", variable: false },
  { family: "JetBrains Mono", slug: "jetbrains-mono", licence: "OFL", axes: "wght@100..800", variable: true },
];

export const FACE_BY_FAMILY = new Map(FACES.map((f) => [f.family, f]));

/** The Turkish characters a face must render without falling back (§6). */
export const TURKISH_GLYPHS = "şğıİÇÖÜĞŞçöü";

/**
 * A string that exercises the glyphs in word shapes rather than in isolation,
 * because the failure mode is a fallback mid-word — the ş of "Dişkent"
 * arriving from a different face and renaming the business.
 */
export const TURKISH_TEST_STRING =
  "Dişkent Ağız ve Diş Sağlığı — İstanbul'da güçlü gülüşler, çözüm ortağınız";

/**
 * The characters every vendored face is subset to.
 *
 * Faces used to ship Google's `latin` + `latin-ext` subsets, two files per
 * family. For three families that is six requests and 235 KB — the heaviest
 * resource class on a generated page, outweighing all its JavaScript, and
 * three times over the `font:count` budget. Subsetting to the characters a
 * Turkish SMB site can actually contain gives one file per family: three
 * requests and 119 KB, a 49% cut on the critical path.
 *
 * Both Google subsets are otherwise required and neither can simply be
 * dropped, because Turkish straddles them: dotless `ı` is U+0131 and lives
 * in `latin`, while `ğ ş İ` are U+011F/U+015F/U+0130 and live in `latin-ext`.
 *
 * Deliberately generous. The failure mode of subsetting is a character that
 * was never anticipated arriving from the fallback face mid-word, which is
 * the same disfigurement `faces.turkish.test.ts` exists to catch — so this
 * carries all of Latin-1's letters, the typographic punctuation a crawl can
 * hand us from a client's own copy, currency including `₺`, and the symbols
 * that turn up in Turkish SMB text (`©`, `®`, `°`, `№`, `½`). Adding a
 * character here costs a few hundred bytes; omitting one that a client
 * publishes is visible on their page.
 */
export const SUBSET_CHARSET: string = [
  // Printable ASCII: letters, digits, punctuation, the quote in "İstanbul'da".
  ...Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCodePoint(0x20 + i)),
  // Latin-1 letters — loanwords, foreign names, and the accented forms a
  // client's own copy may already contain.
  ..."ÀÁÂÄÇÈÉÊËÎÏÔÖÙÛÜŸàáâäçèéêëîïôöùûüÿÑñßŒœ",
  // Turkish proper. Already covered above in part; listed so the intent is
  // readable and so a future edit cannot quietly drop one.
  ..."ĞğİıŞşÇçÖöÜü",
  // Typographic punctuation: en/em dashes and curly quotes arrive from
  // WordPress copy constantly, and a missing ’ breaks a word in half.
  ..."–—‘’“”„…•·‹›«»′″",
  // Currency. `₺` (U+20BA) is the one that matters and is in neither subset
  // by default on some faces.
  ..."₺€£$¢¥",
  // Symbols seen in Turkish SMB copy: trade marks, degrees, fractions.
  ..."©®™°№§¶±×÷≤≥≠→←↑↓∞µ½¼¾",
]
  .filter((ch, i, all) => all.indexOf(ch) === i)
  .join("");
