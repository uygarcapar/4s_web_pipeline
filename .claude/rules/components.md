---
paths: ["template/src/sections/**/*.tsx", "runs/**/generate/src/sections/**/*.tsx"]
---

# Section component rules

- Server components by default; `"use client"` only for interaction
  (gallery lightbox, FAQ accordion, consent banner) and keep the client
  island as small as possible.
- Props come typed from the Zod section schema (`src/lib/schema.ts`); never
  widen types or accept untyped props.
- Images: `next/image` with explicit `width`/`height` and real `alt` text in
  Turkish; below-fold `loading="lazy"`, hero `priority`. Sources only from
  `public/images/**`.
- Styling: Tailwind utilities + `@theme` tokens from `src/styles/tokens.css`.
  No arbitrary hex values, no inline style colors, no `transition: all`.
- Every interactive element: visible `focus-visible` state, `aria-label` on
  icon-only buttons, keyboard reachable.
- Phone/WhatsApp links exclusively via `telHref`/`waHref`; currency/date via
  `formatTRY`/`formatDateTR`; uppercase via `upperTR`.
- No per-section scroll-reveal animations; honor `prefers-reduced-motion`.
- User-facing strings Turkish (real ş/ğ/ı/İ/ç/ö/ü, no ASCII substitutes).
