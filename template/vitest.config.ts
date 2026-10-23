import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the template's pure logic — schema refines, CTA resolution,
 * formatting. Rendering and interaction stay in Playwright (`tests/*.spec.ts`).
 *
 * Specs live next to their source as `src/**\/*.test.ts`, matching
 * `apps/orchestrator`. The `tests/` directory is reserved for Playwright and
 * is hook-protected, so a unit test cannot live there.
 *
 * `scripts/**\/*.test.mjs` is included too: the verify runner is plain ESM
 * (it cannot import TypeScript), so the pure parts it delegates to — reading
 * a Lighthouse result into digest lines — are `.mjs` beside it. Those parts
 * decide what the fix loop can see about a failure, which is worth a test.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "~config": fileURLToPath(new URL("./site.config.ts", import.meta.url)),
    },
  },
});
