# Status

**A1 is closed.** PR #1 merged into `main` as `7ad5948` on 2026-10-21, and the
operator has applied the four protected patches (`01-design-rules`,
`02-build-rules`, `07-acceptance`, `08-section-refs`), so the rule split is
live in the documents as well as in the code.

**A0 is closed and the Bash hook gap with it** — both verified empirically on
branch `verify-a0-hook`, see Open 2 and 3. Verifying them turned up a gate
that had never run; that is Open 4.

Written 2026-10-21, continued 2026-10-22.

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

Every patch was verified with `git apply --check -R` at the commit that
applied it — the proof that it is on disk exactly as generated, with nothing
partially applied or hand-edited in transit. 01–07 at `2e05c48`, 08 at
`2ca9387`. The check is context-sensitive, so it stops holding once a later
commit edits the same region: patch 08 rewrites lines inside 01 and 02's
hunks, and 03–06 cover files this branch edited afterwards. That is expected,
and the reason the verification is recorded against a commit rather than
left as a standing claim.

Patches 01, 02, 07 and 08 touch hook-protected files and were applied by the
operator; 03–06 were applied by an agent.

Every §-number in the repo now resolves: section numbers name
`docs/D10-design-variation.md`, and `DECISIONS.md D10` is cited for the
decision itself. Patch 08 closed the last three, inside `design-rules.md` and
`build-rules.md`.

`checks.test.ts` parses the hard-fail sentence out of the now-patched
`design-rules.md` rather than keeping a copy, and derives
`DJ3, DJ4, DJ5, DJ6, DJ7, DJ10, DJ13, DJ14, DJ15, DJ17` — identical to
`HARD_FAIL_IDS`. The three places that had drifted are now one.

Also in this branch: the D10 decision recorded in `DECISIONS.md`, the v2 draft
of the D10 document deleted in favour of `docs/D10-design-variation.md`, and
the absence half of DJ10 implemented (below).

## Current state

Workspace:

```
typecheck   0 errors    (4 projects)
lint        0 errors    (4 projects)
test        144 passed  (10 files)   — checks.test.ts 9 → 15
template    tsc clean
```

Template verify, run end to end on the A0 fixture
(`contact.whatsappE164: null`):

```
✅ tsc        ✅ eslint      ✅ build
✅ playwright  — 14/14, both projects, incl. the A0 assertion
✅ lhci
⚠️  links      — localhost:3000 canonical, local-build fallback (see 5)
❌ geometry    — 44px tap targets, real (see 4)
```

So A0 is verified and the Playwright gate passes. The verify as a whole does
**not** go green: the geometry gate, which until now could not even load, now
runs and finds genuine violations.

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

**2 · ~~Hook gap~~ — closed and verified.** `protect-bash.sh` (`7ef0e77`) is
the Bash-side twin of `protect-tests.sh`: it reads `.tool_input.command`,
matches the protected paths, and denies when the command also looks like a
write. Probed from an agent session against `design-rules.md` and
`build-rules.md`, all three vectors the old gap allowed:

| Probe | Result |
|---|---|
| `sed -i 's/x/x/' template/design-rules.md` | **denied** |
| `echo "test" > template/build-rules.md` | **denied** |
| `git apply` of a patch touching `design-rules.md` | **denied**, read from the patch body |
| `git apply --check -R` (read-only) | allowed, as intended |

`design-rules.md` was byte-identical after the probes (md5
`c1fe4465cd816a564afc9fae4eb7a672`), so nothing slipped through. The probes
used the no-op `s/x/x/` deliberately: if the hook had failed open, the file
would still be unchanged.

It is conservative in both directions, and false positives are the price.
Three hit during this verification, each from a protected *name* appearing in
a command that merely *looked* like a write. **Still open as of 2026-10-22:**
re-probed by feeding the hook a crafted `git commit -m` payload directly, and
it still denies, so the `commit -m` case below is live.

- a read-only `node -e` inspecting `playwright.config.ts` (`node -e` is in the
  write pattern),
- an `echo` whose message contained the word " patch " alongside a protected
  filename,
- **a `git commit -m` whose message described this work** — quoting a
  protected filename next to words like "sed -i" or "patch" reads as a write.
  This one matters more than the others: it blocks recording work rather than
  just inspecting it. Workaround used here: write the message to a file and
  `git commit -F`.

For the first two, splitting the command is enough. Worth knowing before
assuming a deny means a real violation. One structural false positive is worth
recording too: the visual-baseline directory is
`tests/visual.spec.ts-snapshots/`, which matches the protected spec pattern, so
legitimate baseline maintenance through Bash is denied — use Playwright's
`--update-snapshots` instead.

