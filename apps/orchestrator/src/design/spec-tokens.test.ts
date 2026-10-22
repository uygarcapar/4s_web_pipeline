import type { DesignSpec } from "@pipeline/core";
import { describe, expect, it } from "vitest";

import { DIRECTIONS, DIRECTION_IDS } from "./directions/index.js";
import { buildScale, scaleViolations, MAX_UPPERCASE_TRACKING } from "./scale.js";
import { renderSpecTokens } from "./spec-tokens.js";

/**
 * One spec per direction, sampled at the midpoint of that direction's ranges
 * — what the §6.3 sampler will produce. Built from the catalog rather than
 * hand-written, so a direction whose ranges change is covered without
 * anyone remembering to update a fixture.
 */
function specFor(id: string): DesignSpec {
  const d = DIRECTIONS[id]!;
  const mid = ([a, b]: [number, number]): number => Math.round(((a + b) / 2) * 1000) / 1000;
  const pair = d.type.pairs[0]!;
  return {
    version: 2,
    direction: d.id,
    seed: `${d.id}-fixture`,
    type: {
      display: pair.display,
      body: pair.body,
      ...(d.type.mono[0] === undefined ? {} : { mono: d.type.mono[0] }),
      displayWeight: d.type.displayWeights[0]!,
      displayTracking: mid(d.type.displayTracking),
      scaleRatio: mid(d.type.scaleRatio),
      displayCase: d.type.displayCase[0]!,
    },
    color: {
      mode: d.color.modes[0]!,
      strategy: d.color.strategies[0]!,
      brandH: 318,
      brandC: Math.min(d.color.maxChroma, 0.08),
    },
    shape: {
      radius: d.shape.radius[0]!,
      rules: d.shape.rules[0]!,
      imageFrame: d.shape.imageFrame[0]!,
    },
    grid: { alignment: d.grid.alignment[0]!, density: d.grid.density[0]! },
    motion: {
      profile: d.motion.profiles[0]!,
      signatures: [...d.motion.required],
      heroEntrance: d.motion.heroEntrance,
      smoothScroll: d.motion.smoothScroll,
    },
    sections: [
      { type: "hero", archetype: d.archetypes.hero![0]! },
      { type: "services", archetype: d.archetypes.services![0]! },
      { type: "contact", archetype: "split-form" },
    ],
    signature: { sectionIndex: 0, concept: "fixture" },
    rejected: [],
  };
}

describe.each(DIRECTION_IDS)("%s", (id) => {
  const spec = specFor(id);

  it("generates a scale with no §4 violations", () => {
    const problems = scaleViolations(buildScale(spec));
    expect(problems, problems.join("; ")).toEqual([]);
  });

  it("renders tokens.css", () => {
    const css = renderSpecTokens(spec);
    expect(css).toContain("@import \"tailwindcss\";");
    expect(css).toContain("@theme inline");
    expect(css).toContain(`direction: ${id}`);
  });

  it("emits all eight steps", () => {
    const css = renderSpecTokens(spec);
    for (const step of [
      "t-display",
      "t-h2",
      "t-h2-col",
      "t-h3",
      "t-lead",
      "t-body",
      "meta",
      "btn-label",
    ]) {
      expect(css, `${id} missing .${step}`).toContain(`.${step} {`);
    }
  });

  it("matches its snapshot", () => {
    expect(renderSpecTokens(spec)).toMatchSnapshot();
  });
});

/**
 * The point of A4: the stylesheet is a function of the spec. Two directions
 * that produced the same CSS would mean the catalog changes nothing a
 * visitor can see.
 */
describe("the scale actually varies by direction", () => {
  it("no two directions render the same stylesheet", () => {
    const rendered = DIRECTION_IDS.map((id) => renderSpecTokens(specFor(id)));
    expect(new Set(rendered).size).toBe(DIRECTION_IDS.length);
  });

  it("display sizes differ between the widest and narrowest ratio", () => {
    const sizes = DIRECTION_IDS.map((id) => buildScale(specFor(id))[0]!.maxRem);
    expect(Math.max(...sizes)).toBeGreaterThan(Math.min(...sizes) * 1.3);
  });

  /**
   * The desktop cap is not enough on its own: the fluid term governs every
   * viewport narrow enough not to reach it, which is most phones. A shared
   * `vw` made the whole catalog render one headline size there.
   */
  it("differs on a phone too, not only at the desktop cap", () => {
    const fluids = new Set(DIRECTION_IDS.map((id) => buildScale(specFor(id))[0]!.fluid));
    expect(fluids.size).toBeGreaterThan(1);
  });
});

