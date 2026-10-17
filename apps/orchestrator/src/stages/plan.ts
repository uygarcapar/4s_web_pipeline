import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { StageModule } from "./types.js";
import { runLlmSession } from "../llm/session.js";

/**
 * Plan stage (LLM). Writes design-plan.md first, then sitemap.json and one
 * spec per section, grounded in the crawl screenshots and the verbatim
 * facts. Produces no site code — that is the generate stage.
 */
export const planStage: StageModule = {
  stage: "plan",
  artifactPath: (ctx) => join(ctx.runDir, "plan", "sitemap.json"),

  async run(ctx) {
    const factsPath = join(ctx.runDir, "audit", "facts.json");
    if (!existsSync(factsPath)) {
      return { ok: false, error: "audit/facts.json missing (audit stage must run first)" };
    }
    const facts = readFileSync(factsPath, "utf8");
    const issuesPath = join(ctx.runDir, "audit", "issues.json");
    const issues = existsSync(issuesPath) ? readFileSync(issuesPath, "utf8") : "[]";

    mkdirSync(join(ctx.runDir, "plan", "sections"), { recursive: true });

    const planDir = join(ctx.runDir, "plan");
    const screenshotDir = join(ctx.runDir, "crawl", "screenshots");
    const designRules = join(ctx.repoRoot, "template", "design-rules.md");

    const prompt = `You are planning a rebuilt website for a Turkish small business.

Inputs you MUST read before writing anything:
- ${designRules} — the hard design rules, especially the five generic-AI clusters in §2 and the Turkey rules in §5.
- ${screenshotDir} — mobile and desktop screenshots of the CURRENT site. Read at least index.mobile.png and index.desktop.png.
- Ground-truth facts (verbatim, never invent or alter these):
${facts}
- Audit findings the rebuild must fix:
${issues}

Produce exactly these artifacts, in this order:

1. ${join(planDir, "design-plan.md")} — write this FIRST, before anything else. It must contain:
   - Palette: 4-6 named colors. The template derives its whole ramp from two OKLCH numbers, so state the brand hue (0-360) and chroma (0-0.4) explicitly, plus what each named color is for.
   - Type: one or two typefaces with their roles. They must be Google Fonts with latin-ext coverage (Turkish needs ş ğ ı İ ç ö ü).
   - Layout: an ASCII wireframe per page and one sentence of alignment guidance.
   - The one bold element: the single memorable thing on this site. Everything else stays quiet.
   - A "generic check" section: compare your plan against the five clusters in design-rules.md §2, say which parts matched, and what you changed.
   Ground the design in THIS business — a dental clinic in Kadıköy must not look like a generic agency template.

2. ${join(planDir, "sitemap.json")} — write this LAST. Shape:
   {"pages":[{"path":"/","title":"...","sections":[{"id":"hero","type":"hero","variant":"default"}]}]}
   Valid section types, use each at most once: hero, services, gallery, testimonials, faq, contact, map, hours.
   IMPORTANT: "variant" is a closed enum per section type, defined in
   ${join(ctx.repoRoot, "template", "src", "lib", "schema.ts")}. Read that file and use only the
   literal variant strings it allows (they are short words like "default" or
   "centered"). Inventing a descriptive variant name makes site.config.ts fail
   Zod validation at build time. If the look you want is not an existing
   variant, pick the closest one and describe the difference in the section
   spec instead.
   This is a one-page site: a single page at "/" with an ordered section list. Order sections so the first mobile viewport answers what the business does, where it is, and how to reach it.

3. ${join(planDir, "sections")}/<id>.md — one spec per section in your sitemap. Each spec states: the section's purpose, which facts.json fields it consumes (name the fields), the Turkish copy to use, the chosen variant, and which crawl assets (if any) it needs.

Hard rules:
- Facts are verbatim. Never invent or "improve" a phone number, address, opening hour, price, or service name. If a fact is missing from facts.json, the section must not claim it.
- Turkish user-facing copy with correct ş/ğ/ı/İ/ç/ö/ü. Code, file names and your own notes in English.
- Services are NOT in facts.json — derive them only from the crawl pages (their URLs and titles) and say in the spec where each came from.
- Write no site code, no TSX, no CSS. Specs only.

When every artifact is written, reply with one sentence naming the bold element.`;

    ctx.log("planning (reads screenshots + facts, writes design-plan then sitemap)");
    const result = await runLlmSession({
      prompt,
      cwd: ctx.repoRoot,
      model: process.env.PLAN_MODEL ?? "claude-sonnet-5",
      maxTurns: Number.parseInt(process.env.PLAN_MAX_TURNS ?? "40", 10),
      maxBudgetUsd: Number.parseFloat(process.env.PLAN_BUDGET_USD ?? "3"),
      allowedTools: ["Read", "Write", "Glob", "Grep"],
      effort: "high",
      log: ctx.log,
    });

    if (!result.ok) {
      return { ok: false, error: result.error ?? "plan session failed", costUsd: result.costUsd };
    }
    for (const required of ["design-plan.md", "sitemap.json"]) {
      if (!existsSync(join(planDir, required))) {
        return { ok: false, error: `plan session finished but ${required} was not written`, costUsd: result.costUsd };
      }
    }
    return { ok: true, costUsd: result.costUsd, data: { turns: result.numTurns } };
  },
};
