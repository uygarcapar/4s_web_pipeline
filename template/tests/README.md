# Tests

Playwright specs for the generated site land here in **Milestone 2** (the
verify stage of the pipeline):

- **Smoke** — the page builds, renders every configured section, and the
  tel:/WhatsApp CTAs point at the numbers from `site.config.ts`.
- **A11y** — axe-core scans (Turkish content, WCAG AA) on the home page and
  the legal pages.
- **Visual** — per-section screenshot comparisons across the supported
  variants and a mobile viewport (sticky CTA bar).

There is intentionally no `test` script in `package.json` yet; it will be
added together with the Playwright setup.
