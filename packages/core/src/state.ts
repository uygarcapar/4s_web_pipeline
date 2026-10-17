import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { STAGES, type RunState, type Stage, type StageState } from "./types.js";
import { runStateSchema } from "./schemas.js";

/** Helpers for runs/<domain>/state.json — the per-run source of truth. */

export function runDir(domain: string, runsRoot = "runs"): string {
  return join(runsRoot, domain);
}

export function statePath(domain: string, runsRoot = "runs"): string {
  return join(runDir(domain, runsRoot), "state.json");
}

function emptyStageState(): StageState {
  return { status: "pending", attempts: 0 };
}

export function createRunState(input: {
  domain: string;
  url: string;
  source: "discover" | "manual";
}): RunState {
  const now = new Date().toISOString();
  const stages = Object.fromEntries(
    STAGES.map((s) => [s, emptyStageState()]),
  ) as Record<Stage, StageState>;
  return {
    domain: input.domain,
    url: input.url,
    source: input.source,
    status: "queued",
    currentStage: null,
    stages,
    totalCostUsd: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function readRunState(domain: string, runsRoot = "runs"): RunState | null {
  const path = statePath(domain, runsRoot);
  if (!existsSync(path)) return null;
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return runStateSchema.parse(raw) as RunState;
}

/** Atomic write: tmp file + rename, so a crash never leaves a torn state.json. */
export function writeRunState(state: RunState, runsRoot = "runs"): void {
  state.updatedAt = new Date().toISOString();
  const dir = runDir(state.domain, runsRoot);
  mkdirSync(dir, { recursive: true });
  const path = statePath(state.domain, runsRoot);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}

export function transitionStage(
  state: RunState,
  stage: Stage,
  status: StageState["status"],
  patch: Partial<Omit<StageState, "status">> = {},
): RunState {
  const now = new Date().toISOString();
  const prev = state.stages[stage];
  const next: StageState = { ...prev, ...patch, status };
  if (status === "running") {
    next.attempts = prev.attempts + 1;
    next.startedAt = now;
    delete next.finishedAt;
    delete next.error;
  }
  if (status === "passed" || status === "failed" || status === "skipped") {
    next.finishedAt = now;
  }
  state.stages[stage] = next;
  state.currentStage = status === "running" ? stage : state.currentStage;
  if (typeof patch.costUsd === "number") {
    state.totalCostUsd += patch.costUsd;
  }
  return state;
}

/** Normalize a URL into the run id: bare hostname without "www.". */
export function domainFromUrl(url: string): string {
  const u = new URL(url.includes("://") ? url : `https://${url}`);
  return u.hostname.replace(/^www\./, "").toLocaleLowerCase("en-US");
}
