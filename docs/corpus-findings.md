# Corpus findings — 57 award-winning sites, measured

Harvested 2026-10-20 from Awwwards Sites of the Day. URLs discovered through
Firecrawl's stealth proxy (awwwards.com returns 403 to a local browser), then
every site loaded in a local Chromium and measured with `getComputedStyle` —
`apps/orchestrator/src/corpus/harvest.ts`, raw data in
`data/corpus/measurements.json`, screenshots in `data/corpus/shots/`.

Measured, not eyeballed. Where this contradicts `design-rules.md`, the
contradiction is stated rather than smoothed over: these are 57 sites a jury
rewarded, and our rules were written from a sample of five.

Re-harvest is an operator decision, never a side effect of a client run
(docs/DECISIONS.md D9).

> **How to use this file (added 2026-10-21, DECISIONS D10).**
> **This file gives distributions, not directions.** Every number here is a
> median, a percentile or a count across 57 sites that each committed hard to
> one concept. Designing toward these medians produces the average of those
> sites, which is none of them — and that average, applied to every client,
> is exactly the sameness D10 exists to remove.
>
> Use it for two things only:
>
> 1. **Bounds.** A direction's token ranges (weight, tracking, display/body
>    ratio, motion devices) should sit inside the spread measured here, or
>    state why they leave it. The p25–p75 band is the evidence that a value
>    is legitimate, not a target to aim at.
> 2. **The three places the corpus is the wrong model** (§8.4 payload, §9.4
>    WebGL/media, §9.5 contrast). Our rules stay stricter there on purpose.
>
> Do not use it to pick a face, a weight, a layout or a motion signature for
> a client. Those come from a direction (D10 §4), and a direction comes from
> its reference set — specific sites chosen as a whole — never from the
> statistics of all of them. §10's recommendations below are changes to the
> *bounds*; they are not a recipe for a site.

---

## 1. The fonts are not Google Fonts — this is the ceiling we keep hitting

Faces actually painted, across the corpus:

```
Aeonik · ABC Diatype · PP Supply Mono · GT America Mono · Neue Haas Grotesk
Obys Sans · Baikal · Forvm · PPFrama · Ivar Headline · BT Grotesk · editorialOld
```

Almost none of these are on Google Fonts. They are licensed foundry faces —
Klim, Pangram Pangram, Grilli Type, ABC Dinamo. The handful of Helvetica /
Arial / `sans` readings are system-font sites or faces that failed to load.

**This is why swapping one Google face for another never fixed "the fonts
aren't modern".** `TYPE_PAIRS` is restricted to `next/font/google`, and the
entire Google catalogue sits below the floor this corpus establishes. Changing
Inter to Work Sans moves within that ceiling; it does not raise it.

Two ways out, and only these two:

- **License a face.** One foundry licence covers every generated client site
  if the licence is bought per-domain-count or as an agency licence. Real cost,
  real quality jump.
- **Self-host the good free faces.** Fontshare (Indian Type Foundry) publishes
  commercially-free faces built for exactly this aesthetic — Satoshi, Clash
  Display, General Sans, Switzer, Cabinet Grotesk, Boska, Gambetta. Self-hosted
  via `next/font/local`, not `next/font/google`. This is the cheap move and it
  clears the Google ceiling.

The corpus itself shows the second path works: two sites run on `Aeonik`, which
is licensed, but several run self-hosted faces of the same character.

## 2. Display weight: the corpus says 400, our rule says 700–800

```
display weight   400 ×23   700 ×9   500 ×7   300 ×6   600 ×4   450 ×1   220 ×1
                 median 400
```

`design-rules.md` §4 states: *"A grotesk display needs weight 700–800 and
negative tracking. At 400 it reads timid at any size."*

The corpus does not support that. Nearly half of these sites set display type
at **400** and let the size carry it. Heavy display is one option among
several, not the floor.

Our generated sites use 800 (`displayWeight` in `TYPE_PAIRS`), which puts them
at the far edge of what award juries actually reward.

## 3. Display/body ratio: median 4.7, not 6

