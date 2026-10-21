# Status

**A1 is closed.** PR #1 merged into `main` as `7ad5948` on 2026-10-21, and the
operator has applied the three protected patches (`01-design-rules`,
`02-build-rules`, `07-acceptance`), so the rule split is live in the documents
as well as in the code. Written 2026-10-21, continued on branch `a1-close`.

The run that started this: dermaguzellik.com through the pipeline locally. The
site it produced was judged thin and templated, and the diagnosis is what this
work is about — the pipeline's design rules did not describe good design, they
described **one** design, so every run converged on it and the fix loop
repaired any deviation back toward it.

## The commits, grouped

Ten commits merged in PR #1, on top of `fae9276`:

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

## Closing A1 — branch `a1-close`

All seven patches reverse-apply cleanly (`git apply --check -R`), which is the
proof that every one is on disk exactly as generated and none was partially
applied or hand-edited in transit.

`checks.test.ts` parses the hard-fail sentence out of the now-patched
`design-rules.md` rather than keeping a copy, and derives
`DJ3, DJ4, DJ5, DJ6, DJ7, DJ10, DJ13, DJ14, DJ15, DJ17` — identical to
`HARD_FAIL_IDS`. The three places that had drifted are now one.

Also in this branch: the D10 decision recorded in `DECISIONS.md`, the v2 draft
of the D10 document deleted in favour of `docs/D10-design-variation.md`, and
the absence half of DJ10 implemented (below).

## Current state

```
typecheck   0 errors    (4 projects)
lint        0 errors    (4 projects)
test        144 passed  (10 files)   — checks.test.ts 9 → 15
template    tsc clean
```

`main` is at `7ad5948`; this branch is ahead of it.

## Open

**1 · K8 — the absence half of DJ10 is implemented; the template still
disobeys.** D10 §3.3 gave K8 a home and settled what the check should be:
DJ10 verifies *both* that every signature the profile requires is present
**and** that nothing the direction disables is. That half now exists in
`checks.ts` — forbidden signatures, a hero entrance when the direction's flag
is off, and smooth scroll when its flag is off, with five tests covering the
pages a presence-only check waved through. Smooth scroll is read off the live
page using the same probe as the corpus harvester, not from `design.json`,
because it is the one of the three the template installs unconditionally:
asking the spec would report what we intended rather than what shipped.

What remains is **B2**: nothing in the template reads these flags.
`layout.tsx` wraps every site in `SmoothScroll` and `hero/photo-full.tsx`
always runs the entrance, so a `calm` direction renders both and DJ10 now
*correctly fails it*. Until B2 refactors the archetypes to read only tokens,
a direction with `heroEntrance: false` cannot pass — which is the right
failure to have: visible and attributable, instead of a declared direction
being silently ignored.

**2 · Hook gap — `protect-tests.sh` only guards the Edit and Write tools.**
`settings.json:14` registers it with `"matcher": "Edit|Write"`, so a Bash
command never invokes it: `git apply`, `sed -i`, or a plain `>` redirection
all write to `design-rules.md`, `build-rules.md`, `acceptance.json`,
`lighthouserc.cjs`, `playwright.config.ts`, `budget.json` and the protected
specs unimpeded. The patch workflow A1 used was voluntary compliance, not
something the hook enforced.

Adding `Bash` to the matcher is **not** sufficient on its own: the hook reads
`.tool_input.file_path` and exits 0 when it is empty (line 8), and a Bash call
has no `file_path` — so it would be invoked and then wave everything through.
A real fix has to inspect `.tool_input.command`.

Operator fix. The hook denies writes to `.claude/hooks/*` and
`.claude/settings.json`, so it is out of an agent's reach, which is the
correct arrangement — a guard an agent can rewrite is not a guard.

**3 · Patch 08 — three §-references left inside protected files.**
`design-rules.md:57`, `design-rules.md:94` and `build-rules.md:89` still cite
`docs/DECISIONS.md D10 §3.2` and similar. DECISIONS.md D10 is prose with no
sections, so those numbers resolve nowhere; the sections live in
`docs/D10-design-variation.md`. Both files are hook-protected, so it ships as
`docs/patches/A1/08-section-refs.patch` — applies clean, one command.

**4 · A0 still open.** `template/tests/smoke.spec.ts` requires a `wa.me` link
in the mobile sticky bar, which D8 removes when a business publishes no
WhatsApp. Verify stops at the Playwright gate before the judge ever runs, so
this blocks every end-to-end verify including the ship test. Protected test,
operator edit (D10 §12 A0).

## Next

A2 (`directionSchema` + `designSpecSchema` + `briefSchema` in
`packages/core`), then A3 (the four real directions with their reference sets,
replacing `design/directions/stub.ts`). Phase B refactors the archetypes to
read only tokens, which is where K8 finally closes.
