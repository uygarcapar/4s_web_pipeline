import { describe, expect, it } from "vitest";
import { openStore } from "@pipeline/core";

import { cosine, EMBEDDING_DIMS, normalise, packVector, unpackVector } from "./embed.js";
import {
  clearVectors,
  nearestNeighbour,
  recentVectors,
  recordVector,
  SIMILARITY_THRESHOLD,
  visualRejection,
  type StoredVector,
} from "./visual.js";

/** A deterministic unit vector, so similarities are predictable. */
function vector(seed: number): Float32Array {
  const v = new Float32Array(EMBEDDING_DIMS);
  for (let i = 0; i < EMBEDDING_DIMS; i += 1) {
    v[i] = Math.sin((i + 1) * seed * 0.37);
  }
  return normalise(v);
}

/** `base` rotated slightly toward `other` — similarity falls as t rises. */
function blend(base: Float32Array, other: Float32Array, t: number): Float32Array {
  const v = new Float32Array(base.length);
  for (let i = 0; i < base.length; i += 1) v[i] = base[i]! * (1 - t) + other[i]! * t;
  return normalise(v);
}

const stored = (domain: string, embedding: Float32Array): StoredVector => ({
  domain,
  seed: `${domain}-0`,
  fold: "desktop",
  embedding,
});

describe("cosine", () => {
  it("is 1 for a vector against itself", () => {
    expect(cosine(vector(1), vector(1))).toBeCloseTo(1, 5);
  });

  it("falls as two vectors diverge", () => {
    const a = vector(1);
    const b = vector(2);
    expect(cosine(a, blend(a, b, 0.1))).toBeGreaterThan(cosine(a, blend(a, b, 0.5)));
  });

  it("refuses to compare different dimensions", () => {
    expect(() => cosine(new Float32Array(4), new Float32Array(8))).toThrow(/4-dim/);
  });
});

describe("vector packing", () => {
  it("round-trips through a blob", () => {
    const v = vector(3);
    const back = unpackVector(packVector(v));
    expect(back.length).toBe(v.length);
    expect(cosine(v, back)).toBeCloseTo(1, 6);
  });

  /**
   * better-sqlite3 hands back buffers that may sit at a non-zero offset in a
   * pooled allocation, and a Float32Array view over an unaligned offset
   * throws. The copy in `unpackVector` is what prevents that; this is the
   * shape that would have caught its absence.
   */
  it("survives a buffer at a non-zero offset", () => {
    const v = vector(4);
    const packed = packVector(v);
    const padded = Buffer.alloc(packed.length + 3);
    packed.copy(padded, 3);
    expect(cosine(unpackVector(padded.subarray(3)), v)).toBeCloseTo(1, 6);
  });
});

describe("visualRejection", () => {
  const a = vector(1);

  it("passes a candidate with no neighbours", () => {
    expect(
      visualRejection({ desktop: a, mobile: a }, { desktop: [], mobile: [] }),
    ).toBeNull();
  });

  it("rejects a candidate identical to a shipped site", () => {
    const result = visualRejection(
      { desktop: a, mobile: a },
      { desktop: [stored("other.com", a)], mobile: [] },
    );
    expect(result?.domain).toBe("other.com");
    expect(result?.fold).toBe("desktop");
    expect(result?.similarity).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
  });

  it("passes a candidate that only resembles it a little", () => {
    const far = blend(a, vector(2), 0.6);
    expect(
      visualRejection({ desktop: far, mobile: far }, { desktop: [stored("other.com", a)], mobile: [] }),
    ).toBeNull();
  });

  /**
   * Either fold rejects. Several archetypes collapse to one column under
   * `sm`, so a site that repeats only on a phone is still a repeat — and
   * most of these clients' visitors are on a phone.
   */
  it("rejects on the mobile fold alone", () => {
    const differentDesktop = blend(a, vector(2), 0.6);
    const result = visualRejection(
      { desktop: differentDesktop, mobile: a },
      { desktop: [stored("other.com", a)], mobile: [stored("other.com", a)] },
    );
    expect(result?.fold).toBe("mobile");
  });

  /** §8.3 calibrates against this number, so it has to be the nearest one. */
  it("reports the closest match, not the first", () => {
    const near = blend(a, vector(2), 0.02);
    const result = visualRejection(
      { desktop: a, mobile: a },
      {
        desktop: [stored("far.com", near), stored("exact.com", a)],
        mobile: [],
      },
    );
    expect(result?.domain).toBe("exact.com");
  });

  it("honours a threshold the caller passes", () => {
    const near = blend(a, vector(2), 0.3);
    expect(
      visualRejection({ desktop: near, mobile: near }, { desktop: [stored("o.com", a)], mobile: [] }),
    ).toBeNull();
    expect(
      visualRejection(
        { desktop: near, mobile: near },
        { desktop: [stored("o.com", a)], mobile: [] },
        0.5,
      ),
    ).not.toBeNull();
  });
});

