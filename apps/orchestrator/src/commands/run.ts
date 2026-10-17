import { eq } from "drizzle-orm";
import { openStore, recordEvent, schema } from "@pipeline/core";
import { dbPath } from "../paths.js";
import { runPipeline } from "../engine.js";

/**
 * Process the queue: pick approved waiting items (priority order) and run
 * the automatic stage chain (AUTO_STAGES: crawl → audit → plan → generate →
 * verify → notify; deploy is manual-only, docs/DECISIONS.md D1). The engine
 * halts cleanly at plan/generate until Milestone 3 lands them.
 */
export async function runCommand(options: { domain?: string }): Promise<void> {
  const store = openStore({ dbPath: dbPath() });
  const waiting = store
    .select()
    .from(schema.queue)
    .where(eq(schema.queue.status, "waiting"))
    .all()
    .filter((q) => q.approved)
    .filter((q) => (options.domain ? q.domain === options.domain : true))
    .sort((a, b) => a.priority - b.priority);

  const next = waiting[0];
  if (!next) {
    console.log("Queue is empty (no approved waiting items).");
    return;
  }

  store
    .update(schema.queue)
    .set({ status: "running" })
    .where(eq(schema.queue.id, next.id))
    .run();

  const result = await runPipeline({
    domain: next.domain,
    url: next.url,
    source: next.source,
    store,
  });

  const queueStatus =
    result.outcome === "completed" ? "done" : result.outcome === "failed" ? "failed" : "waiting";
  store
    .update(schema.queue)
    .set({ status: queueStatus })
    .where(eq(schema.queue.id, next.id))
    .run();
  recordEvent(store, {
    domain: next.domain,
    type: `run:${result.outcome}`,
    message: `run ${result.outcome}${result.failedStage ? ` at ${result.failedStage}` : ""}`,
  });

  if (result.outcome === "failed") {
    console.error(`Run failed at stage '${result.failedStage}'. See runs/${next.domain}/logs/ and state.json.`);
    process.exitCode = 1;
  } else if (result.outcome === "completed") {
    console.log(`Run completed for ${next.domain}.`);
  }
}
