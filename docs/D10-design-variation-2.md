# D10 — Design variation through a declared design space

**Status:** proposed · **Date:** 2026-10-21 · **Owner:** operator (Uygar)
**Amends:** D5 (design-rules §3–§6 stop being global), D6 (structural
variation), D7 (fingerprint), D4 (Google-only fonts), D9 (harvest gains a
composition pass, §14)
**Inputs:** `template/design-rules.md`, `template/pattern-library.md`,
`docs/corpus-findings.md`, `apps/orchestrator/src/design/dna.ts`

---

## 1. Problem

Every generated site converges on the same page, even after the 57-site corpus
study. The cause is architectural, not a prompt or model problem:

1. **The style rules encode one site.** `design-rules.md` §3–§6 were written
   from `diskent-landing` and enforced as gates: a fixed type scale (exact
   `clamp()` values), display weight 700–800, tracking −0.045em, a mandatory
   pinned hand-off, a mandatory text transformation, one hue family, two
   families, `next/font/google`. DJ16 hard-checks this. Verify is therefore a
   *similarity-to-diskent* test, and any genuinely different design fails it.
2. **The variation axes are too narrow.** §10 varies palette (from photos —
   most SMB photos are beige/grey/white), type pair (small table) and section
   archetype (small kit). Grid, alignment, density, shape language, image
   framing and motion profile never vary.
3. **The fingerprint measures inequality, not difference.** Changing one
   archetype changes the hash; the eye still sees the same site.
4. **The corpus study produced medians.** Designing toward the median produces
   the average site. Award sites are good because each commits hard to one
   coherent concept, not because they sit at the median. We needed 57 design
   systems, not the statistics of 57 sites. `docs/corpus-findings.md` now says
   this at its head: it gives distributions (the legal range for a direction's
   token ranges), never a direction. Directions come from the reference sets
   in §4.
5. **LLM-written JSX collapses to the model's prior.** Same prompt + same rules
   → narrow output distribution. Each added rule (especially "don't" rules)
   pushes it further into a narrow safe zone. Temperature and "be creative"
   do not fix this.

## 2. Decision

**Move creativity out of the runtime and into a curated, declared design
space. At runtime the model selects and fills; it does not invent.**

- Taste enters the system **once, offline, approved by the operator** — as
  directions and archetypes — not re-derived per run.
- Variation comes from **discrete, enumerated axes** sampled deterministically
  per client and checked against recent runs by **measured distance**
  (structural + visual), not hash inequality.
- The model gets **one** place for bespoke work per site (the signature
  section), guided by **reference screenshots**, not prose rules.

The quality ceiling of the pipeline becomes the quality of the library. That
is intended: design quality is curation, and the pipeline's job is to scale
the curation.

---

## 3. Split the rules: invariants vs style

Every current rule moves into exactly one bucket.

### 3.1 Invariants — global, every site, gates stay hard

| Source | Rule |
|---|---|
| design-rules §6 | `lang="tr"`, latin-ext coverage, no ASCII substitution / mojibake, `upperTR`, line-mask padding ≥0.12em, `formatTRY`/`formatDateTR` |
| design-rules §7 | 44px targets, phone `nowrap`, no overflow 344→2560, overlap detector, `scroll-margin-top`, scroll restoration, a11y, image CLS rules, forms |
| design-rules §8 | tel/wa.me format, first-viewport facts, hours + JSON-LD, KVKK, preview band/noindex/Basic-Auth, facts verbatim |
| design-rules §9 | client's own words, no invention, titles/roles as facts, drop empty sections, photography from manifest |
| design-rules §2 | the five generic clusters (still FAIL, checked per direction at authoring time AND per run) |
| design-rules §3 | **only**: reduced-motion contract, transform/opacity/filter only, no `transition: all`, client-only char splitting, `useGSAP` scope rule, single source of truth for overlapping triggers, Lenis/ScrollTrigger clock wiring *when Lenis is used* |
| design-rules §4 | **only**: one scale per site declared in `tokens.css`, `overflow-wrap: break-word` on display steps, `vw` only on full-width elements, hero fits 900px viewport, line length <80ch, uppercase tracking ≤0.08em |
| build-rules (all) | unchanged — 250 KB script budget, LHCI thresholds, axe zero violations, no third-party scripts |

### 3.2 Style — moves into direction files

| Current global rule | Becomes |
|---|---|
| Fixed type-scale clamp values | per-direction scale generator (ratio + floor + ceiling) |
| Display ratio ≈6:1 | per-direction `scaleRatio` range (corpus p25–p75: 2.9–7.8) |
| Display weight 700–800 | per-direction `displayWeight` options (400 is first-class) |
| Display tracking −0.04…−0.05em | per-direction range (corpus median −0.01em) |
| Mandatory pinned hand-off | `motion.signatures` option of `kinetic`/`editorial` profiles |
| Mandatory text transformation | same |
| Mandatory `heroEntrance` | per-direction flag (corpus: median site animates nothing on load) |
| Lenis everywhere | per-direction (`still` profile may omit it — smaller bundle) |
| One hue family, photo-derived | default `color.strategy: "mono-hue"`; other strategies allowed per direction |
| Max two families | max two **display/body** families + optional mono accent |
| `next/font/google` only | `next/font/local` (self-hosted) **or** `next/font/google` |

