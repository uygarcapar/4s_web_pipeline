/**
 * Palette derivation — the mechanism that stops two clients in the same
 * sector from coming out the same colour (design-rules.md §10.1).
 *
 * The dominant non-neutral hue is taken from the client's own photographs and
 * a one-hue-family scale is built around it: warm papers, darks that are the
 * same hue pushed to near-black, and exactly one accent. On the reference
 * build the clinic's dark ground came from the turquoise of their own
 * treatment chair, which is why their pictures sit inside the palette instead
 * of fighting it.
 *
 * Deterministic and model-free: same pixels in, same palette out.
 */

export interface Palette {
  /** Human-readable family name, used in logs and the fingerprint. */
  name: string;
  /** Source hue in degrees, 0–359. */
  hue: number;
  /** Chroma of the source, 0–1. Low chroma sources fall back to a warm neutral. */
  chroma: number;
  paper: { 50: string; 100: string; 200: string; 300: string; 400: string; 500: string };
  ink: { 900: string; 800: string; 700: string; 600: string; 400: string };
  accent: string;
}

/** A decoded image reduced to raw RGB samples. */
export interface PixelSource {
  /** Flat RGB triples, any length divisible by 3. */
  rgb: Uint8Array | number[];
  /** Weight relative to other sources — the clinic's own room outweighs stock. */
  weight?: number;
}

const TAU = 360;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h * TAU, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hp = ((h % TAU) + TAU) % TAU;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hp / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(hp / 60) % 6;
  const table: readonly (readonly [number, number, number])[] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = table[seg] ?? ([c, x, 0] as const);
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Turkish/descriptive names for hue ranges, so the fingerprint and the
 * operator's Telegram message say something a person can picture.
 */
function hueName(h: number, chroma: number): string {
  if (chroma < 0.06) return "nötr";
  const bands: [number, string][] = [
    [15, "kırmızı"],
    [40, "kiremit"],
    [60, "amber"],
    [95, "zeytin"],
    [150, "yeşil"],
    [185, "turkuaz"],
    [215, "mavi"],
    [260, "lacivert"],
    [300, "mor"],
    [340, "bordo"],
    [360, "kırmızı"],
  ];
  for (const [limit, name] of bands) if (h < limit) return name;
  return "kırmızı";
}

/**
 * Circular-mean hue of the saturated, mid-lightness pixels.
 *
 * Near-white and near-black pixels are discarded: a dental surgery is mostly
 * white cabinetry, and averaging that in returns grey every time. What is
 * left is the equipment, the signage, the upholstery — the colours the
 * business actually chose.
 */
export function dominantHue(sources: PixelSource[]): { hue: number; chroma: number } {
  let x = 0;
  let y = 0;
  let chromaSum = 0;
  let total = 0;

  for (const src of sources) {
    const w = src.weight ?? 1;
    const px = src.rgb;
    for (let i = 0; i + 2 < px.length; i += 3) {
      const [h, s, l] = rgbToHsl(px[i] ?? 0, px[i + 1] ?? 0, px[i + 2] ?? 0);
      if (s < 0.18) continue; // washed out
      if (l < 0.12 || l > 0.9) continue; // shadow or blown highlight
      const weight = w * s;
      const rad = (h * Math.PI) / 180;
      x += Math.cos(rad) * weight;
      y += Math.sin(rad) * weight;
      chromaSum += s * w;
      total += w;
    }
  }

  if (total === 0) return { hue: 38, chroma: 0 }; // warm neutral fallback
  const hue = ((Math.atan2(y, x) * 180) / Math.PI + TAU) % TAU;
  return { hue, chroma: chromaSum / total };
}

/**
 * Build the scale. The papers keep a warm cast regardless of the source hue —
 * a page is read on paper, not on the accent — while the darks and the accent
 * carry the business's own colour.
 */
export function buildPalette(input: { hue: number; chroma: number }): Palette {
  const { hue, chroma } = input;
  const usable = chroma >= 0.06;

  // Papers: always warm, barely tinted toward the source so the two families
  // feel related rather than unrelated.
  const paperHue = usable ? mixHue(38, hue, 0.18) : 38;
  const paper = {
    50: hslToHex(paperHue, 0.3, 0.98),
    100: hslToHex(paperHue, 0.22, 0.94),
    200: hslToHex(paperHue, 0.18, 0.89),
    300: hslToHex(paperHue, 0.14, 0.8),
    400: hslToHex(paperHue, 0.1, 0.62),
    500: hslToHex(paperHue, 0.08, 0.4),
  };

  // Darks: the source hue pushed to near-black. This is what makes the
  // client's photographs belong to the page.
  const inkHue = usable ? hue : 38;
  const inkSat = usable ? 0.3 : 0.12;
  const ink = {
    900: hslToHex(inkHue, inkSat, 0.06),
    800: hslToHex(inkHue, inkSat, 0.1),
    700: hslToHex(inkHue, inkSat * 0.9, 0.15),
    600: hslToHex(inkHue, inkSat * 0.85, 0.23),
    400: hslToHex(inkHue, inkSat * 0.6, 0.43),
  };

  // The single accent: the source hue at a usable contrast, for hover and
  // focus only — never a surface (design-rules.md §5).
  const accent = hslToHex(inkHue, usable ? 0.75 : 0.35, 0.24);

  return {
    name: hueName(hue, chroma),
    hue: Math.round(hue),
    chroma: Number(chroma.toFixed(3)),
    paper,
    ink,
    accent,
  };
}

/** Shortest-path interpolation between two hues on the colour wheel. */
function mixHue(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % TAU) - 180;
  return (from + delta * t + TAU) % TAU;
}

/** Convenience: samples → palette, in one call. */
export function derivePalette(sources: PixelSource[]): Palette {
  return buildPalette(dominantHue(sources));
}
