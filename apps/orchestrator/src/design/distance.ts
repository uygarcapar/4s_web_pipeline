import type { DesignSpec } from "@pipeline/core";

/**
 * Structural distance between two specs (D10 §8.1).
 *
 * This is what §8 means by "replace the fingerprint hash with two
 * distances". A hash answers one question — *is this exactly a repeat* —
 * and the answer is almost always no, because two sites that share their
 * direction, hero layout, colour mode and type pairing still differ
 * somewhere in the eighth decimal of a scale ratio. They are the same site
 * to a visitor and a different string to SHA-256.
 *
 * A weighted axis count answers the question the operator is actually
 * asking. The weights are §8.1's: `direction` and `heroArchetype` are worth
 * three because they are what someone sees in the first second, `radius`
 * and `displayWeight` one because nobody notices them alone.
 *
 * The visual half (§8.2, a pre-render embedding) is C5. Both must pass; this
 * one is free and runs first.
 */

export const AXIS_WEIGHTS = {
  direction: 3,
  heroArchetype: 3,
  colorMode: 2,
  typePair: 2,
  motionProfile: 2,
  gridAlignment: 1.5,
  imageFrame: 1.5,
  radius: 1,
  density: 1,
  displayWeight: 1,
} as const;

export type AxisKey = keyof typeof AXIS_WEIGHTS;

const TOTAL_WEIGHT = Object.values(AXIS_WEIGHTS).reduce((a, b) => a + b, 0);

export type SpecAxes = Record<AxisKey, string>;

/**
 * The ten axes, as strings.
 *
 * Stringified rather than compared structurally because the distance is a
 * count of disagreements, not a magnitude: a 400 display weight is not
 * "closer" to 500 than to 900 for this purpose. §8.1 calibrates against the
 * operator's eye (§8.3), and the eye reads "different weight", not "70
 * units apart".
 */
export function specAxes(spec: DesignSpec): SpecAxes {
  const hero = spec.sections.find((s) => s.type === "hero");
  return {
    direction: spec.direction,
    // A spec with no hero is possible only if the facts produced none,
    // which `sectionsFromFacts` does not do — but the axis must still have
    // a value, and "none" is honest about what was compared.
    heroArchetype: hero?.archetype ?? "none",
    colorMode: spec.color.mode,
    typePair: `${spec.type.display}/${spec.type.body}`,
    motionProfile: spec.motion.profile,
    gridAlignment: spec.grid.alignment,
    imageFrame: spec.shape.imageFrame,
    radius: String(spec.shape.radius),
    density: spec.grid.density,
    displayWeight: String(spec.type.displayWeight),
  };
}

/** 0 = identical on every axis, 1 = differs on every axis. */
export function specDistance(a: SpecAxes, b: SpecAxes): number {
  let d = 0;
  for (const key of Object.keys(AXIS_WEIGHTS) as AxisKey[]) {
    if (a[key] !== b[key]) d += AXIS_WEIGHTS[key];
  }
  return Number((d / TOTAL_WEIGHT).toFixed(4));
}

/** Which axes two specs agree on — the useful half of a rejection message. */
export function sharedAxes(a: SpecAxes, b: SpecAxes): AxisKey[] {
  return (Object.keys(AXIS_WEIGHTS) as AxisKey[]).filter((key) => a[key] === b[key]);
}

/**
 * §8.1's starting thresholds. **Not measurements** — §8.3 calibrates them
 * against ~30 operator-labelled pairs, and a threshold that disagrees with
 * the operator's eye is a broken detector (design-rules §12).
 */
export const THRESHOLDS = {
  /** vs every run in the last 30 days, all sectors. */
  allSectors: 0.4,
  /** vs every run in the same sector, last 90 days. */
  sameSector: 0.55,
  /** `direction` OR `heroArchetype` must differ from the previous N runs. */
  recentRuns: 3,
} as const;

export const WINDOW_DAYS = { allSectors: 30, sameSector: 90 } as const;

export interface Neighbour {
  domain: string;
  spec: DesignSpec;
  /** Position in the ledger, 0 = most recent. */
  rank: number;
  /**
   * Which comparisons this run is eligible for. `sameSector` means both
   * "same sector as the candidate" and "within 90 days" — the ledger query
   * knows the sector, and resolving it there keeps one notion of a window
   * in one place instead of two.
   */
  within: { allSectors: boolean; sameSector: boolean };
}

export interface DistanceRejection {
  /** The neighbour this candidate was too close to. */
  domain: string;
  distance: number;
  rule: "all-sectors" | "same-sector" | "recent-runs";
  reason: string;
}

/**
 * Why this candidate is too close to a recent run, or `null` if it is not.
 *
 * Returns the FIRST violation rather than all of them, because the caller's
 * only decision is to move to the next candidate (§6.3) — the reason is for
 * the run log and the spec's `rejected` list, not for repair. A rejection
 * costs no model spend, which is why both distances run before `generate`.
 */
export function distanceRejection(
  candidate: DesignSpec,
  /** The client being built — never a neighbour of itself. */
  domain: string,
  neighbours: readonly Neighbour[],
  thresholds: typeof THRESHOLDS = THRESHOLDS,
): DistanceRejection | null {
  const axes = specAxes(candidate);

  for (const neighbour of neighbours) {
    // A re-run of the same client is not a neighbour of itself: the whole
    // point of a seeded sampler is that rebuilding a site reproduces it.
    // Compared by domain and not by anything parsed out of `seed`, because
    // a seed is `${domain}-${index}` and domains contain hyphens.
    if (neighbour.domain === domain) continue;

    const other = specAxes(neighbour.spec);
    const distance = specDistance(axes, other);
    const shared = sharedAxes(axes, other);

    if (neighbour.within.allSectors && distance < thresholds.allSectors) {
      return {
        domain: neighbour.domain,
        distance,
        rule: "all-sectors",
        reason:
          `${distance} < ${thresholds.allSectors} vs ${neighbour.domain} ` +
          `(${WINDOW_DAYS.allSectors}d, all sectors) — same ${shared.join(", ")}`,
      };
    }

    if (neighbour.within.sameSector && distance < thresholds.sameSector) {
      return {
        domain: neighbour.domain,
        distance,
        rule: "same-sector",
        reason:
          `${distance} < ${thresholds.sameSector} vs ${neighbour.domain} ` +
          `(${WINDOW_DAYS.sameSector}d, same sector) — same ${shared.join(", ")}`,
      };
    }

    // The hard one: whatever the weighted distance says, the last three
    // runs must not open with the same direction AND the same hero. Those
    // are the two axes a visitor reads in the first second, and a run that
    // matches both reads as a repeat even when six other axes differ.
    if (
      neighbour.rank < thresholds.recentRuns &&
      other.direction === axes.direction &&
      other.heroArchetype === axes.heroArchetype
    ) {
      return {
        domain: neighbour.domain,
        distance,
        rule: "recent-runs",
        reason:
          `same direction (${axes.direction}) and hero (${axes.heroArchetype}) ` +
          `as ${neighbour.domain}, ${neighbour.rank + 1} run(s) ago`,
      };
    }
  }

  return null;
}
