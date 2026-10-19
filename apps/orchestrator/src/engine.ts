import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  AUTO_STAGES,
  readRunState,
  recordEvent,
  syncRunToDb,
  transitionStage,
  writeRunState,
  createRunState,
  type RunState,
  type Store,
} from "@pipeline/core";
import { repoRoot, runsRoot } from "./paths.js";
import type { StageContext, StageModule } from "./stages/types.js";
import { stageRegistry } from "./stages/index.js";
import { createProgressNotifier, type ProgressNotifier } from "./notify/progress.js";

export interface EngineResult {
  domain: string;
  /** "completed" | "failed" | "halted" (reached an unimplemented stage) */
  outcome: "completed" | "failed" | "halted";
  failedStage?: string;
}

/**
 * Run the automatic stage chain for one domain. Idempotent per stage: a
 * stage whose artifact already exists is skipped. Every transition writes
 * state.json AND the DB (runs/stages/events).
 */
export async function runPipeline(input: {
  domain: string;
  url: string;
  source: "discover" | "manual";
  store: Store;
  /** Injected in tests; defaults to the configured channel (Telegram). */
  progress?: ProgressNotifier;
}): Promise<EngineResult> {
  const { domain, url, source, store } = input;
  const root = repoRoot();
  const runDir = join(runsRoot(), domain);
  const progress = input.progress ?? createProgressNotifier();

  const state: RunState =
    readRunState(domain, runsRoot()) ?? createRunState({ domain, url, source });
  state.status = "running";
  writeRunState(state, runsRoot());
  syncRunToDb(store, state);
  recordEvent(store, { domain, type: "run:start", message: `run started for ${domain}` });
  progress.runStarted(domain, url);

  for (const stageName of AUTO_STAGES) {
    const module: StageModule & { notImplemented?: boolean } = stageRegistry[stageName];
    const prior = state.stages[stageName];
    if (prior.status === "passed" || prior.status === "skipped") continue;

    const ctx: StageContext = {
      domain,
      url,
      runDir,
      repoRoot: root,
      state,
      store,
      log: (message, data) => {
        const line = { ts: new Date().toISOString(), stage: stageName, message, ...data };
        console.log(`[${stageName}] ${message}`);
        mkdirSync(join(runDir, "logs"), { recursive: true });
        appendFileSync(
          join(runDir, "logs", `${stageName}.jsonl`),
          JSON.stringify(line) + "\n",
        );
        recordEvent(store, {
          domain,
          stage: stageName,
          type: "log",
          message,
          ...(data !== undefined ? { data } : {}),
        });
      },
    };

    if (module.notImplemented) {
      state.status = "queued";
      state.currentStage = null;
      writeRunState(state, runsRoot());
      syncRunToDb(store, state);
      recordEvent(store, {
        domain,
        stage: stageName,
        type: "run:halt",
        message: `halted before ${stageName}: not implemented yet (Milestone 3)`,
      });
      console.log(`Halted before '${stageName}' (Milestone 3). Progress so far is saved.`);
      progress.runHalted(domain, stageName);
      await progress.flush();
      return { domain, outcome: "halted", failedStage: stageName };
    }

    if (existsSync(module.artifactPath(ctx))) {
      transitionStage(state, stageName, "skipped");
      writeRunState(state, runsRoot());
      syncRunToDb(store, state);
      recordEvent(store, {
        domain,
        stage: stageName,
        type: "stage:skip",
        message: `${stageName} skipped: artifact exists`,
      });
      continue;
    }

    transitionStage(state, stageName, "running");
    writeRunState(state, runsRoot());
    syncRunToDb(store, state);
    recordEvent(store, { domain, stage: stageName, type: "stage:start", message: `${stageName} started` });
    progress.stageStarted(domain, stageName);

    let result;
    try {
      result = await module.run(ctx);
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    if (!result.ok) {
      transitionStage(state, stageName, "failed", {
        error: result.error ?? "unknown error",
        ...(result.costUsd !== undefined ? { costUsd: result.costUsd } : {}),
      });
      state.status = "failed";
      writeRunState(state, runsRoot());
      syncRunToDb(store, state);
      recordEvent(store, {
        domain,
        stage: stageName,
        type: "stage:fail",
        message: `${stageName} failed: ${result.error ?? "unknown"}`,
      });
      progress.stageFailed(domain, stageName, result.error ?? "bilinmeyen hata");
      await progress.flush();
      return { domain, outcome: "failed", failedStage: stageName };
    }

    transitionStage(state, stageName, "passed", {
      ...(result.costUsd !== undefined ? { costUsd: result.costUsd } : {}),
    });
    writeRunState(state, runsRoot());
    syncRunToDb(store, state);
    recordEvent(store, {
      domain,
      stage: stageName,
      type: "stage:pass",
      message: `${stageName} passed`,
      ...(result.data ? { data: result.data } : {}),
    });
    progress.stagePassed(domain, stageName, result.data);
  }

  state.status = "completed";
  state.currentStage = null;
  writeRunState(state, runsRoot());
  syncRunToDb(store, state);
  recordEvent(store, { domain, type: "run:complete", message: `run completed for ${domain}` });
  // The notify stage already sent the "site is ready" message; this only waits
  // for the per-stage sends still in flight.
  await progress.flush();
  return { domain, outcome: "completed" };
}
