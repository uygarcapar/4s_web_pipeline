# Design rules

Hard rules for the `design`/`plan`/`generate` stages, `section-builder`, and
the `design-judge` rubric. Sources: vendored `frontend-design`
(anthropics/skills) and `web-design-guidelines` (vercel-labs/agent-skills) —
quoted below so sessions do not depend on loading those skills. Turkey-specific
rules live only here and in our stage skills, not upstream.

**§3–§6, §10 and §11 were rewritten on 2026-10-19 (DECISIONS D5/D6/D7)** from
a reference site built by hand and approved by the operator over several
review rounds (`~/diskent-landing`). Where this file contradicts PLAN.md,
this file wins.

> **Amendment notice.** The approved design language uses small uppercase
> eyebrow labels and animates most sections on scroll. The previous DJ3 and
> DJ10 banned both outright and would now fail every correct site. They are
> narrowed, not deleted: what was actually wrong was *tracked-out* chrome
> above *every* heading, and *fade-up-on-scroll as the only motion*.

## 1. Process (mandatory order)

1. The `design` stage writes `runs/<domain>/design/design.json` FIRST — the
   site's DNA (§10). No section code before it exists.
2. Review the DNA against the generic clusters in §2 and against the
   fingerprints of recent runs in the same sector (§10.4). If any part reads
   like "the default we would produce for any similar business", revise it and
   record what changed and why.
3. "Spend your boldness in one place." One memorable element; everything
   around it quiet and disciplined.
4. Ground the design in the subject. A Kadıköy dental clinic and a Beşiktaş
   barber must not get the same design — and under §10 they cannot, because
   the palette is derived from their own photographs.

## 2. The five generic-AI clusters (FAIL if matched)

1. Warm cream background (near `#F4F1EA`) + high-contrast serif display +
   terracotta/warm-clay accent (near `#D97757`).
2. Near-black background with a single bright acid-green or vermilion accent.
3. Broadsheet layout: hairline rules, zero border-radius, dense newspaper
   columns.
4. "SaaS-card kit": content chopped into identical rounded cards, one
   border-radius on everything, the same soft grey shadow under each, gradient
   washes as decoration.
5. Template chrome regardless of subject: meta strings joined with middle dots
   (`A · B · C`); `WORD — fragment` labels; tinted near-black (`#0B0B0B`,
   `#111`) standing in for black; monospace for small data labels; `→`
   appended to link or button text.
   *(Amended: the uppercase eyebrow is no longer listed here. It is permitted
   under the tracking limit in §4 and the content test in DJ3.)*

## 3. Motion grammar

> **Which motion a site carries is its direction's decision** — the profile
> (`still` / `calm` / `editorial` / `kinetic`), whether a pinned hand-off or a
> text transformation is required, whether there is a lateral move, whether
> the hero animates on load, and whether Lenis is loaded at all. See
> docs/D10-design-variation.md §3.2 and §4. The rules below are the ones that hold
> for every site regardless of direction; they are about correctness, not
> character.
>
> Moved out of this section: "scroll must change the page", the required
> pinned hand-off, the required text transformation, the recommended lateral
> move, the single page-load moment, and "a page whose entire motion
> vocabulary is fade-up fails". Each of those described one design language
> and is now a property of `kinetic-bold` (D10 §4.3).

- **Foundation, when a direction uses Lenis.** Lenis smooth scroll driven by
  `gsap.ticker`; ScrollTrigger reads the same clock. `lenis.resize()` on every
  ScrollTrigger refresh, and a refresh after `document.fonts.ready` — trigger
  positions measured before the webfont settles are wrong by a few pixels.
  A direction with a `still` profile may omit Lenis entirely.
- **A lateral move never hijacks touch.** Where a direction uses one, it
  degrades to a native swipe list below 1024px.
- Animate `transform`, `opacity` and `filter` only; never `transition: all`.
  (`filter` is in the list because blur and brightness transitions are near
  universal in the reference corpus — docs/corpus-findings.md §8.2.)
- `gsap.matchMedia` gates everything. Under `prefers-reduced-motion: reduce`
  **no timeline runs and no content is left hidden** — anything a timeline
  would have revealed must already be visible.
- Per-character splitting happens on the client only. Server-side the heading
  renders as plain words so it still scores as one LCP block.
- Selector strings inside `useGSAP` resolve against its scope. A trigger that
  lives outside the scope must be looked up on the document, or it silently
  never fires.
- Overlapping trigger ranges need one source of truth. Letting each element
  tween a shared target leaves two of them visible at once.

## 4. Type scale

One scale per site, declared in `tokens.css`. No section invents a size.

