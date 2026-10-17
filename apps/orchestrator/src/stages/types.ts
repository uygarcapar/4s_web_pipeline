import type { Stage, RunState, Store } from "@pipeline/core";

/** Context passed to every stage. */
export interface StageContext {
  domain: string;
  url: string;
  /** Absolute path to runs/<domain>/ */
  runDir: string;
  /** Absolute repo root. */
  repoRoot: string;
  state: RunState;
  store: Store;
  /** Structured log line: console + runs/<domain>/logs/<stage>.jsonl */
  log: (message: string, data?: Record<string, unknown>) => void;
}

export interface StageResult {
  ok: boolean;
  /** Short English reason on failure. */
  error?: string;
  /** Optional cost for LLM stages (USD). */
  costUsd?: number;
  /** Extra data recorded on the stage event. */
  data?: Record<string, unknown>;
}

export interface StageModule {
  stage: Stage;
  /**
   * Idempotency probe: absolute path of the artifact whose existence means
   * this stage is already complete and can be skipped.
   */
  artifactPath: (ctx: StageContext) => string;
  run: (ctx: StageContext) => Promise<StageResult>;
}
