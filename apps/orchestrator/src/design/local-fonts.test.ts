import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DesignSpec } from "@pipeline/core";
import { afterEach, describe, expect, it } from "vitest";

import { DIRECTIONS, DIRECTION_IDS } from "./directions/index.js";
import { copyFaces, planLocalFonts } from "./local-fonts.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

function specFor(id: string): DesignSpec {
  const d = DIRECTIONS[id]!;
  const pair = d.type.pairs[0]!;
  return {
    version: 2,
    direction: d.id,
    seed: "fixture",
    type: {
      display: pair.display,
      body: pair.body,
      ...(d.type.mono[0] === undefined ? {} : { mono: d.type.mono[0] }),
      displayWeight: d.type.displayWeights[0]!,
      displayTracking: d.type.displayTracking[0]!,
      scaleRatio: d.type.scaleRatio[0]!,
      displayCase: d.type.displayCase[0]!,
    },
    color: { mode: d.color.modes[0]!, strategy: d.color.strategies[0]!, brandH: 318, brandC: 0.04 },
    shape: { radius: d.shape.radius[0]!, rules: d.shape.rules[0]!, imageFrame: d.shape.imageFrame[0]! },
    grid: { alignment: d.grid.alignment[0]!, density: d.grid.density[0]! },
    motion: {
      profile: d.motion.profiles[0]!,
      signatures: [...d.motion.required],
      heroEntrance: d.motion.heroEntrance,
      smoothScroll: d.motion.smoothScroll,
    },
    sections: [
      { type: "hero", archetype: "photo-full" },
      { type: "services", archetype: "list-rule" },
      { type: "contact", archetype: "split-form" },
    ],
    signature: { sectionIndex: 0, concept: "fixture" },
    rejected: [],
  };
}

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});

describe.each(DIRECTION_IDS)("%s", (id) => {
  const plan = planLocalFonts(specFor(id));

  it("plans only registered faces", () => {
    expect(plan.faces.length).toBeGreaterThan(0);
  });

  it("emits a next/font/local module", () => {
    expect(plan.module).toContain('import localFont from "next/font/local"');
    expect(plan.module).toContain("export const displayFont");
    expect(plan.module).toContain("export const bodyFont");
    expect(plan.module).toContain("export const fontVariables");
  });

  it("loads latin and latin-ext for every face", () => {
    for (const face of plan.faces) {
      expect(plan.module).toContain(`${face.slug}/${face.slug}-latin.woff2`);
      expect(plan.module).toContain(`${face.slug}/${face.slug}-latin-ext.woff2`);
    }
  });

  /**
   * The root cause of "the fonts are not modern", three times over: a
   * variable face loaded at one weight cannot do an optical-size curve, so
   * every family read the same.
   */
  it("never pins a weight on a variable face", () => {
    expect(plan.module).not.toMatch(/weight: "\d{3}"/);
    if (plan.faces.some((f) => f.variable)) {
      expect(plan.module).toContain('weight: "100 900"');
    }
  });

  it("copies the faces and their licences into a run", () => {
    const site = mkdtempSync(join(tmpdir(), "a5-"));
    temps.push(site);
    copyFaces(plan, REPO_ROOT, site);
    for (const face of plan.faces) {
      expect(existsSync(join(site, "public/fonts", face.slug, `${face.slug}-latin.woff2`))).toBe(true);
      expect(
        existsSync(join(site, "public/fonts", face.slug, "OFL.txt")),
        "a generated site is a redistribution; OFL §2 applies to it too",
      ).toBe(true);
    }
  });
});

describe("the registry is the gate", () => {
  it("refuses a face nothing has vendored", () => {
    const spec = specFor("kinetic-bold");
    expect(() =>
      planLocalFonts({ ...spec, type: { ...spec.type, display: "Helvetica Now" } }),
    ).toThrow(/not in the face registry/);
  });

  it("copies a family shared by display and body only once", () => {
    // swiss-grid pairs Inter Tight with itself.
    const plan = planLocalFonts(specFor("swiss-grid"));
    const slugs = plan.faces.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("includes the mono accent only where the direction has one", () => {
    expect(planLocalFonts(specFor("swiss-grid")).module).toContain("monoFont");
    // editorial-serif declares `mono: []`.
    expect(planLocalFonts(specFor("editorial-serif")).module).not.toContain("monoFont");
  });
});
