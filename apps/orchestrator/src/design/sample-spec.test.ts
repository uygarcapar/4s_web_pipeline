import { designSpecSchema } from "@pipeline/core";
import { describe, expect, it } from "vitest";
import type { Direction } from "@pipeline/core";

import { DIRECTIONS, DIRECTION_IDS } from "./directions/index.js";
import { hashSeed, mulberry32, sampleSpec } from "./sample-spec.js";

describe("mulberry32", () => {
  it("is deterministic", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("stays inside [0, 1)", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i += 1) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  /**
   * Adjacent seeds must not produce correlated streams: candidates are
   * seeded "<domain>-0", "<domain>-1", and a hash that merely sums
   * characters would hand them near-identical first draws — which would
   * make two candidates for one client the same spec.
   */
  it("decorrelates adjacent seeds", () => {
    const a = mulberry32(hashSeed("acme-0"))();
    const b = mulberry32(hashSeed("acme-1"))();
    expect(Math.abs(a - b)).toBeGreaterThan(0.05);
  });
});

describe.each(DIRECTION_IDS)("sampleSpec — %s", (id) => {
  const direction = DIRECTIONS[id]!;

  it("produces a spec that parses", () => {
    for (let i = 0; i < 8; i += 1) {
      const r = designSpecSchema.safeParse(sampleSpec(direction, "fixture", i));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    }
  });

  it("only ever draws values the direction permits", () => {
    for (let i = 0; i < 24; i += 1) {
      const s = sampleSpec(direction, "fixture", i);
      expect(direction.type.displayWeights).toContain(s.type.displayWeight);
      expect(direction.type.displayCase).toContain(s.type.displayCase);
      expect(direction.color.modes).toContain(s.color.mode);
      expect(direction.color.strategies).toContain(s.color.strategy);
      expect(direction.shape.radius).toContain(s.shape.radius);
      expect(direction.shape.rules).toContain(s.shape.rules);
      expect(direction.shape.imageFrame).toContain(s.shape.imageFrame);
      expect(direction.grid.alignment).toContain(s.grid.alignment);
      expect(direction.grid.density).toContain(s.grid.density);
      expect(direction.motion.profiles).toContain(s.motion.profile);

      const [tMin, tMax] = direction.type.displayTracking;
      expect(s.type.displayTracking).toBeGreaterThanOrEqual(tMin);
      expect(s.type.displayTracking).toBeLessThanOrEqual(tMax);
      const [rMin, rMax] = direction.type.scaleRatio;
      expect(s.type.scaleRatio).toBeGreaterThanOrEqual(rMin);
      expect(s.type.scaleRatio).toBeLessThanOrEqual(rMax);
      expect(s.color.brandC).toBeLessThanOrEqual(direction.color.maxChroma);
    }
  });

  it("is reproducible — same inputs, same spec", () => {
    expect(sampleSpec(direction, "acme", 3)).toEqual(sampleSpec(direction, "acme", 3));
  });

  it("gives different clients different specs", () => {
    const a = JSON.stringify(sampleSpec(direction, "acme", 0));
    const b = JSON.stringify(sampleSpec(direction, "baker", 0));
    expect(a).not.toBe(b);
  });

  /**
   * The point of sampling at all. A direction whose candidates never differ
   * is a direction with one spec, and the library would be showing a corner
   * of it — which is exactly what option `[0]` did.
   */
  it("explores more than one point of its own range", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      const s = sampleSpec(direction, "fixture", i);
      seen.add(
        [
          s.type.displayWeight,
          s.type.scaleRatio,
          s.shape.radius,
          s.shape.imageFrame,
          s.color.mode,
        ].join("|"),
      );
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("carries the direction's required motion signatures", () => {
    const s = sampleSpec(direction, "fixture", 0);
    for (const sig of direction.motion.required) {
      expect(s.motion.signatures).toContain(sig);
    }
  });
});

/**
 * `split` had to stop reaching the token generator: it renders anything that
 * is not literally `"dark"` as a light page, so a sampled `quiet-luxury`
 * spec saying `split` produced a white page for a direction that declares
 * itself near-black.
 */
describe("split resolves to the direction's own polarity", () => {
  it.each(DIRECTION_IDS)("%s never samples split", (id) => {
    const direction = DIRECTIONS[id]!;
    for (let i = 0; i < 40; i += 1) {
      expect(sampleSpec(direction, `seed-${id}`, i).color.mode).not.toBe("split");
    }
  });

  /**
   * Built rather than borrowed: after the 2026-10-22 review no catalog
   * direction declares both `split` and a near-black `paperLightness`, so
   * there is nothing to point at. The rule still has to hold for the next
   * direction that does — and `renderRamp` renders anything that is not
   * literally `"dark"` as a light page, so getting this wrong means a
   * near-black direction shipping a white one.
   */
  it("gives a near-black direction a dark page", () => {
    const direction: Direction = {
      ...DIRECTIONS["cinematic-calm"]!,
      color: {
        ...DIRECTIONS["cinematic-calm"]!.color,
        modes: ["split"],
        paperLightness: [0.12, 0.28],
      },
    };
    for (let i = 0; i < 40; i += 1) {
      expect(sampleSpec(direction, "lux", i).color.mode).toBe("dark");
    }
  });

  it("leaves a light direction light", () => {
    const direction = DIRECTIONS["swiss-grid"]!;
    expect(direction.color.modes).toContain("split");
    for (let i = 0; i < 40; i += 1) {
      expect(sampleSpec(direction, "swiss", i).color.mode).toBe("light");
    }
  });
});
