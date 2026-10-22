/**
 * The seeded PRNG the whole design space is drawn with (D10 §6.3).
 *
 * Its own module because both `sample-spec.ts` and `compose.ts` draw from it
 * and `sample-spec.ts` calls `compose.ts` — keeping it in either would make
 * the two import each other.
 *
 * Reproducible is the whole requirement: same inputs, same site. That is
 * why this is not `Math.random`, and why nothing in the design stage may
 * reach for a clock.
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

/** Pick one of `options`, uniformly. */
export function pick<T>(rng: () => number, options: readonly T[]): T {
  if (options.length === 0) {
    throw new Error("cannot sample from an empty option list");
  }
  return options[Math.floor(rng() * options.length)]!;
}
