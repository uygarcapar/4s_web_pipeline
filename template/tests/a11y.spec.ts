import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Accessibility gate (build-rules.md §2): zero axe violations on the
 * configured routes for WCAG 2.0/2.1/2.2 AA plus best practices.
 *
 * Note: axe-core has no `wcag22a` tag — 2.2 only added AA/AAA criteria —
 * so the tag list below is the complete one from the plan.
 *
 * The template is a one-page site (sections on "/"); there is no /iletisim
 * route, so only "/" (which includes the contact section) is scanned.
 */

const ROUTES = ["/"];

const AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

for (const route of ROUTES) {
  test(`axe scan: ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(AXE_TAGS)
      .analyze();

    // Normalize violations into one readable string so a failure message
    // (and verify-digest.md) carries id, impact, help and the first targets.
    const summary = results.violations
      .map((violation) => {
        const targets = violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(" "))
          .join(" | ");
        return `${violation.id} [${violation.impact ?? "unknown"}] ${violation.help} → ${targets}`;
      })
      .join("\n");

    if (summary !== "") {
      console.log(`axe violations on ${route}:\n${summary}`);
    }
    expect(summary, `axe violations on ${route}`).toBe("");
  });
}