```
median 4.7    p25 2.9    p75 7.8    max 22.9
```

`design-rules.md` §4 pins ≈6:1. That is inside the distribution but on the
high side, and the spread (2.9–7.8 across the middle half) says this is a
spectrum, not a constant. A site at 3:1 is not failing.

## 4. Tracking: far more conservative than our rule

```
display letter-spacing   median -0.010em   min -0.060em   max +0.020em
body                     median  0.000em
```

Our rule asks for −0.04em…−0.05em on display. The corpus median is
**−0.01em** — a quarter of that. Only the extreme tail reaches −0.06em.

Our Turkish cap on *uppercase* tracking (≤0.08em, design-rules §4) is a
separate and still-correct rule; this is about display tracking, which we have
been setting four times tighter than the work we admire.

## 5. Motion: smooth scroll is universal, scroll-driven transformation is not

```
40/57  Lenis (smooth scroll)
16/57  GSAP
16/57  ScrollTrigger
 2/57  Three.js
elements whose transform changed between two scroll positions: median 1, max 26
```

Smooth scroll is the house standard — 70%. Only 28% load ScrollTrigger *by
that name*, but see §8: the behaviour profile shows far more motion than the
library sniff suggests, because much of it is hand-rolled or bundled under a
minified alias.

> **Corrected 2026-10-20.** An earlier draft of this section concluded from
> `transformedOnScroll` that "the median site transforms one element" and that
> award sites are not animation showcases. That measurement compared two
> scroll positions across the first 60 elements and was simply too shallow.
> Profiling four scroll depths across 120 elements (§8) shows the opposite:
> **34 of 57 sites pin something**, with a median of 6 pinned elements. The
> claim is withdrawn.

## 6. Structure

```
28/57  fixed or sticky header          (half — not a given)
 2/57  header uses mix-blend-mode      (rare; we copied it from one reference)
median page height: 11.6 × viewport    (long pages)
```

`mix-blend-difference` on the nav came from `fourstack-landing`. In the wider
corpus it is used by 2 sites in 57. It is a legitimate device, not a standard.

## 7. Read out of the stylesheets, not off the screen

A second pass reads `document.styleSheets` directly — and fetches the
cross-origin bundles CSSOM refuses — so these are the sites' own declarations,
not what one element happened to compute to.

### 7.1 Type is self-hosted, roughly 7 times in 10

```
223  self-hosted (same origin)
 94  fonts.gstatic.com
 66  cdn.prod.website-files.com   (Webflow, uploaded faces)
 15  framerusercontent.com        (Framer, uploaded faces)
  4  use.typekit.net
```

Self-hosting is the dominant mode, and it is how the foundry faces get in.
Note that Google Fonts is not absent — 94 declarations — which is the second
reason to treat PLAN.md's Inter ban as "not by default" rather than "never":
Inter itself appears 9 times and Work Sans 15 across this corpus.

What matters is not *which CDN* but that these sites choose a face and ship
it, instead of taking whatever the framework defaults to.

### 7.2 A monospace accent face is a current idiom, and we have none

```
29  Geist Mono        12  JetBrains Mono
22  Google Sans Code   7  Roboto Mono
19  Archivo Narrow
```

Four of the most-declared families in the corpus are monospace. These are not
code blocks — they are the small-caps meta, the index numbers, the labels.
`TYPE_PAIRS` has no mono face at all, so a generated site has nothing to set
its `.meta` and `.btn-label` steps in except the body face.

This is a cheap, high-signal addition: a third optional face used only at the
small end. Geist Mono and JetBrains Mono are both open-licensed.

### 7.3 The type scale depth is right; the motion vocabulary is not

```
distinct font sizes per site: median 8   (ours: 8)   p75 12   max 23
```

Our eight-step scale matches the corpus median exactly. No change needed.

Easing and duration, however, we never specified:

```
cubic-bezier(0.22, 1, 0.36, 1)   easeOutQuint   ×8
cubic-bezier(0.16, 1, 0.3, 1)    easeOutExpo    ×7
cubic-bezier(0.4, 0, 0.2, 1)     material       ×15
linear                           (scrubbed)     ×17
transition duration: median 0.40s, p90 1.00s
```