### 3.3 Judge rubric changes

| id | Change |
|---|---|
| DJ10 | → "Does the page's motion match the direction's motion profile, and is fade-up not the only device when the profile is `editorial` or `kinetic`?" |
| DJ16 | → "Do display weight, tracking and display/body ratio fall inside the selected direction's ranges?" |
| DJ17 | → distance-based (§8), not fingerprint equality |
| DJ18 (new) | "Is the signature section present, and does it match its direction's reference set more than the default kit?" — design note, not hard fail, until calibrated |

> `design-rules.md` and the judge tests are protected. The split above is an
> **operator edit**; agents implement everything else against it.

---

## 4. Direction catalog

A direction is a coherent, named design language: token ranges, allowed
archetypes, motion profile, font options and a reference set. Diskent's
language becomes one direction among several.

### 4.1 Layout

```
apps/orchestrator/src/design/directions/
  index.ts                 # registry: DirectionId → Direction
  kinetic-bold.ts
  editorial-serif.ts
  swiss-grid.ts
  quiet-luxury.ts
  ...
data/directions/<id>/refs/ # 3–5 reference screenshots per direction
                           # (desktop fold + mobile fold), from data/corpus/shots/
```

### 4.2 Direction schema

```ts
import { z } from "zod";

export const directionSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  intent: z.string(),                 // one paragraph: what this language is FOR
  type: z.strictObject({
    pairs: z.array(z.strictObject({ display: z.string(), body: z.string() })).min(2),
    mono: z.array(z.string()),        // empty = no mono accent
    displayWeights: z.array(z.number()).min(1),
    displayTracking: z.tuple([z.number(), z.number()]),   // em, [min, max]
    scaleRatio: z.tuple([z.number(), z.number()]),
    displayCase: z.array(z.enum(["sentence", "upper"])),
  }),
  color: z.strictObject({
    modes: z.array(z.enum(["light", "dark", "split"])).min(1),
    strategies: z.array(z.enum(["mono-hue", "photo-led", "duotone", "accent-block"])).min(1),
    paperLightness: z.tuple([z.number(), z.number()]),     // OKLCH L range
    maxChroma: z.number(),
  }),
  shape: z.strictObject({
    radius: z.array(z.union([z.literal(0), z.literal(4), z.literal(12), z.literal(999)])),
    rules: z.array(z.enum(["none", "hairline", "heavy"])),
    imageFrame: z.array(z.enum(["bleed", "inset", "masked", "collage"])),
  }),
  grid: z.strictObject({
    alignment: z.array(z.enum(["centered", "left-flush", "asymmetric"])),
    density: z.array(z.enum(["poster", "standard", "editorial"])),
  }),
  motion: z.strictObject({
    profiles: z.array(z.enum(["still", "calm", "editorial", "kinetic"])),
    signatures: z.array(z.string()),  // MotionSignature ids allowed
    heroEntrance: z.boolean(),
    smoothScroll: z.boolean(),
  }),
  archetypes: z.record(z.string(), z.array(z.string())), // SectionType → allowed ArchetypeIds
  affinity: z.strictObject({         // used by the scorer (§6.2)
    tone: z.record(z.string(), z.number()),
    tier: z.record(z.string(), z.number()),
    photoProfile: z.record(z.string(), z.number()),
  }),
  avoid: z.array(z.string()),        // which generic clusters this direction is near, and how it stays out
});
```

### 4.3 First four directions

Start with four, fully specified, before adding more. Each must be checked
against §2's generic clusters at authoring time — `avoid` records how.

#### `kinetic-bold` (the current diskent language)

- **Intent:** confident, modern, motion-led. For clinics and studios with good
  real photography and a clear one-sentence identity.
- **Type:** Archivo variable display, weights `[700, 800]`, tracking
  `[-0.045, -0.03]`, ratio `[5.5, 7]`, sentence case. Mono accent optional.
- **Color:** light or split, `mono-hue`, photo-derived.
- **Shape:** radius `0 | 4`, rules `hairline`, frame `bleed | masked`.
- **Grid:** `left-flush | asymmetric`, density `standard | editorial`.
- **Motion:** `kinetic`; signatures: pinned hand-off, word-by-word statement,
  pinned rail. Hero entrance on. Lenis on.
- **Archetypes:** current kit + `statement`, `visit`, `closing`, `marquee`.
- **Avoid:** cluster 2 — accent stays photo-derived, never acid green or
  vermilion on near-black.

#### `editorial-serif`

- **Intent:** calm authority. Long-established practices, law/finance-adjacent
  services, anything with a lot of text the client actually wrote.
