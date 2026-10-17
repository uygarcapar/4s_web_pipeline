import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageModule } from "./types.js";

/**
 * MANUAL-ONLY Vercel deploy (docs/DECISIONS.md D1): invoked via
 * `pipeline deploy <domain>`, never by the automatic chain. Creates the
 * project via REST (deterministic for many sites), then deploys with the
 * CLI using VERCEL_ORG_ID + VERCEL_PROJECT_ID exported together.
 */
export const deployStage: StageModule = {
  stage: "deploy",
  artifactPath: (ctx) => join(ctx.runDir, "deploy", "url.txt"),

  async run(ctx) {
    const token = process.env.VERCEL_TOKEN;
    const orgId = process.env.VERCEL_ORG_ID;
    if (!token || !orgId) {
      return { ok: false, error: "VERCEL_TOKEN / VERCEL_ORG_ID not set (Vercel is optional until a manual deploy; see .env.example)" };
    }

    const siteDir = join(ctx.runDir, "generate");
    if (!existsSync(join(siteDir, "package.json"))) {
      return { ok: false, error: "no generated site at runs/<domain>/generate" };
    }
    const marker = join(ctx.repoRoot, ".pipeline", "verify-passed");
    if (!existsSync(marker)) {
      return { ok: false, error: "verify has not passed (.pipeline/verify-passed missing)" };
    }

    const deployDir = join(ctx.runDir, "deploy");
    mkdirSync(deployDir, { recursive: true });

    // 1. Create (or reuse) the Vercel project via REST.
    const projectFile = join(deployDir, "project.json");
    let projectId: string;
    if (existsSync(projectFile)) {
      projectId = (JSON.parse(readFileSync(projectFile, "utf8")) as { id: string }).id;
      ctx.log(`reusing Vercel project ${projectId}`);
    } else {
      const slug = ctx.domain.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 52);
      const res = await fetch(`https://api.vercel.com/v11/projects?teamId=${orgId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: slug, framework: "nextjs" }),
      });
      const body = (await res.json()) as { id?: string; error?: { code?: string; message?: string } };
      if (res.status === 409 || body.error?.code === "conflict") {
        // Project exists: fetch it by name.
        const get = await fetch(`https://api.vercel.com/v9/projects/${slug}?teamId=${orgId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const existing = (await get.json()) as { id?: string };
        if (!existing.id) return { ok: false, error: `project '${slug}' conflict but lookup failed` };
        projectId = existing.id;
      } else if (!res.ok || !body.id) {
        return { ok: false, error: `Vercel project create failed: ${res.status} ${body.error?.message ?? ""}` };
      } else {
        projectId = body.id;
      }
      writeFileSync(projectFile, JSON.stringify({ id: projectId, name: slug }, null, 2) + "\n");
      ctx.log(`Vercel project ready: ${slug} (${projectId})`);
    }

    // 2. Project env: SITE_PREVIEW turns on noindex + Basic-Auth + the draft
    // band. SITE_URL is deliberately NOT set here — the deployment URL is
    // only known after the deploy, and the template falls back to Vercel's
    // own VERCEL_PROJECT_PRODUCTION_URL, so canonical/OG never point at
    // localhost. Set SITE_URL by hand once a custom domain is attached.
    await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?teamId=${orgId}&upsert=true`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        { key: "SITE_PREVIEW", value: "1", type: "plain", target: ["production", "preview"] },
      ]),
    });

    // 3. CLI deploy with ORG+PROJECT ids exported together (CLI 55 scope rules).
    ctx.log("deploying with vercel CLI");
    const res = spawnSync("npx", ["-y", "vercel@latest", "deploy", "--prod", "--yes"], {
      cwd: siteDir,
      encoding: "utf8",
      env: {
        ...process.env,
        VERCEL_TOKEN: token,
        VERCEL_ORG_ID: orgId,
        VERCEL_PROJECT_ID: projectId,
      },
      timeout: 15 * 60 * 1000,
    });
    const url = (res.stdout ?? "").trim().split("\n").pop() ?? "";
    if (res.status !== 0 || !url.startsWith("https://")) {
      return { ok: false, error: `vercel deploy failed: ${(res.stderr ?? "").slice(-400)}` };
    }
    writeFileSync(join(deployDir, "url.txt"), url + "\n");

    // 4. Verify preview protection headers.
    const head = spawnSync("curl", ["-sI", url], { encoding: "utf8", timeout: 60_000 });
    const noindex = /x-robots-tag:.*noindex/i.test(head.stdout ?? "");
    ctx.log(`deployed: ${url} (noindex header: ${noindex ? "present" : "MISSING"})`);
    if (!noindex) {
      return { ok: false, error: `deployed to ${url} but X-Robots-Tag noindex header is missing — preview protection failed` };
    }
    return { ok: true, data: { url } };
  },
};
