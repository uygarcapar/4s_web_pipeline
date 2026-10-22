import type { DesignSpec } from "@pipeline/core";

import { buildScale, scaleViolations, MEASURE_CH, type TypeStep } from "./scale.js";
import { AA_TEXT, worstContrast } from "./contrast.js";
import { fontRoles, type FontRoleName } from "./local-fonts.js";

/**
 * `DesignSpec` → the generated site's `src/styles/tokens.css` (D10 §5, A4).
 *
 * Everything here is derived: the type scale from `scaleRatio` and the
 * direction's weight and tracking, the colour ramp from `brandH`/`brandC`
 * plus `mode` and `strategy`, the radius and rule weights from `shape`, the
 * rhythm from `grid.density`. **The model never writes a token value.**
 *
 * This replaced `renderTokens(dna)` in C3; the DNA renderers are deleted
 * rather than left beside it, because an unused generator in the design
 * folder is indistinguishable from a second supported path.
 */
export function renderSpecTokens(spec: DesignSpec): string {
  const steps = buildScale(spec);
  const problems = scaleViolations(steps);
  if (problems.length > 0) {
    throw new Error(
      `generated scale violates design-rules.md §4:\n- ${problems.join("\n- ")}`,
    );
  }
  const contrast = rampViolations(spec);
  if (contrast.length > 0) {
    throw new Error(
      `generated ramp fails WCAG AA:\n- ${contrast.join("\n- ")}`,
    );
  }

  // `motion` is deliberately not read here: motion is a component decision
  // (B2 teaches the archetypes to read the flags), not a token value.
  const { color, shape, grid, type } = spec;
  const dark = color.mode === "dark";
  const rhythm = RHYTHM[grid.density];

  return `/* Generated from design.json by the design stage — do not hand-edit.
   direction: ${spec.direction} · seed: ${spec.seed}
   Every value below is derived from the spec: the scale from scaleRatio
   ${type.scaleRatio}, the ramp from brandH ${color.brandH} / brandC ${color.brandC}
   (${color.mode}, ${color.strategy}). design-rules.md §4 owns the eight steps;
   the numbers are ${spec.direction}'s. */

@import "tailwindcss";

:root {
  --brand-h: ${color.brandH};
  --brand-c: ${color.brandC};

${renderRamp(spec)}

  --background: var(--paper-100);
  --foreground: var(--ink-900);
  --brand-accent: ${accent(spec)};

${renderFontVars(spec)}

  /* shape (§4.2) */
  --radius: ${shape.radius === 999 ? "9999px" : `${shape.radius / 16}rem`};
  --rule-width: ${RULE_WIDTH[shape.rules]};
  --rule-color: ${shape.rules === "none" ? "transparent" : "var(--ink-400)"};

  /* How a photograph meets the page (${shape.imageFrame}). An archetype reads
     these rather than branching on the frame name, so a new frame is a token
     change and not an edit to every section that shows a picture. */
  --image-radius: ${IMAGE_FRAME[shape.imageFrame].radius};
  --image-inset: ${IMAGE_FRAME[shape.imageFrame].inset};
  --image-aspect: ${IMAGE_FRAME[shape.imageFrame].aspect};

  /* grid (§4.2), as tokens so an archetype never branches on the direction
     name. ${grid.alignment}: a centred language and a left-flush one are the
     same markup with a different anchor. */
  --text-align: ${grid.alignment === "centered" ? "center" : "left"};
  --align-items: ${grid.alignment === "centered" ? "center" : "flex-start"};
  /* How far a secondary column is pushed off the baseline grid. Zero unless
     the direction is asymmetric, which is the only one that offsets. */
  --offset-y: ${grid.alignment === "asymmetric" ? "4rem" : "0rem"};

  /* rhythm, from grid.density (${grid.density}) */
  --section-y: ${rhythm.y};
  --section-y-lg: ${rhythm.yLg};
  /* line length < 80ch (design-rules.md §4) */
  --measure: ${MEASURE_CH}ch;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-paper-50: var(--paper-50);
  --color-paper-100: var(--paper-100);
  --color-paper-200: var(--paper-200);
  --color-paper-300: var(--paper-300);
  --color-paper-400: var(--paper-400);
  --color-paper-500: var(--paper-500);
  --color-ink-900: var(--ink-900);
  --color-ink-800: var(--ink-800);
  --color-ink-700: var(--ink-700);
  --color-ink-600: var(--ink-600);
  --color-ink-400: var(--ink-400);
  --color-accent: var(--brand-accent);

  /* The template's own components and globals.css's shadcn mapping are still
     written against brand-*; without these aliases every one of them
     resolves to nothing the moment this file replaces tokens.css. */
  --color-brand-50: var(--paper-50);
  --color-brand-100: var(--paper-100);
  --color-brand-200: var(--paper-200);
  --color-brand-300: var(--paper-300);
  --color-brand-400: var(--brand-accent);
  --color-brand-500: var(--paper-500);
  --color-brand-600: var(--brand-accent);
  --color-brand-700: var(--ink-700);
  --color-brand-800: var(--ink-800);
  --color-brand-900: var(--ink-900);
  --color-brand-950: var(--ink-900);

  --font-display: var(--font-display);
  --font-sans: var(--font-sans);
}

html {
  scrollbar-width: thin;
  scrollbar-color: var(--paper-400) transparent;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), system-ui, sans-serif;
  overflow-x: hidden;
}

::selection {
  background: var(--ink-900);
  color: var(--paper-100);
}

/* ---- type scale ----------------------------------------------------------
   Eight steps (design-rules.md §4), generated from scaleRatio ${type.scaleRatio}.
   Big type only reads as big against a quiet floor: the supporting sizes are
   placed on a geometric run and deliberately not raised to meet the
   headline. */

${steps.map(renderStep).join("\n\n")}

/* The measure every running-text block is capped to. */
.measure {
  max-width: var(--measure);
}
${dark ? DARK_NOTE : ""}`;
}

