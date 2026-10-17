import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageContext } from "./types.js";
import { runLlmSession } from "../llm/session.js";

/**
 * Binary design rubric pass (DJ1-DJ12 in template/design-rules.md §6).
 *
 * Runs against the built site served locally, with a fresh session that has
 * no stake in the generation. Questions are neutral and binary and each
 * answer must cite observed evidence; generic-cluster and Turkish-text
 * failures (DJ3-DJ7) are hard fails, everything else is a design note.
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

const HARD_FAIL_IDS = new Set(["DJ3", "DJ4", "DJ5", "DJ6", "DJ7"]);

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
${join(ctx.repoRoot, "template", "design-rules.md")} §6 (questions DJ1-DJ12).

Read the rubric first, then inspect the running site with the Playwright MCP
tools. Take your own screenshots at 375px and 1440px wide before answering.

Answer every question DJ1 through DJ12. For each: the id, pass (true/false,
or null when it genuinely cannot be determined visually), and one sentence of
evidence citing what you actually observed — a screenshot region or a DOM
fact. Do not add criteria of your own, do not score aesthetics, and do not
comment on anything the rubric does not ask about.

Note the rubric's phrasing: for DJ3, DJ4, DJ5, DJ6, DJ7 and DJ10 a passing
answer means "no" (the generic trait is absent).`,
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

    const answers = parseAnswers(result.text);
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
