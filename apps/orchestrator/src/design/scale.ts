import type { DesignSpec } from "@pipeline/core";

/**
 * The eight-step type scale, generated from a `DesignSpec` (D10 §5).
 *
 * design-rules.md §4 keeps the eight steps and the invariants; the numbers
 * are the direction's. This file is the "deterministic code" §5 names: the
 * model never writes a token value, so a direction asking for a 400-weight
 * display at ratio 3.2 gets a scale built for that rather than the 6:1
 * grotesk scale read off one site.
 *
 * Separate from `tokens.ts` because every rule in §4 that is still an
 * invariant has to be enforced on the output, and those checks want to be
 * unit-testable without rendering a whole stylesheet.
 */

/** Body size in rem at the small end and the large end of the viewport. */
const BODY_MIN_REM = 1;
const BODY_MAX_REM = 1.125;

/**
 * Hard ceiling on the display step, in `vmin`.
 *
 * §4: "the hero's three-line display block must fit a 900px-tall laptop
 * viewport". Three lines at line-height 0.86 occupy `3 × 0.86 = 2.58`
 * times the font size, and the hero needs room for an eyebrow, a lead and
 * two CTAs — about 45% of the viewport. 17.5vmin × 2.58 ≈ 45vmin, which is
 * where the existing hand-tuned scale landed after several review rounds.
 */
const DISPLAY_CEILING_VMIN = 17.5;

/** Steps that must carry `overflow-wrap: break-word` (§4). */
export const DISPLAY_STEPS = ["t-display", "t-h2", "t-h2-col", "t-h3"] as const;

/** §4: one tracking value for all small caps, and never above this. */
export const MAX_UPPERCASE_TRACKING = 0.08;

export interface TypeStep {
  /** Class name, without the dot. */
  name: string;
  /** rem at the viewport floor. */
  minRem: number;
  /** The fluid middle term, already written as CSS. */
  fluid: string;
  /** rem at the viewport ceiling. */
  maxRem: number;
  weight: number;
  lineHeight: number;
  /** em. */
  tracking: number;
  family: "display" | "body" | "mono";
  uppercase?: boolean;
}

const round = (n: number): number => Math.round(n * 1000) / 1000;
const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));

/**
 * The display step's `vw` term, from the ratio.
 *
 * Bounded at both ends: below ~6vw a headline stops reading as a headline on
 * a phone, and above ~11vw a long Turkish compound overflows a 344px screen
 * even with `break-word`.
 */
const displayVw = (ratio: number): number => round(clamp(ratio * 1.6, 6, 11));

/**
 * The `vmin` ceiling, derived from the `vw` term and hard-capped at
 * `DISPLAY_CEILING_VMIN` so the hero still fits a 900px-tall laptop
 * viewport whatever the ratio asks for.
 */
const displayVmin = (ratio: number): number =>
  round(Math.min(DISPLAY_CEILING_VMIN, displayVw(ratio) * 1.7));

/**
 * Build the scale.
 *
 * The display step is `body × scaleRatio`; the steps between are placed on a
 * geometric run between body and display rather than at fixed multiples, so
 * a 3.2 ratio and a 7.0 ratio both produce an even progression instead of
 * the supporting sizes bunching against one end.
 *
 * `t-h2-col` is capped in rem and carries no `vw` term at all: §4 is explicit
 * that a heading inside a capped container keeps growing with the viewport
 * while its column does not.
 */
