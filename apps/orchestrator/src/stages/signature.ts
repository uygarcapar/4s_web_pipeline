import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageContext, StageModule } from "./types.js";
import { designSpecSchema, type DesignSpec } from "@pipeline/core";
import { runLlmSession } from "../llm/session.js";
import { resolveDirection } from "../design/directions/index.js";
import { shootSite } from "../design/shots.js";

/**
 * The one bold element (D10 §9) — the only place a model writes bespoke JSX.
 *
 * Runs after `generate`, so the site exists and the signature section is
 * already in `site.config.ts` with its copy; and before `verify`, so
 * whatever it writes faces every gate the rest of the site does. It edits
 * exactly one file — `src/sections/signature/custom.tsx`, the slot the
 * registry already imports — which is how §9's freedom coexists with
 * build-rules §4's "sections render exclusively through the registry".
 *
 * The loop is write → build → screenshot → critique → revise, at most three
 * rounds. The critique is a separate session with vision, looking at the
 * actual rendered page beside the direction's reference screenshots, because
 * the thing being judged is whether the section looks like the direction
 * claims to — and that is not a question source code can answer.
 *
 * **It never fails the run.** §9: "fall back to the direction's default
 * archetype for that slot (never BLOCKED for taste alone)." A signature
 * element that will not converge leaves the client with the default
 * `Signature` section, which is a perfectly good section — just not a bold
 * one. Blocking a finished site over taste would be the wrong trade every
 * time, because the operator reviews the page anyway.
 */
export const signatureStage: StageModule = {
  stage: "signature",
  artifactPath: (ctx) => join(ctx.runDir, "signature", "result.json"),

  async run(ctx) {
    const siteDir = join(ctx.runDir, "generate");
    const outDir = join(ctx.runDir, "signature");
    mkdirSync(outDir, { recursive: true });

    const spec = readSpec(ctx);
    if (spec === null) {
      return { ok: false, error: "design/design.json missing or not a DesignSpec" };
    }

    const slot = join(siteDir, "src", "sections", "signature", "custom.tsx");
    if (!existsSync(slot)) {
      return { ok: false, error: `signature slot missing: ${slot}` };
    }

    // No signature section on this page. Not a failure: `placeSignature`
    // only emits one for a client whose own sentence the brief vouched for,
    // and there is nothing to write markup about without their words.
    if (!spec.sections.some((s) => s.type === "signature")) {
      const result = { built: false, reason: "no signature section in this spec" };
      writeFileSync(join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");
      ctx.log("no signature section — the hero carries the page");
      return { ok: true, data: result };
    }

    // The pristine slot, kept so the fallback is a restore rather than a
    // regeneration. A half-written component is worse than the default.
    const pristine = join(outDir, "custom.pristine.tsx");
    if (!existsSync(pristine)) copyFileSync(slot, pristine);

    const direction = resolveDirection(spec.direction);
    const refs = direction.refs
      .map((r) => join(ctx.repoRoot, r))
      .filter((r) => existsSync(r));

    let costUsd = 0;
    let critique = "";

    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
      ctx.log(`signature round ${round}/${MAX_ROUNDS}`);

      const write = await runLlmSession({
        prompt: writePrompt({ ctx, siteDir, spec, direction, refs, critique, round }),
        cwd: siteDir,
        model: MODEL,
        maxTurns: 24,
        maxBudgetUsd: remaining(costUsd),
        allowedTools: ["Read", "Glob", "Grep", "Edit", "Write", "Bash(pnpm exec tsc *)"],
        log: ctx.log,
      });
      costUsd += write.costUsd;
      if (!write.ok) {
        ctx.log(`signature write failed: ${write.error ?? "unknown"}`);
        break;
      }

      const shots = await screenshot(ctx, siteDir, outDir, round);
      if (shots === null) {
        // It did not build. That is a verdict, and the next round gets told
        // so — but a third failed build means the default is the better
        // page, not that we should keep paying to find out.
        critique = BUILD_FAILED;
        continue;
      }

      const verdict = await runCritique({
        ctx,
        spec,
        direction,
        refs,
        shots,
        budget: remaining(costUsd),
      });
      costUsd += verdict.costUsd;

      if (verdict.pass) {
        const result = {
          built: true,
          rounds: round,
          concept: spec.signature.concept,
          evidence: verdict.notes,
        };
        writeFileSync(join(outDir, "result.json"), JSON.stringify(result, null, 2) + "\n");
        ctx.log(`signature accepted in round ${round}: ${verdict.notes}`, { costUsd });
        return { ok: true, costUsd, data: result };
      }

      critique = verdict.notes;
      ctx.log(`signature round ${round} rejected: ${verdict.notes}`);
      if (remaining(costUsd) <= 0) {
        ctx.log("signature budget spent");
        break;
      }
    }

    return fallback(ctx, { slot, pristine, outDir, costUsd });
  },
};

