/**
 * Minimal direction stub — **replaced by the real catalog in A3**
 * (docs/D10-design-variation.md §4; all §-numbers below refer to that file).
 *
 * A1 only needs the fields the two range checks consume, so that is all this
 * carries: DJ16 reads the type ranges, DJ10 reads the motion profile and the
 * required signatures. Everything else a direction will own (colour, shape,
 * grid, archetypes, affinity, avoid) is deliberately absent rather than
 * guessed at here.
 *
 * Values are D10 §4.3 verbatim for the two directions A1's acceptance test
 * turns on: `kinetic-bold` is today's language, `editorial-serif` is the one
 * that today's gates reject.
 */

/** Motion profiles, quietest first (D10 §4.2). */
export type MotionProfile = "still" | "calm" | "editorial" | "kinetic";

/** Signature ids a profile may require. A1 needs only these two. */
export type MotionSignature = "pinned-handoff" | "text-transformation";

export interface DirectionRanges {
  id: string;
  label: string;
  type: {
    /** Allowed computed display weights. */
    displayWeights: number[];
    /** Allowed display letter-spacing, em, inclusive [min, max]. */
    displayTracking: [number, number];
    /** Allowed display/body font-size ratio, inclusive [min, max]. */
    scaleRatio: [number, number];
  };
  motion: {
    profiles: MotionProfile[];
    /** Signatures the page MUST carry under this direction. */
    required: MotionSignature[];
    /**
     * Signatures this direction PERMITS (D10 §4.2 `motion.signatures`).
     * Anything measured and absent from this list is a violation, which is the
     * absence half of DJ10 — `required` alone cannot catch a calm site that
     * still pins (D10 §3.3, K8). `required` must be a subset.
     */
    allowed: MotionSignature[];
    /** False = a page-load hero entrance is a violation, not merely optional. */
    heroEntrance: boolean;
    /** False = the direction omits Lenis, for the smaller bundle. */
    smoothScroll: boolean;
  };
}

/**
 * D10 §4.3 `kinetic-bold` — the current diskent language. Heavy display,
 * tight tracking, motion-led: the combination every rule in design-rules.md
 * §3–§4 was written from.
 */
export const KINETIC_BOLD: DirectionRanges = {
  id: "kinetic-bold",
  label: "Kinetic bold",
  type: {
    displayWeights: [700, 800],
    displayTracking: [-0.045, -0.03],
    scaleRatio: [5.5, 7],
  },
  motion: {
    profiles: ["kinetic"],
    required: ["pinned-handoff", "text-transformation"],
    allowed: ["pinned-handoff", "text-transformation"],
    heroEntrance: true,
    smoothScroll: true,
  },
};

/**
 * D10 §4.3 `editorial-serif` — calm authority. Light display, near-zero
 * tracking, no pin. Every one of those is a hard fail under today's rules,
 * which is why A1 exists.
 */
export const EDITORIAL_SERIF: DirectionRanges = {
  id: "editorial-serif",
  label: "Editorial serif",
  type: {
    displayWeights: [300, 400],
    displayTracking: [-0.015, 0],
    scaleRatio: [3, 4.5],
  },
  /**
   * D10 §4.3: "calm — opacity/filter reveals, no pin, no lateral. Hero
   * entrance off. Lenis on." So both modelled signatures are disabled here,
   * not merely unrequired — a word-by-word statement is more than an opacity
   * reveal. A3 takes the authoritative list from the catalog.
   */
  motion: {
    profiles: ["calm"],
    required: [],
    allowed: [],
    heroEntrance: false,
    smoothScroll: true,
  },
};

export const DIRECTION_STUB: Record<string, DirectionRanges> = {
  [KINETIC_BOLD.id]: KINETIC_BOLD,
  [EDITORIAL_SERIF.id]: EDITORIAL_SERIF,
};

/**
 * The direction a run was built under. Until the real `DesignSpec` lands
 * (D10 §5, task A2) `design.json` has no `direction` field, so a run that
 * predates the catalog is judged under the language it was actually built in.
 */
export const DEFAULT_DIRECTION_ID = KINETIC_BOLD.id;

export function resolveDirection(id: string | undefined): DirectionRanges {
  return DIRECTION_STUB[id ?? DEFAULT_DIRECTION_ID] ?? KINETIC_BOLD;
}
