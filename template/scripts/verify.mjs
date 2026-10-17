#!/usr/bin/env node
/**
 * verify.mjs — quality-gate orchestrator for a generated client site.
 *
 * Run with cwd = the site copy: `node scripts/verify.mjs`
 *
 * Gates in COST ORDER, stopping at the first hard failure:
 *   1. tsc        — `next typegen` + `tsc --noEmit`
 *   2. eslint     — `eslint . --format json` (errors fail, warnings are notes)
 *   3. build      — `next build` (production build, required by later gates)
 *   4. playwright — smoke + axe + visual (first run creates visual baselines
 *                   via --update-snapshots=missing)
 *   5. lhci       — `lhci autorun` (assertion failures are hard; INFRA
 *                   failures of LHCI itself are downgraded to WARN — see
 *                   lighthouserc.cjs caveat about LHCI 0.15.x / Lighthouse 12)
 *   6. links      — linkinator against a self-managed `next start -p 3102`;
 *                   broken INTERNAL links fail, broken external links WARN.
 *
 * Always writes verify-digest.md (≤ ~4k tokens, normalized failures).
 * On all gates green: writes `${PIPELINE_REPO_ROOT ?? "../.."}/.pipeline/verify-passed`
 * and exits 0. Any hard failure exits 1.
 */

import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const CWD = process.cwd();
const DIGEST_PATH = path.join(CWD, "verify-digest.md");
const LINKS_PORT = 3102;
const MAX_BUFFER = 64 * 1024 * 1024;

