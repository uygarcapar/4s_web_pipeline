import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the monorepo root by walking up from this file until
 * pnpm-workspace.yaml is found, so the CLI works from any cwd.
 */
export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("pnpm-workspace.yaml not found; cannot resolve repo root");
}

export function dbPath(): string {
  return join(repoRoot(), "data", "pipeline.db");
}

export function runsRoot(): string {
  return join(repoRoot(), "runs");
}

export function leadsDir(): string {
  return join(repoRoot(), "leads");
}
