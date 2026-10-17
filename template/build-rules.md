# Build rules

Hard rules for `generate` and `fix-agent`. Performance rules quoted from the
vendored `react-best-practices` skill (vercel-labs/agent-skills, 70 rules;
full text in `.claude/skills/react-best-practices/`). Quality gates
(lighthouserc.cjs, tests/, playwright.config.ts, budget.json,
acceptance.json) are human-owned: it is unacceptable to remove or edit them.

## 1. Editable surface

The LLM edits ONLY:
- `site.config.ts`
- `src/sections/**`
- `src/styles/tokens.css`
- `public/images/**` (self-hosted assets from the crawl manifest only)

Everything else — app/, lib/, components/ui/, configs, tests — is read-only.
Facts in `facts.json` are verbatim; never invent hours, prices, phone numbers.

## 2. Framework gates (checked by verify)

- `tsc --noEmit` clean; TypeScript strict; Zod `.strict()` schemas must parse
  `site.config.ts` at build time.
- `next build` succeeds; pages stay fully static (no dynamic rendering).
- ESLint flat config clean, including `@next/next/no-img-element` (always
  `next/image`) and the `no-restricted-syntax` ban on bare
  `.toUpperCase()`/`.toLowerCase()` (use `upperTR`/`lowerTR`).
- Lighthouse CI thresholds (lighthouserc.cjs): performance ≥ 0.9,
  accessibility ≥ 0.95, best-practices ≥ 0.9, SEO ≥ 0.95, LCP ≤ 2500 ms,
  CLS ≤ 0.1, script budget ≤ 250 KB.
- axe (`wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`, `best-practice`):
  zero violations.
- All `tel:`/`wa.me` hrefs match `^(tel:\+90\d{10}|https:\/\/wa\.me\/90\d{10})`.
- No external asset URLs: every image/font is self-hosted; grep for
  `https?://` in src/sections/** must only hit allowlisted domains
  (wa.me, google.com/maps embeds).

## 3. Performance rules (from react-best-practices — by priority)

CRITICAL — eliminating waterfalls & bundle size:
- `async-parallel`: use `Promise.all()` for independent async operations.
- `async-defer-await`: move `await` into the branch where it is used.
- `bundle-barrel-imports`: import directly from the module, never via barrel
  files (`import { X } from "@/components"` is banned).
- `bundle-dynamic-imports`: `next/dynamic` for heavy below-fold components
  (gallery lightbox, map embed).
- `bundle-defer-third-party`: no third-party scripts before hydration — in
  this template there are NO third-party scripts at all pre-consent (KVKK).
- `bundle-conditional`: load a module only when its feature activates.

HIGH — server-side:
- `server-hoist-static-io`: hoist static I/O (fonts, logos) to module level.
- `server-serialization`: minimize props crossing the server→client boundary.
- `server-cache-react`: `React.cache()` for per-request dedup (rarely needed
  in the static template; applies to the admin panel).

MEDIUM — re-render & rendering (mostly for the few client components:
consent banner, gallery, mobile CTA):
- `rerender-derived-state-no-effect`: derive state during render, not in
  effects.
- `rerender-no-inline-components`: never define a component inside another.
- `rerender-lazy-state-init`: pass a function to `useState` for expensive
  initial values.
- `rendering-conditional-render`: ternary, not `&&`, for conditional JSX.
- `rendering-content-visibility`: `content-visibility: auto` for long
  below-fold sections.
- `rendering-script-defer-async`: any `<script>` gets `defer`/`async`.

LOW-MEDIUM — JavaScript:
- `js-set-map-lookups`: Set/Map for O(1) lookups.
- `js-combine-iterations`: combine chained filter/map into one pass.
- `js-hoist-regexp`: hoist RegExp creation out of loops/renders.

When a verify gate fails on performance, consult the matching rule file in
`.claude/skills/react-best-practices/rules/` before editing.

## 4. Template invariants

- Sections render exclusively through `src/sections/registry.ts`; new section
  types require a schema + registry entry, never ad-hoc JSX in pages.
- Design tokens only via Tailwind `@theme` variables in
  `src/styles/tokens.css`; the brand is steered by `--brand-h`/`--brand-c`
  (OKLCH) — no arbitrary hex values in section code.
- Fonts: `next/font/google`, `latin` + `latin-ext` subsets, max two families.
- `SITE_PREVIEW=1` behavior (noindex, Basic-Auth, draft band) must never be
  weakened by generated code.
- Fix loop: max 3 iterations fed by `verify-digest.md`; then write BLOCKED.md
  and escalate. Each green round commits `fix: gate <stage>`.

<!-- TODO(uygar): confirm the 250 KB script budget and LHCI thresholds after
     the first real verify runs (plan §4 flags LHCI 0.15.x vs Lighthouse 13
     compatibility as untested). -->
<!-- TODO(uygar): decide allowlisted external domains for the grep gate
     (currently wa.me + google.com/maps). -->
