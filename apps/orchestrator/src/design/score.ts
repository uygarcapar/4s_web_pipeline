import type { Direction } from "@pipeline/core";

/**
 * Direction selection (D10 §6.2).
 *
 *     score(d) = affinity(d, brief) − λ · recentUsage(d, last 30 days)
 *
 * The usage penalty applies across **all** sectors, not within one. D6's
 * ledger was per-sector, which let two neighbouring businesses in different
 * trades receive the same language — and the operator reviews every run, so
 * sameness is perceived globally. That is the whole reason this is a penalty
 * rather than a tiebreak.
 */

/** What the scorer reads. A subset of `briefSchema` plus measured photos. */
export interface ScoringBrief {
  tone: string;
  tier: string;
  audience: string;
  contentVolume: string;
  photoProfile: { usableCount: number; quality: string };
}

export interface DirectionScore {
  id: string;
  score: number;
  affinity: number;
  penalty: number;
  /** Why this direction scored as it did, for the run log and design.json. */
  reason: string;
}

/**
 * How hard a repeat is punished.
 *
 * One point is roughly one affinity match, so λ = 2 means a direction used
 * twice recently has to be two matches better than a fresh one to win. High
 * enough to force rotation across a week of runs, low enough that a clearly
 * right direction still wins for the client it is right for — sameness is
 * the problem, but handing a clinical B2B client `playful-local` to avoid a
 * repeat would be a worse one.
 */
const LAMBDA = 2;

/**
 * Affinities are summed, as §6.2 specifies — not vetoed.
 *
 * `quiet-luxury` scores −4 on `stock-heavy`, which is enough to lose to a
 * direction that does not need photographs but not enough to make its total
 * negative for a client whose tone and tier it otherwise suits. That is
 * deliberate: the ranking only has to put the right direction *first*, and a
 * hard veto would mean a premium client with a bad crawl could not receive a
 * premium language at all, when the honest answer is "this one, and get
 * better photographs".
 */
export function scoreDirection(
  direction: Direction,
  brief: ScoringBrief,
  recentUsage: number,
): DirectionScore {
  const { affinity } = direction;
  const parts: string[] = [];

  const tone = affinity.tone[brief.tone] ?? 0;
  if (tone !== 0) parts.push(`tone ${brief.tone} ${tone > 0 ? "+" : ""}${tone}`);

  const tier = affinity.tier[brief.tier] ?? 0;
  if (tier !== 0) parts.push(`tier ${brief.tier} ${tier > 0 ? "+" : ""}${tier}`);

  const photo = affinity.photoProfile[brief.photoProfile.quality] ?? 0;
  if (photo !== 0) {
    parts.push(`photos ${brief.photoProfile.quality} ${photo > 0 ? "+" : ""}${photo}`);
  }

  // A direction whose first density option cannot hold this client's content
  // is a poor fit even when its tone matches: `poster` with pages of text
  // throws the text away, `editorial` with four lines looks empty.
  const density = direction.grid.density.includes(
    brief.contentVolume as (typeof direction.grid.density)[number],
  )
    ? 1
    : -1;
  parts.push(`density ${brief.contentVolume} ${density > 0 ? "+1" : "-1"}`);

  const affinityTotal = tone + tier + photo + density;
  const penalty = LAMBDA * recentUsage;
  if (recentUsage > 0) parts.push(`used ${recentUsage}× recently −${penalty}`);

  return {
    id: direction.id,
    score: affinityTotal - penalty,
    affinity: affinityTotal,
    penalty,
    reason: parts.join(", ") || "no affinity either way",
  };
}

/**
 * Rank every direction, best first.
 *
 * Ties are broken by id rather than left to sort stability, so the same
 * inputs always give the same order — the reproducibility §6.3 asks of the
 * sampler is worth nothing if the direction it samples from wobbles.
 */
export function rankDirections(
  directions: Direction[],
  brief: ScoringBrief,
  usageById: Record<string, number>,
): DirectionScore[] {
  return directions
    .map((d) => scoreDirection(d, brief, usageById[d.id] ?? 0))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/**
 * Photo quality from the asset manifest, without asking a model.
 *
 * `usableCount` is what the manifest already measured. "pro" is inferred
 * from how many large images survived the crawl's own size filter: a
 * business with a photographer has several, one with a phone has one or two
 * and a stock-dependent site has none of its own. It is a proxy, and it is
 * the proxy the selector uses until C5 measures images properly — recorded
 * here rather than hidden behind a confident-sounding name.
 */
export function photoQualityFrom(usableCount: number, largeCount: number): string {
  if (usableCount === 0) return "stock-heavy";
  if (largeCount >= 4) return "pro";
  return "amateur";
}
