import { describe, expect, it } from "vitest";

import { composeArchetypes, fingerprintSpec } from "./compose.js";
import { DIRECTIONS, DIRECTION_IDS } from "./directions/index.js";
import { sampleSpec } from "./sample-spec.js";

const SECTIONS = ["hero", "services", "team", "gallery", "faq", "contact"];

const compose = (
  id: string,
  seed: string,
  recentUsage: Record<string, number> = {},
): ReturnType<typeof composeArchetypes> =>
  composeArchetypes({ direction: DIRECTIONS[id]!, sections: SECTIONS, seed, recentUsage });

describe("composeArchetypes", () => {
  it("only ever picks from the direction's own shortlist", () => {
    for (const id of DIRECTION_IDS) {
      for (const { type, archetype } of compose(id, `seed-${id}`)) {
        const allowed = DIRECTIONS[id]!.archetypes[type] ?? ["default"];
        expect(allowed, `${id} ${type} got ${archetype}`).toContain(archetype);
      }
    }
  });

  it("is deterministic for the same client", () => {
    expect(compose("swiss-grid", "acme.com")).toEqual(compose("swiss-grid", "acme.com"));
  });

  /** §6.4: prefer archetypes the last N runs did not use. */
  it("avoids an archetype a recent run already used", () => {
    const first = compose("swiss-grid", "acme.com");
    const hero = first.find((c) => c.type === "hero")!.archetype;

    const second = compose("swiss-grid", "acme.com", { [`hero/${hero}`]: 1 });
    expect(second.find((c) => c.type === "hero")!.archetype).not.toBe(hero);
    expect(second.find((c) => c.type === "hero")!.recycled).toBe(false);
  });

  /**
   * The preference is not a constraint: a direction offering one layout for
   * a section must still produce that section.
   */
  it("falls back to the seeded draw when every option is used", () => {
    const direction = DIRECTIONS["swiss-grid"]!;
    const used: Record<string, number> = {};
    for (const [type, options] of Object.entries(direction.archetypes)) {
      for (const option of options) used[`${type}/${option}`] = 3;
    }

    const composed = compose("swiss-grid", "acme.com", used);
    expect(composed).toHaveLength(SECTIONS.length);
    for (const choice of composed) {
      expect(choice.archetype.length).toBeGreaterThan(0);
      // `contact` has one layout and never counts as recycled: the direction
      // lists it, the registry renders it, there is nothing to rotate.
      if (choice.type !== "contact") expect(choice.recycled).toBe(true);
    }
    // Same answer as with no history — the draw stands, it does not degrade.
    expect(composed.map((c) => c.archetype)).toEqual(
      compose("swiss-grid", "acme.com").map((c) => c.archetype),
    );
  });

  /**
   * The failure the rotation rule could easily introduce: scanning from
   * index 0 for the first unused option would hand every client with a
   * fresh catalog the same layout, which is less variety than no rule.
   */
  it("does not collapse every client onto option [0]", () => {
    const heroes = new Set(
      ["a.com", "b.com", "c.com", "d.com", "e.com", "f.com"].map(
        (domain) => compose("kinetic-bold", domain).find((c) => c.type === "hero")!.archetype,
      ),
    );
    expect(heroes.size).toBeGreaterThan(1);
  });

  it("gives a section type the direction does not list the registry default", () => {
    const direction = {
      ...DIRECTIONS["swiss-grid"]!,
      archetypes: { hero: ["index"] },
    };
    const composed = composeArchetypes({
      direction,
      sections: ["hero", "process"],
      seed: "acme.com",
      recentUsage: {},
    });
    expect(composed.find((c) => c.type === "process")!.archetype).toBe("default");
  });
});

describe("fingerprintSpec", () => {
  const base = sampleSpec(DIRECTIONS["swiss-grid"]!, "acme.com", 0);

  it("is stable for the same spec", () => {
    expect(fingerprintSpec(base)).toBe(fingerprintSpec(base));
  });

  it("does not depend on section order", () => {
    const reordered = { ...base, sections: [...base.sections].reverse() };
    expect(fingerprintSpec(reordered)).toBe(fingerprintSpec(base));
  });

  it.each([
    ["direction", { direction: "editorial-serif" }],
    ["type pairing", { type: { ...base.type, display: "Anton" } }],
    ["colour mode", { color: { ...base.color, mode: "dark" as const } }],
    ["density", { grid: { ...base.grid, density: "poster" as const } }],
    ["motion profile", { motion: { ...base.motion, profile: "kinetic" as const } }],
  ])("changes when the %s changes", (_label, patch) => {
    expect(fingerprintSpec({ ...base, ...patch })).not.toBe(fingerprintSpec(base));
  });

  it("changes when an archetype changes", () => {
    const swapped = {
      ...base,
      sections: base.sections.map((s, i) =>
        i === 0 ? { ...s, archetype: "offset-grid" } : s,
      ),
    };
    expect(fingerprintSpec(swapped)).not.toBe(fingerprintSpec(base));
  });

  /**
   * Coarse on purpose (design-rules.md §10.4): two sites a couple of degrees
   * apart are the same palette, and one of them has to change.
   */
  it("buckets hue, so a two-degree difference still collides", () => {
    const near = { ...base, color: { ...base.color, brandH: base.color.brandH + 1 } };
    const far = { ...base, color: { ...base.color, brandH: (base.color.brandH + 60) % 360 } };
    expect(fingerprintSpec(near)).toBe(fingerprintSpec(base));
    expect(fingerprintSpec(far)).not.toBe(fingerprintSpec(base));
  });

  it("ignores values a visitor cannot see", () => {
    // The seed and the rejection log are bookkeeping, not design.
    const noisy = {
      ...base,
      seed: "something-else",
      rejected: [{ direction: "kinetic-bold", reason: "lost", distance: 3 }],
    };
    expect(fingerprintSpec(noisy)).toBe(fingerprintSpec(base));
  });
});
