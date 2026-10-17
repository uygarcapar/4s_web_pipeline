import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { StageModule } from "./types.js";

/**
 * Run the quality gates (template/scripts/verify.mjs) inside the generated
 * site working copy at runs/<domain>/generate/. The script runs gates in
 * cost order, writes verify-digest.md and, on full green, the repo-level
 * .pipeline/verify-passed marker consumed by the deploy gate.
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

    ctx.log("running verify gates (tsc -> eslint -> build -> playwright -> lhci -> links)");
    const res = spawnSync("node", ["scripts/verify.mjs"], {
      cwd: siteDir,
      encoding: "utf8",
      env: { ...process.env, PIPELINE_REPO_ROOT: ctx.repoRoot },
      timeout: 30 * 60 * 1000,
    });

    const digestSrc = join(siteDir, "verify-digest.md");
    mkdirSync(join(ctx.runDir, "verify"), { recursive: true });
    if (existsSync(digestSrc)) {
      copyFileSync(digestSrc, join(ctx.runDir, "verify", "digest.md"));
    }

    if (res.status !== 0) {
      const tail = (res.stdout ?? "").split("\n").slice(-15).join("\n");
      return { ok: false, error: `verify gates failed (see verify/digest.md)\n${tail}` };
    }
    ctx.log("all verify gates green");
    return { ok: true };
  },
};
