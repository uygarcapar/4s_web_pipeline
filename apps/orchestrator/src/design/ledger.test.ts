import { describe, expect, it } from "vitest";
import { openStore, type Store } from "@pipeline/core";

import { composeDna } from "./dna.js";
import { derivePalette } from "./palette.js";
import { recentDirectionUsage, recordDesign } from "./ledger.js";

/**
 * The rotation penalty's input (D10 §6.2). Worth its own tests because the
 * two things most likely to be wrong about it are both invisible at runtime:
 * a window that silently never expires, and a count scoped to one sector —
 * which is the D6 behaviour §6.2 exists to replace.
 */

const palette = derivePalette([]);

function dnaFor(domain: string) {
  return composeDna({
    domain,
    sector: "dentist",
    palette,
    contentBlocks: 200,
    sections: ["hero", "services", "contact"],
    recent: [],
  });
}

function record(store: Store, domain: string, sector: string, direction: string): void {
  recordDesign(store, { domain, sector, dna: dnaFor(domain), direction });
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
    record(store, "dentist.com", "dentist", "quiet-luxury");
    record(store, "barber.com", "barber", "quiet-luxury");

    expect(recentDirectionUsage(store)["quiet-luxury"]).toBe(2);
  });

  it("forgets a direction once it falls out of the window", () => {
    const store = openStore({ memory: true });
    record(store, "old.com", "dentist", "editorial-serif");

    const inside = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);
    const outside = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(recentDirectionUsage(store, inside)["editorial-serif"]).toBe(1);
    expect(recentDirectionUsage(store, outside)["editorial-serif"]).toBeUndefined();
  });

  /**
   * Rows written before the design space existed have a null direction.
   * Counting them under any name would skew the penalty against whichever
   * direction we guessed, which is why the column is nullable.
   */
  it("ignores rows from before D10", () => {
    const store = openStore({ memory: true });
    recordDesign(store, { domain: "legacy.com", sector: "dentist", dna: dnaFor("legacy.com") });
    expect(recentDirectionUsage(store)).toEqual({});
  });

  it("does not double-count a client that is rebuilt", () => {
    const store = openStore({ memory: true });
    record(store, "a.com", "dentist", "swiss-grid");
    record(store, "a.com", "dentist", "swiss-grid");
    expect(recentDirectionUsage(store)["swiss-grid"]).toBe(1);
  });
});
