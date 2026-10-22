import { existsSync } from "node:fs";
import { join } from "node:path";
import type { StageContext } from "../stages/types.js";

import { embedShots } from "./embed.js";
import { shootSite } from "./shots.js";
import { clearVectors, recordVector } from "./visual.js";

/**
 * Embed the shipped site and store it (D10 §8.2, second half).
 *
 * "After verify, the final site is embedded again and stored. That second
 * vector is what later runs compare against; it is not a gate on this run."
 *
 * The distinction matters in both directions. Gating on the pre-render
 * alone would compare against pages that may never have shipped, since a
 * candidate can lose and a fix loop can change what a page looks like.
 * Gating *this* run on *this* vector would be re-litigating a decision the
 * design stage already made, two LLM stages too late to act on.
 *
 * Failure here is logged and swallowed. A site that passed every gate must
 * not be failed because a screenshot did not come out — the only cost is
 * that the next run has one fewer neighbour to measure against, and the log
 * says so.
 */
export async function recordFinalVector(
  ctx: StageContext,
  siteDir: string,
  seed: string,
): Promise<void> {
  if (process.env.PIPELINE_SKIP_PRERENDER === "1") return;
  if (!existsSync(join(siteDir, "package.json"))) return;

  try {
    const shots = await shootSite({
      siteDir,
      outDir: join(ctx.runDir, "verify", "shots"),
      port: FINAL_PORT,
    });
    const vectors = await embedShots(shots);

    // A re-run supersedes its own earlier vector rather than adding a
    // second: two rows for one domain would let a client crowd the window
    // it is measured against.
    clearVectors(ctx.store, { domain: ctx.domain, stage: "final" });
    for (const fold of ["desktop", "mobile"] as const) {
      recordVector(ctx.store, {
        domain: ctx.domain,
        stage: "final",
        fold,
        seed,
        embedding: vectors[fold],
      });
    }
    ctx.log("shipped site embedded; later runs will measure against it");
  } catch (err) {
    ctx.log(
      `could not embed the shipped site: ${err instanceof Error ? err.message : String(err)} ` +
        "— the next run has one fewer neighbour, nothing else is affected",
    );
  }
}

/** Separate from the candidate ports so a stray server cannot collide. */
const FINAL_PORT = 3139;
