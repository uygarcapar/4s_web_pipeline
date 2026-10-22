import { directionSchema, type Direction } from "@pipeline/core";

import { cinematicCalm } from "./cinematic-calm.js";
import { galleryWall } from "./gallery-wall.js";
import { kineticBold } from "./kinetic-bold.js";
import { nightRuled } from "./night-ruled.js";
import { starkDisplay } from "./stark-display.js";
import { swissGrid } from "./swiss-grid.js";
import { technicalAccent } from "./technical-accent.js";

/**
 * The direction catalog (docs/D10-design-variation.md §4).
 *
 * Replaces `stub.ts`, which carried only the two fields A1's range checks
 * consumed. These four are the real thing, parsed by `directionSchema` at
 * module load — a direction that contradicts itself (requiring a motion
 * signature it also disables, an inverted range, fewer than three reference
 * screenshots) fails here rather than three stages downstream.
 *
 * Seven, and the count is the point.
 *
 * `editorial-serif` and `quiet-luxury` were rejected in the 2026-10-22
 * review and replaced by `stark-display` and `cinematic-calm`. The three
 * after them — `technical-accent`, `gallery-wall`, `night-ruled` — exist
 * because capacity was measured and four was not enough: four directions
 * produce about eleven mutually-distinct sites across all sectors and six
 * within one, against a §12 ship test of ten.
 *
 * The curve is close to linear at roughly +2.7 sites per direction
 * (all-sector) and +1.3 within a sector, so seven should reach about
 * nineteen and nine. Measured again after this lands, not assumed.
 *
 * Two of the three were chosen to widen axes the distance check was already
 * weighting but the catalog was not using: `technical-accent` is the first
 * real accent colour, and `night-ruled` is the second direction that can go
 * dark. `colorMode` is worth 2 points in §8.1 and had two values in it.
 */
const CATALOG = [
  kineticBold,
  starkDisplay,
  swissGrid,
  cinematicCalm,
  technicalAccent,
  galleryWall,
  nightRuled,
].map(
  (direction) => directionSchema.parse(direction),
);

export const DIRECTIONS: Record<string, Direction> = Object.fromEntries(
  CATALOG.map((d) => [d.id, d]),
);

export const DIRECTION_IDS = CATALOG.map((d) => d.id);

/**
 * The direction a run was built under. A run that predates the `direction`
 * field in `design.json` is judged under `kinetic-bold`, which is the
 * language it was actually built in (§4.3).
 */
export const DEFAULT_DIRECTION_ID = kineticBold.id;

export function resolveDirection(id: string | undefined): Direction {
  return DIRECTIONS[id ?? DEFAULT_DIRECTION_ID] ?? kineticBold;
}

export {
  cinematicCalm,
  galleryWall,
  kineticBold,
  nightRuled,
  starkDisplay,
  swissGrid,
  technicalAccent,
};
