import type { DesignSpec, Direction } from "@pipeline/core";

import { composeArchetypes } from "./compose.js";
import { hashSeed, mulberry32, pick } from "./rng.js";

// Re-exported: the sampler is where callers expect to find the seeded
// draw, and moving the PRNG out was a cycle fix, not an API change.
export { hashSeed, mulberry32 } from "./rng.js";

/**
 * Deterministic sampling of a `DesignSpec` from a `Direction` (D10 §6.3).
 *
 * `mulberry32` seeded from the client and a candidate index, so the same
 * inputs always produce the same spec — §6.3's "reproducible" is the whole
 * reason the sampler is not `Math.random`. The real selection pipeline (C2)
 * draws several candidates per direction and scores them; this is the draw
 * itself, extracted so the library can show a direction's **range** rather
 * than one corner of it.
 *
 * Why that matters now: before this, `/library` rendered option `[0]` of
 * every axis, so radius, image frame, colour mode and type pairing never
 * varied within a direction and an operator approving an archetype was
 * seeing roughly a quarter of what the direction can actually produce.
 */

/** Midpoint-biased pick from an inclusive numeric range. */
function inRange(rng: () => number, [min, max]: [number, number]): number {
  return Math.round((min + rng() * (max - min)) * 1000) / 1000;
}

/**
 * Settle `split` into the polarity the direction actually declares.
 *
 * `split` names a page that is part dark and part light, and the half of
 * that which exists today is the page's own polarity. The token generator
 * only knows `mode`, so a spec left saying `split` was rendered as light —
 * which for `quiet-luxury`, whose `paperLightness` is [0.12, 0.28], meant a
 * near-black direction producing a white page.
 *
 * The answer comes from `color.paperLightness`, which the catalog has
 * declared since A3 and nothing read: below 0.5 the page is dark, above it
 * light. Resolved here rather than in `spec-tokens.ts` because it is a fact
 * about the direction, and the spec is supposed to be self-contained (§5).
 *
 * What remains unbuilt is the per-section half — a dark hero above a light
 * body. That needs a section-level token and belongs with the signature
 * work (§9), so `split` currently differs from `light`/`dark` only in that
 * the polarity is the direction's to state rather than the sampler's to draw.
 */
function resolveMode(
  mode: Direction["color"]["modes"][number],
  direction: Direction,
): DesignSpec["color"]["mode"] {
  if (mode !== "split") return mode;
  const [min, max] = direction.color.paperLightness;
  return (min + max) / 2 < 0.5 ? "dark" : "light";
}

/**
 * Draw candidate `index` for `seedBase` from `direction`.
 *
 * `sections` and `signature` are left to the compose stage (§6.4) — they
 * come from the brief, not from the direction — so a sampled spec carries a
 * minimal valid section list and the caller replaces it.
 */
export function sampleSpec(
  direction: Direction,
  seedBase: string,
  index: number,
): DesignSpec {
  const seed = `${seedBase}-${index}`;
  const rng = mulberry32(hashSeed(seed));

  const pair = pick(rng, direction.type.pairs);
  const mono = direction.type.mono.length === 0 ? undefined : pick(rng, direction.type.mono);

  return {
    version: 2,
    direction: direction.id,
    seed,
    type: {
      display: pair.display,
      body: pair.body,
      ...(mono === undefined ? {} : { mono }),
      displayWeight: pick(rng, direction.type.displayWeights),
      displayTracking: inRange(rng, direction.type.displayTracking),
      scaleRatio: inRange(rng, direction.type.scaleRatio),
      displayCase: pick(rng, direction.type.displayCase),
    },
    color: {
      mode: resolveMode(pick(rng, direction.color.modes), direction),
      strategy: pick(rng, direction.color.strategies),
      // Hue is the client's, not the direction's (§13 Q3: soft, hue only).
      // The library passes one in; a run takes it from the photographs.
      brandH: Math.round(rng() * 360),
      brandC: Math.round(rng() * direction.color.maxChroma * 1000) / 1000,
    },
    shape: {
      radius: pick(rng, direction.shape.radius),
      rules: pick(rng, direction.shape.rules),
      imageFrame: pick(rng, direction.shape.imageFrame),
    },
    grid: {
      alignment: pick(rng, direction.grid.alignment),
      density: pick(rng, direction.grid.density),
    },
    motion: {
      profile: pick(rng, direction.motion.profiles),
      signatures: [...direction.motion.required],
      heroEntrance: direction.motion.heroEntrance,
      smoothScroll: direction.motion.smoothScroll,
    },
    // A placeholder the compose step replaces (§6.4): a sampled spec has
    // to satisfy the schema's three-section minimum, but which sections a
    // client gets is a function of which facts exist, not of the
    // direction. `recentUsage` is empty for the same reason — rotation is
    // a property of a run, and this draw is not one.
    sections: composeArchetypes({
      direction,
      sections: ["hero", "services", "contact"],
      seed,
      recentUsage: {},
    }).map(({ type, archetype }) => ({ type, archetype })),
    signature: { sectionIndex: 0, concept: "sampled" },
    rejected: [],
  };
}