// Make sure children use the same node as this script (node >= 22 required;
// the default system node breaks pnpm).
const ENV = {
  ...process.env,
  PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`,
};

/** @type {{name:string,status:"pass"|"fail"|"warn"|"skip",seconds:number,details:string[],notes:string[]}[]} */
const gates = [];

// Strip ANSI color codes from tool output before parsing/digesting.
const stripAnsi = (text) => text.replace(/\x1b\[[0-9;]*m/g, "");

function run(command, args, { timeoutMs = 600_000 } = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: CWD,
    env: ENV,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    timeout: timeoutMs,
  });
  return {
    status: result.status,
    stdout: stripAnsi(result.stdout ?? ""),
    stderr: stripAnsi(result.stderr ?? ""),
    error: result.error,
    seconds: (Date.now() - started) / 1000,
  };
}

function record(name, status, seconds, details = [], notes = []) {
  gates.push({ name, status, seconds, details, notes });
  const icon = { pass: "✅", fail: "❌", warn: "⚠️", skip: "⏭" }[status];
  console.log(`${icon} ${name} (${seconds.toFixed(1)}s)`);
  for (const line of details.slice(0, 10)) console.log(`   ${line}`);
}

const cap = (lines, max) =>
  lines.length > max
    ? [...lines.slice(0, max), `… ${lines.length - max} more`]
    : lines;

const tail = (text, n) =>
  text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .slice(-n);

/* ------------------------------------------------------------------ */
/* Gate 1: tsc                                                         */
/* ------------------------------------------------------------------ */
function gateTsc() {
  // next typegen generates .next/types (LayoutProps/PageProps) that
  // tsc --noEmit needs on a fresh checkout.
  const typegen = run("pnpm", ["exec", "next", "typegen"]);
  if (typegen.status !== 0) {
    record("tsc", "fail", typegen.seconds, [
      "next typegen failed:",
      ...tail(typegen.stdout + typegen.stderr, 10),
    ]);
    return false;
  }
  const res = run("pnpm", ["exec", "tsc", "--noEmit"]);
  if (res.status === 0) {
    record("tsc", "pass", typegen.seconds + res.seconds);
    return true;
  }
  // Normalize "path(line,col): error TSxxxx: message" → "path:line message"
  const details = [];
  const pattern = /^(.+?)\((\d+),\d+\): (error TS\d+: .*)$/gm;
  let match;
  while ((match = pattern.exec(res.stdout)) !== null) {
    details.push(`${match[1]}:${match[2]} ${match[3]}`);
  }
  if (details.length === 0) details.push(...tail(res.stdout + res.stderr, 15));
  record("tsc", "fail", typegen.seconds + res.seconds, cap(details, 25));
  return false;
}

/* ------------------------------------------------------------------ */
/* Gate 2: eslint                                                      */
/* ------------------------------------------------------------------ */
function gateEslint() {
  const res = run("pnpm", ["exec", "eslint", ".", "--format", "json"]);
  let report;
  try {
    const jsonStart = res.stdout.indexOf("[");
    report = JSON.parse(res.stdout.slice(jsonStart));
  } catch {
    record("eslint", "fail", res.seconds, [
      "eslint produced no parseable JSON:",
      ...tail(res.stdout + res.stderr, 10),
    ]);
    return false;
  }

  /** rule → Set of "file:line" (deduped) */
  const errorsByRule = new Map();
  const warningsByRule = new Map();
  for (const file of report) {
    const rel = path.relative(CWD, file.filePath);
    for (const msg of file.messages) {
      const bucket = msg.severity === 2 ? errorsByRule : warningsByRule;
      const rule = msg.ruleId ?? "(parser)";
      if (!bucket.has(rule)) bucket.set(rule, { message: msg.message, locations: new Set() });
      bucket.get(rule).locations.add(`${rel}:${msg.line}`);
    }
  }

  const format = (map) =>
    [...map.entries()].map(
      ([rule, { message, locations }]) =>
        `${rule} — ${message} → ${cap([...locations], 8).join(", ")}`,
    );

  const notes = cap(format(warningsByRule), 10);
  if (errorsByRule.size > 0) {
    record("eslint", "fail", res.seconds, cap(format(errorsByRule), 25), notes);
    return false;
  }
  record("eslint", "pass", res.seconds, [], notes);
  return true;
}

/* ------------------------------------------------------------------ */
/* Gate 3: build                                                       */
/* ------------------------------------------------------------------ */
function gateBuild() {
  const res = run("pnpm", ["run", "build"]);
  if (res.status === 0) {
    record("build", "pass", res.seconds);
    return true;
  }
  record("build", "fail", res.seconds, cap(tail(res.stdout + res.stderr, 30), 30));
  return false;
}

/* ------------------------------------------------------------------ */
/* Gate 4: playwright                                                  */
/* ------------------------------------------------------------------ */
function hasVisualBaselines() {
  const testsDir = path.join(CWD, "tests");
  if (!existsSync(testsDir)) return false;
  for (const entry of readdirSync(testsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.endsWith("-snapshots")) {
      const files = readdirSync(path.join(testsDir, entry.name));
      if (files.some((f) => f.endsWith(".png"))) return true;
    }
  }
  return false;
}

function collectPlaywrightFailures(reportPath) {
  /** @type {string[]} */
  const failures = [];
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    return null;
  }
  const walk = (suite, trail) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        if (!last || ["passed", "skipped"].includes(last.status)) continue;
        const where = [t.projectName, ...trail, spec.title]
          .filter(Boolean)
          .join(" › ");
        const message = stripAnsi(
          last.error?.message ?? last.errors?.[0]?.message ?? last.status,
        );
        const firstLines = message
          .split("\n")
          .filter((l) => l.trim() !== "")
          .slice(0, 6)
          .map((l) => `    ${l.trim()}`);
        failures.push(`${where}`, ...firstLines);
      }
    }
    for (const child of suite.suites ?? []) walk(child, [...trail, child.title]);
  };
  for (const suite of report.suites ?? []) walk(suite, [suite.title]);
  // Global errors (webServer startup, config errors) live outside suites.
  for (const err of report.errors ?? []) {
    failures.push(
      ...stripAnsi(err.message ?? String(err))
        .split("\n")
        .filter((l) => l.trim() !== "")
        .slice(0, 6),
    );
  }
  return failures;
}

function gatePlaywright() {
  const reportPath = path.join(CWD, "test-results", "results.json");
  rmSync(reportPath, { force: true });

  const args = ["exec", "playwright", "test"];
  if (!hasVisualBaselines()) {
    // First verify run for this client: create the per-client visual
    // baselines instead of failing on missing snapshots.
    args.push("--update-snapshots=missing");
  }
  const res = run("pnpm", args);
  if (res.status === 0) {
    record("playwright", "pass", res.seconds);
    return true;
  }
  const collected = collectPlaywrightFailures(reportPath);
  const failures =
    collected && collected.length > 0
      ? collected
      : [
          "playwright run failed without per-test failures in the report:",
          ...tail(res.stdout + res.stderr, 15),
        ];
  record("playwright", "fail", res.seconds, cap(failures, 40));
  return false;
}

/* ------------------------------------------------------------------ */
/* Gate 5: lhci                                                        */
/* ------------------------------------------------------------------ */
function readLhciScores() {
  try {
    const manifest = JSON.parse(
      readFileSync(path.join(CWD, ".lighthouseci", "manifest.json"), "utf8"),
    );
    const run0 = manifest.find((m) => m.isRepresentativeRun) ?? manifest[0];
    if (!run0?.summary) return null;
    return Object.entries(run0.summary)
      .map(([cat, score]) => `${cat}=${Math.round(score * 100) / 100}`)
      .join(" ");
  } catch {
    return null;
  }
}

function gateLhci() {
  const assertionResultsPath = path.join(
    CWD,
    ".lighthouseci",
    "assertion-results.json",
  );
  rmSync(assertionResultsPath, { force: true });

  const res = run("pnpm", [
    "exec",
    "lhci",
    "autorun",
    "--config=lighthouserc.cjs",
  ]);

  /** @type {{errors:string[], recommendations:string[]}} */
  let assertions = null;
  try {
    const parsed = JSON.parse(readFileSync(assertionResultsPath, "utf8"));
    assertions = { errors: [], recommendations: [] };
    for (const a of parsed) {
      if (a.passed) continue;
      const line = `${a.auditId ?? a.name} — expected ${a.operator ?? ""} ${a.expected}, actual ${a.actual} (${a.url})`;
      if (a.level === "error") assertions.errors.push(line);
      else assertions.recommendations.push(`öneri/recommendation: ${line}`);
    }
  } catch {
    // No assertion results — LHCI never got as far as asserting.
  }

  const scores = readLhciScores();
  const scoreNote = scores ? [`median-run scores: ${scores}`] : [];

  if (res.status === 0) {
    record("lhci", "pass", res.seconds, [], [
      ...scoreNote,
      ...(assertions?.recommendations ?? []),
    ]);
    return { ok: true };
  }

  if (assertions && assertions.errors.length > 0) {
    // Real threshold failures: hard gate.
    record("lhci", "fail", res.seconds, cap(assertions.errors, 20), [
      ...scoreNote,
      ...assertions.recommendations,
    ]);
    return { ok: false };
  }

  // LHCI itself fell over (collect/chrome/server problem) before producing
  // failed assertions — per plan §4 (LHCI 0.15.x bundles Lighthouse 12 and
  // may misbehave with Next 16): WARN, not a hard gate.
  record(
    "lhci",
    "warn",
    res.seconds,
    [
      "LHCI infra failure (not an assertion failure) — downgraded to WARN:",
      ...tail(res.stdout + res.stderr, 12),
    ],
    scoreNote,
  );
  return { ok: true, infraWarned: true };
}

/* ------------------------------------------------------------------ */
/* Gate 6: links                                                       */
/* ------------------------------------------------------------------ */
async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function gateLinks() {
  const started = Date.now();
  const base = `http://localhost:${LINKS_PORT}`;
  const server = spawn("pnpm", ["exec", "next", "start", "-p", String(LINKS_PORT)], {
    cwd: CWD,
    env: ENV,
    detached: true,
    stdio: "ignore",
  });
  const killServer = () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      try {
        server.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    }
  };

  try {
    if (!(await waitForServer(base, 60_000))) {
      record("links", "fail", (Date.now() - started) / 1000, [
        `next start -p ${LINKS_PORT} did not become ready within 60s`,
      ]);
      return false;
    }

    const { LinkChecker } = await import("linkinator");
    const checker = new LinkChecker();
    const result = await checker.check({
      path: base,
      recurse: true,
      timeout: 15_000,
      retry: true,
    });

    const broken = result.links.filter((link) => link.state === "BROKEN");
    const describe = (link) =>
      `${link.url} (status ${link.status ?? "?"}) ← ${link.parent ?? "?"}`;
    const internalBroken = broken
      .filter((link) => link.url.startsWith(base))
      .map(describe);
    const externalBroken = broken
      .filter((link) => !link.url.startsWith(base))
      .map((link) => `external: ${describe(link)}`);

    const seconds = (Date.now() - started) / 1000;
    const checkedNote = [`${result.links.length} links checked`];
    if (internalBroken.length > 0) {
      record("links", "fail", seconds, cap(internalBroken, 20), [
        ...checkedNote,
        ...cap(externalBroken, 10),
      ]);
      return false;
    }
    record(
      "links",
      externalBroken.length > 0 ? "warn" : "pass",
      seconds,
      cap(externalBroken, 10),
      checkedNote,
    );
    return true;
  } finally {
    killServer();
  }
}