- **Type:** Fraunces (`axes: ["opsz"]`) or a self-hosted serif display at
  `[300, 400]`, tracking `[-0.015, 0]`, ratio `[3, 4.5]`, grotesk body.
  No mono.
- **Color:** light only, `mono-hue | photo-led`, low chroma.
- **Shape:** radius `0`, rules `none | hairline`, frame `inset`.
- **Grid:** `left-flush`, density `editorial`.
- **Motion:** `calm` — opacity/filter reveals, no pin, no lateral. Hero
  entrance off. Lenis on.
- **Avoid:** cluster 1 (cream + serif + terracotta) — paper lightness and hue
  must come from the photographs, never the `#F4F1EA` + clay combination;
  cluster 3 (broadsheet) — no dense multi-column text, generous measure.

#### `swiss-grid`

- **Intent:** precise, systematic, technical. Engineering, repair, logistics,
  B2B services, clinics with a clinical brand.
- **Type:** neo-grotesk display at `[400, 500]`, tracking `[-0.02, -0.005]`,
  ratio `[4, 6]`, mono accent required (`.meta`, `.btn-label`, index numbers).
- **Color:** light or split, `accent-block | mono-hue`.
- **Shape:** radius `0`, rules `heavy | hairline`, frame `inset`.
- **Grid:** `asymmetric` 12-column, density `standard`.
- **Motion:** `editorial` — scrubbed `linear` timelines, numbered index
  reveals, optional horizontal rail. Hero entrance off.
- **Avoid:** cluster 5 — mono is used for numbers and labels with content,
  not decorative `A · B · C` strings; no `→` suffixes.

#### `quiet-luxury`

- **Intent:** premium, restrained, photo-forward. Aesthetic clinics, salons,
  boutique hospitality, high-tier tradespeople with strong photography.
- **Type:** thin serif or wide grotesk display at `[300, 400]`, tracking
  `[-0.01, 0.01]`, ratio `[4, 6]`, sentence case.
- **Color:** dark or split, `photo-led`, very low chroma.
- **Shape:** radius `0 | 999` (pills only for buttons), rules `none`,
  frame `bleed | masked`.
- **Grid:** `centered | asymmetric`, density `poster | standard`.
- **Motion:** `calm` — blur/brightness `filter` transitions (46/57 in the
  corpus, unused by us today), slow scale on imagery. One pin allowed.
- **Avoid:** cluster 2 — no single bright accent on near-black; the darks are
  the photo hue pushed to near-black (§5), not `#0B0B0B`.

#### Backlog directions (stub after the first four ship)

`warm-craft` (soft radius, photo collage, organic rhythm — bakeries,
workshops, family businesses) · `poster` (minimal content, giant type, near
still — small businesses with little crawled content) · `clinical-clean` ·
`playful-local`.

---

## 5. DesignSpec — the resolved per-site decision

`runs/<domain>/design/design.json` becomes a fully resolved, validated
`DesignSpec`. Every downstream stage reads it; nothing re-decides style.

```ts
export const designSpecSchema = z.strictObject({
  version: z.literal(2),
  direction: z.string(),
  seed: z.string(),                       // sha256(domain + candidateIndex)
  type: z.strictObject({
    display: z.string(), body: z.string(), mono: z.string().optional(),
    displayWeight: z.number(),
    displayTracking: z.number(),
    scaleRatio: z.number(),
    displayCase: z.enum(["sentence", "upper"]),
  }),
  color: z.strictObject({
    mode: z.enum(["light", "dark", "split"]),
    strategy: z.enum(["mono-hue", "photo-led", "duotone", "accent-block"]),
    brandH: z.number(), brandC: z.number(),
  }),
  shape: z.strictObject({
    radius: z.number(),
    rules: z.enum(["none", "hairline", "heavy"]),
    imageFrame: z.enum(["bleed", "inset", "masked", "collage"]),
  }),
  grid: z.strictObject({
    alignment: z.enum(["centered", "left-flush", "asymmetric"]),
    density: z.enum(["poster", "standard", "editorial"]),
  }),
  motion: z.strictObject({
    profile: z.enum(["still", "calm", "editorial", "kinetic"]),
    signatures: z.array(z.string()),
    heroEntrance: z.boolean(),
    smoothScroll: z.boolean(),
  }),
  sections: z.array(z.strictObject({ type: z.string(), archetype: z.string() })).min(3),
  signature: z.strictObject({            // the one bold element (§9)
    sectionIndex: z.number(),
    concept: z.string(),
  }),
  rejected: z.array(z.strictObject({     // audit trail for §8
    direction: z.string(), reason: z.string(), distance: z.number(),
  })),
});
```

`tokens.css` is **generated** from the spec by deterministic code
(`apps/orchestrator/src/design/tokens.ts`): type scale from
`scaleRatio` + floor/ceiling, tracking, weights, radius, colour ramp from
`brandH`/`brandC` + `mode` + `strategy`. The model never writes token values.

