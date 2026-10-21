import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageContext } from "./types.js";
import { runLlmSession } from "../llm/session.js";
import {
  checkDj10,
  checkDj16,
  measureSmoothScrollInPage,
  measureTypeInPage,
  type MotionMeasurement,
} from "../design/directions/checks.js";
import { resolveDirection } from "../design/directions/stub.js";

/**
 * Binary design rubric pass (DJ1–DJ18 in template/design-rules.md §11).
 *
 * Runs against the built site served locally, with a fresh session that has
 * no stake in the generation. Questions are neutral and binary and each
 * answer must cite observed evidence.
 *
 * Two of the questions are NOT asked of the model. DJ10 and DJ16 are
 * measurable — weight, tracking, the display/body ratio and which motion
 * signatures a page carries are all readable with `getComputedStyle` — and
 * design-rules.md §12 already makes the case for deciding measurable things
 * by script. They are computed here against the run's direction
 * (docs/D10-design-variation.md §3.3) and merged into the answer set, so a direction
 * that calls for a 400-weight display and no pin is judged on its own terms
 * instead of against the one language the constants were written from.
 *
 * DJ17 is likewise not asked: the fingerprint it refers to is enforced in the
 * design stage, before any markup exists. D10 §8 replaces it with a measured
 * distance in task C4.
 */

export interface JudgeAnswer {
  id: string;
  pass: boolean | null;
  evidence: string;
}

export interface JudgeResult {
  ok: boolean;
  hardFails: string[];
  notes: string[];
  costUsd: number;
}

/**
 * The hard-fail set, identical to the sentence design-rules.md §11 ends with.
 * It had drifted three ways — the rubric said one thing, this set another and
 * acceptance.json a third — so `directions/checks.test.ts` now parses the
 * rubric and asserts this set matches it.
 */
export const HARD_FAIL_IDS = new Set([
  "DJ3",
  "DJ4",
  "DJ5",
  "DJ6",
  "DJ7",
  "DJ10",
  "DJ13",
  "DJ14",
  "DJ15",
  "DJ17",
]);

/** Answered by measurement below, never by the model. */
const MEASURED_IDS = ["DJ10", "DJ16"] as const;

const JUDGE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["answers"],
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "pass", "evidence"],
        properties: {
          id: { type: "string" },
          pass: { type: ["boolean", "null"] },
          evidence: { type: "string" },
        },
      },
    },
  },
};

export async function runDesignJudge(
  ctx: StageContext,
  siteDir: string,
): Promise<JudgeResult> {
  const port = process.env.JUDGE_PORT ?? "3400";
  ctx.log(`serving built site on :${port} for the design judge`);
  const server = spawn("pnpm", ["exec", "next", "start", "-p", port], {
    cwd: siteDir,
    stdio: "ignore",
    detached: false,
  });

  try {
    await waitForServer(`http://localhost:${port}/`, 60_000);

    const result = await runLlmSession({
      prompt: `Judge the site at http://localhost:${port}/ against the rubric in
${join(ctx.repoRoot, "template", "design-rules.md")} §11.

Answer DJ1-DJ9, DJ11-DJ15 and DJ18. Do NOT answer DJ10, DJ16 or DJ17: the
first two are measured in code against this run's direction and the third is
enforced in the design stage.

Read the rubric first, then inspect the running site with the Playwright MCP
tools. Take your own screenshots at 375px and 1440px wide before answering.

For each question you answer: the id, pass (true/false,
or null when it genuinely cannot be determined visually), and one sentence of
evidence citing what you actually observed — a screenshot region or a DOM
fact. Do not add criteria of your own, do not score aesthetics, and do not
comment on anything the rubric does not ask about.

Note the rubric's phrasing: for DJ3, DJ4, DJ5, DJ6, DJ7 and DJ15 a passing
answer means "no" (the unwanted trait is absent).

For DJ14, a placeholder is an image under
${join(ctx.runDir, "generate", "public", "images")} that ships with the
template (the generic SVGs named hero-placeholder / gallery-N) rather than a
photograph downloaded from the client's current site. Compare what the page
renders against
${join(ctx.runDir, "crawl", "asset-manifest.json")}.`,
      // Run from the run directory so the judge's screenshots and the
      // Playwright MCP scratch dir land under runs/<domain>/ instead of
      // littering the repo root.
      cwd: ctx.runDir,
      model: process.env.JUDGE_MODEL ?? "claude-opus-5",
      maxTurns: Number.parseInt(process.env.JUDGE_MAX_TURNS ?? "30", 10),
      maxBudgetUsd: Number.parseFloat(process.env.JUDGE_BUDGET_USD ?? "3"),
      allowedTools: ["Read", "Glob", "Grep", "mcp__playwright__*"],
      mcpServers: {
        playwright: {
          command: "npx",
          args: ["-y", "@playwright/mcp@latest", "--headless", "--isolated"],
        },
      },
      outputSchema: JUDGE_SCHEMA,
      effort: "high",
      log: ctx.log,
    });

    if (!result.ok) {
      ctx.log(`design judge did not complete: ${result.error ?? "unknown"}`);
      return { ok: true, hardFails: [], notes: ["judge did not run"], costUsd: result.costUsd };
    }

    const answers = parseAnswers(result.text).filter(
      (a) => !MEASURED_IDS.includes(a.id as (typeof MEASURED_IDS)[number]),
    );
    answers.push(...(await measureRanges(ctx, port)));

    const hardFails: string[] = [];
    const notes: string[] = [];
    for (const a of answers) {
      if (a.pass === false) {
        (HARD_FAIL_IDS.has(a.id) ? hardFails : notes).push(`${a.id}: ${a.evidence}`);
      }
    }

    mkdirSync(join(ctx.runDir, "verify"), { recursive: true });
    writeFileSync(
      join(ctx.runDir, "verify", "design-judge.json"),
      JSON.stringify({ answers, hardFails, notes }, null, 2) + "\n",
    );
    ctx.log(
      `design judge: ${hardFails.length} hard fail(s), ${notes.length} design note(s)`,
    );
    return { ok: hardFails.length === 0, hardFails, notes, costUsd: result.costUsd };
  } finally {
    server.kill();
  }
}

