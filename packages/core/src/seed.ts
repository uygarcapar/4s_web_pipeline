import { randomUUID } from "node:crypto";
import { openStore } from "./db/store.js";
import { recordEvent, syncRunToDb } from "./db/helpers.js";
import * as schema from "./db/schema.js";
import { createRunState, transitionStage } from "./state.js";
import { STAGES } from "./types.js";

/**
 * Seed data/pipeline.db with fake runs, leads and batches so the admin panel
 * can be developed and demoed without the orchestrator (plan Ek C.5).
 * Idempotent-ish: run against a fresh DB (delete data/pipeline.db first).
 */

const SECTORS = ["diş kliniği", "kuaför", "avukat", "veteriner", "emlak ofisi"];
const DISTRICTS = ["Kadıköy", "Beşiktaş", "Şişli", "Üsküdar", "Maltepe"];
const STATUSES = ["completed", "running", "failed", "queued", "blocked"] as const;

function pick<T>(arr: readonly T[], i: number): T {
  const v = arr[i % arr.length];
  if (v === undefined) throw new Error("empty array");
  return v;
}

export function seed(dbPath = "data/pipeline.db"): void {
  const store = openStore({ dbPath });

  for (let i = 0; i < 20; i++) {
    const domain = `ornek-firma-${i + 1}.com.tr`;
    const state = createRunState({
      domain,
      url: `https://${domain}`,
      source: i % 3 === 0 ? "manual" : "discover",
    });
    const status = pick(STATUSES, i);
    state.status = status;
    const reached = status === "completed" ? STAGES.length : (i % STAGES.length) + 1;
    for (let s = 0; s < reached; s++) {
      const stage = STAGES[s];
      if (!stage) break;
      transitionStage(state, stage, "running");
      const failed = status === "failed" && s === reached - 1;
      transitionStage(state, stage, failed ? "failed" : "passed", {
        costUsd: stage === "generate" ? 2.4 : stage === "plan" ? 0.6 : 0.05,
        ...(failed ? { error: "verify gate failed: lighthouse performance 0.72 < 0.9" } : {}),
      });
      recordEvent(store, {
        domain,
        stage,
        type: failed ? "stage:fail" : "stage:pass",
        message: `${stage} ${failed ? "failed" : "passed"} (seed)`,
      });
    }
    if (status === "completed") {
      state.previewUrl = `https://${domain.replace(/\./g, "-")}.vercel.app`;
    }
    syncRunToDb(store, state);
  }

  for (let b = 0; b < 3; b++) {
    const batchId = randomUUID();
    const sector = pick(SECTORS, b);
    const district = pick(DISTRICTS, b);
    const leadCount = 8 + b * 3;
    let tierA = 0;
    for (let l = 0; l < leadCount; l++) {
      const tier = l % 4 === 0 ? "A" : l % 4 === 1 ? "B" : "C";
      if (tier === "A") tierA++;
      store
        .insert(schema.leads)
        .values({
          placeId: `seed-${batchId.slice(0, 8)}-${l}`,
          name: `${sector} ${district} ${l + 1}`,
          phone: `+90530${String(1000000 + l * 7919).slice(0, 7)}`,
          website: `https://ornek-lead-${b}-${l}.com.tr`,
          rating: 3.5 + (l % 3) * 0.5,
          reviewCount: 12 + l * 9,
          category: sector,
          district,
          usesWebsite: l % 2 === 0,
          activityScore: 3 + (l % 7),
          psiMobile: tier === "A" ? 28 + l : null,
          tier,
          topIssuesTr: [
            "Mobilde tıklanabilir telefon yok",
            "HTTPS kullanılmıyor",
            "Mobil performans skoru 50'nin altında",
          ].slice(0, (l % 3) + 1),
          batchId,
          approved: false,
          calledAt: null,
          outcome: "not_called",
          optedOut: false,
        })
        .run();
    }
    store
      .insert(schema.approvals)
      .values({
        batchId,
        sector,
        district,
        foundCount: leadCount,
        tierACount: tierA,
        status: b === 0 ? "approved" : "pending_approval",
        createdAt: new Date().toISOString(),
        decidedAt: b === 0 ? new Date().toISOString() : null,
      })
      .run();
  }

  recordEvent(store, { type: "seed:done", message: "seed data written" });
  console.log(`Seeded ${dbPath}: 20 runs, 3 lead batches.`);
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");
if (isDirectRun) {
  seed();
}