> **The scale's values are the direction's**, generated from its
> `scaleRatio`, `displayWeights` and `displayTracking` ranges
> (docs/D10-design-variation.md §3.2, §5). The eight steps below are the shape every
> site has; the numbers that used to be fixed here are not.
>
> Moved out: the exact `clamp()` values, "display/body ratio ≈ 6:1", and
> "a grotesk display needs weight 700–800 and −0.04em…−0.05em tracking". The
> measured corpus spread is 2.9–7.8 on the ratio, 220–700 on weight and
> −0.06em…+0.02em on tracking (docs/corpus-findings.md §2–§4); the old
> constants sat at one end of all three because they were read off a single
> site. `kinetic-bold` keeps them (D10 §4.3).

| step | role |
|---|---|
| `t-display` | hero + closing statement |
| `t-h2` | full-width section headings |
| `t-h2-col` | headings sharing a row with another column |
| `t-h3` | card titles |
| `t-lead` | lead paragraphs |
| `t-body` | body |
| `.meta` | uppercase eyebrows |
| `.btn-label` | button labels |

- **Big type only reads as big against a quiet floor.** Whatever ratio a
  direction sets, raising the supporting sizes to meet the headline flattens
  the page even though every size got bigger — this was a real failure,
  corrected.
- **Uppercase tracking ≤ 0.08em.** The award references use 0.2–0.35em; in
  Turkish that spread slows reading of short agglutinated phrases. One
  tracking value for all small caps on the page.
- **Wide tracking belongs only to standalone eyebrows.** Inside a dense row of
  label/value pairs, labels keep normal spacing.
- `vw` sizing is only safe where the element is full-width. A heading inside a
  capped container keeps growing with the viewport while its column does not —
  cap it in `rem` (that is what `t-h2-col` is for).
- `overflow-wrap: break-word` on every display step. An unexpected long word
  must break ugly rather than land on top of its neighbour.
- The hero's three-line display block must fit a 900px-tall laptop viewport;
  the `vmin` term in `t-display` is what guarantees it.
- Line length < 80 characters.

## 5. Colour

- **One hue family, start to finish.** Papers warm; darks are the same warmth
  pushed to near-black with a trace of the accent. Neutrals carry the accent's
  hue — this is where "the colours go together" actually comes from.
- **The photographs are the chroma.** At most one non-neutral accent, used
  only for hover/focus — never as a surface, never as a background.
- **The palette is derived from the client's own photographs** (§10.1), not
  chosen from a ramp. A tint sampled from their equipment or their room makes
  their pictures sit inside the palette instead of fighting it.
- Dark grounds get a scrim, not a wash: text over a photograph needs a flat
  dark tint plus gradients weighted to the corners the text occupies. Never a
  white panel over the picture.
- A shared CSS class must not set `color`. These rules are emitted after
  Tailwind's utilities and silently beat every `text-*` written beside them,
  landing one grey on dark grounds and on photographs alike. Size and case in
  the class; colour at each use.

## 6. Turkish typography

- `<html lang="tr">`; `openGraph.locale: 'tr_TR'`; hreflang `tr-TR` +
  `x-default`.
- Fonts via `next/font/google` **or** `next/font/local`,
  `subsets: ['latin','latin-ext']` — ş/ğ/ı/İ/ç/ö/ü must render, confirmed by
  rendering them, not by trusting a catalogue page. At most two display/body
  families plus an optional monospace accent. Which faces are permitted is
  the direction's decision (D10 §3.2, §11 C1/C3). Self-hosted faces are free
  open-licence faces only — no foundry licence is bought, so a per-domain or
  pageview-capped licence disqualifies a face (D10 §13 Q2).
- **Display line masks need padding on both sides.** `overflow: hidden` with
  tight leading clips the cedilla of ş and the dot of İ — which silently
  renames the business ("Dişkent" → "Diskent"). Pad top and bottom by ≥0.12em
  and cancel it with a negative margin.
- No ASCII substitution (s/ş, g/ğ, i/ı, c/ç, o/ö, u/ü) and no mojibake
  (`Ã§`, `Ä±`, `ÅŸ`) — hard fail.
- Uppercasing only via `upperTR()`; CSS `text-transform: uppercase` is correct
  **only** inside `lang="tr"`, where i→İ and ı→I map properly.
- Currency `formatTRY` (`₺1.234,56`), dates `formatDateTR` (`17 Ekim 2026`).

## 7. Interface quality floor (checkable)

Full vendored list: `.claude/skills/web-design-guidelines/guidelines.md`.
Non-negotiable subset enforced by verify:

- **Every interactive target ≥ 44px on both axes.** Small text in a large box
  is correct; a 20px link is not. Use `min-h-11` plus a cancelling negative
  margin when the row's height must not change.
