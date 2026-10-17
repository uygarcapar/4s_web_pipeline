---
name: generate
description: Fill the copied Next.js template from runs/<domain>/plan, editing only site.config.ts, sections and tokens.css, under design-rules.md and build-rules.md.
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(pnpm run *), Bash(pnpm exec *), Bash(git commit *), Bash(git add *)
skills:
  - frontend-design
  - web-design-guidelines
  - ui-ux-pro-max
  - react-best-practices
argument-hint: [domain]
---

Generate stage for `runs/$ARGUMENTS/`. The working copy of the template is at
`runs/$ARGUMENTS/generate/`. Read `plan/design-plan.md`, `plan/sitemap.json`,
`plan/sections/*.md`, `audit/facts.json`, `template/design-rules.md`, and
`template/build-rules.md` before touching anything.

1. Edit ONLY: `site.config.ts`, `src/sections/**`, `src/styles/tokens.css`,
   `public/images/**` (self-hosted assets from crawl/asset-manifest.json
   only — no external URLs).
2. Copy is the CLIENT'S OWN, lifted from `crawl/content.json` and edited for
   spelling, length and flow — never written from scratch (design-rules.md §7).
   Photographs come from `crawl/asset-manifest.json`, including staff
   portraits; placeholders only where the crawl found nothing.
3. Facts in facts.json are verbatim; never invent hours, prices, phone
   numbers. All `tel:`/`wa.me` hrefs come from `telHref`/`waHref` helpers.
4. Follow design-plan.md exactly; the one bold element must survive into the
   build. Respect every hard rule in design-rules.md §2–§8 and
   build-rules.md.
5. After editing, run `pnpm run verify`; read `verify-digest.md`; fix; commit
   `feat: generate <section|page>` on green. Stop after 3 failed rounds and
   write BLOCKED.md with what is failing and why.
6. People photographs from the old site are used (design-rules.md §7); stock
   images with `license_unknown` that are clearly not of this business are
   replaced with placeholders.