/** §6.3's budget line for the signature loop. */
const BUDGET_USD = 2.5;

/** §9: "Max 3 rounds, then fall back." */
const MAX_ROUNDS = 3;

const MODEL = "claude-sonnet-5";

const BUILD_FAILED =
  "The previous attempt did not compile. Read the error from `pnpm exec tsc " +
  "--noEmit`, fix it, and keep the component simpler than last time.";

const remaining = (spent: number): number => Math.max(0, BUDGET_USD - spent);

/**
 * Restore the slot and drop the section's `variant`, so the page renders the
 * default `Signature`.
 *
 * Both halves matter. Restoring alone would leave `variant: "custom"` in the
 * config pointing at a component that is now the default — which works, but
 * says the site has a bespoke signature when it does not, and the next
 * person to read the config would believe it.
 */
function fallback(
  ctx: StageContext,
  paths: { slot: string; pristine: string; outDir: string; costUsd: number },
): { ok: true; costUsd: number; data: Record<string, unknown> } {
  copyFileSync(paths.pristine, paths.slot);

  const config = join(ctx.runDir, "generate", "site.config.ts");
  if (existsSync(config)) {
    const before = readFileSync(config, "utf8");
    const after = dropSignatureVariant(before);
    if (after !== before) writeFileSync(config, after);
  }

  const result = {
    built: false,
    reason: "no round converged; the default signature section ships instead",
  };
  writeFileSync(
    join(paths.outDir, "result.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  ctx.log(
    "signature fell back to the default section — a finished site is never " +
      "blocked for taste (§9)",
    { costUsd: paths.costUsd },
  );
  return { ok: true, costUsd: paths.costUsd, data: result };
}

async function screenshot(
  ctx: StageContext,
  siteDir: string,
  outDir: string,
  round: number,
): Promise<{ desktop: string; mobile: string } | null> {
  try {
    return await shootSite({
      siteDir,
      outDir: join(outDir, `round-${round}`),
      port: SIGNATURE_PORT,
      // Always rebuild: the whole point is to photograph what this round
      // just wrote, and `.next` is stale from the previous one.
      build: true,
    });
  } catch (err) {
    ctx.log(
      `signature round ${round} did not build: ` +
        `${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
    );
    return null;
  }
}

const SIGNATURE_PORT = 3141;

interface WritePromptInput {
  ctx: StageContext;
  siteDir: string;
  spec: DesignSpec;
  direction: ReturnType<typeof resolveDirection>;
  refs: string[];
  critique: string;
  round: number;
}

function writePrompt(input: WritePromptInput): string {
  const { ctx, siteDir, spec, direction, refs, critique, round } = input;
  const slot = join(siteDir, "src", "sections", "signature", "custom.tsx");

  return `Write the ONE bold element for this site (docs/D10-design-variation.md §9).

Edit exactly one file: ${slot}
Nothing else. Not the config, not another section, not the tokens.

## What it is for

${spec.signature.concept}

The direction is ${direction.id} — ${direction.label}. Its intent:
${direction.intent}

What this direction will not do:
${direction.avoid.map((a) => `- ${a}`).join("\n")}

## Read first

- ${join(siteDir, "site.config.ts")} — find the section with \`type: "signature"\`.
  Its \`text\`, \`images\` and \`cta\` are the ONLY content you may render.
- ${join(siteDir, "src", "sections", "signature", "index.tsx")} — the default
  you are trying to beat. It is a competent section; beat it or leave it.
- ${join(siteDir, "src", "styles", "tokens.css")} — the eight type steps and
  the paper/ink ramp. Every size and colour you use comes from here.
- ${join(siteDir, "src", "lib", "schema.ts")} — \`SignatureSection\`'s exact shape.
${refs.length > 0 ? `- The direction's reference screenshots:\n${refs.map((r) => `  ${r}`).join("\n")}` : ""}

## Hard rules — a violation fails the whole site at verify

- Content comes from \`section\` and \`config\`. You may not write a Turkish
  sentence of your own, invent an hour, a price or a service, or add a fact.
  Reordering and emphasising what is already there is the whole job.
- Colour: \`var(--ink-*)\`, \`var(--paper-*)\`, \`var(--brand-accent)\`. No hex,
  no \`text-white\`, no colour of your own.
- Type: the eight steps (t-display, t-h2, t-h2-col, t-h3, t-lead, t-body,
  meta, btn-label). A font-size you invent breaks the scale the page is on.
- Images: \`next/image\`, never \`<img>\`.
- Turkish casing via \`upperTR\` from \`@/lib/format\` — never
  \`.toUpperCase()\`, which turns "için" into "IÇIN".
- Tap targets ≥ 44px. Every interactive element needs a visible
  \`focus-visible\` ring.
- Reduced motion: under \`prefers-reduced-motion: reduce\` nothing animates
  AND nothing stays hidden. If a timeline would reveal something, it must
  already be visible.
- It must compile: \`pnpm exec tsc --noEmit\` before you finish.

## What "bold" means here

One idea, executed completely. A section that is merely *different* from the
default is not better than it. Look at the reference screenshots: each one
does a single thing at a scale that would be uncomfortable anywhere else on
the page. That is the bar.
${
  round > 1
    ? `\n## The previous round was rejected\n\n${critique}\n\nAddress this specifically. Do not start over from the default.`
    : ""
}
Working directory: ${ctx.runDir}`;
}

interface CritiqueInput {
  ctx: StageContext;
  spec: DesignSpec;
  direction: ReturnType<typeof resolveDirection>;
  refs: string[];
  shots: { desktop: string; mobile: string };
  budget: number;
}

/**
 * Look at the page and say whether the bold element is actually bold.
 *
 * A separate session from the one that wrote it, and a deliberately hostile
 * one: a model asked "is your own work good" says yes. The default bar is
 * the comparison that matters — "better than the section it replaced" is a
 * question with a real answer, where "is it good" is not.
 */
async function runCritique(input: CritiqueInput): Promise<{
  pass: boolean;
  notes: string;
  costUsd: number;
}> {
  const { ctx, spec, direction, refs, shots, budget } = input;

  const session = await runLlmSession({
    prompt: `Judge one section of a generated site. Be hostile: the default it replaced is competent, and a merely-different section is a worse outcome than keeping the default.

Look at these screenshots of the rendered page:
- ${shots.desktop}
- ${shots.mobile}

${refs.length > 0 ? `The direction's reference screenshots, which it is supposed to belong beside:\n${refs.map((r) => `- ${r}`).join("\n")}\n` : ""}
The section is the one built from this concept:
${spec.signature.concept}

Direction: ${direction.id}. What it refuses to do:
${direction.avoid.map((a) => `- ${a}`).join("\n")}

Answer these, from what you can SEE:
1. Is there one idea, executed at a scale that would be uncomfortable
   elsewhere on the page? Or is it a card with bigger text?
2. Does it belong beside the reference screenshots, or does it read as a
   different site pasted in?
3. Does it still work on the mobile fold, or does the idea only survive at
   desktop width?
4. Is anything illegible, overlapping, or cut off?

Pass ONLY if 1-3 are yes and 4 is no. Cite what you saw — a region of the
screenshot, not a guess about the code.`,
    cwd: ctx.runDir,
    model: MODEL,
    maxTurns: 12,
    maxBudgetUsd: budget,
    allowedTools: ["Read", "Glob", "mcp__playwright__*"],
    mcpServers: {
      playwright: {
        command: "npx",
        args: ["-y", "@playwright/mcp@latest", "--headless", "--isolated"],
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["pass", "notes"],
      properties: {
        pass: { type: "boolean" },
        notes: {
          type: "string",
          description:
            "One paragraph. On a fail, what specifically to change — the " +
            "next round is given this verbatim.",
        },
      },
    },
    log: ctx.log,
  });

  if (!session.ok) {
    // A critique that did not run is not a pass. The default ships.
    return {
      pass: false,
      notes: `critique session failed: ${session.error ?? "unknown"}`,
      costUsd: session.costUsd,
    };
  }

  try {
    const parsed = JSON.parse(session.text) as { pass?: unknown; notes?: unknown };
    return {
      pass: parsed.pass === true,
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      costUsd: session.costUsd,
    };
  } catch {
    return { pass: false, notes: session.text.slice(0, 1200), costUsd: session.costUsd };
  }
}

function readSpec(ctx: StageContext): DesignSpec | null {
  const path = join(ctx.runDir, "design", "design.json");
  if (!existsSync(path)) return null;
  const parsed = designSpecSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  return parsed.success ? parsed.data : null;
}

/**
 * Remove `variant` from the signature section's object, and from nothing
 * else.
 *
 * Brace-matched rather than pattern-matched. The regex this replaces looked
 * contained — it anchored on `type: "signature"` and allowed 400 characters
 * before the variant — but in the multi-line shape the generate stage
 * actually writes, a signature section with no variant let the match run
 * past the closing brace and strip the NEXT section's variant instead. A
 * fallback whose job is to make one section boring must not be able to take
 * a layout choice away from another one.
 *
 * Returns the source unchanged when there is no signature section, when it
 * has no variant, or when the braces do not balance.
 */
export function dropSignatureVariant(source: string): string {
  const marker = source.indexOf('type: "signature"');
  if (marker === -1) return source;

  const open = source.lastIndexOf("{", marker);
  if (open === -1) return source;

  let depth = 0;
  let close = -1;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return source;

  const object = source.slice(open, close + 1);
  // Its own line, with the trailing comma, so nothing is left dangling.
  const stripped = object.replace(/\n[ \t]*variant:\s*"[^"]*",?/, "");
  return stripped === object ? source : source.slice(0, open) + stripped + source.slice(close + 1);
}
