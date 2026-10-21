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
import { EDITORIAL_SERIF, KINETIC_BOLD, resolveDirection } from "./stub.js";
import { HARD_FAIL_IDS } from "../../stages/design-judge.js";

/**
 * The A1 acceptance fixture (D10 §12): a page set at display weight 400 with
 * no pinned hand-off. It is the shape `editorial-serif` is for and the shape
 * today's constant rules reject.
 */
const FIXTURE: { type: TypeMeasurement; motion: MotionMeasurement } = {
  type: { displayWeight: 400, displayTracking: -0.01, displayToBodyRatio: 4.2 },
  motion: { signatures: [], fadeUpOnly: false },
};

describe("A1 acceptance — weight 400, no pin", () => {
  it("passes under editorial-serif", () => {
    const dj16 = checkDj16(FIXTURE.type, EDITORIAL_SERIF);
    const dj10 = checkDj10(FIXTURE.motion, EDITORIAL_SERIF);
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
      EDITORIAL_SERIF,
    );
    expect(r.pass, r.evidence).toBe(true);
  });
});

describe("checkDj10", () => {
  it("fails an expressive profile whose only device is fade-up", () => {
    const r = checkDj10(
      { signatures: ["pinned-handoff", "text-transformation"], fadeUpOnly: true },
      KINETIC_BOLD,
    );
    expect(r.pass).toBe(false);
    expect(r.evidence).toContain("fade-up");
  });

  it("does not demand a pin from a calm direction", () => {
    const r = checkDj10({ signatures: [], fadeUpOnly: true }, EDITORIAL_SERIF);
    expect(r.pass, r.evidence).toBe(true);
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
