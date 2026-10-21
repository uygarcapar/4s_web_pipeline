import type { DesignSpec } from "@pipeline/core";

import { buildScale, scaleViolations, MEASURE_CH, type TypeStep } from "./scale.js";

/**
 * `DesignSpec` → the generated site's `src/styles/tokens.css` (D10 §5, A4).
 *
 * Everything here is derived: the type scale from `scaleRatio` and the
 * direction's weight and tracking, the colour ramp from `brandH`/`brandC`
 * plus `mode` and `strategy`, the radius and rule weights from `shape`, the
 * rhythm from `grid.density`. **The model never writes a token value.**
 *
 * This replaces `renderTokens(dna)` once the selection pipeline writes a
 * spec (§6.3, task C3). Both exist meanwhile: the running stage still emits
 * a `DesignDna`, and swapping it before the sampler exists would leave the
 * pipeline unable to produce the input this function needs.
 */
export function renderSpecTokens(spec: DesignSpec): string {
  const steps = buildScale(spec);
  const problems = scaleViolations(steps);
  if (problems.length > 0) {
    throw new Error(
      `generated scale violates design-rules.md §4:\n- ${problems.join("\n- ")}`,
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

  --font-display: var(--font-display-face);
  --font-sans: var(--font-body-face);${
    type.mono === undefined ? "" : "\n  --font-mono: var(--font-mono-face);"
  }

  /* shape (§4.2) */
  --radius: ${shape.radius === 999 ? "9999px" : `${shape.radius / 16}rem`};
  --rule-width: ${RULE_WIDTH[shape.rules]};
  --rule-color: ${shape.rules === "none" ? "transparent" : "var(--ink-400)"};

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
    step.uppercase ? "\n  text-transform: uppercase;" : ""
  }${
    // §4: an unexpected long word must break ugly rather than land on top of
    // its neighbour. Turkish compounds make this routine, not exotic.
    step.family === "display" ? "\n  overflow-wrap: break-word;" : ""
  }
}`;
}

/**
 * The paper/ink ramp.
 *
 * `paperLightness` is the direction's; `mode` decides which end the page
 * sits at. The darks are the client's own hue pushed to near-black with a
 * trace of chroma left in, never `#0B0B0B` — a neutral dark makes every
 * photograph look pasted on (§5).
 */
function renderRamp(spec: DesignSpec): string {
  const { mode, strategy } = spec.color;
  const dark = mode === "dark";
  // Chroma tapers toward both ends so an extreme hue stays in gamut.
  const paper = dark
    ? [0.22, 0.19, 0.16, 0.14, 0.12, 0.1]
    : [0.99, 0.975, 0.95, 0.91, 0.86, 0.8];
  const ink = dark ? [0.97, 0.93, 0.87, 0.78, 0.6] : [0.18, 0.26, 0.36, 0.46, 0.64];
  const paperC = strategy === "photo-led" ? 0.3 : 0.18;

  const line = (name: string, l: number, cMul: number): string =>
    `  --${name}: oklch(${l} calc(var(--brand-c) * ${cMul}) var(--brand-h));`;

  return [
    `  /* paper: ${mode}, ${strategy} */`,
    ...paper.map((l, i) =>
      line(`paper-${[50, 100, 200, 300, 400, 500][i]}`, l, paperC * (1 + i * 0.15)),
    ),
    "",
    "  /* ink */",
    ...ink.map((l, i) => line(`ink-${[900, 800, 700, 600, 400][i]}`, l, 0.35 - i * 0.05)),
  ].join("\n");
}

/**
 * The accent.
 *
 * `photo-led` has none by design — quiet-luxury's whole argument is that the
 * photographs carry the page, and an accent would be the "bright accent on
 * near-black" cluster it lists under `avoid`. It falls back to the ink so
 * focus rings and primary buttons stay visible.
 */
function accent(spec: DesignSpec): string {
  if (spec.color.strategy === "photo-led") return "var(--ink-700)";
  const l = spec.color.mode === "dark" ? 0.72 : 0.52;
  return `oklch(${l} var(--brand-c) var(--brand-h))`;
}

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
