import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DesignSpec } from "@pipeline/core";
import { afterEach, describe, expect, it } from "vitest";

import { DIRECTIONS, DIRECTION_IDS } from "./directions/index.js";
import { copyFaces, fontRoles, planLocalFonts } from "./local-fonts.js";

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
  const spec = specFor(id);
  const plan = planLocalFonts(spec);

  it("plans only registered faces", () => {
    expect(plan.faces.length).toBeGreaterThan(0);
  });

  it("emits a next/font/local module", () => {
    expect(plan.module).toContain('import localFont from "next/font/local"');
    expect(plan.module).toContain("export const displayFont");
    expect(plan.module).toContain("export const fontVariables");
    // NOT `bodyFont`: a direction that pairs a face with itself declares the
    // family once. Asserting the symbol is what made the duplicate download
    // look correct.
    for (const role of fontRoles(spec).filter((r) => r.declares)) {
      expect(plan.module).toContain(`export const ${role.role}Font`);
    }
  });

  /**
   * One download per family. `swiss-grid` is Archivo over Archivo; declaring
   * it twice cost 180 ms of LCP against a budget with none to spare.
   */
  it("declares each family exactly once", () => {
    const slugs = plan.faces.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const face of plan.faces) {
      const declarations = plan.module.split(`${face.slug}-latin.woff2`).length - 1;
      expect(declarations, `${face.family} appears in ${declarations} declarations`).toBe(1);
    }
  });

  /** Every role has to resolve to a variable the module actually defines. */
  it("gives every role a declared variable", () => {
    for (const role of fontRoles(spec)) {
      expect(plan.module).toContain(`variable: "${role.variable}"`);
    }
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

  /**
   * Every direction in the catalog currently declares a mono accent, so the
   * negative case is built rather than borrowed. Pinning it to whichever
   * direction happened to have `mono: []` is what broke this test when the
   * 2026-10-22 review replaced two of them — and the next catalog change
   * would have broken it again.
   */
  it("includes the mono accent only where the direction has one", () => {
    const withMono = specFor("swiss-grid");
    expect(planLocalFonts(withMono).module).toContain("monoFont");

    const withoutMono = { ...withMono.type };
    delete withoutMono.mono;
    expect(
      planLocalFonts({ ...withMono, type: withoutMono }).module,
    ).not.toContain("monoFont");
  });
});