---

## 6. Selection pipeline

```
crawl → audit → brief → direction → spec → compose → generate → signature → verify → judge
                 LLM     TS          TS     TS        LLM        LLM+vision
```

### 6.1 `brief` (LLM, small, structured)

Classifies the client from `facts.json`, `content.json` and the asset
manifest. Output is an enum-heavy schema so it cannot drift into prose:

```ts
export const briefSchema = z.strictObject({
  tone: z.enum(["warm", "clinical", "premium", "playful", "traditional", "technical"]),
  tier: z.enum(["budget", "mid", "premium"]),
  audience: z.enum(["local-everyday", "local-premium", "b2b", "tourist"]),
  photoProfile: z.strictObject({
    usableCount: z.number(),
    quality: z.enum(["pro", "amateur", "stock-heavy"]),
    dominant: z.enum(["people", "space", "product", "work"]),
  }),
  contentVolume: z.enum(["poster", "standard", "editorial"]),
  ownSentence: z.string().nullable(),    // verbatim, for a statement section
  brandAssets: z.strictObject({ hasLogo: z.boolean(), hasBrandFont: z.boolean() }),
});
```

### 6.2 `direction` (deterministic TS)

```
score(d) = affinity(d, brief) − λ · recentUsage(d, last 30 days, all sectors)
```

Take the top 3 directions. Usage penalty applies across **all** sectors —
the operator reviews every run, so sameness is perceived globally, not per
sector.

### 6.3 `spec` (deterministic TS)

For each of the top 3 directions, sample 2 candidate specs from the
direction's ranges with a seeded PRNG (`mulberry32(sha256(domain + i))`) →
up to 6 candidates. Drop any candidate failing the distance thresholds in §8.
The judge (pairwise, 3× sampled, unanimity) picks among survivors using the
direction reference screenshots and the client's photos as context.

Reproducible: same inputs → same spec.

#### Per-run budget ceiling

The current hard limit of **$10 per site** stays. D10 moves spend away from
open-ended generation and toward selection, so the same ceiling splits as
follows:

| Stage | Cap (USD) | On reaching the cap |
|---|---|---|
| `brief` | 0.25 | structured text output; retry once, then BLOCKED |
| `direction` / `spec` / `compose` | 0.00 | deterministic TypeScript |
| structural + visual distance (§8) | 0.00 | local computation on a deterministic pre-render |
| candidate judge | 1.00 | take the top-scored surviving candidate |
| `generate` (props + copy only) | 3.00 | BLOCKED |
| `signature` loop (≤3 rounds) | 2.50 | fall back to the direction's default archetype for that slot |
| fix loop (≤3 iterations, unchanged) | 2.00 | BLOCKED.md + escalation (unchanged) |
| design judge | 0.75 | report as design notes, not hard fail |
| reserve | 0.50 | absorbs an overrun from any single stage above |
| **Total** | **10.00** | |

- Caps are enforced by the orchestrator, not by the prompt. A stage may
  borrow only from `reserve`, never from another stage.
- **These are starting allocations, not measurements.** Every stage records
  its actual spend in the events table; re-split after the 10-site ship test
  (§12).
- A distance rejection costs no model spend, because both distances run
  before `generate` (§8.2). A rejection after `generate` would double the
  largest line item; the pipeline is ordered so that cannot happen.
- Library construction (Phase B) is an offline operator budget, outside the
  per-run cap.

### 6.4 `compose` (deterministic TS)

Section set from facts that exist (D6, unchanged). Archetype per section from
`direction.archetypes[type]`, preferring archetypes not used by the last N
runs. Hero archetype is weighted most heavily in the distance (§8).

### 6.5 `generate` (LLM)

Fills section props from `content.json` / `facts.json`. Edits copy within the
§9 rules. **Does not write JSX for library archetypes and does not choose
tokens.**

---

## 7. Archetype library

This is the main lever. Built offline, approved by the operator, never
generated per run.

### 7.1 Targets

| Section type | Archetypes (target) |
|---|---|
| hero | 8 — split, full-bleed photo, type-only, collage, offset grid, marquee hero, centered statement, index hero |
| services | 6 — pinned rail, index list, numbered rows, image grid, accordion, alternating media |
| team | 5 |
| statement | 3 — word reveal, static display, split quote |
| visit (address + hours + map) | 4 |
| gallery | 5 |
| faq | 3 |
| closing | 3 |
| marquee | 2 |
| testimonials | 3 (only when crawled reviews exist) |
| process | 3 (only when the client describes steps) |

Archetypes must differ in **composition**, not props. Two archetypes that
differ only in image side or column count are one archetype with a prop.

### 7.2 Rules for every archetype

- Lives at `template/src/sections/<type>/<archetype>.tsx` with a Zod props
  schema and a registry entry.
- Reads **only** tokens — radius, rules, frame, alignment, density, motion
  profile. The same archetype must look materially different under
  `swiss-grid` and `quiet-luxury`.
