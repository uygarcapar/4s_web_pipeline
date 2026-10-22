import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { connection } from "next/server";

import { ShipClient, type ShippedSite } from "./client";

/**
 * The §12 ship test, as a surface.
 *
 * "Ten real SMB sites, at least three sectors, through the pipeline. Put
 * the desktop folds side by side: if you cannot group any two as the same
 * site, D10 is done."
 *
 * That is the whole acceptance criterion for the design-variation work, and
 * it is a looking test — so it needs the folds in one grid, not a table of
 * distances. The screenshots are the ones `recordFinalVector` already takes
 * after verify, so nothing is re-rendered here.
 *
 * **Direction names are hidden until asked for.** The test is whether two
 * pages group by eye; a visible `kinetic-bold` label under each one tells
 * the answer before the question. They are one click away for afterwards,
 * because "which two did I group, and were they the same direction" is the
 * useful follow-up.
 */
export const instant = false;

export default async function ShipPage() {
  await connection();

  const runs = join(process.cwd(), "..", "..", "runs");
  if (!existsSync(runs)) return <Empty />;

  const sites: ShippedSite[] = [];
  for (const domain of readdirSync(runs)) {
    const shot = join(runs, domain, "verify", "shots", "desktop.png");
    const mobile = join(runs, domain, "verify", "shots", "mobile.png");
    if (!existsSync(shot)) continue;

    let direction = "unknown";
    let seed = "";
    try {
      const spec = JSON.parse(
        readFileSync(join(runs, domain, "design", "design.json"), "utf8"),
      ) as { direction?: string; seed?: string };
      direction = spec.direction ?? "unknown";
      seed = spec.seed ?? "";
    } catch {
      // A run without a readable spec still has a page worth looking at.
    }

    sites.push({
      domain,
      direction,
      seed,
      desktop: `/shot/${domain}/verify/shots/desktop.png`,
      mobile: existsSync(mobile) ? `/shot/${domain}/verify/shots/mobile.png` : null,
    });
  }

  if (sites.length === 0) return <Empty />;
  return <ShipClient sites={sites.sort((a, b) => a.domain.localeCompare(b.domain))} />;
}

function Empty() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-2xl font-semibold">No finished sites yet</h1>
      <p className="mt-4 text-sm leading-relaxed opacity-80">
        This page reads the post-verify screenshots under{" "}
        <code>runs/&lt;domain&gt;/verify/shots/</code>. Run some clients through
        the pipeline first:
      </p>
      <pre className="mt-4 overflow-x-auto rounded bg-black/5 p-4 text-xs leading-relaxed">
        {`pnpm --filter @pipeline/orchestrator pipeline queue add <url>
pnpm --filter @pipeline/orchestrator pipeline run`}
      </pre>
      <p className="mt-4 text-sm leading-relaxed opacity-80">
        §12 wants ten of them across at least three sectors.
      </p>
    </main>
  );
}
