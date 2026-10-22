import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  checkDj10,
  checkDj16,
  type MotionMeasurement,
  type TypeMeasurement,
} from "./checks.js";
import { kineticBold as KINETIC_BOLD, resolveDirection } from "./index.js";
import { HARD_FAIL_IDS } from "../../stages/design-judge.js";
import type { Direction } from "@pipeline/core";

/**
 * A calm, light-weight direction, defined here rather than taken from the
 * catalog.
 *
 * It used to be `editorial-serif`, and when the 2026-10-22 review deleted
 * that direction these tests broke — which was the tests' fault, not the
 * review's. They exercise `checkDj10` and `checkDj16`, not the catalog: what
 * they need is *a* direction with weight 400, no required signature, no hero
 * entrance and smooth scroll on, and pinning that to whichever catalog entry
 * happened to have those values coupled the check's tests to a list of
 * design opinions that is meant to change.
 *
 * `KINETIC_BOLD` stays real, because the contrast case has to be a direction
 * someone can actually be assigned.
 */
const CALM_DIRECTION: Direction = {
  ...KINETIC_BOLD,
  id: "calm-fixture",
  type: {
    ...KINETIC_BOLD.type,
    displayWeights: [300, 400],
    displayTracking: [-0.015, 0],
    scaleRatio: [3, 4.5],
  },
  motion: {
    profiles: ["calm"],
    signatures: [],
    required: [],
    heroEntrance: false,
    smoothScroll: true,
  },
};

/**
 * The A1 acceptance fixture (D10 §12): a page set at display weight 400 with
 * no pinned hand-off. It is the shape `editorial-serif` is for and the shape
 * today's constant rules reject.
 */
const FIXTURE: { type: TypeMeasurement; motion: MotionMeasurement } = {
  type: { displayWeight: 400, displayTracking: -0.01, displayToBodyRatio: 4.2 },
  motion: {
    signatures: [],
    fadeUpOnly: false,
    heroEntrance: false,
    smoothScroll: true,
  },
};

/** A calm page, as the shorthand for the absence tests to vary one field of. */
const CALM: MotionMeasurement = {
  signatures: [],
  fadeUpOnly: false,
  heroEntrance: false,
  smoothScroll: false,
};

describe("A1 acceptance — weight 400, no pin", () => {
  it("passes under a calm, light direction", () => {
    const dj16 = checkDj16(FIXTURE.type, CALM_DIRECTION);
    const dj10 = checkDj10(FIXTURE.motion, CALM_DIRECTION);
    expect(dj16.pass, dj16.evidence).toBe(true);
    expect(dj10.pass, dj10.evidence).toBe(true);
  });

  it("fails under kinetic-bold, on both the weight and the missing pin", () => {
    const dj16 = checkDj16(FIXTURE.type, KINETIC_BOLD);
    const dj10 = checkDj10(FIXTURE.motion, KINETIC_BOLD);
    expect(dj16.pass).toBe(false);
    expect(dj16.evidence).toContain("display weight 400");
    expect(dj10.pass).toBe(false);
    expect(dj10.evidence).toContain("pinned-handoff");
  });
});

describe("checkDj16", () => {
  it("accepts a page sitting inside kinetic-bold", () => {
    const r = checkDj16(
      { displayWeight: 800, displayTracking: -0.04, displayToBodyRatio: 6 },
      KINETIC_BOLD,
    );
    expect(r.pass, r.evidence).toBe(true);
  });

  it("reports every axis that is out of range, not just the first", () => {
    const r = checkDj16(
      { displayWeight: 300, displayTracking: 0.05, displayToBodyRatio: 12 },
      KINETIC_BOLD,
    );
    expect(r.pass).toBe(false);
    expect(r.evidence).toContain("weight");
    expect(r.evidence).toContain("tracking");
    expect(r.evidence).toContain("ratio");
  });

  it("treats the range bounds as inclusive", () => {
    const r = checkDj16(
      { displayWeight: 300, displayTracking: 0, displayToBodyRatio: 4.5 },
      CALM_DIRECTION,
    );
    expect(r.pass, r.evidence).toBe(true);
  });
});

describe("checkDj10 — presence", () => {
  it("fails an expressive profile whose only device is fade-up", () => {
    const r = checkDj10(
      {
        ...CALM,
        signatures: ["pinned-handoff", "text-transformation"],
        fadeUpOnly: true,
        heroEntrance: true,
        smoothScroll: true,
      },
      KINETIC_BOLD,
    );
    expect(r.pass).toBe(false);
    expect(r.evidence).toContain("fade-up");
  });

  it("does not demand a pin from a calm direction", () => {
    const r = checkDj10({ ...CALM, fadeUpOnly: true }, CALM_DIRECTION);
    expect(r.pass, r.evidence).toBe(true);
  });
});

