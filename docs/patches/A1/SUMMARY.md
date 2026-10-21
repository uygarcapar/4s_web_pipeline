# A1 — the rule split

Prepared as patches against `design-space-baseline`. D10 §3 splits every
design rule into an **invariant** (global, hard, same on every site) or a
**style** rule (a property of the site's direction). This records where each
one went and why.

## How to apply

Four patches touch files an agent may edit; they are **already applied** on
this branch so the tree stays green and the new tests run:

    03-claude-md.patch   04-plan-md.patch
    05-design-judge.patch   06-judge-agent.patch

Three touch files the `protect-tests` hook denies — operator apply:

    git apply docs/patches/A1/01-design-rules.patch
    git apply docs/patches/A1/02-build-rules.patch
    git apply docs/patches/A1/07-acceptance.patch

All seven pass `git apply --check`.

## Where each rule went

| Rule | Was | Now | Why |
|---|---|---|---|
| Scroll must **change** the page; fade-up-only fails | design-rules §3 intro | **direction** (`kinetic`/`editorial` profiles) | §3.2 — described one language |
| Required: one pinned hand-off | design-rules §3 | **direction** (`motion.required`) | §3.2 |
| Required: one text transformation | design-rules §3 | **direction** (`motion.required`) | §3.2 |
| Recommended: one lateral move | design-rules §3 | **direction** | §3.2; corpus: 15/56 sites move laterally |
| At most one page-load moment (hero entrance) | design-rules §3 | **direction** (`heroEntrance`) | §3.2; corpus median is 0 |
| Lenis foundation + clock wiring | design-rules §3 | **invariant, conditional** — holds when a direction uses Lenis | §3.1 |
| Lateral move never hijacks touch | design-rules §3 | **invariant** | §3.1 |
| `transform`/`opacity` only, never `transition: all` | design-rules §3 | **invariant**, widened to include `filter` | §3.1; corpus §8.2, 46/57 tween `filter` |
| reduced-motion contract, char splitting, `useGSAP` scope, overlapping triggers | design-rules §3 | **invariant** (untouched) | §3.1 |
| Exact `clamp()` values for the eight steps | design-rules §4 table | **direction** (generated from `scaleRatio`) | §3.2 |
| Display/body ratio ≈ 6:1 | design-rules §4 | **direction** (`scaleRatio`) | §3.2; corpus 2.9–7.8 |
| Display weight 700–800 | design-rules §4 | **direction** (`displayWeights`) | §3.2; corpus median 400 |
| Display tracking −0.04…−0.05em | design-rules §4 | **direction** (`displayTracking`) | §3.2; corpus median −0.01em |
| One scale per site in `tokens.css`; no section invents a size | design-rules §4 | **invariant** | §3.1 |
| `overflow-wrap: break-word`; `vw` only full-width; hero fits 900px; line < 80ch; uppercase tracking ≤ 0.08em | design-rules §4 | **invariant** (untouched) | §3.1 |
| `next/font/google` only | design-rules §6, build-rules §4 | **invariant, widened** — `google` **or** `local` | §11 C1 |
| Max two families | design-rules §6, build-rules §4, CLAUDE.md | **invariant, widened** — two display/body + optional mono | §11 C3 |
| Inter/Roboto hard ban | PLAN.md, CLAUDE.md | **direction-scoped** — never a display face; body only where a direction lists it | §11 C4 |
| latin-ext, Turkish glyph coverage | design-rules §6 | **invariant**, now "confirm by rendering" | §3.1, §11 |
| DJ10 | model question, unconditional | **code**, against the direction's profile | §3.3 |
| DJ16 | model question, weight ≥700 constant | **code**, against the direction's ranges | §3.3, C2 |
| DJ17 | model question (never actually asked) | **rule text only** — enforced in the design stage; distance replaces it in C4 | §3.3, C6 |
| DJ18 | — | **new**, design note, not a hard fail | §3.3 |

Everything in design-rules §2, §7, §8, §9, §12 and all of build-rules is
untouched: the generic clusters, geometry, Turkish typography, the facts
contract, KVKK, the 250 KB script budget, LHCI and axe stay global and hard.

## DJ10 and DJ16 are now measured, not asked

`apps/orchestrator/src/design/directions/checks.ts` holds both. The deciding
half is pure, so the judge stage and the acceptance test call the same
function with the same input; only the measuring half needs a browser.

The judge no longer asks the model about them, and
`.claude/agents/design-judge.md` says so. A page that cannot be measured
returns `pass: null` — indeterminate, not failed — so the fix loop is never
sent after a number nobody read.

`apps/orchestrator/src/design/directions/stub.ts` carries only the fields
these two checks consume, for `kinetic-bold` and `editorial-serif`, values
from D10 §4.3. **A3 replaces it with the real catalog.**

## Acceptance

`checks.test.ts`, 9 tests. The D10 §12 criterion is the first two:

    weight 400, tracking −0.01em, ratio 4.2, no pinned hand-off
      → passes DJ10 + DJ16 under editorial-serif
      → fails both under kinetic-bold

Workspace: typecheck 0, lint 0, 138 tests pass.

## Conflicts D10 did not anticipate

**K1 — DJ16 and DJ17 were dead rules.** The rubric defined DJ1–DJ17, the
judge asked "DJ1-DJ15" twice, and the file's doc-comment said "DJ1-DJ12".
Three ranges, and the comment also pointed at §6 when the rubric is §11.
Rewriting DJ16's text would have changed nothing. Patch 05 reconciles all of
it; without that the acceptance criterion is untestable.

**K2 — the hard-fail set had drifted three ways.** The rubric already said
`DJ3–DJ7, DJ10, DJ13–DJ15, DJ17`; `HARD_FAIL_IDS` said
`{DJ3–DJ7, DJ13–DJ15}` (no DJ10, no DJ17); `acceptance.json` said "DJ3-DJ7".
The rubric is now the single source of truth and a test parses it, so the
three cannot drift again. `acceptance.json` is protected — D10 §12 lists only
`design-rules.md` as the operator edit; this is a second one.

**K3 — `build-rules.md` is protected too** (`protect-tests.sh:22` denies
`*design-rules.md|*build-rules.md`). D10 §12 does not mark the C1/C3
build-rules change as `[operator]`; it is.

**K4 — the judge could not see the direction.** `runDesignJudge(ctx, siteDir)`
read the rubric and the running site, never `design.json`, and `design.json`
has no `direction` field until A2/C2. Patch 05 adds the read with a
`kinetic-bold` fallback, so a run built before the catalog is judged under the
language it was actually built in.

**K5 — `.claude/agents/design-judge.md`** carries the rubric scope and is not
in D10 §3.3's list. Patched (06).

**K6 — out of scope by instruction**, recorded here so it is not lost:
`template/tests/smoke.spec.ts` requires a `wa.me` link in the mobile sticky
bar, which D8 removes when a business publishes no WhatsApp. Verify stops at
the playwright gate before the judge runs. Protected test; it is task A0.

**K7 — `corpus-findings.md` moved to `docs/`** during A1. D10's path
references are correct as written; nothing to change.

**K8 — new.** D10 §3.2 says `heroEntrance` and `smoothScroll` become
direction flags, but nothing in the template reads a flag today: `layout.tsx`
wraps every site in `SmoothScroll` and `hero/photo-full.tsx` always runs
`heroEntrance`. The rule is split here; **making the template obey it is
Phase B work** (B2, "refactor existing archetypes to read only tokens"). Until
then a `still` or `calm` direction will still render Lenis and a hero
entrance, and DJ10 will pass it because DJ10 only checks required signatures
are present, never that forbidden ones are absent.
