import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageContext } from "./types.js";
import { runLlmSession } from "../llm/session.js";

/**
 * Fix loop: at most N iterations (default 3), each fed only by
 * verify-digest.md. On exhaustion a BLOCKED.md is written and the run
 * escalates to the operator rather than looping forever.
 */
export interface FixLoopResult {
  fixed: boolean;
  iterations: number;
  costUsd: number;
}

export async function runFixLoop(
  ctx: StageContext,
  siteDir: string,
  runVerify: () => { ok: boolean; digest: string },
): Promise<FixLoopResult> {
  const maxIterations = Number.parseInt(process.env.PIPELINE_MAX_FIX_ITERATIONS ?? "3", 10);
  let costUsd = 0;

  for (let i = 1; i <= maxIterations; i++) {
    const digestPath = join(siteDir, "verify-digest.md");
    const digest = existsSync(digestPath) ? readFileSync(digestPath, "utf8") : "(no digest written)";

    ctx.log(`fix iteration ${i}/${maxIterations}`);
    const result = await runLlmSession({
      prompt: `The quality gates for the site at ${siteDir} are failing.

Your ONLY problem statement is the digest below. Do not go looking for other
work, and do not refactor anything the digest does not mention.

${digest}

Rules:
- Edit only site.config.ts, src/sections/** and src/styles/tokens.css.
- Tests, lighthouserc.cjs, playwright.config.ts, budget.json and acceptance.json
  are off limits; a hook will deny the write. Fix the code, not the gate.
- Entries marked as a recommendation (öneri) are not failures — ignore them
  unless an actual failure shares their root cause.
- For performance failures, consult the matching rule under
  ${join(ctx.repoRoot, ".claude", "skills", "react-best-practices", "rules")}
  (waterfalls and bundle size first).
- Keep the design intent from plan/design-plan.md and every hard rule in
  design-rules.md. A fix that reintroduces a generic cluster, breaks a Turkish
  string, or drops a verbatim fact is not a fix.

Run \`pnpm exec tsc --noEmit\` as you go. When you believe the reported
failures are addressed, reply with one sentence per failure you fixed.`,
      cwd: siteDir,
      model: process.env.FIX_MODEL ?? "claude-sonnet-5",
      maxTurns: Number.parseInt(process.env.FIX_MAX_TURNS ?? "40", 10),
      maxBudgetUsd: Number.parseFloat(process.env.FIX_BUDGET_USD ?? "3"),
      allowedTools: [
        "Read",
        "Edit",
        "Glob",
        "Grep",
        "Bash(pnpm exec tsc *)",
        "Bash(pnpm exec eslint *)",
      ],
      effort: "high",
      log: ctx.log,
    });
    costUsd += result.costUsd;

    const verify = runVerify();
    if (verify.ok) {
      ctx.log(`gates green after fix iteration ${i}`);
      return { fixed: true, iterations: i, costUsd };
    }
    ctx.log(`gates still failing after iteration ${i}`);
  }

  const blocked = `# BLOCKED

The verify gates for ${ctx.domain} did not pass after ${maxIterations} fix
iterations. A human needs to look at this run.

- Site: ${siteDir}
- Latest digest: ${join(siteDir, "verify-digest.md")}
- Crawl screenshots: ${join(ctx.runDir, "crawl", "screenshots")}
- Plan: ${join(ctx.runDir, "plan", "design-plan.md")}

Written ${new Date().toISOString()}.
`;
  writeFileSync(join(ctx.runDir, "BLOCKED.md"), blocked);
  ctx.log(`escalating: BLOCKED.md written after ${maxIterations} failed iterations`);
  return { fixed: false, iterations: maxIterations, costUsd };
}