function renderStep(step: TypeStep): string {
  const family =
    step.family === "display"
      ? "var(--font-display), system-ui, sans-serif"
      : step.family === "mono"
        ? "var(--font-mono), ui-monospace, monospace"
        : "var(--font-sans), system-ui, sans-serif";
  const em = (v: number): string => (v === 0 ? "0" : `${v}em`);

  return `.${step.name} {
  font-family: ${family};
  font-size: clamp(${step.minRem}rem, ${step.fluid}, ${step.maxRem}rem);
  font-weight: ${step.weight};
  line-height: ${step.lineHeight};
  letter-spacing: ${em(step.tracking)};${
    // A label that wraps is not a label: `.meta` and `.btn-label` are
    // eyebrows, button text and field captions, and the site nav's brand
    // link was measured 15px wide with the name broken one character per
    // line because this was missing. §7 says the same thing about a phone
    // number, for the same reason.
    step.uppercase ? "\n  text-transform: uppercase;\n  white-space: nowrap;" : ""
  }${
    // §4: an unexpected long word must break ugly rather than land on top of
    // its neighbour. Turkish compounds make this routine, not exotic.
    step.family === "display" ? "\n  overflow-wrap: break-word;" : ""
  }
}`;
}

/**
 * Point `--font-display` / `--font-sans` / `--font-mono` at whichever
 * variable the font module actually declares.
 *
 * It cannot be assumed: when a direction pairs a face with itself the module
 * declares one font and `--font-body-face` is never defined, and an
 * undefined custom property in `font-family` makes the whole declaration
 * invalid — the page silently falls back to system-ui. That is precisely how
 * `--ink-400` went undetected in the template for a whole phase.
 */
function renderFontVars(spec: DesignSpec): string {
  const roles = fontRoles(spec);
  const varOf = (role: FontRoleName): string | undefined =>
    roles.find((r) => r.role === role)?.variable;

  const lines = [
    `  --font-display: var(${varOf("display")!});`,
    `  --font-sans: var(${varOf("body")!});`,
  ];
  const mono = varOf("mono");
  if (mono !== undefined) lines.push(`  --font-mono: var(${mono});`);
  return lines.join("\n");
}

/** Lightness of each paper step, lightest first. */
const PAPER_L = {
  light: [0.99, 0.975, 0.95, 0.91, 0.86, 0.8],
  dark: [0.22, 0.19, 0.16, 0.14, 0.12, 0.1],
} as const;

/**
 * Lightness of each ink step: 900, 800, 700, 600, 400.
 *
 * `ink-400` is the muted step — `.meta`, captions, the rule colour — and it
 * is the one these numbers exist for. It was L 0.64 in light mode, which
 * measures **2.83:1** on `paper-200` at hue 10 and failed axe the first time
 * a real page rendered it. The whole light ramp is re-spaced rather than
 * just that step so the muted tone is still visibly a step away from
 * `ink-600`; `rampViolations` checks the result instead of trusting it.
 */
const INK_L = {
  light: [0.18, 0.26, 0.34, 0.42, 0.5],
  dark: [0.97, 0.92, 0.85, 0.76, 0.66],
} as const;

const INK_STEPS = [900, 800, 700, 600, 400] as const;
const PAPER_STEPS = [50, 100, 200, 300, 400, 500] as const;

