/**
 * Lighthouse CI gate (docs/PLAN.md "Kalite kapıları", calibrated per
 * docs/DECISIONS.md D4 — operator-approved after the first real runs).
 *
 * Runs against the production build (`next build` happens earlier in
 * scripts/verify.mjs) on its own port (3101) so it never collides with the
 * Playwright webServer (3100) or the linkinator server (3102).
 *
 * Levels: `error` assertions are hard gates (non-zero exit); `warn`
 * assertions are surfaced in verify-digest.md as "öneri/recommendation"
 * only. Inline budget values are in BYTES (budget.json would be KB).
 *
 * Known caveat (plan §4): @lhci/cli 0.15.x bundles Lighthouse 12.x — if
 * `lhci autorun` fails for infrastructure reasons (not assertion failures),
 * scripts/verify.mjs downgrades the gate to WARN instead of a hard failure.
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start -- -p 3101",
      startServerReadyPattern: "Ready|ready|listening",
      startServerReadyTimeout: 30000,
      url: ["http://localhost:3101/"],
      numberOfRuns: 3,
      settings: { chromeFlags: "--no-sandbox --disable-gpu" },
    },
    assert: {
      /*
       * D4: the plan proposed "lighthouse:no-pwa", but that preset asserts
       * EVERY audit at error level, which turns audits we cannot fix from a
       * generated site's editable surface into permanent blockers:
       *   - legacy-javascript-insight (Next.js ships its own polyfills)
       *   - network-dependency-tree-insight (Next.js chunk + font chain)
       * "recommended" keeps those at warn level so they land in the digest
       * as recommendations, while the explicit error assertions below stay
       * the real gates — which is the plan's category-threshold intent.
       */
      preset: "lighthouse:recommended",
      assertions: {
        "categories:performance": [
          "error",
          { minScore: 0.9, aggregationMethod: "median-run" },
        ],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        /*
         * D4: measured LCP for the reference template swings 2.7-3.2 s on
         * this harness (LHCI simulates Slow 4G + 4x CPU on localhost) while
         * the performance category sits at 0.94-0.96. 2500 ms is the field
         * target and stays as a warn so the digest keeps nudging; 3500 ms is
         * the hard gate that catches real regressions without tripping on
         * run-to-run noise.
         */
        "largest-contentful-paint": [
          "error",
          { maxNumericValue: 3500, aggregationMethod: "median-run" },
        ],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "resource-summary:script:size": [
          "error",
          { maxNumericValue: 250000 }, // bytes
        ],
        "resource-summary:font:count": ["warn", { maxNumericValue: 2 }],
        "unused-javascript": "warn",
        /*
         * D4: structural to Next.js output, not fixable from a generated
         * site's editable surface, so they ride along as digest
         * recommendations. "lighthouse:recommended" still errors on these,
         * hence the explicit downgrade.
         *   legacy-javascript-insight        — Next.js ships its polyfills
         *   network-dependency-tree-insight  — framework chunk/font chain
         */
        "legacy-javascript-insight": "warn",
        "network-dependency-tree-insight": "warn",
        /*
         * Measured on minaguzellik.com, the first real client. The audit
         * compares a served image against its CSS pixel size and ignores
         * device pixel ratio, so it penalises correct responsive serving:
         *
         *   displayed   372 CSS px
         *   DPR         1.75 (Lighthouse's own mobile emulation)
         *   needed      651 device px
         *   source      640x480 — the client's own photograph, no larger
         *               original exists
         *
         * next/image serves the 640 px source, which is the right call for
         * a 1.75x screen and still slightly short of ideal. Satisfying the
         * audit means serving ~372 px, i.e. deliberately shipping a soft
         * image on every high-DPR phone — degrading the client's site to
         * move a number.
         *
         * Same category as the two above: real as a recommendation, wrong
         * as a hard gate, and not fixable from a generated site's editable
         * surface. The fix loop spent three iterations and $5.43 on it
         * across two runs before this was understood.
         */
        "image-delivery-insight": "warn",
      },
    },
    upload: { target: "filesystem", outputDir: "./.lighthouseci" },
  },
};