- Declares which motion profiles it supports and its reduced-motion fallback.
- Passes all invariants (§3.1) on its own, tested in isolation.

### 7.3 How to build it

1. For each archetype, pick 2–3 corpus screenshots
   (`data/corpus/shots/`) whose **composition** it should follow. Take
   composition only — never content, branding or distinctive artwork.
2. Claude Code builds the archetype against those references, one at a time.
3. `apps/admin` gets a `/library` route: every archetype × every direction,
   rendered with seeded fake content, desktop + mobile.
4. Operator approves or rejects each cell. Rejected archetypes do not enter
   the registry. **This is where taste enters the system.**

---

## 8. Measuring diversity

Replace the fingerprint hash with two distances. Both must pass.

### 8.1 Structural distance

```ts
const AXIS_WEIGHTS = {
  direction: 3,
  heroArchetype: 3,
  colorMode: 2,
  typePair: 2,
  motionProfile: 2,
  gridAlignment: 1.5,
  imageFrame: 1.5,
  radius: 1,
  density: 1,
  displayWeight: 1,
} as const;

type AxisKey = keyof typeof AXIS_WEIGHTS;
const TOTAL_WEIGHT = Object.values(AXIS_WEIGHTS).reduce((a, b) => a + b, 0);

export function specDistance(a: Record<AxisKey, string>, b: Record<AxisKey, string>): number {
  let d = 0;
  for (const key of Object.keys(AXIS_WEIGHTS) as AxisKey[]) {
    if (a[key] !== b[key]) d += AXIS_WEIGHTS[key];
  }
  return d / TOTAL_WEIGHT; // 0 = identical, 1 = differs on every axis
}
```

Thresholds (starting values, calibrate in §8.3):

- vs every run in the last 30 days, **all sectors**: distance ≥ 0.40
- vs every run in the same sector, last 90 days: distance ≥ 0.55
- `direction` OR `heroArchetype` must differ from the previous 3 runs

### 8.2 Visual distance

Runs **before** `generate`, so a rejection costs nothing (§6.3 budget).
Tokens and archetypes are deterministic, so each surviving candidate can be
pre-rendered from its spec plus the client's raw `content.json` text and
crawled photos — no model call. Screenshot the desktop fold (1350×940) and
mobile fold (iPhone 13). Embed with DINOv2 (or CLIP) via a small local Python
tool (`tools/embed/embed.py`, outside the generated site). Store vectors in
SQLite. Reject if cosine similarity to any recent run exceeds the threshold
(start at 0.85). A rejection moves to the next candidate, never into the fix
loop.

After verify, the final site is embedded again and stored. That second
vector is what later runs compare against; it is not a gate on this run.

### 8.3 Calibration

The operator labels ~30 site pairs as "looks alike / looks different". Set
both thresholds so they agree with the labels. A threshold that disagrees
with the operator's eye is a broken detector (design-rules §12: fix the
detector before the site).

---

## 9. Signature section — the one bold element

The only place the model writes bespoke JSX.

- Registered once as section type `signature` with a free component slot, so
  the registry rule (build-rules §4) still holds.
- Input: `design.json`, the direction's reference screenshots (multimodal),
  the client's best photographs, the client's verbatim sentence if any.
- Loop: write → build → screenshot → vision critique against the references
  and the rest of the page → revise. Max 3 rounds, then fall back to the
  direction's default archetype for that slot (never BLOCKED for taste alone).
- Must pass every invariant. Must not exceed the script budget.

Reference images do more than any amount of prose rules. Prose rules describe
the safe zone; references show the target.

---

## 10. Taste calibration over time

- Store every operator pairwise vote and every library approve/reject in the
  DB (`design_votes`, `library_reviews`).
- Feed the most recent approved/rejected pairs to the judge as few-shot
  examples.
- Adjust direction affinity weights from votes monthly (operator decision,
  never automatic).

---

## 11. Contradictions to resolve now

| # | Conflict | Resolution |
|---|---|---|
| C1 | corpus §1 says self-host; design-rules §6 and build-rules §4 say `next/font/google` | Allow `next/font/local`. Self-host faces in `template/public/fonts/` (or a shared fonts package copied per run). |
| C2 | DJ16 requires ≥700; corpus median display weight is 400 | DJ16 checks against direction ranges (§3.3). |
| C3 | "Max two families" blocks the mono accent (corpus §7.2) | Two display/body families + optional mono. |
| C4 | PLAN.md bans Inter; pattern-library says not a hard ban | Inter is allowed as a **body** face only where a direction lists it; never as a default display. Record in DECISIONS. |
| C5 | `heroEntrance` and pinned hand-off mandatory on every site | Direction flags (§3.2). |
| C6 | Fingerprint equality treated as a guarantee | Replaced by §8. |

