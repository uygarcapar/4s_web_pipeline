import type { Stage } from "@pipeline/core";
import type { StageModule } from "./types.js";
import { crawlStage } from "./crawl.js";
import { auditStage } from "./audit.js";
import { designStage } from "./design.js";
import { verifyStage } from "./verify.js";
import { notifyStage } from "./notify.js";
import { deployStage } from "./deploy.js";
import { planStage } from "./plan.js";
import { generateStage } from "./generate.js";

export const stageRegistry: Record<Stage, StageModule & { notImplemented?: boolean }> = {
  crawl: crawlStage,
  audit: auditStage,
  design: designStage,
  plan: planStage,
  generate: generateStage,
  verify: verifyStage,
  notify: notifyStage,
  deploy: deployStage,
};