/* ------------------------------------------------------------------ */
/* Digest + marker                                                     */
/* ------------------------------------------------------------------ */
function writeDigest(allGreen) {
  const icon = { pass: "✅", fail: "❌", warn: "⚠️", skip: "⏭" };
  const lines = [
    "# verify-digest",
    "",
    `- date: ${new Date().toISOString()}`,
    `- result: ${allGreen ? "ALL GATES GREEN" : "FAILED"}`,
    "",
    "| gate | status | time |",
    "|---|---|---|",
    ...gates.map(
      (g) => `| ${g.name} | ${icon[g.status]} ${g.status} | ${g.seconds.toFixed(1)}s |`,
    ),
    "",
  ];
  for (const g of gates) {
    if (g.details.length === 0 && g.notes.length === 0) continue;
    lines.push(`## ${g.name}`, "");
    for (const d of g.details) lines.push(`- ${d}`);
    for (const n of g.notes) lines.push(`- (not/öneri) ${n}`);
    lines.push("");
  }
  // Keep the digest well under ~4k tokens (~16k chars).
  let text = lines.join("\n");
  if (text.length > 15_000) {
    text = `${text.slice(0, 15_000)}\n… (digest truncated)\n`;
  }
  writeFileSync(DIGEST_PATH, text);
  console.log(`\ndigest → ${DIGEST_PATH}`);
}

