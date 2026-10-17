import { query, type Options } from "@anthropic-ai/claude-agent-sdk";

/**
 * Wrapper around one budget-capped Agent SDK session.
 *
 * Every LLM stage runs as a fresh session (plan §cost: long sessions resend
 * the whole conversation and lose cache on idle). Secrets are scoped: only
 * the variables a stage needs are forwarded into the subprocess env, so a
 * generate session never sees the Vercel or Telegram tokens.
 */

export interface LlmSessionInput {
  /** The task prompt. Stage instructions live in .claude/skills/<stage>/SKILL.md. */
  prompt: string;
  /** Working directory the session may read and edit. */
  cwd: string;
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
  /** Narrow allowlist; anything outside it is denied (dontAsk semantics). */
  allowedTools: string[];
  /** Appended to the built-in system prompt. */
  appendSystemPrompt?: string;
  /** Forces a JSON-schema-shaped final result. */
  outputSchema?: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  /** MCP servers this session may use (none by default). */
  mcpServers?: Record<string, { command: string; args: string[] }>;
  /** Extra env vars for the subprocess, merged over the scoped base. */
  env?: Record<string, string>;
  log: (message: string, data?: Record<string, unknown>) => void;
}

export interface LlmSessionResult {
  ok: boolean;
  /** Final assistant text (or the raw JSON string when outputSchema is set). */
  text: string;
  costUsd: number;
  numTurns: number;
  /** Set when the session ended on anything other than success. */
  error?: string;
}

/**
 * Environment forwarded to every LLM session. Deliberately minimal: the
 * model's Bash environment must not contain deploy or notification
 * credentials (docs/PLAN.md — tokens stay in the orchestrator process).
 */
function scopedEnv(extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    LANG: process.env.LANG ?? "en_US.UTF-8",
  };
  if (process.env.ANTHROPIC_API_KEY) {
    base.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }
  return { ...base, ...extra };
}

export async function runLlmSession(input: LlmSessionInput): Promise<LlmSessionResult> {
  const options: Options = {
    cwd: input.cwd,
    model: input.model,
    maxTurns: input.maxTurns,
    maxBudgetUsd: input.maxBudgetUsd,
    allowedTools: input.allowedTools,
    // Locked-down: anything needing a prompt is denied rather than asked.
    permissionMode: "dontAsk",
    // Load the repo's CLAUDE.md, .claude/rules and hooks for this session.
    settingSources: ["project"],
    env: scopedEnv(input.env),
    ...(input.appendSystemPrompt !== undefined
      ? { systemPrompt: { type: "preset" as const, preset: "claude_code" as const, append: input.appendSystemPrompt } }
      : {}),
    ...(input.outputSchema !== undefined
      ? { outputFormat: { type: "json_schema" as const, schema: input.outputSchema } }
      : {}),
    ...(input.effort !== undefined ? { effort: input.effort } : {}),
    ...(input.mcpServers !== undefined
      ? { mcpServers: input.mcpServers, strictMcpConfig: true }
      : {}),
  };

  let text = "";
  let costUsd = 0;
  let numTurns = 0;
  let error: string | undefined;
  let ok = false;

  for await (const message of query({ prompt: input.prompt, options })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text" && block.text.trim()) {
          input.log(`assistant: ${block.text.trim().slice(0, 160)}`);
        }
      }
      continue;
    }
    if (message.type !== "result") continue;

    costUsd = message.total_cost_usd;
    numTurns = message.num_turns;
    if (message.subtype === "success") {
      text = message.result;
      ok = !message.is_error;
      if (message.is_error) error = `session reported an error: ${message.result.slice(0, 300)}`;
    } else {
      error = `session ended with ${message.subtype}`;
    }
  }

  input.log(`session finished: $${costUsd.toFixed(4)} over ${numTurns} turn(s)`, {
    ok,
    model: input.model,
  });
  return { ok, text, costUsd, numTurns, ...(error !== undefined ? { error } : {}) };
}
