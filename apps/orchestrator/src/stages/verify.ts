import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { StageContext, StageModule } from "./types.js";
import { runFixLoop } from "./fix-loop.js";
import { runDesignJudge } from "./design-judge.js";

/**
 * Run the quality gates (template/scripts/verify.mjs) inside the generated
 * site working copy. The script runs gates in cost order, writes
 * verify-digest.md and, on full green, the repo-level
 * .pipeline/verify-passed marker consumed by the deploy gate.
 *
 * On failure the fix loop gets up to PIPELINE_MAX_FIX_ITERATIONS attempts,
 * each fed only by the digest; if it never goes green the stage fails with
 * BLOCKED.md written for the operator.
 */
export const verifyStage: StageModule = {
  stage: "verify",
  artifactPath: (ctx) => join(ctx.runDir, "verify", "digest.md"),

  async run(ctx) {
    const siteDir = join(ctx.runDir, "generate");
    if (!existsSync(join(siteDir, "package.json"))) {
      return {
        ok: false,
        error: "no generated site at runs/<domain>/generate (generate stage must run first)",
      };
    }

    const runGates = (): { ok: boolean; digest: string } => {
      const res = spawnSync("node", ["scripts/verify.mjs"], {
        cwd: siteDir,
        encoding: "utf8",
        env: { ...process.env, PIPELINE_REPO_ROOT: ctx.repoRoot },
        timeout: 30 * 60 * 1000,
        stdio: ["ignore", "inherit", "inherit"],
      });
      const digestSrc = join(siteDir, "verify-digest.md");
      const digest = existsSync(digestSrc) ? readFileSync(digestSrc, "utf8") : "";
      mkdirSync(join(ctx.runDir, "verify"), { recursive: true });
      if (existsSync(digestSrc)) {
        copyFileSync(digestSrc, join(ctx.runDir, "verify", "digest.md"));
      }
      return { ok: res.status === 0, digest };
    };

    ctx.log("running verify gates (tsc -> eslint -> build -> playwright -> lhci -> links)");
    let costUsd = 0;
    let fixIterations = 0;

    if (!runGates().ok) {
      ctx.log("gates failed; entering fix loop");
      const fix = await runFixLoop(ctx, siteDir, runGates);
      costUsd += fix.costUsd;
      fixIterations = fix.iterations;
      if (!fix.fixed) {
        return {
          ok: false,
          error: `verify gates still failing after ${fix.iterations} fix iteration(s); BLOCKED.md written`,
          costUsd,
        };
      }
    } else {
      ctx.log("all verify gates green on the first run");
    }

    // Design rubric runs only once the mechanical gates are green, so the
    // judge is never looking at a broken build.
    if (process.env.SKIP_DESIGN_JUDGE === "1") {
      ctx.log("design judge skipped (SKIP_DESIGN_JUDGE=1)");
      return { ok: true, costUsd, data: { fixIterations } };
    }
    const judge = await runDesignJudge(ctx, siteDir);
    costUsd += judge.costUsd;
    if (!judge.ok) {
      // Hard fails are generic-cluster or Turkish-text violations: feed them
      // back as the problem statement for one more pass through the loop.
      appendFileSync(
        join(siteDir, "verify-digest.md"),
        `\n## design-judge (hard fails)\n\n${judge.hardFails.map((f) => `- ${f}`).join("\n")}\n`,
      );
      ctx.log(`design judge hard fails: ${judge.hardFails.length}; re-entering fix loop`);
      const fix = await runFixLoop(ctx, siteDir, () => {
        const gates = runGates();
        if (!gates.ok) return gates;
        return { ok: true, digest: gates.digest };
      });
      costUsd += fix.costUsd;
      fixIterations += fix.iterations;
      if (!fix.fixed) {
        return {
          ok: false,
          error: `design judge hard fails unresolved: ${judge.hardFails.join("; ")}`,
          costUsd,
        };
      }
    }
    return {
      ok: true,
      costUsd,
      data: { fixIterations, designNotes: judge.notes.length },
    };
  },
};

/** Exposed for the design-judge pass, which reuses the digest path. */
export function digestPath(ctx: StageContext): string {
  return join(ctx.runDir, "generate", "verify-digest.md");
}
