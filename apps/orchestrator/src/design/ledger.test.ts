import { describe, expect, it } from "vitest";
import { openStore, type DesignSpec, type Store } from "@pipeline/core";

import { DIRECTIONS } from "./directions/index.js";
import { sampleSpec } from "./sample-spec.js";
import { recentArchetypes, recentDirectionUsage, recordSpec } from "./ledger.js";

/**
 * The rotation penalties' inputs (D10 §6.2, §6.4). Worth their own tests
 * because the two things most likely to be wrong about them are both
 * invisible at runtime: a window that silently never expires, and a count
 * scoped to one sector — which is the D6 behaviour §6.2 exists to replace.
 */

const palette = { name: "nötr", hue: 38 };

function specFor(id: string, seed: string, sections?: DesignSpec["sections"]): DesignSpec {
  const spec = sampleSpec(DIRECTIONS[id]!, seed, 0);
  return sections === undefined ? spec : { ...spec, sections };
}

function record(
  store: Store,
  domain: string,
  sector: string,
  id: string,
  sections?: DesignSpec["sections"],
): void {
  recordSpec(store, { domain, sector, spec: specFor(id, domain, sections), palette });
}

describe("recentDirectionUsage", () => {
  it("counts a direction once per run that used it", () => {
    const store = openStore({ memory: true });
    record(store, "a.com", "dentist", "kinetic-bold");
    record(store, "b.com", "dentist", "kinetic-bold");
    record(store, "c.com", "dentist", "swiss-grid");

    expect(recentDirectionUsage(store)).toEqual({
      "kinetic-bold": 2,
      "swiss-grid": 1,
    });
  });

  /** The whole point: D6's ledger was per-sector, §6.2's is not. */
  it("counts across sectors, not within one", () => {
    const store = openStore({ memory: true });
    record(store, "dentist.com", "dentist", "cinematic-calm");
    record(store, "barber.com", "barber", "cinematic-calm");

    expect(recentDirectionUsage(store)["cinematic-calm"]).toBe(2);
  });

  it("forgets a direction once it falls out of the window", () => {
    const store = openStore({ memory: true });
    record(store, "old.com", "dentist", "stark-display");

    const inside = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);
    const outside = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(recentDirectionUsage(store, inside)["stark-display"]).toBe(1);
    expect(recentDirectionUsage(store, outside)["stark-display"]).toBeUndefined();
  });

  it("does not double-count a client that is rebuilt", () => {
    const store = openStore({ memory: true });
    record(store, "a.com", "dentist", "swiss-grid");
    record(store, "a.com", "dentist", "swiss-grid");
    expect(recentDirectionUsage(store)["swiss-grid"]).toBe(1);
  });
});

describe("recentArchetypes", () => {
  const sections: DesignSpec["sections"] = [
    { type: "hero", archetype: "index" },
    { type: "services", archetype: "accordion" },
    { type: "contact", archetype: "default" },
  ];

  it("counts every type/archetype pair the recent runs shipped", () => {
    const store = openStore({ memory: true });
    record(store, "a.com", "dentist", "swiss-grid", sections);
    record(store, "b.com", "barber", "swiss-grid", sections);

    expect(recentArchetypes(store)).toEqual({
      "hero/index": 2,
      "services/accordion": 2,
      "contact/default": 2,
    });
  });

  it("only looks back `limit` runs", () => {
    const store = openStore({ memory: true });
    record(store, "old.com", "dentist", "swiss-grid", [
      { type: "hero", archetype: "offset-grid" },
      { type: "services", archetype: "index" },
      { type: "contact", archetype: "default" },
    ]);
    record(store, "new.com", "dentist", "swiss-grid", sections);

    const recent = recentArchetypes(store, 1);
    expect(recent["hero/index"]).toBe(1);
    expect(recent["hero/offset-grid"]).toBeUndefined();
  });

  /**
   * Rows written before C3 hold the DNA's own archetype shape — an object,
   * not an array. Skipping them costs one run's worth of rotation; guessing
   * at them would mean avoiding layouts nobody was served.
   */
  it("ignores rows written before the spec path", () => {
    const store = openStore({ memory: true });
    const spec = specFor("swiss-grid", "legacy.com", sections);
    recordSpec(store, { domain: "legacy.com", sector: "dentist", spec, palette });
    // Overwrite with the pre-C3 shape, as an old row would hold it.
    store.$client
      .prepare("UPDATE designs SET archetypes = ? WHERE domain = ?")
      .run(JSON.stringify({ hero: "photo-full" }), "legacy.com");

    expect(recentArchetypes(store)).toEqual({});
  });

  it("survives an unparseable row", () => {
    const store = openStore({ memory: true });
    record(store, "a.com", "dentist", "swiss-grid", sections);
    store.$client
      .prepare("UPDATE designs SET archetypes = ? WHERE domain = ?")
      .run("not json", "a.com");

    expect(() => recentArchetypes(store)).not.toThrow();
    expect(recentArchetypes(store)).toEqual({});
  });
});
