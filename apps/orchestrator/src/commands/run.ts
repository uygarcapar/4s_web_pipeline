import { eq } from "drizzle-orm";
import {
  createRunState,
  openStore,
  readRunState,
  recordEvent,
  schema,
  syncRunToDb,
  writeRunState,
} from "@pipeline/core";
import { dbPath, runsRoot } from "../paths.js";

/**
 * Process the queue. Milestone 1: picks the next approved waiting item,
 * creates runs/<domain>/state.json and stops — the stage implementations
 * land in Milestones 2–3. Each stage will be idempotent (skip if its
 * artifact exists) and write state.json + an events row on every transition.
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

  let state = readRunState(next.domain, runsRoot());
  if (!state) {
    state = createRunState({ domain: next.domain, url: next.url, source: next.source });
    writeRunState(state, runsRoot());
    syncRunToDb(store, state);
    recordEvent(store, {
      domain: next.domain,
      type: "run:create",
      message: `run created for ${next.domain}`,
    });
  }

  console.log(`Run initialized for ${next.domain} (state: runs/${next.domain}/state.json).`);
  console.log("Stages are not implemented yet (crawl/audit/verify/deploy/notify land in Milestone 2, plan/generate in Milestone 3).");
  process.exitCode = 1;
}
