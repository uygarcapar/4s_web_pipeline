import { describe, expect, it } from "vitest";
import type { DesignSpec } from "@pipeline/core";

import { DIRECTIONS } from "./directions/index.js";
import { sampleSpec } from "./sample-spec.js";
import {
  AXIS_WEIGHTS,
  distanceRejection,
  sharedAxes,
  specAxes,
  specDistance,
  THRESHOLDS,
  type Neighbour,
} from "./distance.js";

const base = sampleSpec(DIRECTIONS["swiss-grid"]!, "acme.com", 0);

const neighbour = (
  domain: string,
  spec: DesignSpec,
  over: Partial<Neighbour> = {},
): Neighbour => ({
  domain,
  spec,
  rank: 99,
  within: { allSectors: true, sameSector: false },
  ...over,
});

describe("specDistance", () => {
  it("is 0 for a spec against itself", () => {
    expect(specDistance(specAxes(base), specAxes(base))).toBe(0);
  });

  it("is 1 when every axis differs", () => {
    const other: DesignSpec = {
      ...base,
      direction: "quiet-luxury",
      type: { ...base.type, display: "Fraunces", body: "Karla", displayWeight: 300 },
      color: { ...base.color, mode: base.color.mode === "dark" ? "light" : "dark" },
      shape: { ...base.shape, radius: base.shape.radius === 0 ? 12 : 0, imageFrame: "collage" },
      grid: { alignment: "centered", density: "poster" },
      motion: { ...base.motion, profile: "kinetic" },
      sections: [{ type: "hero", archetype: "collage" }, ...base.sections.slice(1)],
    };
    // Guard the fixture: if a future catalog change makes one of these match
    // by accident, the assertion below would pass for the wrong reason.
    expect(sharedAxes(specAxes(base), specAxes(other))).toEqual([]);
    expect(specDistance(specAxes(base), specAxes(other))).toBe(1);
  });

  it("weights the direction and the hero above the details", () => {
    const axes = specAxes(base);
    const differentHero = { ...axes, heroArchetype: "something-else" };
    const differentRadius = { ...axes, radius: "999" };
    expect(specDistance(axes, differentHero)).toBeGreaterThan(
      specDistance(axes, differentRadius),
    );
  });

  it("is symmetric", () => {
    const other = specAxes({ ...base, direction: "kinetic-bold" });
    expect(specDistance(specAxes(base), other)).toBe(specDistance(other, specAxes(base)));
  });

  /**
   * The weights are §8.1's verbatim. Pinned because §8.3 calibrates them
   * against the operator's labels, and a silent edit would invalidate that
   * calibration without anything saying so.
   */
  it("uses the weights D10 §8.1 specifies", () => {
    expect(AXIS_WEIGHTS).toEqual({
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
    });
  });
});

describe("specAxes", () => {
  it("reads the hero's archetype, not the first section's", () => {
    const spec: DesignSpec = {
      ...base,
      sections: [
        { type: "marquee", archetype: "ticker" },
        { type: "hero", archetype: "offset-grid" },
        { type: "contact", archetype: "default" },
      ],
    };
    expect(specAxes(spec).heroArchetype).toBe("offset-grid");
  });

  it("says so when there is no hero rather than guessing", () => {
    const spec: DesignSpec = {
      ...base,
      sections: [
        { type: "services", archetype: "index" },
        { type: "faq", archetype: "rows" },
        { type: "contact", archetype: "default" },
      ],
    };
    expect(specAxes(spec).heroArchetype).toBe("none");
  });
});

describe("distanceRejection", () => {
  it("passes a candidate with no neighbours", () => {
    expect(distanceRejection(base, "acme.com", [])).toBeNull();
  });

  it("rejects a near-identical neighbour inside the 30-day window", () => {
    const result = distanceRejection(base, "acme.com", [neighbour("other.com", base)]);
    expect(result?.rule).toBe("all-sectors");
    expect(result?.distance).toBe(0);
    expect(result?.reason).toContain("other.com");
  });

  /** The seeded sampler's whole promise: rebuilding a client reproduces it. */
  it("never rejects a client against its own earlier run", () => {
    expect(distanceRejection(base, "acme.com", [neighbour("acme.com", base)])).toBeNull();
  });

  it("ignores a neighbour outside every window", () => {
    const old = neighbour("other.com", base, {
      within: { allSectors: false, sameSector: false },
      rank: 99,
    });
    expect(distanceRejection(base, "acme.com", [old])).toBeNull();
  });

  /**
   * The same-sector rule is stricter, so a candidate can clear the
   * all-sectors threshold and still be too close to a neighbour in its own
   * trade. 0.4–0.55 is exactly that band.
   */
  it("applies the stricter threshold within a sector", () => {
    // Differ on direction (3) and hero (3) only: 6/18 = 0.333 — fails both.
    // Add colorMode (2) and typePair (2): 10/18 = 0.556 — clears both.
    // Differ on direction, hero and colorMode: 8/18 = 0.444 — the band.
    const inBand: DesignSpec = {
      ...base,
      direction: "kinetic-bold",
      color: { ...base.color, mode: base.color.mode === "dark" ? "light" : "dark" },
      sections: [{ type: "hero", archetype: "collage" }, ...base.sections.slice(1)],
    };
    const distance = specDistance(specAxes(inBand), specAxes(base));
    expect(distance).toBeGreaterThanOrEqual(THRESHOLDS.allSectors);
    expect(distance).toBeLessThan(THRESHOLDS.sameSector);

    const otherSector = neighbour("other.com", base, {
      within: { allSectors: true, sameSector: false },
    });
    const ownSector = neighbour("other.com", base, {
      within: { allSectors: true, sameSector: true },
    });
    expect(distanceRejection(inBand, "acme.com", [otherSector])).toBeNull();
    expect(distanceRejection(inBand, "acme.com", [ownSector])?.rule).toBe("same-sector");
  });

  /**
   * §8.1's hard rule, independent of the weighted distance: the last three
   * runs must not open with the same direction AND the same hero. Those are
   * the two things a visitor reads in the first second.
   */
  it("rejects a repeat of the last three runs' direction and hero", () => {
    // Far apart on everything else — distance clears both thresholds.
    const far: DesignSpec = {
      ...base,
      type: { ...base.type, display: "Fraunces", body: "Karla", displayWeight: 300 },
      color: { ...base.color, mode: base.color.mode === "dark" ? "light" : "dark" },
      shape: { ...base.shape, radius: base.shape.radius === 0 ? 12 : 0, imageFrame: "collage" },
      grid: { alignment: "centered", density: "poster" },
      motion: { ...base.motion, profile: "kinetic" },
    };
    expect(specDistance(specAxes(far), specAxes(base))).toBeGreaterThan(
      THRESHOLDS.sameSector,
    );

    const recent = neighbour("other.com", base, { rank: 2 });
    expect(distanceRejection(far, "acme.com", [recent])?.rule).toBe("recent-runs");

    // Four runs ago, the same pair is allowed again.
    const older = neighbour("other.com", base, { rank: 3 });
    expect(distanceRejection(far, "acme.com", [older])).toBeNull();
  });

  it("reports the first violation, not all of them", () => {
    const result = distanceRejection(base, "acme.com", [
      neighbour("first.com", base),
      neighbour("second.com", base),
    ]);
    expect(result?.domain).toBe("first.com");
  });

  it("names the axes the two specs share", () => {
    const result = distanceRejection(base, "acme.com", [neighbour("other.com", base)]);
    expect(result?.reason).toContain("direction");
    expect(result?.reason).toContain("heroArchetype");
  });
});
