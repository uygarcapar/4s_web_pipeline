import { directionSchema, type Direction } from "@pipeline/core";

import { cinematicCalm } from "./cinematic-calm.js";
import { kineticBold } from "./kinetic-bold.js";
import { starkDisplay } from "./stark-display.js";
import { swissGrid } from "./swiss-grid.js";

/**
 * The direction catalog (docs/D10-design-variation.md §4).
 *
 * Replaces `stub.ts`, which carried only the two fields A1's range checks
 * consumed. These four are the real thing, parsed by `directionSchema` at
 * module load — a direction that contradicts itself (requiring a motion
 * signature it also disables, an inverted range, fewer than three reference
 * screenshots) fails here rather than three stages downstream.
 *
 * Two of the original four are gone. `editorial-serif` and `quiet-luxury`
 * were rejected in the 2026-10-22 review and are replaced by
 * `stark-display` and `cinematic-calm`, built from the operator's own
 * reference sites. The count stays at four deliberately: C4 measured four
 * directions producing about six distinct sites before the distance gate
 * starts falling back, and §12's ship test wants ten.
 */
const CATALOG = [kineticBold, starkDisplay, swissGrid, cinematicCalm].map(
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

export { cinematicCalm, kineticBold, starkDisplay, swissGrid };
