---
paths: ["template/src/app/**", "runs/**/generate/src/app/**"]
---

# App router rules (template)

- Pages stay fully static; no dynamic rendering, no server actions, no
  runtime data fetching in client sites.
- `layout.tsx`: `<html lang="tr">`; fonts via `next/font/google` with
  `subsets: ['latin', 'latin-ext']`; metadata through `src/lib/seo.ts`
  (metadataBase, title.template, `openGraph.locale: 'tr_TR'`, hreflang
  `tr-TR` + `x-default`); LocalBusiness JSON-LD from `src/lib/jsonld.ts`.
- Sections render ONLY through `SectionRenderer` + `registry.ts`; no ad-hoc
  section JSX in pages.
- `SITE_PREVIEW` behavior (noindex header, robots disallow, Basic-Auth in
  proxy, draft band) must never be weakened or conditionally bypassed.
- KVKK: consent banner always rendered; no third-party script may load
  before explicit consent — in demo builds there are no third-party scripts
  at all.
- app/ is OUTSIDE the generate/fix editable surface; only humans change it.
