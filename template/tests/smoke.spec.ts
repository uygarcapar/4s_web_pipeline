import { expect, test } from "@playwright/test";

/**
 * Smoke gate (build-rules.md §2, design-rules.md §5):
 * - <html lang="tr…">, exactly one h1, non-empty title
 * - every tel:/wa.me href is strict E.164 (+90, 10 digits)
 * - KVKK consent banner with the three equally-styled choices
 * - footer legal pages respond 200
 * - sticky mobile CTA bar: visible on mobile, hidden on desktop
 */

const CTA_HREF_PATTERN = /^(tel:\+90\d{10}|https:\/\/wa\.me\/90\d{10})/;

test("html lang is Turkish, exactly one h1, non-empty title", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", /^tr/);
  await expect(page.locator("h1")).toHaveCount(1);
  expect((await page.title()).trim()).not.toBe("");
});

test("all tel: and wa.me hrefs are E.164 (+90…)", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page
    .locator('a[href^="tel:"], a[href*="wa.me"]')
    .evaluateAll((anchors) =>
      anchors.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""),
    );
  expect(hrefs.length, "at least one tel:/WhatsApp CTA").toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href, `CTA href not E.164: ${href}`).toMatch(CTA_HREF_PATTERN);
  }
});

test("KVKK consent banner shows the three equal choices", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", {
    name: "Çerez ve kişisel veri tercihleri",
  });
  await expect(banner).toBeVisible();
  await expect(
    banner.getByRole("button", { name: "Tümünü Kabul Et" }),
  ).toBeVisible();
  await expect(
    banner.getByRole("button", { name: "Tümünü Reddet" }),
  ).toBeVisible();
  await expect(
    banner.getByRole("button", { name: "Tercihleri Yönet" }),
  ).toBeVisible();
});

test("footer links to the legal pages and they respond 200", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await expect(
    footer.locator('a[href="/kvkk-aydinlatma"]').first(),
  ).toBeVisible();
  await expect(
    footer.locator('a[href="/cerez-politikasi"]').first(),
  ).toBeVisible();
  for (const path of ["/kvkk-aydinlatma", "/cerez-politikasi"]) {
    const response = await page.request.get(path);
    expect(response.status(), `${path} must respond 200`).toBe(200);
  }
});

test("sticky CTA bar is visible on mobile only", async ({ page }, testInfo) => {
  await page.goto("/");
  const bar = page.getByRole("navigation", { name: "Hızlı iletişim" });
  if (testInfo.project.name === "mobile") {
    await expect(bar).toBeVisible();
    await expect(bar.locator('a[href^="tel:"]')).toBeVisible();
    await expect(bar.locator('a[href*="wa.me"]')).toBeVisible();
  } else {
    await expect(bar).toBeHidden();
  }
});