/**
 * Chroma of paper step `i` as a multiple of `brandC`.
 *
 * Rounded because this number is printed into the stylesheet: `0.18 * 1.15`
 * is `0.20699999999999996` in binary floating point, and a token file the
 * operator reads should not say that.
 */
const PAPER_CHROMA_BASE: Record<DesignSpec["color"]["strategy"], number> = {
  // The photographs set the temperature, so the paper leans into them.
  "photo-led": 0.3,
  // Two-tone imagery, so the paper is part of the image's own palette and
  // leans the same way. No direction declares it yet; it is in the schema,
  // and a missing key here would be a type error rather than a decision.
  duotone: 0.3,
  "mono-hue": 0.18,
  // Near-neutral, for the same reason `accent-block`'s ink is: the accent
  // is only the one colour on the page if the page is not already that
  // colour. At brandC 0.17 the 0.18 base put the hue into the paper at
  // L 0.975, which renders as lavender — and `technical-accent`'s reference
  // is off-white with one orange mark on it.
  "accent-block": 0.05,
};

const paperChroma = (strategy: DesignSpec["color"]["strategy"], i: number): number =>
  round3(PAPER_CHROMA_BASE[strategy] * (1 + i * 0.15));

/**
 * Chroma of ink step `i` as a multiple of `brandC`.
 *
 * **`accent-block` keeps its ink nearly neutral**, and that is the whole
 * meaning of the strategy. The ink chroma is a multiple of `brandC`, so a
 * direction that raises `brandC` to afford a hot accent was tinting every
 * headline, every paragraph and every rule the same hue — `technical-accent`
 * at chroma 0.19 rendered an entirely purple page, when its reference is
 * neutral grey with one orange mark on it. The accent cannot read as the
 * only colour on the page if it is sharing its hue with the text.
 *
 * Found by looking at the render. The numbers were all in range and
 * `rampViolations` passed, because tinted ink is perfectly legible — it is
 * just not what the direction says it is.
 */
const inkChroma = (strategy: DesignSpec["color"]["strategy"], i: number): number =>
  round3((strategy === "accent-block" ? 0.1 : 0.35) - i * (strategy === "accent-block" ? 0.015 : 0.05));

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * The paper/ink ramp.
 *
 * `mode` decides which end the page sits at. The darks are the client's own
 * hue pushed to near-black with a trace of chroma left in, never `#0B0B0B` —
 * a neutral dark makes every photograph look pasted on (§5).
 *
 * The direction's `color.paperLightness` is NOT read here: this ramp uses
 * fixed per-step lightnesses so `rampViolations` can guarantee contrast for
 * any hue a client's photographs produce. `paperLightness` currently decides
 * only the polarity of a `split` mode, in `sample-spec.ts`; sampling the
 * page's own lightness from that range would mean re-deriving the contrast
 * floors per draw, which is A4 work this does not pretend to have done.
 */
function renderRamp(spec: DesignSpec): string {
  const { mode, strategy } = spec.color;
  const dark = mode === "dark";
  // Chroma tapers toward both ends so an extreme hue stays in gamut.
  const paper = PAPER_L[dark ? "dark" : "light"];
  const ink = INK_L[dark ? "dark" : "light"];

  const line = (name: string, l: number, cMul: number): string =>
    `  --${name}: oklch(${l} calc(var(--brand-c) * ${cMul}) var(--brand-h));`;

  return [
    `  /* paper: ${mode}, ${strategy} */`,
    ...paper.map((l, i) => line(`paper-${PAPER_STEPS[i]}`, l, paperChroma(strategy, i))),
    "",
    "  /* ink */",
    ...ink.map((l, i) => line(`ink-${INK_STEPS[i]}`, l, inkChroma(strategy, i))),
  ].join("\n");
}

/**
 * Lightness of the accent, which is a background for `paper-50` text on
 * every primary button and the sticky CTA.
 *
 * Light mode is 0.48 rather than the 0.52 the template's own tokens note
 * recommends, because that note bounds itself at "moderate chroma (≤ ~0.15)"
 * and `swiss-grid` declares a ceiling of 0.18. At 0.18 and hue 190 — a plain
 * cyan, nothing exotic — L 0.52 measures 4.15:1 and fails. The directions
 * are allowed their chroma; the accent gives way.
 */
const ACCENT_L = { light: 0.48, dark: 0.72 } as const;

