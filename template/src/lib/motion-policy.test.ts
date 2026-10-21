import { describe, expect, it } from "vitest";

import {
  usesHeroEntrance,
  usesScrollChoreography,
  usesSmoothScroll,
} from "./motion-policy.js";
import { siteConfigSchema, type SiteConfig } from "./schema.js";
import { calmConfig } from "../../fixtures/calm.config.js";
import { siteConfig } from "../../site.config.js";

const withMotion = (motion: SiteConfig["motion"]): SiteConfig =>
  siteConfigSchema.parse({ ...calmConfig, motion } as never);

describe("motion policy", () => {
  it("the calm fixture asks for no smooth scroll and no entrance", () => {
    expect(usesSmoothScroll(calmConfig)).toBe(false);
    expect(usesHeroEntrance(calmConfig)).toBe(false);
    expect(usesScrollChoreography(calmConfig)).toBe(false);
  });

  it("the reference config is kinetic and asks for all three", () => {
    expect(usesSmoothScroll(siteConfig)).toBe(true);
    expect(usesHeroEntrance(siteConfig)).toBe(true);
    expect(usesScrollChoreography(siteConfig)).toBe(true);
  });

  it("still is quieter than calm but neither choreographs", () => {
    for (const profile of ["still", "calm"] as const) {
      const c = withMotion({ profile, heroEntrance: false, smoothScroll: false });
      expect(usesScrollChoreography(c), profile).toBe(false);
    }
  });

  it("editorial choreographs without necessarily entering", () => {
    const c = withMotion({
      profile: "editorial",
      heroEntrance: false,
      smoothScroll: true,
    });
    expect(usesScrollChoreography(c)).toBe(true);
    expect(usesHeroEntrance(c)).toBe(false);
  });

  /**
   * The flags are independent on purpose. A direction may want smooth scroll
   * with no entrance (editorial-serif does), and conflating them is how a
   * single `motion: "calm"` string would quietly decide three things.
   */
  it("treats the three as independent", () => {
    const c = withMotion({ profile: "calm", heroEntrance: false, smoothScroll: true });
    expect(usesSmoothScroll(c)).toBe(true);
    expect(usesHeroEntrance(c)).toBe(false);
  });
});

describe("the config schema carries motion", () => {
  it("defaults a pre-D10 config to the kinetic language it was built in", () => {
    const { motion: _dropped, ...withoutMotion } = calmConfig as SiteConfig & {
      motion: unknown;
    };
    const parsed = siteConfigSchema.parse(withoutMotion as never);
    expect(parsed.motion).toEqual({
      profile: "kinetic",
      heroEntrance: true,
      smoothScroll: true,
    });
  });

  it("rejects a profile outside the four", () => {
    const r = siteConfigSchema.safeParse({
      ...calmConfig,
      motion: { profile: "energetic", heroEntrance: false, smoothScroll: false },
    } as never);
    expect(r.success).toBe(false);
  });
});
