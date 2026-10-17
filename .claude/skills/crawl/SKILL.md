---
name: crawl
description: Run the deterministic crawl stage for a queued domain and validate its artifacts (pages, screenshots, assets manifest, extracted facts).
disable-model-invocation: true
allowed-tools: Read, Bash(pnpm run *), Bash(pnpm --filter *), Grep, Glob
argument-hint: [domain]
---

Crawl stage for `runs/$ARGUMENTS/`. This stage is deterministic (Crawlee +
Playwright, no LLM); your job is to run it and verify the artifacts, not to
reimplement it.

1. If `runs/$ARGUMENTS/crawl/pages.json` already exists, report "crawl already
   complete" and stop (idempotency).
2. Run `pnpm --filter @pipeline/orchestrator pipeline run --domain $ARGUMENTS`
   (crawl is its first pending stage).
3. Verify the outputs exist and are sane:
   - `crawl/pages.json` — at least the homepage, same-domain only.
   - `crawl/screenshots/` — mobile (iPhone 13, tr-TR, Europe/Istanbul) and
     desktop (1350x940) full-page shots per page.
   - `crawl/asset-manifest.json` — every asset has `source_url`, `fetched_at`,
     `sha256`, `license_unknown` provenance fields.
   - robots.txt was respected (check the crawl log for the parsed verdict).
4. Report missing/suspect artifacts; do NOT edit stage code to force a pass.
