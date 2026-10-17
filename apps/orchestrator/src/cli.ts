#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
import { join } from "node:path";
import { Command } from "commander";
import { repoRoot } from "./paths.js";

loadEnv({ path: join(repoRoot(), ".env"), quiet: true });
import { discoverCommand } from "./commands/discover.js";
import { approveCommand } from "./commands/approve.js";
import { queueAddCommand } from "./commands/queue.js";
import { runCommand } from "./commands/run.js";
import { statusCommand } from "./commands/status.js";
import { retryCommand, cancelCommand } from "./commands/retry-cancel.js";
import { deployCommand, previewCommand } from "./commands/deploy-preview.js";

const program = new Command();

program
  .name("pipeline")
  .description("Website-rebuild pipeline orchestrator")
  .version("0.1.0");

program
  .command("discover")
  .description("Find leads via Places API Text Search (stage 0, Ek A)")
  .requiredOption("--sector <sector>", 'sector query, e.g. "diş kliniği"')
  .requiredOption("--district <district>", 'district, e.g. "Kadıköy"')
  .action(discoverCommand);

program
  .command("approve")
  .description("Approve leads from the latest pending batch into the queue, e.g. approve 1,4,7")
  .argument("<selection>", "comma-separated 1-based indexes from the batch list")
  .option("--batch <batchId>", "batch id (defaults to latest pending batch)")
  .action(approveCommand);

const queue = program.command("queue").description("Manage the rebuild queue");
queue
  .command("add")
  .description("Add a URL directly to the queue (manual entry, bypasses approval)")
  .argument("<url>", "site URL to rebuild")
  .action(queueAddCommand);

program
  .command("run")
  .description("Process the queue: crawl → audit → plan → generate → verify → deploy → notify")
  .option("--domain <domain>", "run a single queued domain")
  .action(runCommand);

program
  .command("preview")
  .description("Serve a finished site locally for operator review")
  .argument("<domain>")
  .action(previewCommand);

program
  .command("deploy")
  .description("Manually deploy a verified site to Vercel (never automatic; see docs/DECISIONS.md D1)")
  .argument("<domain>")
  .action(deployCommand);

program
  .command("status")
  .description("Show queue and run status")
  .action(statusCommand);

program
  .command("retry")
  .description("Re-run a failed/blocked domain from its first failed stage")
  .argument("<domain>")
  .action(retryCommand);

program
  .command("cancel")
  .description("Cancel a queued or running domain")
  .argument("<domain>")
  .action(cancelCommand);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
