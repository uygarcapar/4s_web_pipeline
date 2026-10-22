import { describe, expect, it } from "vitest";

import { sectionRegistry } from "./registry.js";
import {
  closingSectionSchema,
  marqueeSectionSchema,
  sectionSchema,
  type SectionType,
} from "@/lib/schema";
import { calmConfig } from "../../fixtures/calm.config.js";
import { siteConfig } from "../../site.config.js";

/**
 * D10 §7.1 targets 45 archetypes across eleven section types. B3's job was
 * the section types that did not exist at all — `closing` and `marquee`;
 * `statement` and `visit` were already built. This pins what exists so the
 * count in `/library` and the count here cannot drift apart.
 */
const EXPECTED_TYPES: SectionType[] = [
  "hero",
  "statement",
  "visit",
  "closing",
  "marquee",
  "process",
  "services",
  "team",
  "gallery",
  "testimonials",
  "faq",
  "contact",
  "map",
  "hours",
];

describe("section registry", () => {
  it("registers a component for every section type the schema allows", () => {
    expect(Object.keys(sectionRegistry).sort()).toEqual([...EXPECTED_TYPES].sort());
  });

  it("has the two types B3 added", () => {
    expect(sectionRegistry.closing).toBeDefined();
    expect(sectionRegistry.marquee).toBeDefined();
  });
});

describe("closing", () => {
  const valid = {
    type: "closing" as const,
    id: "closing",
    variant: "statement-cta" as const,
    headline: "Randevunuzu bugün alın",
    ctaPrimary: { label: "Hemen Ara", action: "tel" as const },
  };

  it("parses", () => {
    expect(closingSectionSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a call to action — the whole point of the section", () => {
    const { ctaPrimary: _omitted, ...withoutCta } = valid;
    expect(closingSectionSchema.safeParse(withoutCta).success).toBe(false);
  });

  it("rejects an unknown key rather than dropping it", () => {
    expect(closingSectionSchema.safeParse({ ...valid, image: {} }).success).toBe(false);
  });
});

describe("marquee", () => {
  const valid = {
    type: "marquee" as const,
    id: "marquee",
    variant: "ticker" as const,
    items: ["Cilt Bakımı", "Lazer Epilasyon", "Bölgesel İncelme"],
  };

  it("parses", () => {
    expect(marqueeSectionSchema.safeParse(valid).success).toBe(true);
  });

  /**
   * Fewer than three reads as a slogan, and a slogan repeated across a band
   * is generic cluster 5 — decoration with nothing behind it.
   */
  it("rejects fewer than three items", () => {
    expect(
      marqueeSectionSchema.safeParse({ ...valid, items: valid.items.slice(0, 2) }).success,
    ).toBe(false);
  });

  it("rejects an empty item", () => {
    expect(marqueeSectionSchema.safeParse({ ...valid, items: ["a", "b", ""] }).success).toBe(
      false,
    );
  });
});

describe("both fixtures exercise the new sections", () => {
  it.each([
    ["reference", siteConfig],
    ["calm", calmConfig],
  ])("%s has a closing and a marquee", (_label, config) => {
    const types = config.sections.map((s) => s.type);
    expect(types).toContain("closing");
    expect(types).toContain("marquee");
  });

  it("every section in both fixtures is a valid section", () => {
    for (const config of [siteConfig, calmConfig]) {
      for (const section of config.sections) {
        const r = sectionSchema.safeParse(section);
        expect(r.success, `${section.type}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
      }
    }
  });

  /**
   * The marquee only moves under `editorial` and `kinetic` (§7.2: an
   * archetype declares which profiles it supports). The calm fixture is the
   * case that must render it as a static row, and it is in that fixture
   * precisely so the quiet branch is exercised rather than assumed.
   */
  it("the calm fixture is a profile where the marquee must not move", () => {
    expect(calmConfig.motion.profile).toBe("calm");
  });
});
