import { describe, expect, it } from "vitest";

import {
  briefSchema,
  designSpecSchema,
  directionSchema,
  type Brief,
  type DesignSpec,
  type Direction,
} from "./design.js";

/* -------------------------------------------------------------------------- */
/* Fixtures — `editorial-serif` from D10 §4.3, the direction A1's gates used   */
/* to reject outright.                                                        */
/* -------------------------------------------------------------------------- */

const DIRECTION: Direction = {
  id: "editorial-serif",
  label: "Editorial serif",
  intent:
    "Calm authority. Long-established practices, law/finance-adjacent services, " +
    "anything with a lot of text the client actually wrote.",
  type: {
    pairs: [
      { display: "Fraunces", body: "Karla" },
      { display: "Newsreader", body: "Public Sans" },
    ],
    mono: [],
    displayWeights: [300, 400],
    displayTracking: [-0.015, 0],
    scaleRatio: [3, 4.5],
    displayCase: ["sentence"],
  },
  color: {
    modes: ["light"],
    strategies: ["mono-hue", "photo-led"],
    paperLightness: [0.94, 0.99],
    maxChroma: 0.06,
  },
  shape: { radius: [0], rules: ["none", "hairline"], imageFrame: ["inset"] },
  grid: { alignment: ["left-flush"], density: ["editorial"] },
  motion: {
    profiles: ["calm"],
    signatures: [],
    required: [],
    heroEntrance: false,
    smoothScroll: true,
  },
  archetypes: { hero: ["photo-full", "statement-left"], services: ["list-rule"] },
  affinity: {
    tone: { traditional: 3, clinical: 1, playful: -2 },
    tier: { premium: 2, mid: 1 },
    photoProfile: { "stock-heavy": 1, pro: 1 },
  },
  avoid: [
    "cluster 1 — paper lightness and hue come from the photographs, never #F4F1EA + clay",
  ],
};

const BRIEF: Brief = {
  tone: "traditional",
  tier: "mid",
  audience: "local-everyday",
  photoProfile: { usableCount: 21, quality: "amateur", dominant: "space" },
  contentVolume: "editorial",
  ownSentence: "1998'den beri Küçükçekmece'de hizmet veriyoruz.",
  brandAssets: { hasLogo: true, hasBrandFont: false },
};

const SPEC: DesignSpec = {
  version: 2,
  direction: "editorial-serif",
  seed: "9f2c1a7e",
  type: {
    display: "Fraunces",
    body: "Karla",
    displayWeight: 400,
    displayTracking: -0.01,
    scaleRatio: 4.2,
    displayCase: "sentence",
  },
  color: { mode: "light", strategy: "photo-led", brandH: 318, brandC: 0.04 },
  shape: { radius: 0, rules: "hairline", imageFrame: "inset" },
  grid: { alignment: "left-flush", density: "editorial" },
  motion: {
    profile: "calm",
    signatures: [],
    heroEntrance: false,
    smoothScroll: true,
  },
  sections: [
    { type: "hero", archetype: "photo-full" },
    { type: "statement", archetype: "quote-rule" },
    { type: "services", archetype: "list-rule" },
    { type: "visit", archetype: "map-split" },
  ],
  signature: { sectionIndex: 1, concept: "The client's own sentence, set at display size." },
  rejected: [
    { direction: "kinetic-bold", reason: "tone affinity", distance: 0.41 },
  ],
};

/* -------------------------------------------------------------------------- */

