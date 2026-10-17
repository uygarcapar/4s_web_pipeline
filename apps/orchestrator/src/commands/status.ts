import { openStore, schema } from "@pipeline/core";
import { dbPath } from "../paths.js";

export async function statusCommand(): Promise<void> {
  const store = openStore({ dbPath: dbPath() });
  const queueItems = store.select().from(schema.queue).all();
  const runs = store.select().from(schema.runs).all();

  console.log(`Queue (${queueItems.length}):`);
  if (queueItems.length === 0) console.log("  (empty)");
  for (const q of queueItems.sort((a, b) => a.priority - b.priority)) {
    console.log(
      `  [${q.status}] ${q.domain}  source=${q.source} approved=${q.approved} added=${q.addedAt}`,
    );
  }

  console.log(`\nRuns (${runs.length}):`);
  if (runs.length === 0) console.log("  (none)");
  for (const r of runs) {
    const stage = r.currentStage ? ` stage=${r.currentStage}` : "";
    const preview = r.previewUrl ? ` preview=${r.previewUrl}` : "";
    console.log(
      `  [${r.status}] ${r.domain}${stage} cost=$${r.totalCostUsd.toFixed(2)}${preview}`,
    );
  }
}