**Font licence check (before C1 lands):** for each self-hosted face, confirm
(a) the licence permits commercial web use across unlimited client domains,
and (b) the files contain full Turkish coverage — `ş ğ ı İ ç ö ü Ş Ğ Ç Ö Ü`
— by rendering a test string, not by trusting the catalogue page.

---

## 12. Implementation plan

Ordered. Each task is one Claude Code session with its acceptance criteria.
Tasks marked **[operator]** touch protected files.

### Critical path

```
A1 → A2 → A4 → B2 → B4
```

**A1 goes first, and nothing in Phase B starts before it is merged.** Today
DJ16 rejects display weight 400 and DJ10 rejects a page without a pinned
hand-off. Every `editorial-serif`, `swiss-grid` and `quiet-luxury` archetype
built in B4 would fail verify on arrival, and the fix loop would "repair" it
back into `kinetic-bold`. Building the library before the rule split is wasted
work that also trains the fix loop in the wrong direction.

Off the critical path:

- **A5** is blocked by §13 question 2 (font licence). It blocks only the
  directions whose faces are not on Google Fonts; `kinetic-bold` (Archivo)
  and `editorial-serif` (Fraunces) can proceed on `next/font/google` while
  the licence is decided.
- **C1–C4** run in parallel with B4 once A2 and A4 are merged. They need at
  least two archetypes per section type to exercise `compose`, not the full
  library.
- **D1** needs A4 and B3, not the rest of B.

### Phase A — make variation possible

- **A1 [operator]** Apply the rule split (§3) to `design-rules.md`;
  update DJ10/DJ16/DJ17 wording and the judge tests; resolve C1–C5.
  *Done when:* a site built with display weight 400 and no pin passes verify
  under a direction that allows it.
- **A2** `directionSchema` + `designSpecSchema` + `briefSchema` in
  `packages/core`. *Done when:* `pnpm typecheck` clean, schemas exported,
  unit tests parse a valid and reject an invalid example of each.
- **A3** Four direction files (§4.3) + reference screenshots copied into
  `data/directions/<id>/refs/`. *Done when:* all four parse, each lists ≥3
  refs, `avoid` filled.
- **A4** `tokens.ts`: `DesignSpec` → `tokens.css`. *Done when:* snapshot tests
  for one spec per direction; generated scales satisfy §3.1 invariants
  (hero fits 900px, line length).
- **A5** Self-hosted font pipeline (C1) with Turkish glyph test. *Done when:*
  a test page renders the Turkish test string in every listed face with no
  fallback glyphs (checked by Playwright font-face inspection).

### Phase B — the library

- **B1** `/library` route in `apps/admin` rendering archetype × direction.
- **B2** Refactor existing archetypes to read only tokens (radius, rules,
  frame, alignment, density, motion profile).
- **B3** Add `statement`, `visit`, `closing`, `marquee` section types
  (pattern-library §2) with schemas and registry entries.
- **B4** Build hero archetypes to 8, then services to 6, one per session,
  each against 2–3 corpus references. *Done when (each):* operator approves
  in `/library`; isolated invariants pass.

### Phase C — selection and diversity

- **C1** `brief` stage (LLM, structured output, budget-capped).
- **C2** `direction` scorer + `spec` sampler (seeded, reproducible).
  *Done when:* same domain → identical spec across runs.
- **C3** `compose` with archetype recency preference.
- **C4** Structural distance + thresholds; `rejected[]` audit trail in
  `design.json` and an events row.
- **C5** Deterministic pre-render + visual embedding tool; similarity check
  before `generate` (§8.2), final-site vector stored after verify.
- **C6** Calibration: label 30 pairs in admin, tune thresholds.

### Phase D — signature and judge

- **D1** `signature` section type + vision loop (§9) with fallback.
- **D2** Judge receives direction references + few-shot votes (§10).

### Phase E — library growth from new references (§14)

Not required for the ship criterion; it is how the library keeps growing
after ship. Prerequisites: B1 (`/library` exists to compare against) and C5
(the embedding tool).

- **E1** Composition pass in the harvester: segment each page into sections,
  screenshot each section at desktop and mobile width, describe it with a
  vision model into a `PatternCard` (§14.2). *Done when:* the existing 57
  corpus sites produce pattern cards that parse, and a re-run on the same
  site yields the same section boundaries.
- **E2** Novelty check against the library (embedding + structural fields).
  *Done when:* every current archetype, fed back in as if it were a corpus
  site, is classified "known".
- **E3** Feasibility filter (invariants + SMB content test). *Done when:* a
  WebGL hero and a custom-cursor section from the corpus are both rejected
  with the right reason.
- **E4** Intake queue in `apps/admin`: approve → backlog task; reject →
  reason stored and the pattern suppressed in future harvests. *Done when:*
  a rejected pattern from batch 1 does not reappear in batch 2.
- **E5** Direction-candidate clustering over the batch. *Done when:* the
  existing four directions' reference sets are recovered as clusters from
  the corpus they came from.

### Effort

One unit = one Claude Code session ending in a green verify and a commit.
Operator time is listed separately because it does not parallelise.

