---
paths: ["template/src/sections/**/*.tsx", "runs/**/generate/src/sections/**/*.tsx"]
---

# Section component rules

- Server components by default; `"use client"` only for interaction
  (gallery lightbox, FAQ accordion, consent banner) or for a section that
  carries scroll choreography, and keep the client island as small as
  possible. A client section still renders its content on the server, so the
  copy and the LCP element are in the HTML either way — what `"use client"`
  costs is that section's JS, not its text.
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
- Motion follows `template/design-rules.md` §3 (approved 2026-10-19,
  DECISIONS D5). Scroll must CHANGE the page, not merely translate it: a site
  needs one pinned hand-off and one text transformation. What stays banned is
  what the old rule was aiming at — fade-and-slide-up on every section as the
  page's entire motion vocabulary. Compose the helpers in `src/lib/motion.ts`
  rather than hand-writing timelines.
- `gsap.matchMedia` gates every timeline. Under `prefers-reduced-motion:
  reduce` no timeline runs AND no content is left hidden: anything a timeline
  would have revealed must already be visible.
- Never hijack scroll on touch — a pinned lateral rail degrades to a native
  swipe list below 1024px.
- User-facing strings Turkish (real ş/ğ/ı/İ/ç/ö/ü, no ASCII substitutes).