`linear` leading the count is the scrub signal — scroll-driven timelines must
not ease, or the motion fights the scroll. The expressive curves are the
`easeOut*` family with a long tail. Our `src/lib/motion.ts` picks curves
ad hoc; this is the vocabulary to standardise on.

### 7.4 Spacing is a 4px grid

```
most common spacing values: 4, 6, 8, 10, 12, 16, 20, 24, 32, 40
distinct spacing values per site: median 15
```

A 4px base with a dense low end. Our `--section-y` rhythm is set per density
but the small-end spacing is whatever Tailwind's default scale gives, which
happens to agree.

### 7.5 Token blocks

```
custom properties per site: median 26, max 586
```

Most-declared names are the predictable ones (`--spacing`, `--color-white`,
`--font-sans`, `--ease-out`, `--grid-gutter`, `--grid-columns`). Nothing here
argues against our token structure; it confirms that a ~26-token system is
normal and that a 586-token one is an outlier, not a target.

## 8. What the pages actually DO

The third pass scrolls each site to 0 / 30 / 60 / 90% and samples position,
transform, opacity and clip-path for 120 elements, then classifies the
relationship between scroll and element. A stylesheet cannot answer "does this
pin"; only scrolling can.

```
MOTION KIND          sites      elements
pin                  34/57         1013
parallax             31/57          196
reveal               26/57          213
scale                17/57           82
horizontal           15/57           76
clip                 13/57           98

pinned elements:      median 6,  max 118
horizontal movers:    median 0,  max 20   (15 sites move laterally at all)
```

**Pinning is the dominant device, not a flourish** — 60% of the corpus pins
something, and the heavy users pin dozens of elements. Our pinned hero
hand-off is therefore *in* the idiom, not above it. §5's earlier claim to the
contrary came from a shallower measurement and is withdrawn.

Lateral motion is the opposite: only 15 sites move anything horizontally, and
the median site moves nothing. Our pinned services rail is a minority device —
defensible, but it should be a choice the brief makes, not a default.

### 8.1 Text splitting is rarer than we assumed

```
none 44   ·   word 10   ·   char 3
```

Only 13 of 57 break a heading into spans to animate it. Our `statement`
section (word-by-word) and `hero/photo-full` (per-character) both do. That is
fine — but it is a distinctive choice, not table stakes, and applying it to
every client is what would make the sites look alike.

### 8.2 What the timelines actually tween

```
52/57 opacity    52/57 scale      46/57 filter     38/57 autoAlpha
37/57 skewY      33/57 yPercent   32/57 xPercent   29/57 scaleX
```

`filter` at 46/57 is the surprise: blur and brightness transitions are near
universal in this corpus and we use them nowhere. `skewY` at 37/57 is the
other one — a slight skew during motion that we never apply.

### 8.3 The easing vocabulary, from the JS side

```
ease: none    ×35      (scrubbed timelines — must not ease)
ease: expo    ×25
ease: power4  ×24
duration: 1   ×25
anticipatePin ×27
```

This agrees with the CSS reading in §7.3: `easeOutExpo`/`power4` for discrete
motion, `none` for anything tied to scroll. `anticipatePin` appearing 27 times
is a practical detail — it is the option that stops a pin from jumping, and we
do not set it.

### 8.4 Payload

```
JS per site: median 1007 KB, max 3877 KB
```

Award winners ship a megabyte of JavaScript. `build-rules.md` caps our
generated sites at 250 KB of script, and `lighthouserc.cjs` enforces it.

**That cap should stay.** These are agency showpieces measured on a studio
connection; ours are SMB sites whose visitors arrive on mobile data and whose
owner loses a customer to a slow first paint. This is a place where the corpus
is the wrong model and our own rule is right — worth stating so nobody later
reads this document as licence to loosen it.

## 9. On load, on hover, at phone width, under reduced motion

A fourth pass that needs either time or a different browser context: the load
animation, hover, 390px, and a run with `prefers-reduced-motion: reduce`.

