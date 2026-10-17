# Tests — the verify quality gate

Run everything with `pnpm run verify` (= `node scripts/verify.mjs`, cwd =
the site copy). Gates run in cost order and stop at the first hard failure:

1. **tsc** — `next typegen` + `tsc --noEmit`
2. **eslint** — `eslint . --format json`; errors fail, warnings become notes
3. **build** — `next build` (production build used by all later gates)
4. **playwright** — the specs in this directory (`pnpm run test:e2e` runs
   them standalone against a pre-built app)
5. **lhci** — `lhci autorun --config=lighthouserc.cjs` (thresholds from
   docs/PLAN.md; LHCI *infra* failures are WARN, assertion failures are hard)
6. **links** — linkinator crawl of `next start -p 3102`; broken internal
   links fail, broken external links only WARN

Every run writes `verify-digest.md`; when all gates are green a
`.pipeline/verify-passed` marker is written at the pipeline repo root
(`PIPELINE_REPO_ROOT`, default `../..`).

## Playwright specs

Two projects (playwright.config.ts): `desktop-chromium` (1350×940) and
`mobile` (iPhone 13, Chromium, `tr-TR`, Europe/Istanbul). The config starts
`pnpm start -- -p 3100` itself — build first.

- **smoke.spec.ts** — `html[lang^="tr"]`, exactly one `h1`, non-empty title,
  every `tel:`/`wa.me` href strict E.164
  (`^(tel:\+90\d{10}|https:\/\/wa\.me\/90\d{10})`), KVKK banner with the
  three equal buttons (Tümünü Kabul Et / Tümünü Reddet / Tercihleri Yönet),
  legal pages respond 200, sticky CTA bar mobile-only.
- **a11y.spec.ts** — axe-core with
  `['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']`
  (there is no `wcag22a` tag); zero violations required. One-page site, so
  only `/` is scanned.
- **visual.spec.ts** — full-page screenshot per project,
  `maxDiffPixelRatio: 0.02`, animations disabled. Baselines
  (`tests/visual.spec.ts-snapshots/`) are **per client**: the first verify
  run creates them (`--update-snapshots=missing`), later runs on the same
  client guard against regressions. Never compare across clients; never
  copy baselines between site copies.

## Ports

3100 Playwright webServer · 3101 LHCI · 3102 linkinator. verify.mjs starts
and kills the linkinator server itself; the other two are managed by their
tools.

These files are human-owned quality gates (see build-rules.md): the
generate/fix agents must not edit or delete them.
