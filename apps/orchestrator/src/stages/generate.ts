import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
    const assetCount = stageCrawlAssets(ctx, siteDir);
    ctx.log(`${assetCount} crawl photograph(s) staged in public/images/crawl/`);

    // The palette and the type pairing are decisions the design stage already
    // made from this client's own photographs and sector, and checked against
    // the fingerprint ledger (D6). They are copied in rather than described
    // to the model: a model asked to choose a palette reaches for the same
    // one every time, which is the sameness the ledger exists to prevent.
    const staged = stageDesign(ctx, siteDir);
    if (!staged) {
      return { ok: false, error: "design/tokens.css missing (design stage must run first)" };
    }
    ctx.log("design tokens and fonts staged from the design stage");

    const factsPath = join(ctx.runDir, "audit", "facts.json");
    const prompt = `Fill the Next.js template at ${siteDir} for this client.

Read first:
- ${join(planDir, "design-plan.md")} — the design you are implementing. Follow it; the "one bold element" must survive into the build.
- ${join(planDir, "sitemap.json")} — the exact sections and their order.
- ${join(ctx.runDir, "design", "design.json")} — this client's design DNA:
  the palette derived from their own photographs, their type pairing, the
  layout archetype per section, and which section carries the pinned
  hand-off and which the text transformation.
- ${join(planDir, "sections")}/ — one spec per section.
- ${factsPath} — verbatim ground truth (name, phone, address, hours).
- ${join(ctx.runDir, "crawl", "content.json")} — the client's own Turkish text.
  The section specs quote it; this is the full source if you need more.
- ${join(siteDir, "public", "images", "crawl", "manifest.json")} — the
  photographs from the current site, ALREADY COPIED into the site. Each entry
  has pixel width/height, the original source URL, and \`public_path\` — the
  exact string to put in site.config.ts (e.g. "/images/crawl/3-image.jpg").
  Do not try to copy or create image files; they are in place. Placeholders
  under /images/ are only for sections the crawl found no photograph for.
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
(public/images/ is already populated — reference the files, do not add any)

Do NOT edit src/styles/tokens.css or src/lib/fonts.ts. Both are generated:
the palette was derived from this client's own photographs and the type
pairing was chosen for their sector and checked against the design
fingerprint ledger, so that two businesses in the same trade cannot be
handed the same-looking site. Use the tokens that are there.

Rules that will be checked mechanically after you finish:
- Every value in facts.json is verbatim. Do not invent or alter a phone number, address, opening hour, service name or price. A fact that is absent must not be claimed.
- No value from the reference clinic may survive: "Moda Diş Kliniği", +905551234567, info@modadisklinigi.example and similar must all be gone.
- Turkish user-facing copy with real ş/ğ/ı/İ/ç/ö/ü. Code and comments in English.
- Phone and WhatsApp links only via telHref/waHref from src/lib/format.ts; currency via formatTRY, dates via formatDateTR, uppercase via upperTR.
- next/image only, never <img>. No arbitrary hex and no colour of your own in sections: use the paper-*/ink-*/accent tokens from tokens.css, and the type steps (t-display, t-h2, t-h2-col, t-h3, t-lead, t-body, meta, btn-label). A section that invents a size or a colour breaks the scale the whole site is built on.
- Use the REAL photographs, including staff portraits (operator decision,
  design-rules.md §7). Reference them by their \`public_path\` from
  public/images/crawl/manifest.json and give next/image their true
  width/height from the same entry. The hero takes the largest usable
  photograph. Every image path you write is checked against the filesystem
  afterwards: a path with no file behind it fails the stage.
- Every section renders real body content, not a list of labels: a service
  shows its description, a team member their title, an FAQ entry its answer.
  If a section has no source content, drop it from site.config.ts rather than
  padding it with invented copy.
- Each section's \`variant\` in site.config.ts must be the archetype named for
  it in design.json. That is the layout this client was assigned; changing it
  puts them back on the same structure as every other site in their trade.
- If design.json or the tokens look wrong for this business, say so in your
  final message rather than working around them.

Work in this order: site.config.ts first (it drives everything), then each section component. After each meaningful edit run \`pnpm exec tsc --noEmit\` in ${siteDir} and fix what it reports.

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

    const missingImages = verifyImagePaths(siteDir);
    if (missingImages.length > 0) {
      return {
        ok: false,
        error: `referenced images do not exist: ${missingImages.join("; ")}`,
        costUsd: result.costUsd,
      };
    }

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

/**
 * Copy the crawl's photographs into the site's public directory before the
 * session starts.
 *
 * The model cannot do this itself: binary files do not survive Read/Write,
 * and giving a generate session shell access to copy them would widen its
 * tool surface for no benefit. When it was asked to copy them anyway it
 * wrote correct filenames into site.config.ts with no files behind them,
 * the browser 404'd on every image, and Lighthouse's errors-in-console
 * audit took the whole verify gate down.
 */
function stageCrawlAssets(ctx: StageContext, siteDir: string): number {
  const assetsDir = join(ctx.runDir, "crawl", "assets");
  const manifestPath = join(ctx.runDir, "crawl", "asset-manifest.json");
  if (!existsSync(assetsDir) || !existsSync(manifestPath)) return 0;

  const target = join(siteDir, "public", "images", "crawl");
  mkdirSync(target, { recursive: true });
  cpSync(assetsDir, target, { recursive: true });

  // Keep provenance next to the images so it survives into the demo, and
  // give the session a manifest whose paths are the ones it must reference.
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    file: string;
    width: number | null;
    height: number | null;
  }[];
  const withPublicPaths = manifest.map((entry) => ({
    ...entry,
    public_path: `/images/crawl/${entry.file}`,
  }));
  writeFileSync(
    join(target, "manifest.json"),
    JSON.stringify(withPublicPaths, null, 2) + "\n",
  );
  return manifest.length;
}

/**
 * Every image path a generated site references must exist on disk. A missing
 * file is invisible to tsc and to the build, and only surfaces as a console
 * 404 that fails Lighthouse — far from its cause.
 */
export function verifyImagePaths(siteDir: string): string[] {
  const missing: string[] = [];
  const sources = [
    join(siteDir, "site.config.ts"),
    ...readdirSync(join(siteDir, "src", "sections"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(siteDir, "src", "sections", d.name, "index.tsx")),
  ].filter((p) => existsSync(p));

  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/["'`](\/images\/[^"'`]+)["'`]/g)) {
      const rel = match[1];
      if (!rel) continue;
      if (!existsSync(join(siteDir, "public", rel))) {
        missing.push(`${rel} (referenced in ${file.replace(siteDir + "/", "")})`);
      }
    }
  }
  return [...new Set(missing)];
}

/**
 * Copy the design stage's artefacts into the site: the token scale derived
 * from this client's photographs, and the font module for the pairing chosen
 * for their sector.
 *
 * Deterministic for the same reason the photographs are staged deterministically
 * — the model has no tool that can produce either correctly, and asking it to
 * try is how a site ends up with a palette that belongs to nobody.
 *
 * Returns false if the design stage has not run.
 */
function stageDesign(ctx: StageContext, siteDir: string): boolean {
  const designDir = join(ctx.runDir, "design");
  const tokens = join(designDir, "tokens.css");
  const fonts = join(designDir, "fonts.ts");
  if (!existsSync(tokens) || !existsSync(fonts)) return false;

  mkdirSync(join(siteDir, "src", "styles"), { recursive: true });
  mkdirSync(join(siteDir, "src", "lib"), { recursive: true });
  copyFileSync(tokens, join(siteDir, "src", "styles", "tokens.css"));
  copyFileSync(fonts, join(siteDir, "src", "lib", "fonts.ts"));
  return true;
}
