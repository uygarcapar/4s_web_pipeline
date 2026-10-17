import { desc, eq } from "drizzle-orm";
import { openStore, recordEvent, schema, domainFromUrl } from "@pipeline/core";
import { dbPath } from "../paths.js";

/**
 * Approval gate (Ek B): move selected leads from the latest pending batch
 * into the queue. Selection is 1-based over the batch's leads ordered by
 * tier then review count — the same order shown in the Telegram summary
 * and the admin panel.
 */
export async function approveCommand(
  selection: string,
  options: { batch?: string },
): Promise<void> {
  const indexes = selection
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1);
  if (indexes.length === 0) {
    console.error("No valid indexes. Usage: pipeline approve 1,4,7");
    process.exitCode = 1;
    return;
  }

  const store = openStore({ dbPath: dbPath() });
  const batch = options.batch
    ? store.select().from(schema.approvals).where(eq(schema.approvals.batchId, options.batch)).get()
    : store
        .select()
        .from(schema.approvals)
        .where(eq(schema.approvals.status, "pending_approval"))
        .orderBy(desc(schema.approvals.createdAt))
        .get();
  if (!batch) {
    console.error("No pending approval batch found. Run `pipeline discover` first.");
    process.exitCode = 1;
    return;
  }

  const batchLeads = store
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.batchId, batch.batchId))
    .all()
    .sort((a, b) => (a.tier ?? "Z").localeCompare(b.tier ?? "Z") || b.reviewCount - a.reviewCount);

  let queued = 0;
  for (const i of indexes) {
    const lead = batchLeads[i - 1];
    if (!lead) {
      console.warn(`Index ${i} is out of range (batch has ${batchLeads.length} leads); skipped.`);
      continue;
    }
    if (!lead.website) {
      console.warn(`Lead ${i} (${lead.name}) has no website; skipped.`);
      continue;
    }
    if (lead.optedOut) {
      console.warn(`Lead ${i} (${lead.name}) opted out; skipped (6563/KVKK).`);
      continue;
    }
    const domain = domainFromUrl(lead.website);
    const already = store.select().from(schema.queue).where(eq(schema.queue.domain, domain)).get();
    if (already) {
      console.warn(`${domain} already in queue; skipped.`);
      continue;
    }
    store
      .insert(schema.queue)
      .values({
        url: lead.website,
        domain,
        source: "discover",
        approved: true,
        priority: 100,
        status: "waiting",
        leadPlaceId: lead.placeId,
        addedAt: new Date().toISOString(),
      })
      .run();
    store
      .update(schema.leads)
      .set({ approved: true })
      .where(eq(schema.leads.placeId, lead.placeId))
      .run();
    recordEvent(store, {
      domain,
      type: "queue:add",
      message: `queued ${domain} (approved from batch ${batch.batchId})`,
    });
    queued++;
  }

  store
    .update(schema.approvals)
    .set({ status: "approved", decidedAt: new Date().toISOString() })
    .where(eq(schema.approvals.batchId, batch.batchId))
    .run();
  console.log(`Approved ${queued} lead(s) into the queue from batch ${batch.batchId}.`);
}