### 9.1 Reduced motion is honoured by 73% — and our mandate is right

```
41/56 sites honour prefers-reduced-motion
elements still moving under the preference: median 1
```

Nearly three quarters quiet down properly. Fifteen do not. Our rule (every
timeline behind `gsap.matchMedia`, nothing left hidden) puts us with the
majority, and the 27% who ignore it are not a model to copy.

### 9.2 Our mobile display type is already at the corpus 75th percentile

```
display at 390px:  median 41px   p25 28   p75 54   max 200
body    at 390px:  median 16px
ours:              display clamp floor 52px, body 15px
```

This is the measurement that answers "textler daha büyük olmalı" with a
number. At phone width we set display at **52px against a corpus median of
41px** — we are already larger than half the award winners and sit at their
p75. Our body at 15px is a point under their 16px median, which is the one
place a small increase is defensible.

If the type still reads small, the cause is not the size. It is more likely
the weight (§2), the tracking (§4) or the face (§1).

### 9.3 Entrance animation is a minority device

```
elements settling in the first 2.5s: median 0, max 67
```

Most of these sites do not animate on load at all — they arrive composed. Our
`heroEntrance` runs on every generated site. Worth making optional.

### 9.4 Media is heavy — and this is the second place the corpus is wrong for us

```
37/56  any <canvas>      33 of them with a live WebGL context
33/56  any <video>
 3/56  custom cursor
```

Two thirds run WebGL. Combined with the 1 MB median JS payload (§8.4), this is
an agency-showpiece profile. An SMB site whose visitor is on mobile data in
Küçükçekmece does not want a WebGL canvas, and `build-rules.md` is right to
make that impossible.

Custom cursors, at 3/56, are rare enough to ignore.

### 9.5 Contrast: 29% of award winners fail WCAG AA

```
body contrast: median 15.0:1
below 4.5:1 (AA): 16/56 sites
```

The median is excellent, but nearly a third of this corpus fails AA on body
text. Our axe gate demands zero violations. **Keep it.** A jury forgives low
contrast; a Turkish SMB's older customer squinting at a phone does not. This
is the third place where the corpus is the wrong model.

### 9.6 Hover on the primary CTA — low-confidence measurement

```
46/56 sites: no measured change   ·   border 7   colour 5   background 4
```

Read this one sceptically rather than acting on it. The probe hovers the first
`a`/`button` over 32px tall with text, which on many of these sites is a nav
link rather than the real call to action, and a synthetic hover does not always
trigger JS-driven states. The honest conclusion is that **this needs a better
probe**, not that award sites skip hover styling.

## 10. What to change

In priority order, highest leverage first:

1. **Self-host the faces.** Fontshare through `next/font/local`, not
   `next/font/google`. 7 of 10 corpus sites self-host; it is how the foundry
   faces get in, and nothing else here moves the needle as much.
2. **Add a monospace accent face** to `TYPE_PAIRS` — used only for `.meta`
   and `.btn-label`. Four of the most-declared corpus families are mono, and
   we have none. Geist Mono and JetBrains Mono are open-licensed (§7.2).
3. **Stop forcing `displayWeight: 800`.** Make it vary, with 400 a
   first-class option — the corpus median is 400 (§2).
4. **Relax display tracking** from −0.045em toward −0.01em (§4).
   Note §9.2: our display size is already at the corpus p75, so if the type
   still reads small the cause is weight, tracking or face — not size.
5. **Standardise the motion vocabulary**: `easeOutExpo`/`easeOutQuint` for
   discrete motion at ~0.4s, `linear` for anything scrubbed (§7.3).
6. **Reconsider the mandatory pinned hand-off.** Required motion on every
   site is heavier than the corpus median; it should be something the brief
   chooses, not a floor every client pays for.

Items 3, 4 and 6 contradict `design-rules.md` §3 and §4, which were approved
as D5. They need the operator's decision before they are applied — the file is
protected for that reason. Items 1, 2 and 5 do not contradict anything; they
fill gaps.
