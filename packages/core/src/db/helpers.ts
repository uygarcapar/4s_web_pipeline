import { eq } from "drizzle-orm";
import type { RunState, Stage } from "../types.js";
import * as schema from "./schema.js";
import type { Store } from "./store.js";

/** Append an event row; the admin panel streams these over SSE. */
export function recordEvent(
  store: Store,
  input: {
    domain?: string;
    stage?: Stage;
    type: string;
    message: string;
    data?: Record<string, unknown>;
  },
): void {
  store
    .insert(schema.events)
    .values({
      domain: input.domain ?? null,
      stage: input.stage ?? null,
      type: input.type,
      message: input.message,
      data: input.data ?? null,
      createdAt: new Date().toISOString(),
    })
    .run();
}

/**
 * Mirror a RunState into the DB (runs + stages tables). Called on every
 * transition right after writeRunState — the file stays the source of truth.
 */
export function syncRunToDb(store: Store, state: RunState): void {
  store
    .insert(schema.runs)
    .values({
      domain: state.domain,
      url: state.url,
      source: state.source,
      status: state.status,
      currentStage: state.currentStage,
      previewUrl: state.previewUrl ?? null,
      vercelProjectId: state.vercelProjectId ?? null,
      totalCostUsd: state.totalCostUsd,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.runs.domain,
      set: {
        status: state.status,
        currentStage: state.currentStage,
        previewUrl: state.previewUrl ?? null,
        vercelProjectId: state.vercelProjectId ?? null,
        totalCostUsd: state.totalCostUsd,
        updatedAt: state.updatedAt,
      },
    })
    .run();

  store.delete(schema.stages).where(eq(schema.stages.domain, state.domain)).run();
  for (const [stage, s] of Object.entries(state.stages)) {
    store
      .insert(schema.stages)
      .values({
        domain: state.domain,
        stage,
        status: s.status,
        attempts: s.attempts,
        startedAt: s.startedAt ?? null,
        finishedAt: s.finishedAt ?? null,
        costUsd: s.costUsd ?? null,
        error: s.error ?? null,
      })
      .run();
  }
}
