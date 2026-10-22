import type { DesignSpec, Direction } from "@pipeline/core";

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

/** Small, fast, well-distributed 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a over the seed string. Not a cryptographic hash and does not need to
 * be — it only has to spread adjacent seeds ("acme-0", "acme-1") into
 * unrelated streams, which a plain character sum would not.
 */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Midpoint-biased pick from an inclusive numeric range. */
function inRange(rng: () => number, [min, max]: [number, number]): number {
  return Math.round((min + rng() * (max - min)) * 1000) / 1000;
}

function pick<T>(rng: () => number, options: readonly T[]): T {
  if (options.length === 0) {
    throw new Error("cannot sample from an empty option list");
  }
  return options[Math.floor(rng() * options.length)]!;
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
      mode: pick(rng, direction.color.modes),
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
    sections: [
      { type: "hero", archetype: direction.archetypes.hero?.[0] ?? "photo-full" },
      { type: "services", archetype: direction.archetypes.services?.[0] ?? "list-rule" },
      { type: "contact", archetype: "split-form" },
    ],
    signature: { sectionIndex: 0, concept: "sampled" },
    rejected: [],
  };
}
