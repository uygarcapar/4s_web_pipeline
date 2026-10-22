import { describe, expect, it } from "vitest";

import { hoursSummary } from "./hours-summary.js";
import type { SiteConfig } from "./schema.js";
import { calmConfig } from "../../fixtures/calm.config.js";
import { siteConfig } from "../../site.config.js";

const withHours = (
  openingHours: SiteConfig["openingHours"],
  hoursNote: string | null = null,
): SiteConfig => ({ ...siteConfig, openingHours, hoursNote });

const day = (d: number, opens = "09:00", closes = "19:00") => ({
  day: d,
  opens,
  closes,
});

describe("hoursSummary", () => {
  it("collapses consecutive days that share a range", () => {
    const c = withHours([day(1), day(2), day(3), day(4), day(5)]);
    expect(hoursSummary(c)).toBe("Pazartesi–Cuma 09:00–19:00");
  });

  it("keeps a differing day as its own run", () => {
    const c = withHours([day(1), day(2), day(6, "10:00", "16:00")]);
    expect(hoursSummary(c)).toBe("Pazartesi–Salı 09:00–19:00 · Cumartesi 10:00–16:00");
  });

  it("names a single day without a range dash", () => {
    expect(hoursSummary(withHours([day(7, "11:00", "15:00")]))).toBe(
      "Pazar 11:00–15:00",
    );
  });

  /** D8: a closed day is published as null/null and is simply absent. */
  it("ignores days the business publishes as closed", () => {
    const c = withHours([day(1), { day: 7, opens: null, closes: null }]);
    expect(hoursSummary(c)).toBe("Pazartesi 09:00–19:00");
  });

  it("prefers the verbatim note when the business publishes one", () => {
    const c = withHours([day(1)], "Her gün 10.00-19.30");
    expect(hoursSummary(c)).toBe("Her gün 10.00-19.30");
  });

  /** A site with no published hours shows none, never an invented default. */
  it("returns null when the business publishes nothing", () => {
    expect(hoursSummary(withHours([], null))).toBeNull();
  });

  it("stops at two runs — beyond that the hours section is the right place", () => {
    const c = withHours([
      day(1),
      day(2, "10:00", "18:00"),
      day(3, "11:00", "17:00"),
      day(4, "12:00", "16:00"),
    ]);
    expect(hoursSummary(c)?.split("·")).toHaveLength(2);
  });

  it("reads both committed fixtures", () => {
    // The reference publishes day-mapped hours; the calm fixture a note.
    expect(hoursSummary(siteConfig)).toMatch(/Pazartesi/);
    expect(hoursSummary(calmConfig)).toBe("Her gün 10.00-19.30");
  });
});
