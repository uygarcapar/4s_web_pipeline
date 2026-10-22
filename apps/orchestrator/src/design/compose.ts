import { createHash } from "node:crypto";
import type { DesignSpec, Direction } from "@pipeline/core";

import { hashSeed, mulberry32 } from "./rng.js";

/**
 * `compose` — the archetype per section, and the fingerprint of the result
 * (D10 §6.4).
 *
 * Which sections exist is still a function of which facts exist (D6,
 * `sectionsFromFacts`). What §6.4 adds is the second half: *which layout*
 * each section gets, "preferring archetypes not used by the last N runs".
 *
 * This replaces the D6 DNA's `chooseArchetypes`. The DNA picked from its own
 * table and re-rolled on a fingerprint collision; the spec picks from the
 * direction's shortlist, which is the point of having directions at all —
 * `cinematic-calm` must not be able to draw `services/index`, however novel
 * that would be for the ledger.
 */

/** How many recent runs count when avoiding a repeat. */
export const ARCHETYPE_WINDOW = 12;

export interface ArchetypeChoice {
  type: string;
  archetype: string;
  /** True when every option the direction offers was already in use. */
  recycled: boolean;
}

/**
 * Choose one archetype per section, preferring options the recent runs did
 * not use.
 *
 * The rule is a preference, not a constraint, and the fallback matters: a
 * direction that offers one layout for `statement` must still produce a
 * `statement`. When every option is already in play the seeded draw stands
 * and `recycled` says so, which is what the run log needs to distinguish
 * "the catalog is too small here" from "this client happened to match".
 *
 * Seeded per section type rather than once per site, so two clients on the
 * same direction differ section by section instead of sharing a whole page
 * whenever their seeds collide on the first draw.
 */
export function composeArchetypes(input: {
  direction: Direction;
  sections: readonly string[];
  /** Usually the domain — anything stable for this client. */
  seed: string;
  /** How many of the last N runs used each `type/archetype`. */
  recentUsage: Record<string, number>;
}): ArchetypeChoice[] {
  const { direction, sections, seed, recentUsage } = input;

  return sections.map((type) => {
    const options = direction.archetypes[type];
    if (options === undefined || options.length === 0) {
      // The template registry's own per-type fallback. Honest for `contact`,
      // which has one layout; `archetypes.test.ts` fails on anything else.
      return { type, archetype: "default", recycled: false };
    }

    const rng = mulberry32(hashSeed(`${seed}-${type}`));
    const draw = Math.floor(rng() * options.length);

    // Rotate from the drawn position rather than always scanning from 0:
    // scanning would hand every client with a fresh catalog the SAME first
    // unused option, which turns "prefer unused" into "always option [0]"
    // — a rotation rule that produces less variety than no rule at all.
    for (let i = 0; i < options.length; i += 1) {
      const option = options[(draw + i) % options.length]!;
      if ((recentUsage[`${type}/${option}`] ?? 0) === 0) {
        return { type, archetype: option, recycled: false };
      }
    }

    return { type, archetype: options[draw]!, recycled: true };
  });
}

/**
 * The fingerprint, now computed from the spec rather than a parallel DNA.
 *
 * D6 fingerprinted a `DesignDna` whose palette, type pairing, density and
 * motion all reached the page. After C3 none of them do — the spec decides
 * every one — so a fingerprint over the DNA would be hashing values no
 * visitor can see, and two sites could collide on it while looking entirely
 * different, or differ on it while looking identical. The ledger's guarantee
 * only means something if it fingerprints what ships.
 *
 * Deliberately coarse, as before (design-rules.md §10.4): it hashes the
 * decisions a visitor would actually notice, not every token, so two sites
 * that differ only in the third decimal of a scale ratio still collide and
 * one of them is forced to change.
 */
export function fingerprintSpec(spec: DesignSpec): string {
  const archetypes = [...spec.sections]
    .map((s) => `${s.type}:${s.archetype}`)
    .sort()
    .join(",");

  // 12° buckets: finer than a colour name, coarse enough that two sites a
  // couple of degrees apart count as the same palette and one must change.
  const hue = Math.round(spec.color.brandH / 12);

  const payload = [
    spec.direction,
    `${spec.type.display}/${spec.type.body}`,
    `${spec.color.mode}/${spec.color.strategy}/${hue}`,
    `${spec.grid.alignment}/${spec.grid.density}`,
    spec.motion.profile,
    archetypes,
  ].join("|");

  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}