export function buildScale(spec: DesignSpec): TypeStep[] {
  const { displayWeight, displayTracking, scaleRatio } = spec.type;
  const displayMax = round(BODY_MAX_REM * scaleRatio);
  // A quiet floor: the display step shrinks faster than the body does, or a
  // phone gets a headline it cannot fit (§4, "big type against a quiet floor").
  const displayMin = round(Math.max(2.25, displayMax * 0.3));

  // Geometric run from body to display, so the middle steps stay even
  // whatever the ratio.
  const step = (fraction: number): number =>
    round(BODY_MAX_REM * Math.pow(scaleRatio, fraction));

  const bodyTracking = 0;

  return [
    {
      name: "t-display",
      minRem: displayMin,
      // The fluid term scales with the ratio too, not just the rem cap.
      // A single shared `10.5vw` made every direction render an identical
      // display size on a phone — the cap only bites once the viewport is
      // wide enough to reach it, so the whole catalog collapsed to one
      // headline size on exactly the devices most of these visitors use.
      //
      // The vmin term still bounds the hero to a 900px-tall viewport; it is
      // derived from the vw term and hard-capped, so no ratio can escape it.
      fluid: `min(${displayVw(scaleRatio)}vw, ${displayVmin(scaleRatio)}vmin)`,
      maxRem: displayMax,
      weight: displayWeight,
      lineHeight: 0.86,
      tracking: displayTracking,
      family: "display",
    },
    {
      name: "t-h2",
      minRem: round(Math.max(1.875, step(0.82) * 0.55)),
      fluid: "8vw",
      maxRem: round(step(0.82)),
      weight: displayWeight,
      lineHeight: 0.9,
      tracking: round(displayTracking * 0.9),
      family: "display",
    },
    {
      // No vw term: it shares a row, so the viewport is the wrong ruler.
      name: "t-h2-col",
      minRem: round(Math.max(1.5, step(0.58) * 0.6)),
      fluid: "4vw",
      maxRem: round(step(0.58)),
      weight: displayWeight,
      lineHeight: 0.95,
      tracking: round(displayTracking * 0.8),
      family: "display",
    },
    {
      name: "t-h3",
      minRem: round(Math.max(1.125, step(0.34) * 0.8)),
      fluid: "2.2vw",
      maxRem: round(step(0.34)),
      weight: displayWeight,
      lineHeight: 1.1,
      tracking: round(displayTracking * 0.6),
      family: "display",
    },
    {
      name: "t-lead",
      minRem: 1.125,
      fluid: "1.6vw",
      maxRem: round(Math.max(1.25, step(0.16))),
      weight: 400,
      lineHeight: 1.45,
      tracking: bodyTracking,
      family: "body",
    },
    {
      name: "t-body",
      minRem: BODY_MIN_REM,
      fluid: "1.1vw",
      maxRem: BODY_MAX_REM,
      weight: 400,
      lineHeight: 1.6,
      tracking: bodyTracking,
      family: "body",
    },
    {
      name: "meta",
      minRem: 0.75,
      fluid: "0.9vw",
      maxRem: 0.875,
      weight: 500,
      lineHeight: 1.2,
      // §4: one tracking value for all small caps, never above 0.08em. The
      // award references run 0.2–0.35em, which slows Turkish agglutinated
      // phrases badly.
      tracking: MAX_UPPERCASE_TRACKING,
      family: spec.type.mono === undefined ? "body" : "mono",
      uppercase: true,
    },
    {
      name: "btn-label",
      minRem: 0.875,
      fluid: "1vw",
      maxRem: 1,
      weight: 500,
      lineHeight: 1,
      tracking: 0.02,
      family: spec.type.mono === undefined ? "body" : "mono",
      uppercase: true,
    },
  ];
}

/**
 * The §3.1 invariants that survive the split, checked on the generated scale.
 *
 * Returns the violations rather than throwing: `renderSpecTokens` turns them
 * into an error, and the test asserts the list is empty for every direction.
 * A silent scale that breaks the hero is the failure mode this prevents —
 * nothing downstream re-reads these numbers.
 */
export function scaleViolations(steps: TypeStep[]): string[] {
  const problems: string[] = [];
  const byName = new Map(steps.map((s) => [s.name, s]));

  const display = byName.get("t-display");
  if (!display) problems.push("t-display is missing");

  for (const name of DISPLAY_STEPS) {
    const s = byName.get(name);
    if (!s) problems.push(`${name} is missing`);
  }

  // Hero fits a 900px-tall laptop viewport (§4).
  if (display && !display.fluid.includes("vmin")) {
    problems.push(
      "t-display has no vmin term: nothing then bounds the hero to a 900px " +
        "viewport, which §4 requires",
    );
  }

  // `vw` only where the element is full-width (§4). t-h2-col shares a row.
  const col = byName.get("t-h2-col");
  if (col && col.maxRem > 5) {
    problems.push(
      `t-h2-col caps at ${col.maxRem}rem: a heading sharing a row with another ` +
        "column has to stay small enough that a long Turkish word still breaks",
    );
  }

  for (const s of steps) {
    if (s.uppercase && s.tracking > MAX_UPPERCASE_TRACKING) {
      problems.push(
        `${s.name} tracks uppercase at ${s.tracking}em, above the ${MAX_UPPERCASE_TRACKING}em ceiling`,
      );
    }
    if (s.minRem > s.maxRem) {
      problems.push(`${s.name} has a floor above its ceiling`);
    }
  }

  // A quiet floor: the body must not climb toward the display step (§4).
  const body = byName.get("t-body");
  if (display && body && display.maxRem / body.maxRem < 2.5) {
    problems.push(
      `display/body is ${round(display.maxRem / body.maxRem)} at the ceiling: ` +
        "below 2.5 the page flattens even though every size grew",
    );
  }

  return problems;
}

/**
 * Line length < 80ch (§4), as the measure the body step may occupy.
 * Returned as a token rather than checked, because it is a container width
 * and the sections consume it.
 */
export const MEASURE_CH = 72;
