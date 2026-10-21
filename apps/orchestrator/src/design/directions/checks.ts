/**
 * Deterministic range checks for DJ10 and DJ16
 * (docs/D10-design-variation.md §3.3; decision recorded in DECISIONS.md D10).
 *
 * These were prompt questions answered by a vision model against a constant
 * ("weight ≥700"). Both are measurable, and design-rules.md §12 already makes
 * the argument for deciding measurable things by script: a model asked
 * whether tracking is −0.045em or −0.01em is guessing at a screenshot, while
 * `getComputedStyle` simply knows.
 *
 * The measuring half needs a browser; the deciding half is pure, so the judge
 * stage and the acceptance test call exactly the same decision function with
 * the same shape of input.
 */
import type { DirectionRanges, MotionSignature } from "./stub.js";

/** What DJ16 needs, read off the built page. */
export interface TypeMeasurement {
  /** Computed font-weight of the largest heading. */
  displayWeight: number;
  /** Computed letter-spacing of that heading, normalised to em. */
  displayTracking: number;
  /** display font-size / body font-size. */
  displayToBodyRatio: number;
}

/** What DJ10 needs, read off the scroll profile. */
export interface MotionMeasurement {
  signatures: MotionSignature[];
  /** True when fade-and-slide-up is the page's entire motion vocabulary. */
  fadeUpOnly: boolean;
  /** Does the page animate on load? */
  heroEntrance: boolean;
  /** Does the page install smooth scroll (Lenis, or CSS `scroll-behavior`)? */
  smoothScroll: boolean;
}

export interface CheckResult {
  id: string;
  pass: boolean;
  evidence: string;
}

const em = (v: number): string => `${v >= 0 ? "" : "−"}${Math.abs(v).toFixed(3)}em`;

/**
 * DJ16 — do display weight, tracking and the display/body ratio fall inside
 * the selected direction's ranges?
 *
 * Replaces "weight ≥700 with negative tracking, body ≤ 1/4 of display". That
 * constant described one direction; the measured corpus spread is 220–700 on
 * weight and −0.06em…+0.02em on tracking (docs/corpus-findings.md §2, §4).
 */
export function checkDj16(
  m: TypeMeasurement,
  direction: DirectionRanges,
): CheckResult {
  const { displayWeights, displayTracking, scaleRatio } = direction.type;
  const problems: string[] = [];

  if (!displayWeights.includes(m.displayWeight)) {
    problems.push(
      `display weight ${m.displayWeight} is not one of ${displayWeights.join("/")}`,
    );
  }
  const [tMin, tMax] = displayTracking;
  if (m.displayTracking < tMin || m.displayTracking > tMax) {
    problems.push(
      `display tracking ${em(m.displayTracking)} is outside ${em(tMin)}…${em(tMax)}`,
    );
  }
  const [rMin, rMax] = scaleRatio;
  if (m.displayToBodyRatio < rMin || m.displayToBodyRatio > rMax) {
    problems.push(
      `display/body ratio ${m.displayToBodyRatio.toFixed(1)} is outside ${rMin}–${rMax}`,
    );
  }

  return {
    id: "DJ16",
    pass: problems.length === 0,
    evidence:
      problems.length === 0
        ? `weight ${m.displayWeight}, tracking ${em(m.displayTracking)}, ratio ` +
          `${m.displayToBodyRatio.toFixed(1)} — all inside ${direction.id}`
        : `${direction.id}: ${problems.join("; ")}`,
  };
}

/**
 * DJ10 — does the page's motion match the direction's profile, and is fade-up
 * not the only device where the profile is `editorial` or `kinetic`?
 *
 * Replaces the unconditional "is there no pinned hand-off and no text
 * transformation". A `calm` or `still` direction is supposed to have neither;
 * failing it for that was the rule encoding one design language as the floor.
 *
 * Checks **both** directions (D10 §3.3). Presence alone was the A1 finding K8:
 * a `calm` site that still pins, still runs a hero entrance and still ships
 * Lenis satisfies an empty `required` list, so the direction would be declared
 * and then quietly ignored. What a direction disables has to fail too.
 */
export function checkDj10(
  m: MotionMeasurement,
  direction: DirectionRanges,
): CheckResult {
  const { profiles, required, allowed, heroEntrance, smoothScroll } =
    direction.motion;
  const profile = profiles[0] ?? "calm";
  const expressive = profile === "editorial" || profile === "kinetic";
  const problems: string[] = [];

  const missing = required.filter((s) => !m.signatures.includes(s));
  if (missing.length > 0) {
    problems.push(`${direction.id} requires ${missing.join(" and ")}`);
  }
  if (expressive && m.fadeUpOnly) {
    problems.push(`profile ${profile} but fade-up is the only motion device`);
  }

  const forbidden = m.signatures.filter((s) => !allowed.includes(s));
  if (forbidden.length > 0) {
    problems.push(`${direction.id} disables ${forbidden.join(" and ")}`);
  }
  if (!heroEntrance && m.heroEntrance) {
    problems.push(`${direction.id} disables the hero entrance`);
  }
  if (!smoothScroll && m.smoothScroll) {
    problems.push(`${direction.id} disables smooth scroll`);
  }

  return {
    id: "DJ10",
    pass: problems.length === 0,
    evidence:
      problems.length === 0
        ? `profile ${profile}; signatures present: ` +
          `${m.signatures.join(", ") || "none required"}`
        : problems.join("; "),
  };
}

/**
 * Read in the page, by the judge stage. Mirrors the corpus harvester's
 * approach (`src/corpus/harvest.ts`): the largest rendered heading is the
 * display step and the first substantial paragraph is the body, because the
 * cascade and the clamp() both resolve where the text is painted.
 *
 * Returns null when the page has no measurable display/body pair, so the
 * judge can report DJ16 as indeterminate rather than inventing a failure.
 */
/**
 * Read in the page: is smooth scroll installed? Same detection the corpus
 * harvester uses (`src/corpus/harvest.ts`, `profileMotion`), so a direction
 * and a measured reference site are judged by the same probe.
 *
 * Lenis sets classes on the documentElement and `SmoothScroll` renders nothing,
 * so the DOM is the only place this is visible from outside the bundle.
 */
export function measureSmoothScrollInPage(): boolean {
  return (
    getComputedStyle(document.documentElement).scrollBehavior === "smooth" ||
    document.querySelector("[data-lenis], .lenis") !== null
  );
}

export function measureTypeInPage(): TypeMeasurement | null {
  const px = (v: string): number => Number.parseFloat(v) || 0;

  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .filter((h) => (h.textContent ?? "").trim().length > 1)
    .sort(
      (a, b) => px(getComputedStyle(b).fontSize) - px(getComputedStyle(a).fontSize),
    );
  const display = headings[0];
  const body = Array.from(document.querySelectorAll("p")).find(
    (p) => (p.textContent ?? "").trim().length > 60,
  );
  if (!display || !body) return null;

  const dcs = getComputedStyle(display);
  const bcs = getComputedStyle(body);
  const size = px(dcs.fontSize);
  const bodySize = px(bcs.fontSize);
  if (size <= 0 || bodySize <= 0) return null;

  return {
    displayWeight: Number.parseInt(dcs.fontWeight, 10) || 400,
    displayTracking:
      dcs.letterSpacing === "normal"
        ? 0
        : Math.round((px(dcs.letterSpacing) / size) * 1000) / 1000,
    displayToBodyRatio: Math.round((size / bodySize) * 10) / 10,
  };
}
