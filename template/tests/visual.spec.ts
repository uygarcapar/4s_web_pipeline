import { expect, test } from "@playwright/test";

/**
 * Visual regression gate.
 *
 * Baselines are PER CLIENT: a fresh site copy has no snapshots, so the first
 * verify run creates them (scripts/verify.mjs passes
 * `--update-snapshots=missing` when no baseline exists yet). Subsequent runs
 * on the SAME client compare against those baselines to catch regressions in
 * the fix loop. Comparing snapshots across clients is meaningless.
 *
 * Diff settings (maxDiffPixelRatio 0.02, animations disabled) come from
 * playwright.config.ts `expect.toHaveScreenshot`; each project
 * (desktop-chromium 1350x940, mobile iPhone 13) keeps its own baseline file.
 */

test("home page full-page screenshot", async ({ page }) => {
  await page.goto("/");

  // Deterministic page state: fonts loaded, consent banner dismissed
  // (its translucent overlay would otherwise sit on top of the content),
  // and all lazy-loaded images forced in by scrolling through the page.
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: "Tümünü Reddet" }).click();
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveScreenshot("home.png", { fullPage: true });
});
