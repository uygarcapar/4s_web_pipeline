import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageContext, StageModule } from "./types.js";
import { runLlmSession } from "../llm/session.js";
import { verifyFacts } from "./facts-check.js";

/**
 * Generate stage (LLM). Copies the template into runs/<domain>/generate and
 * lets a budget-capped session fill site.config.ts, src/sections/** and
 * src/styles/tokens.css from the plan. Facts are verified by grep after the
 * session returns — the model's assurance is not evidence.
 */
export const generateStage: StageModule = {
  stage: "generate",
  artifactPath: (ctx) => join(ctx.runDir, "generate", ".generate-done"),

  async run(ctx) {
    const planDir = join(ctx.runDir, "plan");
    if (!existsSync(join(planDir, "sitemap.json"))) {
      return { ok: false, error: "plan/sitemap.json missing (plan stage must run first)" };
    }
    const siteDir = join(ctx.runDir, "generate");
    copyTemplate(ctx, siteDir);

    const factsPath = join(ctx.runDir, "audit", "facts.json");
    const prompt = `Fill the Next.js template at ${siteDir} for this client.

Read first:
- ${join(planDir, "design-plan.md")} — the design you are implementing. Follow it; the "one bold element" must survive into the build.
- ${join(planDir, "sitemap.json")} — the exact sections and their order.
- ${join(planDir, "sections")}/ — one spec per section.
- ${factsPath} — verbatim ground truth (name, phone, address, hours).
- ${join(ctx.runDir, "crawl", "content.json")} — the client's own Turkish text.
  The section specs quote it; this is the full source if you need more.
- ${join(ctx.runDir, "crawl", "asset-manifest.json")} — photographs downloaded
  from the current site, with pixel dimensions and source URLs. Copy the ones
  the specs name into ${siteDir}/public/images/ and use them. Placeholders are
  only for sections where the crawl found no suitable photograph.
- ${join(ctx.repoRoot, "template", "design-rules.md")} and ${join(ctx.repoRoot, "template", "build-rules.md")} — hard rules. §7 (content reuse) and §8 (density) matter most here.
- The vendored \`ui-ux-pro-max\` skill at ${join(ctx.repoRoot, ".claude", "skills", "ui-ux-pro-max")}
  for per-section layout and spacing decisions, and
  ${join(ctx.repoRoot, ".claude", "skills", "react-best-practices")} for the
  performance rules the verify gate measures.
- ${siteDir}/src/lib/schema.ts — the Zod schema your site.config.ts must satisfy, and the exact variant names each section accepts.
- ${siteDir}/site.config.ts — the current (reference clinic) content you are replacing.

Edit ONLY these paths:
- ${siteDir}/site.config.ts
- ${siteDir}/src/sections/**
- ${siteDir}/src/styles/tokens.css
- ${siteDir}/public/images/** (copy in the crawl photographs you use)

Rules that will be checked mechanically after you finish:
- Every value in facts.json is verbatim. Do not invent or alter a phone number, address, opening hour, service name or price. A fact that is absent must not be claimed.
- No value from the reference clinic may survive: "Moda Diş Kliniği", +905551234567, info@modadisklinigi.example and similar must all be gone.
- Turkish user-facing copy with real ş/ğ/ı/İ/ç/ö/ü. Code and comments in English.
- Phone and WhatsApp links only via telHref/waHref from src/lib/format.ts; currency via formatTRY, dates via formatDateTR, uppercase via upperTR.
- next/image only, never <img>. No arbitrary hex in sections — the brand comes from --brand-h / --brand-c in tokens.css.
- Use the REAL photographs from asset-manifest.json, including staff portraits
  (operator decision, design-rules.md §7). Copy them into public/images/ and
  reference them with next/image at their true width/height. The hero takes the
  largest usable photograph. Keep the manifest alongside the site so the
  provenance of each image survives.
- Every section renders real body content, not a list of labels: a service
  shows its description, a team member their title, an FAQ entry its answer.
  If a section has no source content, drop it from site.config.ts rather than
  padding it with invented copy.
- Set the brand hue and chroma from design-plan.md, and the fonts in src/app/layout.tsx are fixed — if the plan names different typefaces, note it in your final message rather than editing layout.tsx.

Work in this order: site.config.ts first (it drives everything), then each section component, then tokens.css. After each meaningful edit run \`pnpm exec tsc --noEmit\` in ${siteDir} and fix what it reports.

When tsc is clean, reply with a one-paragraph summary of what you built.`;

    ctx.log("generating site (site.config.ts, sections, tokens)");
    const result = await runLlmSession({
      prompt,
      cwd: siteDir,
      model: process.env.GENERATE_MODEL ?? "claude-sonnet-5",
      maxTurns: Number.parseInt(process.env.GENERATE_MAX_TURNS ?? "80", 10),
      maxBudgetUsd: Number.parseFloat(process.env.GENERATE_BUDGET_USD ?? "6"),
      allowedTools: [
        "Read",
        "Edit",
        "Write",
        "Glob",
        "Grep",
        "Bash(pnpm exec tsc *)",
        "Bash(pnpm exec next *)",
      ],
      effort: "high",
      log: ctx.log,
    });

    if (!result.ok) {
      return { ok: false, error: result.error ?? "generate session failed", costUsd: result.costUsd };
    }

    ctx.log("verifying facts by grep");
    const check = verifyFacts(factsPath, siteDir);
    if (!check.ok) {
      const detail = [...check.missing, ...check.leaked].join("; ");
      return { ok: false, error: `fact verification failed: ${detail}`, costUsd: result.costUsd };
    }
    ctx.log("facts verified: all present, no template placeholders left");

    writeFileSync(join(siteDir, ".generate-done"), new Date().toISOString() + "\n");
    return { ok: true, costUsd: result.costUsd, data: { turns: result.numTurns } };
  },
};

/** Copy the pristine template, skipping build output and local state. */
function copyTemplate(ctx: StageContext, siteDir: string): void {
  if (existsSync(join(siteDir, "package.json"))) {
    ctx.log("template copy already present, reusing it");
    return;
  }
  const templateDir = join(ctx.repoRoot, "template");
  const skip = new Set([
    "node_modules",
    ".next",
    ".lighthouseci",
    "test-results",
    "playwright-report",
    "verify-digest.md",
    // Visual baselines are per-client: the template's own snapshots would
    // make every client site fail the visual gate against the reference
    // clinic's layout, and the fix loop cannot repair that by editing code.
    // verify.mjs regenerates them with --update-snapshots=missing.
    "visual.spec.ts-snapshots",
  ]);
  mkdirSync(siteDir, { recursive: true });
  cpSync(templateDir, siteDir, {
    recursive: true,
    filter: (src) => !skip.has(src.split("/").pop() ?? ""),
  });
  // The copy lives outside the pnpm workspace, so workspace resolution does
  // not reach it. Symlink the template's node_modules (whose entries are
  // absolute links into the pnpm store, so they resolve from any path)
  // instead of running a fresh install per client.
  const nodeModules = join(siteDir, "node_modules");
  if (!existsSync(nodeModules)) {
    symlinkSync(join(templateDir, "node_modules"), nodeModules, "dir");
  }

  const pkgPath = join(siteDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
  pkg.name = `client-${ctx.domain.replace(/[^a-z0-9-]/g, "-")}`;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  ctx.log(`template copied to ${siteDir}`);
}
