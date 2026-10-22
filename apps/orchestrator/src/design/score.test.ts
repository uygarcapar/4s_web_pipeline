import { describe, expect, it } from "vitest";

import { DIRECTIONS, DIRECTION_IDS } from "./directions/index.js";
import { photoQualityFrom, rankDirections, scoreDirection } from "./score.js";
import type { ScoringBrief } from "./score.js";

const ALL = DIRECTION_IDS.map((id) => DIRECTIONS[id]!);

const brief = (over: Partial<ScoringBrief> = {}): ScoringBrief => ({
  tone: "premium",
  tier: "premium",
  audience: "local-premium",
  contentVolume: "standard",
  photoProfile: { usableCount: 12, quality: "pro" },
  ...over,
});

describe("scoreDirection", () => {
  it("rewards a direction whose tone the brief matches", () => {
    const traditional = scoreDirection(
      DIRECTIONS["stark-display"]!,
      brief({ tone: "technical", contentVolume: "standard" }),
      0,
    );
    const playful = scoreDirection(
      DIRECTIONS["stark-display"]!,
      brief({ tone: "playful", contentVolume: "editorial" }),
      0,
    );
    expect(traditional.score).toBeGreaterThan(playful.score);
  });

  /**
   * The condition recorded against Q1: `cinematic-calm` is carried by
   * photographs, so a thin-imagery client must score away from it rather
   * than be built in it and repaired. Sharper than its predecessor's was,
   * because `quiet-luxury` declared `photo-led` and still rendered without
   * one — the failure the 2026-10-22 review surfaced.
   */
  it("scores cinematic-calm away from a client with no photographs", () => {
    const withPhotos = scoreDirection(
      DIRECTIONS["cinematic-calm"]!,
      brief({ photoProfile: { usableCount: 14, quality: "pro" } }),
      0,
    );
    const without = scoreDirection(
      DIRECTIONS["cinematic-calm"]!,
      brief({ photoProfile: { usableCount: 0, quality: "stock-heavy" } }),
      0,
    );
    expect(without.score).toBeLessThan(withPhotos.score);
    // Lower, not vetoed: what matters is that it stops winning.
    const ranked = rankDirections(
      ALL,
      brief({ photoProfile: { usableCount: 0, quality: "stock-heavy" } }),
      {},
    );
    expect(ranked[0]!.id).not.toBe("cinematic-calm");
  });

  it("penalises recent use", () => {
    const fresh = scoreDirection(DIRECTIONS["kinetic-bold"]!, brief(), 0);
    const used = scoreDirection(DIRECTIONS["kinetic-bold"]!, brief(), 2);
    expect(used.score).toBe(fresh.score - 4);
    expect(used.reason).toContain("used 2×");
  });

  it("explains itself", () => {
    const s = scoreDirection(DIRECTIONS["swiss-grid"]!, brief({ tone: "technical" }), 0);
    expect(s.reason).toContain("tone technical");
  });
});

describe("rankDirections", () => {
  it("puts a technical, text-heavy, photo-poor client on swiss-grid or stark-display", () => {
    const ranked = rankDirections(
      ALL,
      brief({
        tone: "technical",
        tier: "mid",
        contentVolume: "standard",
        photoProfile: { usableCount: 1, quality: "amateur" },
      }),
      {},
    );
    expect(["swiss-grid", "stark-display"]).toContain(ranked[0]!.id);
  });

  it("puts a premium client with real photographs on cinematic-calm", () => {
    const ranked = rankDirections(
      ALL,
      brief({ tone: "premium", tier: "premium", photoProfile: { usableCount: 18, quality: "pro" } }),
      {},
    );
    expect(ranked[0]!.id).toBe("cinematic-calm");
  });

  /** The point of the penalty: the same brief twice must not give the same site. */
  it("rotates away from a direction used twice", () => {
    const b = brief({ tone: "premium", photoProfile: { usableCount: 18, quality: "pro" } });
    const first = rankDirections(ALL, b, {})[0]!.id;
    const second = rankDirections(ALL, b, { [first]: 2 })[0]!.id;
    expect(second).not.toBe(first);
  });

  it("is deterministic, including ties", () => {
    const b = brief({ tone: "warm", tier: "budget" });
    expect(rankDirections(ALL, b, {}).map((r) => r.id)).toEqual(
      rankDirections(ALL, b, {}).map((r) => r.id),
    );
  });

  it("ranks every direction, never drops one", () => {
    expect(rankDirections(ALL, brief(), {})).toHaveLength(ALL.length);
  });
});

describe("photoQualityFrom", () => {
  it("calls a client with nothing of their own stock-heavy", () => {
    expect(photoQualityFrom(0, 0)).toBe("stock-heavy");
  });

  it("calls a handful of large images pro", () => {
    expect(photoQualityFrom(12, 6)).toBe("pro");
  });

  it("calls a couple of small ones amateur", () => {
    expect(photoQualityFrom(3, 1)).toBe("amateur");
  });
});