| Phase | Task | Sessions | Operator time |
|---|---|---|---|
| A | A1 rule split + judge tests | 1 | ~2 h (protected-file edit, review) |
| A | A2 schemas | 1 | — |
| A | A3 four directions + refs | 2 | ~1 h (pick reference screenshots) |
| A | A4 `tokens.ts` | 2 | — |
| A | A5 self-hosted fonts + Turkish glyph test | 2 | licence decision (§13 Q2) |
| **A** | | **8** | **~3 h** |
| B | B1 `/library` route | 2 | — |
| B | B2 token-only refactor of existing archetypes | 3 | ~30 min |
| B | B3 `statement`, `visit`, `closing`, `marquee` | 4 | ~30 min |
| B | B4 hero +7 (1 per session) | 7 | |
| B | B4 services +5 | 5 | |
| B | B4 team +4 | 4 | |
| B | B4 gallery +4 | 4 | |
| B | B4 visit +3 | 3 | |
| B | B4 process ×3 (new type, 2 per session) | 2 | |
| B | B4 statement +2, faq +2, closing +2, testimonials +2 (2 per session) | 4 | |
| B | B4 marquee +1 | 1 | |
| **B** | | **39** | **~4 h** (≈45 archetypes × 4 directions × 2 viewports, reviewed per archetype as it lands) |
| B | expected rework (15–20% of B4 rejected in review) | +6 | +1 h |
| C | C1 `brief` | 1 | — |
| C | C2 scorer + sampler | 2 | — |
| C | C3 `compose` | 1 | — |
| C | C4 structural distance | 1 | — |
| C | C5 visual embedding + pre-render | 2 | — |
| C | C6 calibration | 1 | ~1 h (label 30 pairs) |
| **C** | | **8** | **~1 h** |
| D | D1 signature + vision loop | 3 | ~30 min |
| D | D2 judge references + few-shot | 1 | — |
| **D** | | **4** | **~30 min** |
| Ship | 10-site test run + review | 1 | ~2 h |
| **To ship** | | **60** (≈66 with rework) | **~11–12 h** |
| E | E1 composition pass | 2 | — |
| E | E2 novelty check | 1 | — |
| E | E3 feasibility filter | 1 | — |
| E | E4 admin intake queue | 2 | — |
| E | E5 direction-candidate clustering | 1 | — |
| **E** | | **7** | **~1 h per intake batch** (triage) |
| **Total** | | **67** (≈73 with rework) | **~12–13 h**, then ~1 h per batch |

Each approved pattern from an intake batch then costs what one B4 archetype
costs: one or half a session, plus its `/library` review.

Assumptions behind the B4 count, to correct once the kit is inventoried:

- The current kit has **one** archetype per existing section type (hero,
  services, team, gallery, testimonials, faq), and `statement` already exists.
  If `statement` already exists, B3 drops to 3 sessions.
- `contact`, `hours` and `map` fold into `visit` and are not counted as
  archetypes of their own.
- Complex compositions (hero, services, team, gallery, visit) are one per
  session; simpler ones (statement, faq, closing, testimonials, process) are
  two per session.

Phase B is **~39 sessions, ~45 with rework** — two thirds of the work to
ship, and more than half of the whole programme including Phase E. That is the expected shape: the library is where the design work
lives, and it is the one place this plan cannot be shortcut. An earlier
estimate of ~35 undercounted `process` (a new section type) and the fold of
`contact`/`hours`/`map` into `visit`.

Phase B spend is offline and outside the $10 per-run cap (§6.3). Record the
actual cost of the first three B4 sessions and project the rest from those,
rather than estimating it now.

### Ship criterion for D10

Run the pipeline on 10 real crawled SMB sites across at least 3 sectors.
The operator, shown the 10 desktop folds side by side, should not be able to
group any two as "the same site". Every run passes all invariants.

---

## 13. Open questions for the operator

1. Which four directions first — are the four in §4.3 right for the client
   mix you expect, or should `warm-craft` replace one?
2. Font licensing: free self-hosted faces only, or budget for one agency
   licence for a foundry face?
3. Should a client's existing brand (logo colours, logo face) be allowed to
   override direction colour/type choices, and how strongly?
4. Visual similarity: run embeddings locally only, or is a hosted vision
   model acceptable for comparison?

---

## 14. Library growth — intake from new references

"Harvest 50 more award sites" must be able to produce new archetypes and new
directions, not only updated medians. Today it cannot: the harvester measures
statistics, and statistics move a direction's bounds, never its shapes. A new
hero composition is not in any number `corpus-findings.md` reports.

This section adds the missing path. **Nothing in it writes to the registry.**
New material reaches client sites only through the same operator review as
every other archetype (§7.3).

### 14.1 Why intake is never automatic

- **Quality.** The library is the pipeline's ceiling (§2). An archetype that
  skipped `/library` review lowers it for every client after it.