/**
 * DJ10 and DJ16, measured rather than asked.
 *
 * Drives Playwright directly instead of through the MCP session: the numbers
 * must be the same on every run, and a model reporting what it thinks a
 * screenshot's letter-spacing is cannot give that. A page we cannot measure
 * returns `pass: null` — indeterminate, not failed — because an invented
 * failure here would send the fix loop after nothing.
 */
async function measureRanges(
  ctx: StageContext,
  port: string,
): Promise<JudgeAnswer[]> {
  const spec = readJson<{
    direction?: string;
    motion?: { signatures?: string[]; heroEntrance?: boolean };
  }>(join(ctx.runDir, "design", "design.json"));
  const direction = resolveDirection(spec?.direction);
  ctx.log(`measuring DJ10/DJ16 against direction ${direction.id}`);

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    // tsx/esbuild (--keep-names) injects __name() into serialised evaluate fns.
    await page.addInitScript("globalThis.__name = globalThis.__name ?? ((fn) => fn);");
    await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });

    const type = await page.evaluate(measureTypeInPage);

    // The signatures the design stage recorded for this run are what DJ10 is
    // about; whether they survived into the markup is DJ11's question.
    //
    // Smooth scroll is read off the live page rather than the spec, because it
    // is the one of these the template installs unconditionally today (K8):
    // asking design.json would only report what we intended, not what shipped.
    const motion: MotionMeasurement = {
      signatures: (spec?.motion?.signatures ?? []).filter(
        (x): x is "pinned-handoff" | "text-transformation" =>
          x === "pinned-handoff" || x === "text-transformation",
      ),
      fadeUpOnly: false,
      heroEntrance: spec?.motion?.heroEntrance ?? false,
      smoothScroll: await page.evaluate(measureSmoothScrollInPage),
    };

    return [
      checkDj10(motion, direction),
      type
        ? checkDj16(type, direction)
        : {
            id: "DJ16",
            pass: null,
            evidence: "no measurable display/body pair on the page",
          },
    ];
  } catch (err) {
    ctx.log(`range measurement failed: ${err instanceof Error ? err.message : String(err)}`);
    return [
      { id: "DJ10", pass: null, evidence: "measurement failed" },
      { id: "DJ16", pass: null, evidence: "measurement failed" },
    ];
  } finally {
    await browser.close();
  }
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function parseAnswers(text: string): JudgeAnswer[] {
  try {
    const parsed = JSON.parse(text) as { answers?: JudgeAnswer[] };
    return Array.isArray(parsed.answers) ? parsed.answers : [];
  } catch {
    return [];
  }
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`server at ${url} did not start in time`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}
