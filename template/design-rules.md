# Design rules

Hard rules for the `plan`/`generate` stages, `section-builder`, and the
`design-judge` rubric. Sources: vendored `frontend-design` (anthropics/skills)
and `web-design-guidelines` (vercel-labs/agent-skills, Web Interface
Guidelines) — quoted below so sessions do not depend on loading those skills.
Turkey-specific rules live only here and in our stage skills, not upstream.

## 1. Process (from frontend-design — mandatory order)

1. Write `design-plan.md` FIRST: 4–6 named hex/OKLCH colors, 1–2 typefaces
   with roles, ASCII wireframes, alignment guidance, and "the one bold
   element". No code before the plan exists.
2. Review the plan against the generic clusters in §2: if any part reads like
   "the generic default you would produce for any similar page", revise it and
   say what changed and why.
3. "Spend your boldness in one place. Let one element be the memorable thing,
   keep everything around it quiet and disciplined."
4. Ground the design in the subject: a Kadıköy dental clinic and a Beşiktaş
   barber must not get the same design. Industry, materials and vernacular
   drive the choices.

## 2. The five generic-AI clusters (from frontend-design — FAIL if matched)

A generated site must not land in any of these:

1. Warm cream background (near `#F4F1EA`) + high-contrast serif display +
   terracotta/warm-clay accent (near `#D97757`).
2. Near-black background with a single bright acid-green or vermilion accent.
3. Broadsheet layout: hairline rules, zero border-radius, dense
   newspaper-like columns.
4. "SaaS-card kit": content chopped into identical rounded cards, one
   border-radius on everything, the same soft grey shadow
   (`rgba(0,0,0,.1)`) under each, gradient washes as decoration.
5. Template chrome regardless of subject: tracked-out ALL-CAPS eyebrow label
   above every heading; meta strings joined with middle dots (`A · B · C`);
   `WORD — fragment` labels; tinted near-black (`#0B0B0B`, `#111`) standing
   in for black; monospace for small data labels; `→` appended to link or
   button text.

## 3. Typography and motion (from frontend-design)

- One or two typefaces; if two, make them clearly distinct. Deliberate type
  scale, intentional weights.
- Line length < 80 characters; serifs get slightly more line-height.
- Banned default treatments: accenting a single word in a headline
  (italic/bold/color), ALL-CAPS labels, unnecessary typographic labels above
  content.
- Numbered markers (01/02/03) only if the content truly is a sequence.
- Motion: at most ONE orchestrated page-load moment. Per-section
  fade-and-slide-up entrances and hover transitions on every card are the
  generic default — banned. `prefers-reduced-motion` always honored.
- Copy: active voice, plain verbs; CTA says exactly what happens.

## 4. Interface quality floor (from web-design-guidelines — checkable)

Full vendored list: `.claude/skills/web-design-guidelines/guidelines.md`.
Non-negotiable subset enforced by audit/verify:

- Accessibility: icon-only buttons need `aria-label`; form controls need
  labels; `<button>` for actions, `<a>`/`<Link>` for navigation (never
  `<div onClick>`); images need `alt`; headings hierarchical h1–h6; visible
  `focus-visible` states; never `outline: none` without replacement.
- Forms: correct `type`/`inputmode` (`tel`, `email`); never block paste;
  labels clickable; errors inline next to fields.
- Images: explicit `width`/`height` (CLS); below-fold `loading="lazy"`;
  above-fold hero `priority`.
- Animation: animate `transform`/`opacity` only; never `transition: all`.
- Typography: `…` not `...`; curly quotes; `text-wrap: balance` on headings;
  `tabular-nums` for number columns.
- Touch: `touch-action: manipulation`; no `user-scalable=no` or
  `maximum-scale=1`.
- Locale: `Intl.DateTimeFormat`/`Intl.NumberFormat`, never hardcoded formats.
- Dark mode (admin panel only; client sites are light unless brief says
  otherwise): `color-scheme` on `<html>`, `theme-color` meta matches.

## 5. Turkey-specific rules (ours — hard FAIL if violated)

- `<html lang="tr">`; `openGraph.locale: 'tr_TR'`; hreflang `tr-TR` +
  `x-default`.
- Fonts via `next/font/google`, `subsets: ['latin','latin-ext']` — ş/ğ/ı/İ/ç/ö/ü
  must render; `adjustFontFallback` on.
- No ASCII substitution in Turkish text: s/ş, g/ğ, i/ı, c/ç, o/ö, u/ü errors
  are a hard fail. Mojibake (`Ã§`, `Ä±`, `ÅŸ`) is a hard fail.
- Uppercasing only via `upperTR()` (`toLocaleUpperCase('tr-TR')`); CSS
  `text-transform: uppercase` only on elements inside `lang="tr"`.
- Currency `formatTRY` (`₺1.234,56`), dates `formatDateTR` (`17 Ekim 2026`).
- Phone CTAs: `tel:+90XXXXXXXXXX` (E.164); WhatsApp `https://wa.me/90XXXXXXXXXX`
  (no `+`, no spaces/dashes, optional URL-encoded `?text=`).
- Mobile: sticky bottom CTA bar — "Hemen Ara" + "WhatsApp'tan Yaz". On the
  first mobile viewport it must be clear what the business does, where it is,
  and how to reach it.
- Phone number appears as TEXT (selectable, crawlable), never only in an image.
- KVKK: consent banner with "Tümünü Kabul Et / Tümünü Reddet / Tercihleri
  Yönet" equally styled; no pre-checked boxes; no analytics/marketing scripts
  in demos at all; footer links to Aydınlatma Metni and Çerez Politikası.
