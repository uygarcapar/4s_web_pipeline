# Pattern library — what the reference corpus actually does

Extracted 2026-10-20 from the work the operator rates, by reading the source
rather than by looking at screenshots (docs/DECISIONS.md D9).

**Corpus on disk:** `~/fourstack-landing`, `~/lit-landing`, `~/naks-landing`,
`~/vibecheck-landing`, `~/diskent-landing`.
**Live references:** Aventura Dental Arts (scroll choreography),
4ourstack.com and speaktable.com (typography and colour).

`diskent-landing` carries the most weight here: it is the SMB site the
operator built by hand and approved as the design language (D5). It is the
only member of the corpus that has a real client's facts to honour, so where
it differs from the agency landings, it wins.

This file is a **reference input for the design and plan stages**, not a style
guide to copy. The point is to stop re-deriving these findings by eye on every
run.

---

## 1. Type — the corpus has a house setup, and we were not using it

Measured across all five repos:

| | finding |
|---|---|
| `weight:` pin | **zero repos pin weights.** Every face loads variable. |
| Archivo | 4/5 (fourstack, lit, vibecheck, diskent) — the house grotesk |
| Fraunces | 2/5 (fourstack, naks), **both declare `axes`** — `["opsz"]`, naks adds `"SOFT"` |
| Inter | 2/5 (naks, diskent) as a body face |
| `localFont` | 2/5 (fourstack, lit) for a wordmark the brand owns |

Two corrections this forces on us:

- **Never pin weights.** `weight: ["800"]` gives every heading one fixed
  instance and the page reads like a UI kit. This was our setting until
  2026-10-20; D4 had pinned it to save bytes, and the measured cost of going
  variable on a real client build was **+12 KB** (375 → 387 KB total). The
  saving was not worth what it cost the typography.
- **Inter is not the problem.** `docs/PLAN.md` bans Inter/Roboto, and the
  operator's own corpus uses Inter as a body face in two of five. The signal
  is not "ban a family" — it is *variable faces, a serif with its optical-size
  axis declared, and a display face with enough weight and negative tracking
  to read as display*. Treat the PLAN ban as "do not reach for Inter as a
  default", not as a hard exclusion.

Where a brand owns a wordmark face, the corpus loads it with `localFont`
rather than approximating it from Google Fonts.

## 2. Sections the corpus has that our kit does not

Composition of each multi-section member, in order:

```
diskent    StickyBar  Hero  Marquee  Statement  Services  Team  Visit  Faq  Closing
fourstack  Nav        Hero  Manifesto  Process  WarpGallery  Products  WebWork  ContactForm  Footer
naks       SiteHeader SiteFx  HeroFilm  NiyetSection  MonthCanvas  ScreensStrip  MotifGallery  ReadingSection  TrustAndCta  SiteFooter
```

Our kit: `hero · services · team · gallery · testimonials · faq · contact ·
map · hours`.

Four shapes recur in the corpus and have no equivalent in the kit:

### 2.1 Statement (diskent) / Manifesto (fourstack) / Niyet (naks) — 3/3

The highest-value gap. A single large sentence, revealed **word by word** as
the reader scrolls through it.

diskent's implementation is the model, and it settles the objection that this
section needs invented copy:

> ```
> // The clinic's own sentence from its "Biz Kimiz?" page, trimmed only at the
> // comma. No claim here is ours.
> ```

The sentence is the client's, verbatim, cut only at punctuation. The motion is
`opacity 0.17 → 1`, `stagger`, `ease: "none"`, scrubbed between
`top 78%` and `bottom 55%`. The whole sentence stays one text node for screen
readers; the per-word spans carry no semantics.

This is also how D5's "the text itself changes" invariant is satisfied without
a gimmick. Most crawled SMB sites have exactly one such sentence on their
about page — dermaguzellik.com's is already in `content.json`.

### 2.2 Visit (diskent) — practical information as one section

Our kit splits address, hours and map into three sections (`contact`, `hours`,
`map`). diskent folds them into one, and its comment says why:

> ```
> // The part the award-winning references never need and a clinic cannot do
> // without: opening hours, a street, a number.
> ```

Each row slides up from under its own rule (`yPercent: 110`, `stagger: 0.07`)
so practical information still belongs to the motion language without becoming
a puzzle. One section reads as a decision; three read as a form.

### 2.3 Closing (diskent) / TrustAndCta (naks) — 2/3

A final statement plus the call, distinct from a contact form. The page ends
on a claim and an action, not on a field set.

### 2.4 Marquee (diskent) — a scrolling band

A horizontal band of the client's own service names between hero and
statement. Cheap, and it carries the lateral motion the design rules ask for
on sites whose services section is a plain grid rather than a pinned rail.

## 3. Structure

- **A persistent header in every multi-section member** (`StickyBar`,
  `Nav`, `SiteHeader`). Our template had none until 2026-10-20.
- **Smooth scroll in all five** (`SmoothScroll` wrapper, Lenis driven by
  `gsap.ticker`).
- **A background effect layer in four** (`LiveBg`, `SiteFx`, `VibeFx`,
  `WorkFx`) — a site-wide canvas/gradient under the content, not a per-section
  decoration.
- **ScrollTrigger is the motion vocabulary throughout**, always inside
  `gsap.matchMedia()` with a `prefers-reduced-motion: no-preference` query.
- `mix-blend-difference` on the fixed header (fourstack) so one bar works over
  a photograph and over pale sections without a plate of its own.

## 4. What does NOT transfer

- **Uppercase tracking.** The corpus sets `0.22em`–`0.3em` on small caps.
  `design-rules.md` §4 caps us at `0.08em` because that spread slows reading of
  short agglutinated Turkish. The corpus is English-first; we are not.
- **Invented copy.** Agency landings write their own claims. Every sentence on
  a generated client site comes from `facts.json` or `content.json` verbatim.
  Where the corpus has a `Manifesto`, we may only have a `Statement` if the
  client wrote one.
- **Section count.** naks and fourstack run 9–10 sections because they have
  material for them. Section set follows the facts that exist (D6).

## 5. Open gaps this library does not close

- The kit cannot express a section that is not in `sectionSchema`'s union, so
  adopting any of §2 means adding to the schema and the registry, not just to
  a prompt.
- Nothing here tells the pipeline *which* of these a given client needs. That
  is the brief step (D9), not this file.
