import { describe, expect, it } from "vitest";

import { DIRECTIONS, DIRECTION_IDS } from "./directions/index.js";
import { maxInternalDistance, THRESHOLDS } from "./distance.js";

/**
 * A direction that cannot put two clients far enough apart can serve
 * exactly one, ever — every subsequent client is rejected against the
 * first, and the catalog quietly shrinks by one.
 *
 * `swiss-grid` shipped like that and nothing failed. It was found by a
 * capacity probe during Phase E, which is the wrong way to find it: by then
 * it had been in the catalog through four merges.
 */
describe("every direction can serve more than one client", () => {
  it.each(DIRECTION_IDS)("%s clears the all-sectors threshold internally", (id) => {
    const { ceiling, frozen } = maxInternalDistance(DIRECTIONS[id]!);
    expect(
      ceiling,
      `${id} can never exceed ${ceiling} between two of its own draws ` +
        `(threshold ${THRESHOLDS.allSectors}); frozen axes: ${frozen.join(", ")}`,
    ).toBeGreaterThanOrEqual(THRESHOLDS.allSectors);
  });

  /**
   * Not a hard requirement, but a direction this tight is one axis away
   * from the failure above, and the warning is cheap.
   */
  it.each(DIRECTION_IDS)("%s has room above the threshold, not just room", (id) => {
    const { ceiling } = maxInternalDistance(DIRECTIONS[id]!);
    expect(ceiling).toBeGreaterThan(THRESHOLDS.allSectors + 0.05);
  });

  /** `direction` is shared by two draws by definition, so 1.0 is unreachable. */
  it("never reports a ceiling of 1", () => {
    for (const id of DIRECTION_IDS) {
      const { ceiling, frozen } = maxInternalDistance(DIRECTIONS[id]!);
      expect(ceiling).toBeLessThan(1);
      expect(frozen).toContain("direction");
    }
  });

  /**
   * `split` resolves to one polarity, so a direction declaring
   * `["light", "split"]` has ONE colour mode. Counting the literal array
   * would hide exactly the frozen axis this is looking for.
   */
  it("counts a split-only direction's colour mode as frozen", () => {
    const swiss = DIRECTIONS["swiss-grid"]!;
    expect(swiss.color.modes).toEqual(["light", "split"]);
    expect(maxInternalDistance(swiss).frozen).toContain("colorMode");
  });
});
