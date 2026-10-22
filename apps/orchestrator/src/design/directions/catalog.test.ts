import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { directionSchema } from "@pipeline/core";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_DIRECTION_ID,
  DIRECTIONS,
  DIRECTION_IDS,
  resolveDirection,
} from "./index.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

/** The four D10 §4.3 ships before any more are added. */
const EXPECTED = ["kinetic-bold", "stark-display", "swiss-grid", "cinematic-calm"];

describe("direction catalog", () => {
  it("holds exactly the four directions of §4.3", () => {
    expect([...DIRECTION_IDS].sort()).toEqual([...EXPECTED].sort());
  });

  it("every direction parses", () => {
    for (const id of DIRECTION_IDS) {
      const r = directionSchema.safeParse(DIRECTIONS[id]);
      expect(r.success, `${id}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
  });

  it("every direction lists at least three reference screenshots", () => {
    for (const id of DIRECTION_IDS) {
      expect(DIRECTIONS[id]!.refs.length, id).toBeGreaterThanOrEqual(3);
    }
  });

  /**
   * A path that does not resolve is worse than a missing one: the signature
   * stage and DJ18 would compare against nothing and report no difference.
   */
  it("every reference screenshot exists on disk", () => {
    for (const id of DIRECTION_IDS) {
      for (const ref of DIRECTIONS[id]!.refs) {
        expect(existsSync(join(REPO_ROOT, ref)), `${id} → ${ref}`).toBe(true);
      }
    }
  });

  it("every direction fills avoid", () => {
    for (const id of DIRECTION_IDS) {
      expect(DIRECTIONS[id]!.avoid.length, id).toBeGreaterThan(0);
    }
  });

  it("every direction offers a hero archetype", () => {
    for (const id of DIRECTION_IDS) {
      expect(DIRECTIONS[id]!.archetypes.hero?.length ?? 0, id).toBeGreaterThan(0);
    }
  });

  it("falls back to kinetic-bold for a run built before the catalog", () => {
    expect(resolveDirection(undefined).id).toBe(DEFAULT_DIRECTION_ID);
    expect(resolveDirection("not-a-direction").id).toBe("kinetic-bold");
  });
});

/**
 * The catalog exists to make sites differ. Four directions that agree on
 * weight, motion and colour would be one direction with four names, so the
 * axes that drive the eye have to actually spread.
 */
describe("the four directions are distinguishable", () => {
  it("no two share a display weight set, a motion profile and a colour mode", () => {
    const fingerprints = DIRECTION_IDS.map((id) => {
      const d = DIRECTIONS[id]!;
      return [
        d.type.displayWeights.join("/"),
        d.motion.profiles.join("/"),
        d.color.modes.join("/"),
      ].join(" | ");
    });
    expect(new Set(fingerprints).size).toBe(DIRECTION_IDS.length);
  });

  it("covers both ends of the weight range the corpus measured", () => {
    const weights = DIRECTION_IDS.flatMap((id) => DIRECTIONS[id]!.type.displayWeights);
    expect(Math.min(...weights)).toBeLessThanOrEqual(400);
    expect(Math.max(...weights)).toBeGreaterThanOrEqual(700);
  });

  it("offers more than one motion profile across the catalog", () => {
    const profiles = new Set(
      DIRECTION_IDS.flatMap((id) => DIRECTIONS[id]!.motion.profiles),
    );
    expect(profiles.size).toBeGreaterThanOrEqual(3);
  });

  /** Only one direction may require a signature; the rest must be buildable without one. */
  it("does not require a pinned hand-off everywhere, which was the A1 failure", () => {
    const requiring = DIRECTION_IDS.filter(
      (id) => DIRECTIONS[id]!.motion.required.length > 0,
    );
    expect(requiring.length).toBeLessThan(DIRECTION_IDS.length);
  });
});