**3 · ~~A0~~ — done and verified.** The assertion in
`template/tests/smoke.spec.ts` now branches on the config (`7ef0e77`): no
published WhatsApp means the sticky bar must carry *no* `wa.me` link, rather
than requiring one. Verified by running the real verify over a fixture with
`contact.whatsappE164: null` — all 14 Playwright tests passed in both
projects, including `sticky CTA bar is visible on mobile only` under `mobile`,
which is the assertion A0 changed.

Now gated rather than spot-checked: A0b adds
`template/fixtures/null-whatsapp.config.ts`.

**4 · ~~The geometry gate~~ — fixed, and A0b closed what it found.** See the
A0b section below.

**5 · `links` WARN is expected and permanent.** `http://localhost:3000/` is
reported as a broken external link. It is the documented local-build fallback
in `src/lib/seo.ts:16` when neither `SITE_URL` nor
`VERCEL_PROJECT_PRODUCTION_URL` is set, so it is correct locally and absent in
a deploy — but it will WARN on every local verify. A WARN does not fail the
gate. Mentioned so it is not re-investigated.

## A0b — the template passes its own verify

Both runs exit 0:

```
pnpm run verify                                          → 0, marker written
VERIFY_FIXTURE=fixtures/null-whatsapp.config.ts … verify  → 0, marker skipped
```

Workspace: typecheck 0, lint 0, 159 tests (144 orchestrator + 6 core + 9 new
template).

**a · 44px tap targets.** The gate's report is capped at six items per
viewport, so "four failures at 344×882" was the visible tip. Probing all
interactive elements across the matrix found **18 distinct offenders**: the
hero and contact CTAs (36px), the contact phone and e-mail links (18px), four
FAQ `summary` rows (24px), the map facade button (36px), the three consent
buttons (32px), both consent legal links (17px), and one nav link failing on
**width** (40px, not height). Fixed:

| Fix | Covers |
|---|---|
| `min-h-11 min-w-11` on `buttonVariants`' base class | every `Button`, any size variant — min-height beats the variant's `h-*`, so the floor holds for variants a future section picks |
| `-my-2.5 flex min-h-11 items-center` on the FAQ `summary` | 44px hit area, 24px of flow — the card's rhythm is unchanged |
| `-my-3 inline-flex min-h-11 items-center` on the contact and consent links | the idiom `site-nav.tsx` already used |
| `min-w-11 justify-center` on the nav links | the width axis, which §7 requires too |

The geometry gate sweeps all 12 viewports 344 → 2560 by itself (`WIDTHS` in
`scripts/geometry.mjs`), so "run the full matrix" meant confirming all twelve,
not adding any. Zero offenders now, on every width.

Two notes. The `Button` floor raises the upstream shadcn scale (`h-8` default,
`h-9` lg, `size-8` icon), which is tuned for dense admin UI — these are client
sites on phones, and §7 is explicit that small text in a large box is correct.
And the two legal-page links carried the same defect but sit on
`/kvkk-aydinlatma` and `/cerez-politikasi`, which the gate never visits (it
only loads `/`); fixed anyway rather than left as a known violation the gate
cannot see.

**b · The D8 CTA edge, both ends.**

`resolveCta` replaces `resolveCtaHref`: it returns `{href, label}` and degrades
**both** when `whatsappE164` is null. Only the href degraded before, so the
hero read "WhatsApp'tan Yaz" over a `tel:` href — a button promising a channel
the business does not have, which no gate can catch, because the href is valid
and the label is content. The degraded label is `"Hemen Ara"`, the same wording
the sticky bar already uses, so one page never shows two words for one action.

The first end is a schema refine, not a prompt line. The plan stage writes
markdown specs; the `whatsapp` action is chosen when `generate` writes
`site.config.ts`. So the enforceable boundary is `siteConfigSchema`, whose
module-load `.parse()` turns a bad plan into a **build failure**: a hero CTA
with `action: "whatsapp"` and `whatsappE164: null` is now rejected outright.
The plan prompt also states the rule, so a planner does not waste a build
discovering it.

Nine tests in `src/lib/cta.test.ts` cover both: the degradation (including the
explicit "never promises WhatsApp over a `tel:` href" invariant) and the
schema rejection. `template/tests/*.spec.ts` is hook-protected, so unit tests
live beside their source and the template gains `vitest`, matching
`apps/orchestrator`.

**c · The fixture.** `template/fixtures/null-whatsapp.config.ts` — no
WhatsApp, no `legalName`, no day-mapped hours, so it exercises the whole D8
degradation path rather than one flag. `VERIFY_FIXTURE=<path> pnpm run verify`
swaps it in, runs every gate, and restores `site.config.ts` in a `finally`
plus the top-level `catch`, so a crash cannot leave a client's config
overwritten.