describe("nearestNeighbour", () => {
  it("reports the closest site even when nothing is rejected", () => {
    const a = vector(1);
    const far = blend(a, vector(2), 0.8);
    const near = nearestNeighbour(
      { desktop: far, mobile: far },
      { desktop: [stored("other.com", a)], mobile: [] },
    );
    expect(near?.domain).toBe("other.com");
    expect(near?.similarity).toBeLessThan(SIMILARITY_THRESHOLD);
  });
});

describe("the vector ledger", () => {
  it("round-trips a stored vector", () => {
    const store = openStore({ memory: true });
    const v = vector(5);
    recordVector(store, {
      domain: "a.com",
      stage: "final",
      fold: "desktop",
      seed: "a.com-0",
      embedding: v,
    });

    const [row] = recentVectors(store, { fold: "desktop" });
    expect(row?.domain).toBe("a.com");
    expect(cosine(row!.embedding, v)).toBeCloseTo(1, 5);
  });

  /**
   * §8.2 is explicit: the post-verify vector is what later runs compare
   * against. A candidate vector belongs to a page that may never have
   * shipped, and gating against the pipeline's own rejected proposals would
   * narrow the space for nothing.
   */
  it("compares against shipped sites only, never candidates", () => {
    const store = openStore({ memory: true });
    recordVector(store, {
      domain: "a.com",
      stage: "candidate",
      fold: "desktop",
      seed: "a.com-0",
      embedding: vector(6),
    });
    expect(recentVectors(store, { fold: "desktop" })).toEqual([]);
  });

  it("does not measure a client against itself", () => {
    const store = openStore({ memory: true });
    recordVector(store, {
      domain: "a.com",
      stage: "final",
      fold: "desktop",
      seed: "a.com-0",
      embedding: vector(7),
    });
    expect(recentVectors(store, { fold: "desktop", excludeDomain: "a.com" })).toEqual([]);
  });

  it("keeps the folds apart", () => {
    const store = openStore({ memory: true });
    recordVector(store, {
      domain: "a.com",
      stage: "final",
      fold: "mobile",
      seed: "a.com-0",
      embedding: vector(8),
    });
    expect(recentVectors(store, { fold: "desktop" })).toEqual([]);
    expect(recentVectors(store, { fold: "mobile" })).toHaveLength(1);
  });

  /**
   * Two models produce two incomparable spaces, and comparing across them
   * returns a confident number about nothing.
   */
  it("ignores vectors from another model", () => {
    const store = openStore({ memory: true });
    recordVector(store, {
      domain: "a.com",
      stage: "final",
      fold: "desktop",
      seed: "a.com-0",
      embedding: vector(9),
    });
    store.$client.prepare("UPDATE vectors SET model = ?").run("some/other-model");
    expect(recentVectors(store, { fold: "desktop" })).toEqual([]);
  });

  it("lets a re-run supersede its own vector", () => {
    const store = openStore({ memory: true });
    for (const seed of [10, 11]) {
      clearVectors(store, { domain: "a.com", stage: "final" });
      recordVector(store, {
        domain: "a.com",
        stage: "final",
        fold: "desktop",
        seed: `a.com-${seed}`,
        embedding: vector(seed),
      });
    }
    expect(recentVectors(store, { fold: "desktop" })).toHaveLength(1);
  });
});
