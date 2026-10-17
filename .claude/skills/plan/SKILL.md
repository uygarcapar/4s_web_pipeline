---
name: plan
description: Produce sitemap.json, per-section specs and design-plan.md for a crawled+audited domain, grounded in facts.json and design-rules.md.
disable-model-invocation: true
allowed-tools: Read, Write, Grep, Glob
skills:
  - frontend-design
  - ui-ux-pro-max
argument-hint: [domain]
---

Plan stage for `runs/$ARGUMENTS/`. Inputs: `crawl/content.json` (the
client's own text and FAQ pairs), `crawl/asset-manifest.json` (their
photographs with dimensions), `crawl/pages.json`, `crawl/screenshots/`,
`audit/facts.json`, `audit/issues.json`, and `template/design-rules.md`. If `plan/design-plan.md` already exists, stop
(idempotency).

1. Write `runs/$ARGUMENTS/plan/design-plan.md` FIRST: 4–6 named colors
   (OKLCH, derived from `--brand-h`/`--brand-c`), 1–2 typefaces with roles,
   ASCII wireframes per page, alignment guidance, and the ONE bold element.
2. Review the plan against the five generic clusters in design-rules.md §2.
   If any part matches, revise it and record what changed and why.
3. Write `runs/$ARGUMENTS/plan/sitemap.json` (pages, their sections in order,
   each section's type + variant from the template registry) and
   `runs/$ARGUMENTS/plan/sections/<id>.md` — one spec per section: purpose,
   content mapping from facts.json (verbatim fields only), variant, imagery
   from the asset manifest.
4. Facts are verbatim: never invent hours, prices, phone numbers, services.
   Each section spec cites which facts.json fields it consumes.
5. Do not write any site code in this stage.