describe("briefSchema", () => {
  it("parses a valid brief", () => {
    expect(briefSchema.safeParse(BRIEF).success).toBe(true);
  });

  it("rejects a tone outside the enum", () => {
    const r = briefSchema.safeParse({ ...BRIEF, tone: "luxurious" });
    expect(r.success).toBe(false);
  });

  it("rejects prose where an enum belongs", () => {
    const r = briefSchema.safeParse({
      ...BRIEF,
      tier: "somewhere between mid and premium",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown key rather than dropping it", () => {
    const r = briefSchema.safeParse({ ...BRIEF, vibe: "coastal" });
    expect(r.success).toBe(false);
  });

  it("accepts a null ownSentence but not an empty one", () => {
    expect(briefSchema.safeParse({ ...BRIEF, ownSentence: null }).success).toBe(true);
    expect(briefSchema.safeParse({ ...BRIEF, ownSentence: "" }).success).toBe(false);
  });
});

describe("directionSchema", () => {
  it("parses a valid direction", () => {
    const r = directionSchema.safeParse(DIRECTION);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it("rejects fewer than two type pairs", () => {
    const r = directionSchema.safeParse({
      ...DIRECTION,
      type: { ...DIRECTION.type, pairs: [{ display: "Fraunces", body: "Karla" }] },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an inverted range", () => {
    const r = directionSchema.safeParse({
      ...DIRECTION,
      type: { ...DIRECTION.type, scaleRatio: [4.5, 3] },
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("min must be ≤ max");
  });

  it("rejects an unknown motion signature", () => {
    const r = directionSchema.safeParse({
      ...DIRECTION,
      motion: { ...DIRECTION.motion, signatures: ["pinned-handof"] },
    });
    expect(r.success).toBe(false);
  });

  /**
   * The contradiction the schema exists to catch: DJ10 would demand the
   * signature on every page and then fail the page for carrying it, because
   * the direction does not permit it. A1 asserted this in a test; here it
   * cannot be authored in the first place.
   */
  it("rejects a direction requiring a signature it does not permit", () => {
    const r = directionSchema.safeParse({
      ...DIRECTION,
      motion: {
        ...DIRECTION.motion,
        signatures: ["text-transformation"],
        required: ["pinned-handoff"],
      },
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("does not permit it");
  });

  it("accepts required when it is a subset of signatures", () => {
    const r = directionSchema.safeParse({
      ...DIRECTION,
      motion: {
        ...DIRECTION.motion,
        profiles: ["kinetic"],
        signatures: ["pinned-handoff", "text-transformation"],
        required: ["pinned-handoff"],
      },
    });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it("rejects a radius outside the four allowed values", () => {
    const r = directionSchema.safeParse({
      ...DIRECTION,
      shape: { ...DIRECTION.shape, radius: [6] },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an archetype list with no entries", () => {
    const r = directionSchema.safeParse({
      ...DIRECTION,
      archetypes: { ...DIRECTION.archetypes, team: [] },
    });
    expect(r.success).toBe(false);
  });
});

describe("designSpecSchema", () => {
  it("parses a valid spec", () => {
    const r = designSpecSchema.safeParse(SPEC);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it("rejects version 1 — the pre-D10 design.json", () => {
    const r = designSpecSchema.safeParse({ ...SPEC, version: 1 });
    expect(r.success).toBe(false);
  });

  it("rejects fewer than three sections", () => {
    const r = designSpecSchema.safeParse({ ...SPEC, sections: SPEC.sections.slice(0, 2) });
    expect(r.success).toBe(false);
  });

  /** The bold element attached to a section that does not exist. */
  it("rejects a signature index past the end of its own section list", () => {
    const r = designSpecSchema.safeParse({
      ...SPEC,
      signature: { ...SPEC.signature, sectionIndex: SPEC.sections.length },
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("past the");
  });

  it("accepts the last valid section index", () => {
    const r = designSpecSchema.safeParse({
      ...SPEC,
      signature: { ...SPEC.signature, sectionIndex: SPEC.sections.length - 1 },
    });
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
  });

  it("rejects a hue outside 0–360", () => {
    expect(designSpecSchema.safeParse({
      ...SPEC,
      color: { ...SPEC.color, brandH: 400 },
    }).success).toBe(false);
  });

  it("accepts an omitted mono face but not an empty one", () => {
    expect(designSpecSchema.safeParse(SPEC).success).toBe(true);
    expect(
      designSpecSchema.safeParse({ ...SPEC, type: { ...SPEC.type, mono: "" } }).success,
    ).toBe(false);
  });

  it("keeps rejected entries as an audit trail, empty allowed", () => {
    expect(designSpecSchema.safeParse({ ...SPEC, rejected: [] }).success).toBe(true);
    expect(
      designSpecSchema.safeParse({
        ...SPEC,
        rejected: [{ direction: "kinetic-bold", reason: "", distance: 0.4 }],
      }).success,
    ).toBe(false);
  });
});

/**
 * The spec is the resolved form of the direction, so a spec built from a
 * direction must land inside that direction's ranges. The sampler (§6.3)
 * guarantees it; this pins the two schemas to the same vocabulary so they
 * cannot drift apart silently.
 */
describe("spec and direction agree", () => {
  it("the fixture spec sits inside the fixture direction", () => {
    const { type, motion } = SPEC;
    expect(DIRECTION.type.displayWeights).toContain(type.displayWeight);
    const [tMin, tMax] = DIRECTION.type.displayTracking;
    expect(type.displayTracking).toBeGreaterThanOrEqual(tMin);
    expect(type.displayTracking).toBeLessThanOrEqual(tMax);
    const [rMin, rMax] = DIRECTION.type.scaleRatio;
    expect(type.scaleRatio).toBeGreaterThanOrEqual(rMin);
    expect(type.scaleRatio).toBeLessThanOrEqual(rMax);
    expect(DIRECTION.motion.profiles).toContain(motion.profile);
    expect(motion.heroEntrance).toBe(DIRECTION.motion.heroEntrance);
    for (const signature of motion.signatures) {
      expect(DIRECTION.motion.signatures).toContain(signature);
    }
  });
});
