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
- ${designRules} — the hard design rules. §2 (generic-AI clusters), §5 (Turkey),
  §7 (content reuse) and §8 (density and hierarchy) all constrain this plan.
- ${join(ctx.runDir, "crawl", "content.json")} — the CLIENT'S OWN TEXT: per-page
  content blocks, detected FAQ pairs and headings. This is the copy the rebuilt
  site uses. Read it properly; a plan that ignores it produces a thin site.
- ${join(ctx.runDir, "crawl", "asset-manifest.json")} — the photographs downloaded
  from the current site, with pixel dimensions. The rebuild uses these, not
  placeholders.
- ${screenshotDir} — mobile and desktop screenshots of the CURRENT site. Read at least index.mobile.png and index.desktop.png.
- The vendored \`ui-ux-pro-max\` skill at ${join(ctx.repoRoot, ".claude", "skills", "ui-ux-pro-max")} —
  a searchable dataset of product palettes (with reasoning profiles), font
  pairings, UX guidelines and per-section layout patterns. Query it for the
  palette and type pairing instead of reaching for your own defaults; read its
  SKILL.md first to learn how to search the data files.
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
   This is a one-page site: a single page at "/" with an ordered section list.
   Order sections by what a visitor needs, not by template order: what this
   business does and where → proof it is competent (team photos, treatments,
   FAQ) → how to reach it (contact, hours, map together at the end).
   Include a section ONLY if content.json actually has content for it; an
   empty testimonials block is worse than no testimonials block.

3. ${join(planDir, "sections")}/<id>.md — one spec per section in your sitemap.
   Each spec states: the section's purpose, which facts.json fields it consumes
   (name them), the chosen variant, and — the important part — THE ACTUAL
   TURKISH COPY, lifted from content.json. Quote the source text and give the
   edited version next to it. Editing means: fixing spelling and mojibake,
   splitting walls of text, cutting marketing filler, shortening a 120-word
   paragraph to 60. It does NOT mean inventing a claim, a treatment, a
   credential or a statistic the current site does not make.
   Each spec also names the specific image files from asset-manifest.json it
   uses, chosen by their width/height — the hero needs the largest usable
   photograph, not the first entry in the list.

Hard rules:
- Facts are verbatim. Never invent or "improve" a phone number, address, opening hour, price, or service name. If a fact is missing from facts.json, the section must not claim it.
- Turkish user-facing copy with correct ş/ğ/ı/İ/ç/ö/ü. Code, file names and your own notes in English.
- Services are NOT in facts.json — take them from content.json (service page
  titles AND their descriptions) and cite the source URL for each.
- Staff portraits and clinic photographs from the crawl ARE used (operator
  decision, see design-rules.md §7). Name them per section.
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
