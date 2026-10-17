import { join } from "node:path";
import type { StageModule } from "./types.js";

/** Placeholder for the LLM stages landing in Milestone 3. */
export function notImplementedStage(stage: "plan" | "generate"): StageModule & {
  notImplemented: true;
} {
  return {
    stage,
    notImplemented: true,
    artifactPath: (ctx) =>
      join(ctx.runDir, stage, stage === "plan" ? "design-plan.md" : ".generate-done"),
    run: async () => ({
      ok: false,
      error: `${stage} stage is not implemented until Milestone 3`,
    }),
  };
}
