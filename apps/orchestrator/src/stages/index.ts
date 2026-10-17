import type { Stage } from "@pipeline/core";
import type { StageModule } from "./types.js";
import { crawlStage } from "./crawl.js";
import { auditStage } from "./audit.js";
import { verifyStage } from "./verify.js";
import { notifyStage } from "./notify.js";
import { deployStage } from "./deploy.js";
import { notImplementedStage } from "./not-implemented.js";

export const stageRegistry: Record<Stage, StageModule & { notImplemented?: boolean }> = {
  crawl: crawlStage,
  audit: auditStage,
  plan: notImplementedStage("plan"),
  generate: notImplementedStage("generate"),
  verify: verifyStage,
  notify: notifyStage,
  deploy: deployStage,
};