- **A phone number never wraps** (`white-space: nowrap`).
- **No horizontal overflow at any width** — checked 344 → 2560.
- **No text overlapping other text at any width** — checked by the overlap
  detector (§12).
- `scroll-margin-top` on every anchor target, or the fixed bar covers the
  heading it just jumped to.
- **Own scroll restoration.** `history.scrollRestoration = "manual"` in a
  pre-paint inline script, plus `ScrollTrigger.clearScrollMemory("manual")`.
  Two separate restorers (the browser's and GSAP's) otherwise drop a reload
  into the middle of a pinned section. Re-assert the top *after*
  `ScrollTrigger.refresh()`, which can itself move the position.
- **A hash target below a pinned section must be re-aimed** once the page has
  its final height; the browser's jump happens before the pin spacers exist.
- A list that snaps needs `scroll-padding`, or snapping the first card flush
  scrolls the list's own padding out of view.
- Accessibility: icon-only buttons need `aria-label`; `<button>` for actions,
  `<a>` for navigation; images need `alt`; headings hierarchical; visible
  `focus-visible`; never `outline: none` without replacement.
- A display heading split across block lines needs `aria-label` with the whole
  sentence, or a screen reader runs the words together.
- Images: `fill`/explicit dimensions (CLS); below-fold `loading="lazy"`;
  hero `priority`.
- Forms: correct `type`/`inputmode`; never block paste; errors inline.
- `…` not `...`; curly quotes; `tabular-nums` for number columns.
- `touch-action: manipulation`; no `user-scalable=no`.

## 8. Turkey-specific business rules (hard FAIL if violated)

- Phone CTAs `tel:+90XXXXXXXXXX`; WhatsApp `https://wa.me/90XXXXXXXXXX`.
- Phone number appears as selectable TEXT, never only in an image.
- **The first viewport shows what the business does, where it is, when it is
  open, a pressable phone number and a CTA.** The award references omit these;
  an SMB site cannot.
- Opening hours with Turkish day names visible on page AND in LocalBusiness
  JSON-LD; most specific schema subtype (`Dentist`, `HairSalon`, …).
- KVKK: consent banner with equally styled accept/reject/manage; no
  pre-checked boxes; no analytics or marketing scripts in demos at all;
  footer links to Aydınlatma Metni and Çerez Politikası.
- Preview demos: visible "Taslak / Önizleme" band, `noindex`, Basic-Auth.
- Facts come verbatim from `facts.json`. Inventing or "improving" one is a
  hard fail.

## 9. Content and copy language

The first rebuild was judged thin and templated. The root cause was not the
palette: the crawl discarded the page text and downloaded no photography, so
the generator had headings and nothing else and filled the gap with its own
copy.

- **The client's own words are the copy.** Service descriptions, team bios,
  FAQ answers and about text come from `crawl/content.json`. Lift them.
- **Editing is allowed, invention is not.** Fix spelling and mojibake, break
  walls of text, cut filler, tighten. Never add a claim, credential,
  treatment, guarantee or statistic the old site did not make.
- **Titles and roles are facts, not guesses.** A doctor's speciality comes
  from their own page title; which portrait belongs to whom comes from the
  crawled markup, never from looking at the pictures. This was a real error
  on the first run: five specialities were invented and two people were given
  the wrong ones.
- **Neighbourhood, founding date and similar details are facts too.** If the
  site says Feneryolu, it is not Caferağa.
- **A section with no source content is dropped**, not padded.
- **Photography comes from `asset-manifest.json`**, self-hosted, picked by
  dimensions — the hero needs the largest usable image. Distinguish the
  client's *real* photographs (their room, their staff) from the stock
  pictures their old site licensed; the real ones carry the hero.
- Alt text describes what is actually in the frame. Decorative service imagery
  takes `alt=""`; the heading carries the meaning.
- **Headline grammar varies per site** (§10.3). The same prompt shape writes
  the same sentence shape — "X onaran klinik" must not become every client's
  hero.
- Active voice, plain verbs; the CTA says exactly what happens.

## 10. Variation — sites must not be copies of each other

One design language must not become one site repeated per client. Sameness
has four failure modes and each needs its own remedy: **structural,
chromatic, typographic, rhetorical**.

Variation is **derived from the client's own material, never random**. Random
variation produces incoherent sites; derived variation produces sites that
differ because the businesses differ.

### 10.1 Chromatic — from their photographs

Sample the crawl's real photographs, take the dominant non-neutral hue, and
build the one-hue-family scale (§5) around it. Deterministic TypeScript, no
model call, reproducible from the same inputs.

### 10.2 Structural — from what exists

- The section set follows which facts actually exist. A clinic with five
  doctors and an FAQ gets a team section and an FAQ; a bakery with forty
  products and no staff page gets a product grid and neither.
