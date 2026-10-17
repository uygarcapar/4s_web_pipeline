import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the verify quality gate.
 *
 * The app is built BEFORE Playwright runs (scripts/verify.mjs runs
 * `pnpm run build` first), so the webServer only has to `next start` the
 * production build on port 3100.
 *
 * Only Chromium is provisioned in this environment, so the mobile project
 * pins `browserName: "chromium"` (the iPhone 13 descriptor would otherwise
 * default to WebKit).
 */
export default defineConfig({
  testDir: "tests",
  // Single local `next start` server: run deterministically, one worker.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    // verify.mjs parses this file to normalize failures into verify-digest.md.
    ["json", { outputFile: "test-results/results.json" }],
  ],
  expect: {
    toHaveScreenshot: {
      // Visual baselines are per-client; small AA/font rasterization drift
      // is tolerated, real layout changes are not.
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    // Not `pnpm start -- -p 3100`: pnpm forwards the literal `--` to the
    // script, so `next start` would see it as a project directory.
    command: "pnpm exec next start -p 3100",
    port: 3100,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1350, height: 940 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        locale: "tr-TR",
        timezoneId: "Europe/Istanbul",
      },
    },
  ],
});