/**
 * Every text-on-background pair the generated ramp can produce, checked
 * against WCAG AA at the worst hue.
 *
 * Measured rather than asserted by eye, and run on every generated spec
 * rather than only in tests, for the reason the last three of these cost:
 * the failure appears in a browser, at one hue, in one direction, inside the
 * playwright gate — by which point a plan and a generate session have been
 * paid for. The ramp is a pure function of four numbers, so it can be
 * checked before anything renders.
 *
 * Returns a human-readable line per violation; empty means clean.
 */
export function rampViolations(spec: DesignSpec): string[] {
  const { mode, strategy, brandC } = spec.color;
  const dark = mode === "dark";
  const paper = PAPER_L[dark ? "dark" : "light"];
  const ink = INK_L[dark ? "dark" : "light"];
  const out: string[] = [];

  // Sections sit on paper-50, the page on paper-100, and a banded section on
  // paper-200. Beyond that the paper steps are fills and borders, not text
  // backgrounds — `rule-color` is checked as a rule, not as text.
  for (let bg = 0; bg < 3; bg += 1) {
    const background = { l: paper[bg]!, c: brandC * paperChroma(strategy, bg) };
    for (let i = 0; i < ink.length; i += 1) {
      const { ratio, hue } = worstContrast(
        { l: ink[i]!, c: brandC * inkChroma(strategy, i) },
        background,
      );
      if (ratio < AA_TEXT) {
        out.push(
          `ink-${INK_STEPS[i]} on paper-${PAPER_STEPS[bg]} is ${ratio}:1 at hue ` +
            `${hue} (needs ${AA_TEXT}:1) — it is used for text`,
        );
      }
    }
  }

  // paper-50 text on the accent: every primary button, and `bg-brand-600`
  // wherever a component reaches for it. `photo-led` is checked too, against
  // its ink-700 fallback — skipping it is how a dark photo-led page shipped
  // a button whose label failed, since ink-700 inverts to a LIGHT colour
  // and the button's text had been hardcoded white.
  const accentColor =
    strategy === "photo-led"
      ? { l: ink[2]!, c: brandC * inkChroma(strategy, 2) }
      : { l: ACCENT_L[dark ? "dark" : "light"], c: brandC };
  const onAccent = worstContrast(
    { l: paper[0]!, c: brandC * paperChroma(strategy, 0) },
    accentColor,
  );
  if (onAccent.ratio < AA_TEXT) {
    out.push(
      `paper-50 on the accent is ${onAccent.ratio}:1 at hue ${onAccent.hue} ` +
        `(needs ${AA_TEXT}:1) — that is every primary button`,
    );
  }

  return out;
}

/**
 * The accent.
 *
 * `photo-led` has none by design — `cinematic-calm`'s whole argument is that
 * the photographs carry the page, and an accent would be the "bright accent
 * on near-black" cluster it lists under `avoid`. It falls back to the ink so
 * focus rings and primary buttons stay visible.
 */
function accent(spec: DesignSpec): string {
  if (spec.color.strategy === "photo-led") return "var(--ink-700)";
  return `oklch(${ACCENT_L[spec.color.mode === "dark" ? "dark" : "light"]} var(--brand-c) var(--brand-h))`;
}

/**
 * How a photograph meets the page, per `shape.imageFrame` (§4.2).
 *
 * `bleed` runs to the edge with no corner; `inset` sits inside the measure
 * with the direction's radius; `masked` is a tall crop that reads as a
 * window rather than a card; `collage` is the softest and squarest, for a
 * direction that overlaps several pictures.
 */
const IMAGE_FRAME: Record<
  DesignSpec["shape"]["imageFrame"],
  { radius: string; inset: string; aspect: string }
> = {
  bleed: { radius: "0px", inset: "0rem", aspect: "4 / 3" },
  inset: { radius: "var(--radius)", inset: "1.5rem", aspect: "4 / 3" },
  masked: { radius: "var(--radius)", inset: "0rem", aspect: "3 / 4" },
  collage: { radius: "var(--radius)", inset: "1rem", aspect: "1 / 1" },
};

const RULE_WIDTH: Record<DesignSpec["shape"]["rules"], string> = {
  none: "0px",
  hairline: "1px",
  heavy: "2px",
};

const RHYTHM: Record<DesignSpec["grid"]["density"], { y: string; yLg: string }> = {
  // Few sections, each given room.
  poster: { y: "7rem", yLg: "11rem" },
  standard: { y: "5.5rem", yLg: "8rem" },
  // The client has copy; the page is read rather than scanned.
  editorial: { y: "4.5rem", yLg: "6.5rem" },
};

const DARK_NOTE = `
/* A dark page still has to pass the axe contrast gate: the ink steps above
   are light-on-dark and the ramp is inverted, not merely re-pointed. */
`;
