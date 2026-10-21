import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the template's pure logic — schema refines, CTA resolution,
 * formatting. Rendering and interaction stay in Playwright (`tests/*.spec.ts`).
 *
 * Specs live next to their source as `src/**\/*.test.ts`, matching
 * `apps/orchestrator`. The `tests/` directory is reserved for Playwright and
 * is hook-protected, so a unit test cannot live there.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "~config": fileURLToPath(new URL("./site.config.ts", import.meta.url)),
    },
  },
});
