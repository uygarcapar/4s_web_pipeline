import { rmSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import {
  openStore,
  readRunState,
  recordEvent,
  schema,
  syncRunToDb,
  writeRunState,
  STAGES,
} from "@pipeline/core";
import { dbPath, runsRoot } from "../paths.js";

/**
 * Reset stages to pending so `run` re-enters at the first one.
 * By default only failed/stuck stages are reset; `--stage <name>` forces a
 * re-run of that stage and everything after it (its artifacts are removed
 * too, otherwise the idempotency check would skip it again).
 */
export async function retryCommand(
  domain: string,
  options: { stage?: string } = {},
): Promise<void> {
  const store = openStore({ dbPath: dbPath() });
  const state = readRunState(domain, runsRoot());
  if (!state) {
    console.error(`No run found for ${domain}.`);
    process.exitCode = 1;
    return;
  }

  let reset = 0;
  if (options.stage) {
    const from = STAGES.indexOf(options.stage as (typeof STAGES)[number]);
    if (from === -1) {
      console.error(`Unknown stage '${options.stage}'. Valid: ${STAGES.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    for (const stage of STAGES.slice(from)) {
      const s = state.stages[stage];
      if (s.status === "pending") continue;
      state.stages[stage] = { status: "pending", attempts: s.attempts };
      rmSync(join(runsRoot(), domain, stage), { recursive: true, force: true });
      reset++;
    }
  } else {
    for (const stage of STAGES) {
      const s = state.stages[stage];
      if (s.status === "failed" || s.status === "running") {
        state.stages[stage] = { status: "pending", attempts: s.attempts };
        reset++;
      }
    }
  }
  state.status = "queued";
  state.currentStage = null;
  writeRunState(state, runsRoot());
  syncRunToDb(store, state);
  store
    .update(schema.queue)
    .set({ status: "waiting" })
    .where(eq(schema.queue.domain, domain))
    .run();
  recordEvent(store, { domain, type: "run:retry", message: `retry requested (${reset} stage(s) reset)` });
  console.log(`${domain}: ${reset} stage(s) reset to pending; re-queued.`);
}

export async function cancelCommand(domain: string): Promise<void> {
  const store = openStore({ dbPath: dbPath() });
  const state = readRunState(domain, runsRoot());
  if (state) {
    state.status = "cancelled";
    writeRunState(state, runsRoot());
    syncRunToDb(store, state);
  }
  const queued = store.select().from(schema.queue).where(eq(schema.queue.domain, domain)).get();
  if (queued) {
    store
      .update(schema.queue)
      .set({ status: "cancelled" })
      .where(eq(schema.queue.domain, domain))
      .run();
  }
  if (!state && !queued) {
    console.error(`Nothing to cancel for ${domain}.`);
    process.exitCode = 1;
    return;
  }
  recordEvent(store, { domain, type: "run:cancel", message: "cancelled by operator" });
  console.log(`${domain}: cancelled.`);
}
