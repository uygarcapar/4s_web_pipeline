---
name: verify
description: Run the verify gates (tsc, eslint, build, Playwright smoke/axe/visual, LHCI, links) for a generated site and summarize verify-digest.md.
disable-model-invocation: true
allowed-tools: Read, Bash(pnpm run *), Bash(node scripts/verify.mjs*), Grep, Glob, mcp__playwright__*
skills:
  - webapp-testing
argument-hint: [domain]
---

Verify stage for `runs/$ARGUMENTS/generate/`. Gates run in cost order via
`scripts/verify.mjs` and stop at the first failure:
tsc → eslint → next build → Playwright (smoke + axe + visual) → lhci →
link check. The script writes `verify-digest.md` (≤ 4k tokens, normalized
failures) and, on full green, the `.pipeline/verify-passed` marker that the
deploy gate requires.

1. If `runs/$ARGUMENTS/verify/digest.md` exists and reports green, stop.
2. Run `pnpm run verify` in the generated site working copy.
3. Read the digest, not the raw logs. Summarize per-gate status; `warn`-level
   LHCI output is a recommendation, not a failure.
4. NEVER edit tests, lighthouserc.cjs, playwright.config.ts, budget.json or
   acceptance.json — the protect-tests hook denies it anyway. Verify only
   reports; fixing belongs to the fix loop (fix-agent, max 3 iterations).
5. Visual baselines are per-client, generated once on first verify
   (`--update-snapshots=missing`); cross-client comparisons are meaningless.