- Preview demos: visible "Taslak / Önizleme — resmi site değildir" band,
  `noindex`, Basic-Auth. Photographs from the old site, including staff
  portraits, ARE used in these private demos — see §7 and its TODO for the
  operator decision and the deferred FSEK 86 / KVKK question.
- Opening hours with Turkish day names (Pzt…Paz) visible on page AND in
  LocalBusiness JSON-LD `openingHoursSpecification`; most specific schema
  subtype (`Dentist`, `HairSalon`, …).
- Facts (name, phone, address, hours, prices, services) come verbatim from
  `facts.json`. Inventing or "improving" a fact is a hard fail.

## 6. Design-judge rubric (binary, neutral, screenshot-verifiable)

Each question answered as `{id, pass, evidence}`; evidence cites a screenshot
region or DOM fact. Written neutrally (no "fail/should" steering).

| id | Question |
|---|---|
| DJ1 | Does the first mobile viewport show what the business does, where it is, and one way to contact it? |
| DJ2 | Is there exactly one primary CTA in the first mobile viewport? |
| DJ3 | Does any section use a tracked-out ALL-CAPS eyebrow label? |
| DJ4 | Do three or more sections render as the same shadowed, same-radius card grid? |
| DJ5 | Does any link or button text end with "→"? |
| DJ6 | Does the palette match generic cluster 1 or 2 (cream+terracotta / near-black+acid accent)? |
| DJ7 | Does any Turkish text contain ASCII substitutions (s/ş, g/ğ, i/ı) or mojibake? |
| DJ8 | Is the phone number rendered as selectable text with a `tel:+90` href? |
| DJ9 | Is the sticky mobile CTA bar present with working tel: and wa.me links? |
| DJ10 | Do more than one section animate on scroll into view? |
| DJ11 | Is the memorable "one bold element" from design-plan.md actually present? |
| DJ12 | Are opening hours visible with Turkish day names? |
| DJ13 | Does every rendered section contain body content, not just labels and headings? |
| DJ14 | Does the page use photographs from the crawl rather than placeholder images? |
| DJ15 | Does any visible body copy restate the template's reference-clinic wording rather than this client's own text? |

DJ3–DJ7, DJ10 and DJ15 passing means "no". Generic-cluster or Turkish-text failures
(DJ3–DJ7) and content failures (DJ13–DJ15) are hard fails → fix loop. Others go to the digest as design notes.
Aesthetic comparisons between two variants use randomized A/B pairwise voting,
sampled 3×, trusted only on unanimity — never absolute 1–10 scores.

<!-- TODO(uygar): review DJ list after the first 3 real runs; add/remove
     questions based on what the judge gets wrong. -->
<!-- TODO(uygar): decide the default body/heading font shortlist (3-4 pairs)
     allowed for client sites, so generate doesn't pick exotic fonts. -->

## 7. Content reuse (ours — added after the first real run)

The first rebuild was judged thin and templated. The root cause was not the
palette: the crawl discarded the page text and downloaded none of the
photography, so the generator had titles and headings and nothing else, and
filled the gap with its own copy. These rules close that.

- **The client's own words are the copy.** Service descriptions, team bios,
  FAQ answers and about text come from `crawl/content.json` (per-page
  `contentBlocks`, plus a merged `faq` array). Lift them; do not rewrite from
  scratch and do not summarize away the specifics.
- **Editing is allowed, invention is not.** Fix spelling and mojibake, break
  a wall of text into readable paragraphs, cut filler and marketing padding,
  tighten a 120-word paragraph to 60. Never add a claim, a credential, a
  treatment, a guarantee or a statistic the old site did not make.
- **A section with no source content is dropped**, not padded. An empty
  testimonials section is worse than no testimonials section.
- **Photography comes from `crawl/asset-manifest.json`.** Self-host the real
  images; placeholders are a fallback for when the crawl found none, not the
  default. Pick by `width`/`height` — the hero needs the largest usable
  image, not the first one in the list.
- Every asset carries `license_unknown: true` and a `source_url`. Keep the
  manifest with the generated site so provenance survives into the demo.

<!-- TODO(uygar): operator decided (2026-10-18) that real photographs,
     including staff portraits, are used in private noindex demos. The
     FSEK 86 / KVKK consent question is deferred to the point of sale, not
     the demo. Revisit with a lawyer before any public deployment. -->

## 8. Density and hierarchy (ours — the "thin and generic" failure)

A correct, accessible, fast page can still be lifeless. These are the
checkable parts of what made the first attempt feel templated:

- **Use the vendored `ui-ux-pro-max` dataset for palette, type pairing and
  per-section layout** instead of reaching for defaults. It carries product
  palettes with reasoning profiles, font pairings and UX guidelines; a
  clinic should land on a clinic's palette, not a generic brand ramp.
- **The hero carries real content**, not just a headline over empty space:
  the clinic's actual positioning line, a real photograph, and the primary
  CTA in the first mobile viewport.
- **Sections are ordered by what a visitor needs**, not by template order:
  what this business does and where → proof it is competent (team,
  treatments) → how to reach it. Hours and map belong near contact, not
  stranded mid-page.
- **No section renders as a bare list of labels.** A service needs its
  description; a team member needs their title and their photo; an FAQ entry
  needs its answer.
- Vertical rhythm is deliberate: section padding varies with importance
  rather than every block getting the same spacing token.
