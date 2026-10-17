import { domainFromUrl, openStore, recordEvent, schema } from "@pipeline/core";
import { dbPath } from "../paths.js";

/**
 * Manual entry gate (Ek B, Giriş 2): the command itself is the approval,
 * so the item enters the queue with approved = true.
 */
export async function queueAddCommand(url: string): Promise<void> {
  const domain = domainFromUrl(url);
  const store = openStore({ dbPath: dbPath() });
  const existing = store
    .select()
    .from(schema.queue)
    .all()
    .find((q) => q.domain === domain);
  if (existing) {
    console.log(`Already queued: ${domain} (status: ${existing.status})`);
    return;
  }
  store
    .insert(schema.queue)
    .values({
      url: url.includes("://") ? url : `https://${url}`,
      domain,
      source: "manual",
      approved: true,
      priority: 100,
      status: "waiting",
      leadPlaceId: null,
      addedAt: new Date().toISOString(),
    })
    .run();
  recordEvent(store, {
    domain,
    type: "queue:add",
    message: `queued ${domain} (manual)`,
  });
  console.log(`Queued: ${domain}`);
}