/**
 * K8 (D10 §3.3). A presence-only DJ10 passes a calm site that still pins, still
 * runs a hero entrance and still ships Lenis, because `required` is empty —
 * the direction gets declared and then ignored. Each branch below is a page
 * the old check waved through.
 */
describe("checkDj10 — absence", () => {
  it("fails a calm direction that still pins", () => {
    const r = checkDj10({ ...CALM, signatures: ["pinned-handoff"] }, CALM_DIRECTION);
    expect(r.pass).toBe(false);
    expect(r.evidence).toContain("disables pinned-handoff");
  });

  it("fails a calm direction that still runs a hero entrance", () => {
    const r = checkDj10({ ...CALM, heroEntrance: true }, CALM_DIRECTION);
    expect(r.pass).toBe(false);
    expect(r.evidence).toContain("hero entrance");
  });

  it("fails a direction whose smoothScroll flag is off when Lenis is installed", () => {
    const still: typeof CALM_DIRECTION = {
      ...CALM_DIRECTION,
      id: "still-poster",
      motion: { ...CALM_DIRECTION.motion, smoothScroll: false },
    };
    const r = checkDj10({ ...CALM, smoothScroll: true }, still);
    expect(r.pass).toBe(false);
    expect(r.evidence).toContain("smooth scroll");
  });

  it("allows what the direction permits but does not require", () => {
    const r = checkDj10({ ...CALM, signatures: ["pinned-handoff"] }, {
      ...CALM_DIRECTION,
      motion: { ...CALM_DIRECTION.motion, signatures: ["pinned-handoff"] },
    });
    expect(r.pass, r.evidence).toBe(true);
  });

  it("reports the missing and the forbidden together", () => {
    const r = checkDj10(
      { ...CALM, signatures: ["text-transformation"], heroEntrance: true },
      {
        ...KINETIC_BOLD,
        motion: { ...KINETIC_BOLD.motion, signatures: ["pinned-handoff"], required: ["pinned-handoff"] },
      },
    );
    expect(r.pass).toBe(false);
    expect(r.evidence).toContain("requires pinned-handoff");
    expect(r.evidence).toContain("disables text-transformation");
  });
});

/**
 * `required` ⊆ `signatures` or the direction contradicts itself: DJ10 would
 * demand a signature and fail the page for carrying it.
 */
describe("catalog directions are self-consistent", () => {
  it("requires nothing it does not also allow", () => {
    for (const d of [KINETIC_BOLD, CALM_DIRECTION]) {
      const contradictory = d.motion.required.filter(
        (s) => !d.motion.signatures.includes(s),
      );
      expect(contradictory, `${d.id} requires what it disables`).toEqual([]);
    }
  });
});

describe("resolveDirection", () => {
  it("falls back to kinetic-bold for runs built before the catalog", () => {
    expect(resolveDirection(undefined).id).toBe("kinetic-bold");
    expect(resolveDirection("not-a-direction").id).toBe("kinetic-bold");
  });
});

/**
 * K2: the hard-fail set lived in three places that disagreed — the rubric,
 * `HARD_FAIL_IDS`, and acceptance.json. The rubric is the source of truth, so
 * the code is pinned to it by parsing the sentence rather than by a copy
 * someone has to remember to update.
 */
describe("HARD_FAIL_IDS matches the rubric", () => {
  it("equals the set design-rules.md §11 declares", () => {
    const rules = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../../../../template/design-rules.md"),
      "utf8",
    );
    const line = /\*\*Hard fails → fix loop:\*\*\s*([^.]+)\./.exec(rules);
    expect(line, "hard-fail sentence not found in design-rules.md §11").not.toBeNull();

    const declared = new Set<string>();
    for (const part of line![1]!.split(",")) {
      const range = /DJ(\d+)\s*[–-]\s*DJ(\d+)/.exec(part);
      if (range) {
        for (let n = Number(range[1]); n <= Number(range[2]); n += 1) {
          declared.add(`DJ${n}`);
        }
        continue;
      }
      for (const m of part.matchAll(/DJ(\d+)/g)) declared.add(`DJ${m[1]}`);
    }

    expect([...declared].sort()).toEqual([...HARD_FAIL_IDS].sort());
  });
});