- **Collapse.** A pattern translated into code by the model without review
  drifts toward the model's own habits. Automatic intake would slowly rebuild
  the sameness D10 removes.
- **Copying.** We take a composition, not a site. Whether an archetype has
  crossed from "this kind of layout" into "that studio's distinctive design"
  is a judgement, and it is the operator's.

### 14.2 The flow

```
new URLs → harvest (existing) → composition pass → novelty → feasibility → intake queue → operator
                                       E1             E2          E3            E4
                                                                                  │
                                       approve → B4-style task → /library review → registry
                                       reject  → reason stored → suppressed in future batches
```

**Composition pass (E1).** Each harvested page is cut into sections (by
landmark elements, falling back to large vertical gaps in the full-page
screenshot). Each section is captured at desktop and mobile width, and a
vision model fills a fixed schema, so it cannot drift into prose:

```ts
export const patternCardSchema = z.strictObject({
  source: z.strictObject({ url: z.string(), sectionIndex: z.number(), harvestedAt: z.string() }),
  role: z.enum([
    "hero", "services", "team", "statement", "visit", "gallery", "faq",
    "closing", "marquee", "testimonials", "process", "other",
  ]),
  layout: z.enum([
    "split", "full-bleed", "type-only", "collage", "offset-grid", "index-list",
    "rail", "stacked", "centered", "other",
  ]),
  grid: z.strictObject({
    columns: z.number(),
    alignment: z.enum(["centered", "left-flush", "asymmetric"]),
  }),
  imageFrame: z.enum(["bleed", "inset", "masked", "collage", "none"]),
  typeRole: z.enum(["display-led", "balanced", "image-led"]),
  motion: z.array(z.enum(["pin", "parallax", "reveal", "scale", "horizontal", "clip", "filter", "none"])),
  contentNeeds: z.array(z.string()),   // what a client must have to fill it: "5+ portraits", "one verbatim sentence"
  description: z.string().max(400),    // one paragraph, composition only — no copy, no brand
  shots: z.strictObject({ desktop: z.string(), mobile: z.string() }),
});
```

The motion field reuses the harvester's existing scroll profiling (corpus
findings §8) rather than asking the model to guess motion from a still image.

**Novelty (E2).** Each card is compared with every library archetype on two
axes: embedding similarity of its screenshots against the archetype's
`/library` renders, and agreement on `role` + `layout` + `grid` +
`imageFrame`. A card that matches an existing archetype on both is "known"
and dropped. Cards that are near-duplicates of each other within the batch
are merged, keeping every source URL as a reference.

**Feasibility (E3).** Rejects, with a stated reason, any card that cannot be
built inside the invariants (§3.1):

- needs WebGL, canvas effects, video backgrounds or a custom cursor
  (corpus findings §9.4);
- cannot fit the 250 KB script budget, or depends on a library not already
  in the template;
- its `contentNeeds` are things a typical SMB crawl does not contain
  (case-study pages, product renders, press logos) — kept with the reason
  "content", because a later client may have it;
- cannot keep the first-viewport facts (design-rules §8) when used as a hero.

**Intake queue (E4).** Surviving cards land in `apps/admin` grouped by
`role`, each showing its source screenshots, the nearest existing archetype
and the feasibility notes. Operator actions:

- **Approve** → creates a backlog task in the B4 format: section type, the
  card, 2–3 source screenshots as composition references, target directions.
  It is then built and reviewed exactly like any other archetype.
- **Approve as reference only** → the screenshots join a direction's
  reference set (§4.1) without becoming an archetype.
- **Reject** → reason stored (`pattern_reviews` table). The card's embedding
  is kept, so the same pattern from a different site is suppressed in later
  batches instead of being re-proposed.

**Direction candidates (E5).** After a batch, sites are clustered by their
whole-page profile (type measurements, palette strategy, motion profile,
dominant layouts). A tight cluster that no existing direction covers is
proposed as a candidate direction, with its sites as a ready-made reference
set. Adding it to the catalog is an operator decision and goes through §4's
authoring checks, including the generic clusters.

### 14.3 What a batch also updates

- `corpus-findings.md` distributions are re-measured over the enlarged
  corpus. These update the **bounds** for direction token ranges, per that
  file's header note. A change of bounds that would move an existing
  direction outside its range is flagged for the operator, never applied.
- Raw measurements, cards and screenshots stay internal reference material
  under `data/corpus/`. They are never shipped in a client site.

### 14.4 Expectations and cost

- Most of a 50-site batch will be "known". Award sites converge on a smaller
  set of compositions than their visual variety suggests. A batch that yields
  only a handful of genuinely new, feasible patterns is a normal batch.
- Intake runs offline and is outside the $10 per-run cap (§6.3). The vision
  call is per section, so a batch costs far more than a stats-only harvest.
  Run the first batch on 5 sites, record the cost per site, and size later
  batches from that number.
- Re-harvest stays an operator decision, never a side effect of a client
  run (D9).
