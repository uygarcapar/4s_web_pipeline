import { readRunState } from "@pipeline/core";
import { runsRoot } from "../paths.js";

/**
 * Manual-only Vercel deploy (docs/DECISIONS.md D1): never part of the
 * automatic run chain. Implemented in Milestone 2; even then it requires
 * the verify stage to have passed (.pipeline/verify-passed gate).
 */
export async function deployCommand(domain: string): Promise<void> {
  const state = readRunState(domain, runsRoot());
  if (!state) {
    console.error(`No run found for ${domain}.`);
    process.exitCode = 1;
    return;
  }
  if (state.stages.verify.status !== "passed") {
    console.error(`Refusing to deploy ${domain}: verify has not passed (status: ${state.stages.verify.status}).`);
    process.exitCode = 1;
    return;
  }
  console.log("deploy: not implemented yet (Milestone 2). This command is manual-only by design.");
  process.exitCode = 1;
}

/** Serve the locally built site for operator review. Implemented in Milestone 2. */
export async function previewCommand(domain: string): Promise<void> {
  const state = readRunState(domain, runsRoot());
  if (!state) {
    console.error(`No run found for ${domain}.`);
    process.exitCode = 1;
    return;
  }
  console.log(`preview: not implemented yet (Milestone 2). Will serve runs/${domain}/generate/ on a local port.`);
  process.exitCode = 1;
}
