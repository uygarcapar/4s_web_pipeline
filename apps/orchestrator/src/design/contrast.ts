/**
 * WCAG contrast for the OKLCH ramps `spec-tokens.ts` generates.
 *
 * Needed because the ramp is now derived rather than hand-tuned. The
 * template's committed tokens carry a note that the "text on brand" step was
 * moved from L 0.57 to L 0.52 after axe measured 4.0–4.2:1 — a number
 * someone had to discover by running the gate. A generator that can emit any
 * lightness for any hue has to be able to check itself, or every new
 * direction rediscovers that by failing verify.
 *
 * sRGB only. The generated CSS is in OKLCH and a wide-gamut display will
 * show more saturated colour than this predicts, but WCAG is defined on
 * sRGB relative luminance and axe measures the sRGB fallback, so sRGB is
 * both the conservative answer and the one the gate uses.
 */

/** OKLCH (L 0–1, C, H degrees) → sRGB in 0–1, clipped to gamut. */
export function oklchToSrgb(
  l: number,
  c: number,
  hDeg: number,
): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  // OKLab → LMS (cube roots), per Björn Ottosson's reference implementation.
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  // LMS → linear sRGB.
  const lin: [number, number, number] = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];

  return lin.map((v) => clamp01(gamma(v))) as [number, number, number];
}

function gamma(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** WCAG 2.x relative luminance of an sRGB triple in 0–1. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number): number =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two OKLCH colours, 1:1 to 21:1. */
export function contrastRatio(
  a: { l: number; c: number; h: number },
  b: { l: number; c: number; h: number },
): number {
  const la = relativeLuminance(oklchToSrgb(a.l, a.c, a.h));
  const lb = relativeLuminance(oklchToSrgb(b.l, b.c, b.h));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
}

/** WCAG AA for body text. */
export const AA_TEXT = 4.5;

/**
 * The worst contrast a pair reaches across the hue circle.
 *
 * The ramp's chroma is a multiple of the client's `brandC`, and the hue is
 * the client's too, so a pair that passes at hue 220 can fail at hue 90 —
 * yellow at the same OKLCH lightness is markedly lighter in sRGB. Checking
 * one hue would pass a ramp that breaks for the next client.
 */
export function worstContrast(
  text: { l: number; c: number },
  background: { l: number; c: number },
): { ratio: number; hue: number } {
  let worst = { ratio: 21, hue: 0 };
  for (let h = 0; h < 360; h += 5) {
    const ratio = contrastRatio({ ...text, h }, { ...background, h });
    if (ratio < worst.ratio) worst = { ratio, hue: h };
  }
  return worst;
}
