---
name: generate
description: Fill the copied Next.js template from runs/<domain>/plan, editing only site.config.ts, sections and tokens.css, under design-rules.md and build-rules.md.
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(pnpm run *), Bash(pnpm exec *), Bash(git commit *), Bash(git add *)
skills:
  - frontend-design
  - web-design-guidelines
argument-hint: [domain]
---

Generate stage for `runs/$ARGUMENTS/`. The working copy of the template is at
`runs/$ARGUMENTS/generate/`. Read `plan/design-plan.md`, `plan/sitemap.json`,
`plan/sections/*.md`, `audit/facts.json`, `template/design-rules.md`, and
`template/build-rules.md` before touching anything.

1. Edit ONLY: `site.config.ts`, `src/sections/**`, `src/styles/tokens.css`,
   `public/images/**` (self-hosted assets from crawl/asset-manifest.json
   only — no external URLs).
2. Facts in facts.json are verbatim; never invent hours, prices, phone
   numbers. All `tel:`/`wa.me` hrefs come from `telHref`/`waHref` helpers.
3. Follow design-plan.md exactly; the one bold element must survive into the
   build. Respect every hard rule in design-rules.md §2–§5 and
   build-rules.md.
4. After editing, run `pnpm run verify`; read `verify-digest.md`; fix; commit
   `feat: generate <section|page>` on green. Stop after 3 failed rounds and
   write BLOCKED.md with what is failing and why.
5. People photos from the old site: blurred or placeholder until consent is
   verified. Stock images from the manifest keep `license_unknown` and are
   replaced with placeholders.
