import { desc, eq, and } from "drizzle-orm";
import { vectors, type Store } from "@pipeline/core";

import { cosine, MODEL, packVector, unpackVector } from "./embed.js";

/**
 * The visual half of §8 — cosine similarity between candidate screenshots
 * and the sites that already shipped.
 *
 * Why it exists on top of §8.1's structural distance: two specs can
 * disagree on several declared axes and still produce pages that read as
 * the same site, because the axes are what we *chose to name* and a visitor
 * sees what is actually on the screen. The structural check is a cheap
 * filter over the decisions; this one is a check on the result.
 *
 * Runs before `generate`, so a rejection costs no model spend (§6.3's
 * budget table). A rejection moves to the next candidate and never into the
 * fix loop — a site that resembles another is not a broken site.
 */

/**
 * The similarity at which two sites count as the same site.
 *
 * **Not §8.2's 0.85.** That number predates any measurement of this
 * detector, and measuring it (docs/D10-visual-calibration.md) showed 0.85
 * would reject correct candidates: a loud light page and a near-black serif
 * one scored 0.91 on the mobile fold, while two draws of the *same*
 * direction with the same hero scored 0.93–0.97. At 0.85 the gate fires on
 * pages that look nothing alike, which is the broken detector
 * design-rules §12 is about.
 *
 * 0.93 is where eight candidates from one client separated. Three cautions,
 * all of which belong here and not only in that file: the margin is 0.02;
 * the measurement used identical copy and no photographs, which inflates
 * every pair; and **half the catalog it measured no longer exists** — the
 * 2026-10-22 review replaced two directions, so the matrix needs re-taking
 * before §8.3's thirty operator-labelled pairs settle this.
 */
export const SIMILARITY_THRESHOLD = 0.93;

/** How many recent runs a candidate is compared against. */
export const VISUAL_WINDOW = 40;

export type Fold = "desktop" | "mobile";
export type VectorStage = "candidate" | "final";

export interface StoredVector {
  domain: string;
  seed: string;
  fold: Fold;
  embedding: Float32Array;
}

export interface VisualRejection {
  domain: string;
  fold: Fold;
  similarity: number;
  reason: string;
}

/**
 * The vectors a candidate is measured against.
 *
 * `final` only, never `candidate`. §8.2 is explicit that the post-verify
 * vector "is what later runs compare against" — a candidate vector belongs
 * to a page that may never have shipped, and gating against proposals the
 * pipeline itself rejected would narrow the space for no reason.
 */
export function recentVectors(
  store: Store,
  input: { fold: Fold; limit?: number; excludeDomain?: string },
): StoredVector[] {
  const rows = store
    .select({
      domain: vectors.domain,
      seed: vectors.seed,
      fold: vectors.fold,
      model: vectors.model,
      embedding: vectors.embedding,
    })
    .from(vectors)
    .where(and(eq(vectors.stage, "final"), eq(vectors.fold, input.fold)))
    .orderBy(desc(vectors.createdAt), desc(vectors.id))
    .limit(input.limit ?? VISUAL_WINDOW)
    .all();

  return rows
    .filter((row) => row.domain !== input.excludeDomain)
    // Vectors from another model are not comparable. Dropping them is the
    // only safe answer: coercing would compare two different spaces and
    // return a confident number about nothing.
    .filter((row) => row.model === MODEL)
    .map((row) => ({
      domain: row.domain,
      seed: row.seed,
      fold: row.fold as Fold,
      embedding: unpackVector(row.embedding),
    }));
}

export function recordVector(
  store: Store,
  input: {
    domain: string;
    stage: VectorStage;
    fold: Fold;
    seed: string;
    embedding: Float32Array;
  },
): void {
  store
    .insert(vectors)
    .values({
      domain: input.domain,
      stage: input.stage,
      fold: input.fold,
      seed: input.seed,
      model: MODEL,
      embedding: packVector(input.embedding),
      createdAt: new Date().toISOString(),
    })
    .run();
}

/** Replace a domain's vectors for one stage — a re-run supersedes itself. */
export function clearVectors(
  store: Store,
  input: { domain: string; stage: VectorStage },
): void {
  store
    .delete(vectors)
    .where(and(eq(vectors.domain, input.domain), eq(vectors.stage, input.stage)))
    .run();
}

/**
 * Why this candidate looks too much like a recent site, or `null`.
 *
 * **Either fold rejects.** A desktop layout and a phone layout can diverge
 * sharply — several archetypes collapse to a single column under `sm` — so
 * a site that repeats only on mobile is still a repeat, and most of these
 * clients' visitors are on a phone.
 */
export function visualRejection(
  candidate: { desktop: Float32Array; mobile: Float32Array },
  neighbours: { desktop: StoredVector[]; mobile: StoredVector[] },
  threshold: number = SIMILARITY_THRESHOLD,
): VisualRejection | null {
  const folds: [Fold, Float32Array, StoredVector[]][] = [
    ["desktop", candidate.desktop, neighbours.desktop],
    ["mobile", candidate.mobile, neighbours.mobile],
  ];

  let worst: VisualRejection | null = null;
  for (const [fold, vector, others] of folds) {
    for (const other of others) {
      const similarity = cosine(vector, other.embedding);
      if (similarity < threshold) continue;
      if (worst === null || similarity > worst.similarity) {
        worst = {
          domain: other.domain,
          fold,
          similarity,
          reason:
            `${fold} fold is ${similarity} similar to ${other.domain} ` +
            `(threshold ${threshold})`,
        };
      }
    }
  }
  // The closest match rather than the first, unlike §8.1: this number is
  // what §8.3 calibrates against, so the log has to say how close the
  // nearest site actually was, not how close the first one checked was.
  return worst;
}

/** The nearest recent site, whether or not it crosses the threshold. */
export function nearestNeighbour(
  candidate: { desktop: Float32Array; mobile: Float32Array },
  neighbours: { desktop: StoredVector[]; mobile: StoredVector[] },
): { domain: string; fold: Fold; similarity: number } | null {
  let best: { domain: string; fold: Fold; similarity: number } | null = null;
  const folds: [Fold, Float32Array, StoredVector[]][] = [
    ["desktop", candidate.desktop, neighbours.desktop],
    ["mobile", candidate.mobile, neighbours.mobile],
  ];
  for (const [fold, vector, others] of folds) {
    for (const other of others) {
      const similarity = cosine(vector, other.embedding);
      if (best === null || similarity > best.similarity) {
        best = { domain: other.domain, fold, similarity };
      }
    }
  }
  return best;
}
