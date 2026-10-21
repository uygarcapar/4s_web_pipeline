# Status — branch `design-space-baseline`

Ten commits on top of `main` (`fae9276`). Written 2026-10-21.

The run that started this: dermaguzellik.com through the pipeline locally. The
site it produced was judged thin and templated, and the diagnosis is what the
rest of this branch is about — the pipeline's design rules did not describe
good design, they described **one** design, so every run converged on it and
the fix loop repaired any deviation back toward it.

## The commits, grouped

| # | Commit | Group | What |
|---|---|---|---|
| 1 | `66cd60a` | core | `hoursUnmappedCandidates` + `hoursNote` on the facts type, brief stage in the state machine |
| 2 | `940d5e3` | crawl | sitemap seeding, URL filtering, dedupe, `links`/`og` capture, `MIN_ASSET_BYTES` 10k→2k |
| 3 | `57d0e8a` | orchestrator | the brief stage, service composition, variable-font selection, `--brand-accent` |
| 4 | `73e6ee9` | template | D8 graceful degradation, `site-nav`, `statement` + `visit` sections, the new footer |
| 5 | `6b06885` | corpus | the 5-layer harvester, 57 measured award sites, `corpus-findings.md` |
| 6 | `811338f` | docs | D8, D9, the D10 proposal |
| 7 | `71fccf6` | chore | Firecrawl MCP wiring, `pattern-library.md` |
| 8 | `37502a0` | experiments | two standalone sites built from the corpus, no pipeline |
| 9 | `3562bb2` | **A1** | the rule split, DJ10/DJ16 as measured code, seven patches |
| 10 | `dfb2488` | chore | the vendored skill datasets that were never committed |

## What each group actually fixed

### 1–2 · The crawl was losing the site

The crawler found 3 of 13 pages, because it only followed links from the
homepage and dermaguzellik's nav is JS-built. Seeding from `sitemap.xml` (via
`robots.txt`, then the conventional paths) took it to 10 unique pages and 236
content blocks.

`MIN_ASSET_BYTES` was vetoing real service photos at 10 kB. The threshold is
passed into `isTooSmallImage` as a parameter by a protected test, so the
constant moved rather than the function: 11 → 21 usable assets.

Hours that the extractor could not map to a weekday were being dropped
silently. They now survive as `hoursUnmappedCandidates` + a `hoursNote`, so a
business with "Hafta içi 09:00–19:00" renders that sentence instead of nothing.

### 3–4 · Sections that degrade, and faces that are actually modern

D8: `legalName`, `whatsappE164` and the hours array are nullable, and the
template renders around what a business does not publish instead of printing
an empty block. Two new archetypes — `statement` and `visit` — plus
`site-nav`, and the footer went from 160 px to 604 px.

The font complaint ("fontlar modern değil", three times) was not about family
choice. It was `next/font/google` only, with pinned weights: a variable face
loaded at a single weight cannot do an optical-size curve, so everything read
as the same 2014 web-font look regardless of which family was picked. The fix
is variable axes and no weight pin.

Six reduced-motion bugs came out of this, all the same shape — motion was
carrying content. Rail cards were unreachable, counters stuck at 0, swap words
stacked on top of each other. Also a 12× React #418 hydration mismatch from
calling `motionAllowed()` during render.

### 5 · The corpus, and a measurement I had to withdraw

57 award-winning sites, measured in five layers: computed type, palette,
motion profile, mined scripts, component taxonomy.

An earlier shallow pass concluded award sites barely animate. The deeper
profile refuted it — 34 of 57 pin — and the withdrawal is written into
`docs/corpus-findings.md` §5 rather than quietly deleted, because the first
number was used to justify a design decision.

The corpus is **distributions, not directions**. Display weight median 400,
range 220–700. Tracking median −0.01em. Display/body ratio 2.9–7.8.

### 9 · A1 — why the gates had to change first

That corpus median is the whole problem. `DJ16` hard-required display weight
≥ 700; the measured median is 400. `DJ10` required a pinned hand-off on every
page. So any direction other than the current one failed verify **on arrival**,
and the fix loop dutifully repaired it back. Phase B cannot build
`editorial-serif` until this is gone.

A1 splits every design rule into an invariant (global, hard) or a style rule
(a property of the site's direction), and moves `DJ10`/`DJ16` out of the LLM
prompt into deterministic code. A model asked whether tracking is −0.045em or
−0.01em is guessing at a screenshot; `getComputedStyle` knows. The deciding
half is pure, so the judge stage and the acceptance test call the same
function with the same input.

Full rule-by-rule table and the conflict list: `docs/patches/A1/SUMMARY.md`.

### 10 · The vendored datasets

`VENDOR.md` promises the skills are committed so there is no live marketplace
dependency, and `plan.ts:51` / `generate.ts:68` hand the LLM the path to
`ui-ux-pro-max` expecting a dataset behind it. The `data/` directories were
never added — a fresh clone got the documentation and nothing to query, so
palette and type decisions fell back to model defaults, the exact failure the
skill was vendored to prevent.

## Current state

```
typecheck   0 errors    (4 projects)
lint        0 errors    (4 projects)
test        138 passed  (10 files)
template    tsc clean
```

Working tree clean. `main` is untouched at `fae9276`.

`checks.test.ts` parses the hard-fail sentence out of `design-rules.md` rather
than keeping a copy, and it yields `DJ3–DJ7, DJ10, DJ13–DJ15, DJ17` both
before and after patch 01 — verified by applying the patch in a scratch copy.

## Open

**1 · Three patches are not applied.** `protect-tests.sh` denies these files
to an agent, so this is an operator action:

```
git apply docs/patches/A1/01-design-rules.patch   # the §3/§4 split, DJ10/16/17/18
git apply docs/patches/A1/02-build-rules.patch    # C1/C3 + the Turkish glyph check
git apply docs/patches/A1/07-acceptance.patch     # the stale hard-fail list
```

Until then the code enforces per-direction ranges while `design-rules.md` still
says "weight ≥ 700". The code is what runs, so nothing fails — the document
lags. Patches 03–06 are already applied on this branch.

**2 · K8, live.** D10 §3.2 makes `heroEntrance` and `smoothScroll` direction
flags, but nothing in the template reads a flag: `layout.tsx` wraps every site
in `SmoothScroll` and `hero/photo-full.tsx` always runs the entrance. A `calm`
direction would still render both, and `DJ10` would not catch it — it checks
that required signatures are *present*, never that forbidden ones are *absent*.
Phase B (B2).

**3 · The D10 document.** On disk it is `docs/D10-design-variation-2.md`. It
does not contain the A0 task or the deterministic-DJ16 note, both of which A1
was built to; A1 followed the instruction, and `SUMMARY.md`'s §-references
point at the v2 file. They may need a pass when the updated document lands.

**4 · A0, deferred by instruction.** `template/tests/smoke.spec.ts` requires a
`wa.me` link in the mobile sticky bar, which D8 removes when a business
publishes no WhatsApp. Verify stops at the Playwright gate before the judge
ever runs. Protected test.

## Next

A2 (the `DesignSpec` type and a `direction` field on `design.json`), then A3
(the real direction catalog replacing `design/directions/stub.ts`). Phase B
refactors the archetypes to read only tokens, which is also where K8 gets
closed.
