import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  openStore,
  readRunState,
  recordEvent,
  syncRunToDb,
  transitionStage,
  writeRunState,
} from "@pipeline/core";
import { dbPath, repoRoot, runsRoot } from "../paths.js";
import { deployStage } from "../stages/deploy.js";
import type { StageContext } from "../stages/types.js";

/**
 * Manual-only Vercel deploy (docs/DECISIONS.md D1): never part of the
 * automatic run chain. Requires verify to have passed.
 */
export async function deployCommand(domain: string): Promise<void> {
  const store = openStore({ dbPath: dbPath() });
  const state = readRunState(domain, runsRoot());
  if (!state) {
    console.error(`No run found for ${domain}.`);
    process.exitCode = 1;
    return;
  }
  if (state.stages.verify.status !== "passed") {
    console.error(
      `Refusing to deploy ${domain}: verify has not passed (status: ${state.stages.verify.status}).`,
    );
    process.exitCode = 1;
    return;
  }

  const runDir = join(runsRoot(), domain);
  const ctx: StageContext = {
    domain,
    url: state.url,
    runDir,
    repoRoot: repoRoot(),
    state,
    store,
    log: (message, data) => {
      console.log(`[deploy] ${message}`);
      mkdirSync(join(runDir, "logs"), { recursive: true });
      appendFileSync(
        join(runDir, "logs", "deploy.jsonl"),
        JSON.stringify({ ts: new Date().toISOString(), stage: "deploy", message, ...data }) + "\n",
      );
      recordEvent(store, {
        domain,
        stage: "deploy",
        type: "log",
        message,
        ...(data !== undefined ? { data } : {}),
      });
    },
  };

  if (existsSync(deployStage.artifactPath(ctx))) {
    console.log(`Already deployed (runs/${domain}/deploy/url.txt exists). Delete it to redeploy.`);
    return;
  }

  transitionStage(state, "deploy", "running");
  writeRunState(state, runsRoot());
  syncRunToDb(store, state);
  const result = await deployStage.run(ctx);
  transitionStage(state, "deploy", result.ok ? "passed" : "failed", {
    ...(result.error !== undefined ? { error: result.error } : {}),
  });
  if (result.ok && typeof result.data?.url === "string") {
    state.previewUrl = result.data.url;
  }
  writeRunState(state, runsRoot());
  syncRunToDb(store, state);
  recordEvent(store, {
    domain,
    stage: "deploy",
    type: result.ok ? "stage:pass" : "stage:fail",
    message: result.ok ? `deployed: ${String(result.data?.url)}` : `deploy failed: ${result.error}`,
  });

  if (!result.ok) {
    console.error(`Deploy failed: ${result.error}`);
    process.exitCode = 1;
  } else {
    console.log(`Preview URL: ${String(result.data?.url)}`);
  }
}

/** Serve the locally built site for operator review (D1 local-first flow). */
export async function previewCommand(domain: string): Promise<void> {
  const siteDir = join(runsRoot(), domain, "generate");
  if (!existsSync(join(siteDir, "package.json"))) {
    console.error(`No generated site at runs/${domain}/generate.`);
    process.exitCode = 1;
    return;
  }
  if (!existsSync(join(siteDir, ".next"))) {
    console.error(`Site is not built yet (no .next). Run the verify stage first or run 'pnpm run build' in runs/${domain}/generate.`);
    process.exitCode = 1;
    return;
  }
  const port = process.env.PREVIEW_PORT ?? "4310";
  console.log(`Serving runs/${domain}/generate at http://localhost:${port} (Ctrl+C to stop)`);
  const child = spawn("pnpm", ["exec", "next", "start", "-p", port], {
    cwd: siteDir,
    stdio: "inherit",
  });
  await new Promise<void>((resolve) => {
    child.on("exit", () => resolve());
  });
}
