# 4s_web_pipeline

Automated website-rebuild pipeline for Turkish SMBs. Architecture and all
decisions: `docs/PLAN.md` (source of truth). Monorepo: `packages/core`
(types, SQLite store, state helpers), `apps/orchestrator` (CLI + queue),
`apps/admin` (panel), `template/` (client-site template, copied per run).

## Stack (pinned)

Node 22 · pnpm workspace · TypeScript strict · Next.js 16.4 · React 19.3 ·
Tailwind v4 · shadcn (Base UI) · Drizzle + better-sqlite3 · Zod 4 ·
Playwright · Lighthouse 13 / LHCI 0.15 · Crawlee.

## Commands

- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` — whole workspace
- `pnpm --filter @pipeline/orchestrator pipeline <cmd>` — CLI
  (discover, approve, queue add <url>, run, status, retry <domain>, cancel <domain>)
- `pnpm run verify` — inside a generated site copy: gates in cost order
- `pnpm seed` — fake data for the admin panel

## Language rules

- Code, identifiers, comments, commits, logs, traces: ENGLISH.
- User-facing text in generated client sites and the admin UI: TURKISH.
- Turkish casing only via `upperTR`/`lowerTR` (template `src/lib/format.ts`);
  bare `.toUpperCase()`/`.toLowerCase()` is an ESLint error.
- Conventional commits (`feat:`, `fix:`, `chore:`, ...).

## Hard rules

- Facts from `runs/<domain>/audit/facts.json` are verbatim. Never invent
  hours, prices, phone numbers, services.
- Generated-site edits only in `site.config.ts`, `src/sections/**`,
  `src/styles/tokens.css`, `public/images/**`.
- It is unacceptable to remove or edit tests, `lighthouserc.cjs`,
  `playwright.config.ts`, `budget.json`, `acceptance.json`
  (protect-tests hook denies writes).
- `vercel` deploys are blocked until `.pipeline/verify-passed` exists
  (deploy-gate hook).
- Never commit secrets; every env var is documented in `.env.example`.
  Vercel/Telegram/WhatsApp tokens live only in the orchestrator process,
  never in model-visible Bash env.
- No `<img>` (use `next/image`), no arbitrary hex in sections (tokens only),
  max two font families, no analytics/marketing scripts in demos (KVKK).
- `tel:`/`wa.me` hrefs must match `^(tel:\+90\d{10}|https:\/\/wa\.me\/90\d{10})`.
- robots.txt is respected when crawling; `opted_out` leads are never
  re-contacted or re-crawled.

## Stage model

`discover → approve → queue → crawl → audit → plan → generate → verify →
deploy → notify`. Deterministic stages (crawl, audit measurement, verify,
deploy, notify, discover) are plain TypeScript; LLM stages (plan, generate,
fix loop) are budget-capped fresh sessions. Every stage is idempotent: skip
if its artifact exists; write `runs/<domain>/state.json` + an events row on
every transition. Fix loop ≤ 3 iterations, then BLOCKED.md + escalation.

Design constraints: `template/design-rules.md`. Build/perf constraints:
`template/build-rules.md`. Both are enforcement inputs, not suggestions.

## Compaction

When compacting, always preserve: the full list of modified files, the verify
command for the current working copy, and the current domain/run id.