/**
 * Repo root for the deploy-gate marker. The orchestrator passes
 * PIPELINE_REPO_ROOT; standalone runs walk up to the workspace manifest.
 * A relative fallback is not safe here: the site copy sits at a different
 * depth (template/ vs runs/<domain>/generate/) and a wrong guess writes the
 * marker outside the repo.
 */
function resolveRepoRoot() {
  if (process.env.PIPELINE_REPO_ROOT) {
    return path.resolve(process.env.PIPELINE_REPO_ROOT);
  }
  let dir = CWD;
  for (let i = 0; i < 10; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return CWD;
}

function writeMarker() {
  const repoRoot = resolveRepoRoot();
  const markerDir = path.join(repoRoot, ".pipeline");
  mkdirSync(markerDir, { recursive: true });
  const marker = path.join(markerDir, "verify-passed");
  writeFileSync(marker, `${new Date().toISOString()}\n`);
  console.log(`marker → ${marker}`);
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
async function main() {
  let hardFailed = false;

  const steps = [
    ["tsc", gateTsc],
    ["eslint", gateEslint],
    ["build", gateBuild],
    ["playwright", gatePlaywright],
    ["lhci", () => gateLhci().ok],
    ["links", gateLinks],
  ];

  for (const [name, step] of steps) {
    if (hardFailed) {
      record(name, "skip", 0, ["skipped — earlier gate failed"]);
      continue;
    }
    let ok;
    try {
      ok = await step();
    } catch (error) {
      record(name, "fail", 0, [`unexpected error: ${error?.message ?? error}`]);
      ok = false;
    }
    if (!ok) hardFailed = true;
  }

  const allGreen = !hardFailed;
  writeDigest(allGreen);
  if (allGreen) {
    writeMarker();
    process.exit(0);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  try {
    writeDigest(false);
  } catch {
    /* best effort */
  }
  process.exit(1);
});