Two deliberate choices there. A fixture run passes `--ignore-snapshots`:
visual baselines are per-client and gitignored, so comparing a fixture's
render against the client's baseline compares two different sites. And a
fixture run does **not** write `.pipeline/verify-passed` — it proves the
gates pass for that shape, not that this client's site is shippable, and the
marker is what the deploy hook reads. The Done-when asked for the marker; it
is written by the default run, which is the only run that should.

## A2 — the three schemas

`packages/core/src/design.ts`: `briefSchema` (§6.1), `directionSchema` (§4.2),
`designSpecSchema` (§5), exported from the package index. 22 tests, a valid
and an invalid example of each.

They live in `packages/core` because the orchestrator writes them while the
judge, the token generator and the admin panel read them — a schema owned by
one stage gets re-declared by the next.

Shape is the cheap part; the refines are the point:

- **`required` ⊆ `signatures`** on a direction. A direction requiring a
  motion signature it also disables would make DJ10 demand the signature and
  then fail the page for carrying it. A1 asserted this in a test; now it
  cannot be authored.
- **`signature.sectionIndex` within `sections`** on a spec. Otherwise the one
  bold element per site is attached to a section that does not exist.
- **Inverted `[min, max]` ranges rejected** — the typo that turns the sampler
  into an empty set or an infinite loop.
- **`version: 2` is a literal**, so a pre-D10 `design.json` is a parse failure
  rather than a spec with silently missing fields.

**D10 §4.2 amended in the same branch** (RUNBOOK §1: propose the fix rather
than work around it). Two gaps between the sketch and §3.3:

`motion.required` did not exist. §3.3 defines DJ10 as checking both halves,
but the schema carried only the permitted list, so the required half had no
input — which is exactly K8, a `calm` site that still pins satisfying an empty
requirement. And `signatures` was `z.string()`; since DJ10 compares a measured
page against the list in both directions, a typo in a direction file would
read as "absent" and fail every page built in that direction with nothing
pointing at the cause. It is now an enum, `MOTION_SIGNATURES`, which **A3
extends** when a direction needs a device the first four do not use.

Not done here, deliberately: `apps/orchestrator/src/design/directions/stub.ts`
still has its own local `DirectionRanges`. A3 replaces the stub with real
direction files parsed by `directionSchema`, and that is the moment the local
type goes — swapping it now would mean rewriting `checks.ts` twice.

## A3 — the direction catalog (merged, PR #11)

**Reference picks accepted as-is** by the operator on 2026-10-22 — all four
directions keep the four screenshots proposed in
`docs/A3-reference-candidates.md`, including editorial-serif's, which was
flagged as the weakest set and accepted knowingly. If calm serif pages start
coming out wrong, that reference set is the first thing to re-harvest; the
candidates not picked are still listed in that file.


The four directions of §4.3 as real files under
`apps/orchestrator/src/design/directions/`, parsed by `directionSchema` at
module load, with 16 reference screenshots committed under
`data/directions/<id>/refs/`. `stub.ts` is deleted; `checks.ts` and the judge
now take core's `Direction`.

The candidate shortlist and what was rejected: **`docs/A3-reference-candidates.md`**.

**The measured ranking was wrong in three of four directions.** I scored all
56 usable corpus sites against each direction's ranges, then opened the
leaders. `butter.video` topped quiet-luxury because a **cookie banner** filled
the lower half of its screenshot and read as "dark". `overworldaudio` is an
*enter with sound* splash gate with no page structure.
`leoparpeix` ranked 2nd for editorial-serif on a serif flag that matched a
font *name*. `odysseeclinic` topped editorial-serif but is plainly
quiet-luxury — and is an aesthetics clinic, the direction's stated intent.
The ranking is a filter, not a verdict, which matters before §14 intake
treats a score as a decision.

`directionSchema` gained `refs` (≥3). §4.1 defines the directory and A3's
acceptance requires the count, but §4.2 had no field for it — amended the
same way `motion.required` was in A2.

Honest gap: **editorial-serif's reference set is the weakest of the four.**
The corpus is award sites and calm serif pages rarely win awards, so all four
picks there are measurement-only. It is also the direction most SMB leads
will land in. Flagged for decision rather than quietly accepted.

Workspace: typecheck 0, lint 0, 193 tests (155 orchestrator + 29 core + 9
template). 11 new catalog tests, including one that fails if two directions
collapse to the same weight/motion/colour fingerprint — four names for one
language would defeat the point.

## Next

A4 (`tokens.ts`, spec → `tokens.css`) and A5 (self-hosted fonts, free
open-licence only per Q2). Phase B refactors the archetypes to read only
tokens, which is where K8 finally closes — until then a direction with
`heroEntrance: false` still cannot pass DJ10.