describe("the §4 invariants hold whatever the ratio", () => {
  const spec = specFor("kinetic-bold");
  const withRatio = (scaleRatio: number): DesignSpec => ({
    ...spec,
    type: { ...spec.type, scaleRatio },
  });

  /** The measured corpus spread, which is what a direction may legally ask for. */
  it.each([2.9, 3.5, 4.2, 5, 6, 7, 7.8])("ratio %s produces a legal scale", (r) => {
    const problems = scaleViolations(buildScale(withRatio(r)));
    expect(problems, problems.join("; ")).toEqual([]);
  });

  it("keeps a vmin term on t-display so the hero fits a 900px viewport", () => {
    expect(buildScale(withRatio(7.8))[0]!.fluid).toContain("vmin");
  });

  it("never tracks uppercase above the ceiling", () => {
    for (const id of DIRECTION_IDS) {
      for (const step of buildScale(specFor(id))) {
        if (!step.uppercase) continue;
        expect(step.tracking, `${id} .${step.name}`).toBeLessThanOrEqual(
          MAX_UPPERCASE_TRACKING,
        );
      }
    }
  });

  it("keeps t-h2-col free of a viewport-growing cap", () => {
    for (const id of DIRECTION_IDS) {
      const col = buildScale(specFor(id)).find((s) => s.name === "t-h2-col")!;
      expect(col.maxRem, id).toBeLessThanOrEqual(5);
    }
  });

  it("rejects a scale that would flatten the page", () => {
    // Ratio 1.5 is below anything a direction may declare; the guard is what
    // stops a future sampler bug from shipping a flat page silently.
    const problems = scaleViolations(buildScale(withRatio(1.5)));
    expect(problems.join(" ")).toContain("flattens");
  });

  it("throws rather than writing a stylesheet that breaks the rules", () => {
    expect(() => renderSpecTokens(withRatio(1.5))).toThrow(/design-rules.md §4/);
  });
});

/**
 * The image-frame tokens an archetype reads instead of branching on the
 * frame's name.
 *
 * Worth testing directly: all four directions in the catalog list `bleed` or
 * `inset` first, so the library — which samples option `[0]` — renders the
 * same frame for every one of them. The tokens vary; the sample does not.
 * Without this, "the frame never changes in /library" would look like a bug
 * in the archetype rather than a property of the fixture.
 */
describe("image frame", () => {
  const base = specFor("kinetic-bold");
  const framed = (imageFrame: DesignSpec["shape"]["imageFrame"]): string =>
    renderSpecTokens({ ...base, shape: { ...base.shape, imageFrame } });

  it("gives every frame a distinct aspect or radius", () => {
    const rendered = (["bleed", "inset", "masked", "collage"] as const).map(framed);
    expect(new Set(rendered).size).toBe(4);
  });

  it("makes masked a tall window rather than a wide one", () => {
    expect(framed("masked")).toContain("--image-aspect: 3 / 4");
    expect(framed("bleed")).toContain("--image-aspect: 4 / 3");
  });

  it("leaves a bleed frame square-cornered whatever the radius", () => {
    expect(framed("bleed")).toContain("--image-radius: 0px");
    expect(framed("inset")).toContain("--image-radius: var(--radius)");
  });

  it("insets only the frames that sit inside the measure", () => {
    expect(framed("bleed")).toContain("--image-inset: 0rem");
    expect(framed("inset")).toContain("--image-inset: 1.5rem");
  });
});

describe("colour", () => {
  it("inverts the ramp for a dark direction rather than re-pointing it", () => {
    const css = renderSpecTokens(specFor("quiet-luxury"));
    // paper-50 is the lightest step on a light page and the darkest on a dark one.
    const paper50 = /--paper-50: oklch\(([\d.]+)/.exec(css)?.[1];
    expect(Number(paper50)).toBeLessThan(0.5);
  });

  it("gives a photo-led direction no chromatic accent", () => {
    expect(renderSpecTokens(specFor("quiet-luxury"))).toContain(
      "--brand-accent: var(--ink-700)",
    );
  });

  it("gives an accent-block direction a real accent", () => {
    expect(renderSpecTokens(specFor("swiss-grid"))).toMatch(
      /--brand-accent: oklch\([\d.]+ var\(--brand-c\)/,
    );
  });
});