- Density follows crawled content volume: 400+ content blocks is an editorial
  page, 40 is a poster.
- Layout archetype is chosen per section from the template's variant kit
  (`template/src/sections/<type>/<archetype>.tsx`), not fixed.

### 10.3 Typographic and rhetorical — from sector and voice

- Type pairing from a curated table keyed by sector and density, not a free
  choice; max two families.
- Motion signature (which section carries the pinned hand-off, which carries
  the text transformation) varies per site.
- The hero's headline grammar is selected per site, so the rhetorical shape
  changes along with everything else.

### 10.4 The hard guarantee — design fingerprint

Derivation is a hope; the fingerprint is the guarantee. Each run records

```
fingerprint = hash(palette family + type pair + section archetypes + motion signature)
```

in the database. **A new run may not emit a fingerprint matching any recent
run in the same sector.** On collision the design stage takes the next
candidate and logs what it rejected and why.

## 11. Design-judge rubric (binary, screenshot-verifiable)

Each question answered as `{id, pass, evidence}`; evidence cites a screenshot
region or DOM fact. Written neutrally.

| id | Question |
|---|---|
| DJ1 | Does the first mobile viewport show what the business does, where it is, and one way to contact it? |
| DJ2 | Is there exactly one primary CTA in the first mobile viewport? |
| DJ3 | Does any uppercase label use letter-spacing above 0.08em, or sit above a heading without adding information the heading lacks? |
| DJ4 | Do three or more sections render as the same shadowed, same-radius card grid? |
| DJ5 | Does any link or button text end with "→"? |
| DJ6 | Does the palette match generic cluster 1 or 2? |
| DJ7 | Does any Turkish text contain ASCII substitutions or mojibake? |
| DJ8 | Is the phone number rendered as selectable text with a `tel:+90` href? |
| DJ9 | Is the mobile CTA present with working tel: and wa.me links? |
| DJ10 | Does the page's motion match the direction's motion profile, and is fade-up not the only device when that profile is `editorial` or `kinetic`? **Measured in code** (`design/directions/checks.ts`), not asked of the model. |
| DJ11 | Is the memorable "one bold element" from design.json actually present? |
| DJ12 | Are opening hours visible with Turkish day names? |
| DJ13 | Does every rendered section contain body content, not just labels and headings? |
| DJ14 | Does the page use photographs from the crawl rather than placeholder images? |
| DJ15 | Does any visible body copy restate the template's reference-clinic wording rather than this client's own text? |
| DJ16 | Do the display weight, the display tracking and the display/body ratio all fall inside the selected direction's ranges? **Measured in code** (`design/directions/checks.ts`), not asked of the model. |
| DJ17 | Is this run far enough from every recent run? Enforced in the design stage, not by the judge — the fingerprint it names is checked before any markup exists, and D10 §8 replaces equality with a measured structural + visual distance in task C4. |
| DJ18 | Is the signature section present, and does it resemble its direction's reference set more than the default kit? Design note, not a hard fail, until the thresholds are calibrated (D10 §3.3). |

DJ3–DJ7 and DJ15 passing means "no" (the unwanted trait is absent).
**Hard fails → fix loop:** DJ3–DJ7, DJ10, DJ13–DJ15, DJ17. Others go to the
digest as design notes. This sentence is the single source of truth for the
hard-fail set: `design/directions/checks.test.ts` parses it and asserts
`HARD_FAIL_IDS` matches, because the set had previously drifted apart in the
rubric, the judge and `acceptance.json`.

Aesthetic comparisons between two variants use randomized A/B pairwise voting,
sampled 3×, trusted only on unanimity — never absolute 1–10 scores.

## 12. Automated checks (run in verify, before the judge)

Geometry is cheaper and more reliable to check by script than by model. These
run headless across the width matrix and fail the gate directly:

- **Responsive audit** — 344 / 375 / 390 / 430 / 768 / 820 / 1024 / 1280 /
  1512 / 1920 / 2560 plus one landscape phone. Asserts: no horizontal
  overflow, no interactive target under 44px, every section present, no page
  errors.
- **Overlap detector** — compares every painted leaf text box against every
  other and fails on a real intersection. Two rules learned the hard way, or
  the tool reports phantoms: skip anything inside a `position: fixed` ancestor
  (its document coordinates are meaningless), and trust
  `Element.checkVisibility()` over geometry (a closed `<details>` still reports
  a non-zero box for its hidden content).
- **Reload stability** — scroll to several depths, reload, assert the page
  lands at the top each time; and load each anchor directly, asserting the
  target sits at its `scroll-margin-top`.

A check that produces false positives is worse than no check: it trains the
fix loop to ignore it. Fix the detector before fixing the site.
