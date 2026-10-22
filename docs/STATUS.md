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

## A4 — the spec generates the stylesheet

`design/scale.ts` builds the eight-step scale from a `DesignSpec`;
`design/spec-tokens.ts` renders the whole `tokens.css` from it. The model
writes no token value: the scale comes from `scaleRatio` plus the direction's
weight and tracking, the ramp from `brandH`/`brandC` + `mode` + `strategy`,
the radius and rule weight from `shape`, the rhythm from `grid.density`.

34 tests, a snapshot per direction. The four stylesheets are measurably
different — one test fails if any two render identically, because a catalog
that produces one stylesheet changes nothing a visitor can see.

**A bug worth recording, caught by looking at the output rather than the
tests.** The first version derived the rem cap from the ratio but left the
fluid term as a shared `min(10.5vw, 17.5vmin)`. The cap only governs once a
viewport is wide enough to reach it, so on a phone every direction rendered
the *same* display size — the whole catalog collapsed to one headline on
exactly the devices most of these visitors use. The `vw` term is now derived
from the ratio too, bounded to 6–11vw (below 6 a headline stops reading as
one; above 11 a long Turkish compound overflows 344px even with
`break-word`), with the `vmin` ceiling derived from it and hard-capped so the
hero still fits a 900px-tall viewport. The tests now assert the fluid terms
differ, not just the caps.

`scaleViolations` checks the §4 invariants that survived the split — vmin
term present, `t-h2-col` capped in rem, uppercase tracking ≤ 0.08em,
display/body ≥ 2.5 at the ceiling — and `renderSpecTokens` throws rather than
writing a stylesheet that breaks them. Tested across the full measured corpus
ratio spread, 2.9 to 7.8.

Two deliberate deviations from §5, both to avoid breaking what runs today:

- The file is `spec-tokens.ts`, not `tokens.ts`. `tokens.ts` holds
  `renderTokens(dna)`, which the live design stage still calls; the spec path
  replaces it at C3, when the sampler first produces a spec.
- Nothing is wired into the pipeline yet. A4's acceptance is the generator
  and its tests; wiring without a sampler would mean building the input by
  hand at the call site.

## A5 — self-hosted faces, Turkish proved by rendering

**Phase A is complete.**

Eleven faces vendored as woff2 (`latin` + `latin-ext`) into `data/fonts/`,
1.0 MB, committed like the direction reference sets and copied per run rather
than shipped in every template copy. `scripts/vendor-fonts.mjs` re-runs it.
All eleven are **OFL**, confirmed against
`ui-ux-pro-max/data/google-font-licenses.json` rather than from memory — so
Q2 holds: no per-domain or pageview-capped licence anywhere.

Each family ships its `OFL.txt`. OFL §2 requires the licence travel with the
font, and a generated client site is a redistribution — so `copyFaces` moves
it too, not just the woff2.

`local-fonts.ts` renders `src/lib/fonts.ts` with `next/font/local` and
**pins no weight**: a variable face loaded at a single weight cannot do an
optical-size curve, which is the actual cause of "fontlar modern değil" three
times over. A test asserts no `weight: "NNN"` ever appears.

### The glyph check, and why it nearly shipped useless

A5's acceptance is "renders the Turkish test string with no fallback glyphs,
checked by Playwright". Two bugs on the way there, both of which would have
left a green test proving nothing:

1. **It failed everything.** `document.fonts.ready` resolves against the
   *pending* set, and a face is only fetched when something asks to render in
   it — so ready resolved immediately, nothing had loaded, and all eleven
   faces measured as fallback. Fixed with an explicit
   `document.fonts.load(…, text)`, plus an assertion that at least one face
   reports `status === "loaded"` before any measurement is trusted.
2. **Then it passed everything**, which is the same bug with the sign
   flipped. So the file carries a negative control: load `latin` alone and
   assert the check catches exactly the letters that live in `latin-ext`.

The control also corrected me. I expected four failures — ş, ğ, İ, ı — and
got three. **Google's `latin` subset carries ı (U+0131) explicitly**,
alongside basic Latin. So a face rendering a dotless ı is not thereby
Turkish-capable, which is precisely the kind of thing a catalogue page would
have let through.

One `@font-face` per subset, not one rule listing both files: a single rule
uses only the first source that loads — `latin` — and `latin-ext`, where
ş/ğ/İ live, would never be consulted.

Workspace: typecheck 0, lint 0, 268 tests (230 orchestrator + 29 core + 9
template).

Not wired into the design stage, same reasoning as A4: the stage still emits
a `DesignDna`, and the spec path goes live at C3.

## B1 — the archetype library

`apps/library` (port 3106, `pnpm --filter @pipeline/library dev`): one row per
archetype, one column per direction, desktop and mobile. 11 archetypes × 4
directions × 2 widths = 88 preview frames.

**A separate app, not a route in `apps/admin` as §12 B1 says, and not one in
the template either.** Both alternatives were tried and both are wrong:

- In the **template**, the route would have to be dynamic to read a guard
  env var, and `.claude/rules/app.md` says plainly *"Pages stay fully static;
  no dynamic rendering"* and *"app/ is OUTSIDE the editable surface"*. It
  would also need excluding from every per-run copy — a client domain must
  never serve our review tool, and that is a guard you only notice has failed
  after it has.
- In **admin**, the template's section components import `@/lib/schema`
  internally, and inside admin's compilation `@/` resolves to admin's own
  `src`. There is no alias that fixes this without breaking admin.

`apps/library` maps `@/*` → `template/src/*` and `~config` →
`template/site.config.ts`, so the components compile exactly as they do in a
run. Nothing is copied or duplicated, and a client site cannot serve it
because it is not in the template at all.

Cells are scaled iframes. Four directions on one document would mean four
sets of custom properties competing for `:root`, and an iframe is the only
way to show a real 1440px layout beside a real 390px one without lying about
either.

`scripts/build-library-css.mjs` emits the four directions' tokens from A4's
`renderSpecTokens`, stripping `@import` and `@theme inline` — those need
Tailwind's build step, while the custom properties and the eight type classes
are plain CSS the preview can inject. Committed output, regenerated by hand:
a file that changes under the operator mid-review is worse than one slightly
stale.

Verified rather than assumed — the same archetype, measured through the four
previews:

| direction | display size | weight | tracking | page |
|---|---|---|---|---|
| kinetic-bold | 112px | 700 | −4.16px | light |
| editorial-serif | 68px | 300 | −0.47px | light |
| swiss-grid | 90px | 400 | −1.08px | light |
| quiet-luxury | 90px | 300 | normal | **dark** |

**What it exposed immediately:** the font *family* is `Archivo` in all four.
Scale, weight, tracking and colour vary; the face does not, because faces
still come from the template's `fonts.ts` rather than from the direction —
A5's `local-fonts.ts` generator exists but is not wired, same as A4's token
renderer. Both land at C3. The library doing its job on its first run is the
argument for having built it before B2 rather than after.

One bug on the way, worth recording because it would have been invisible: the
first version rendered inside the template with an env-var guard, and both
routes were **statically prerendered at build time** — so the guard's value
was baked in and every request got a 404. A dev surface that silently 404s in
production is exactly the failure that argues for a separate app over a
guarded route.

## B2 — K8 is closed

**K8 is fixed and verified.** A direction's motion flags now reach the
components, and a `calm` site renders without Lenis, without a hero entrance
and without a pin.

The flags travel on `site.config.ts`, not `design.json`: `layout.tsx` has to
know whether to mount Lenis *before* it renders, and reading a pipeline
artifact at runtime would make a client site depend on a file that is not
shipped with it. `siteConfigSchema` gains a `motion` block, defaulted to
`kinetic` so a config written before D10 parses as what it actually was.

`src/lib/motion-policy.ts` holds the three decisions as pure functions, so
the same answer reaches `layout.tsx` (a server component) and a hero
archetype (a client one). Each component testing `config.motion.*` inline is
how a flag ends up honoured in one place and ignored in another — K8 in
miniature.

Measured on the same template, one fixture apart:

| | calm | kinetic |
|---|---|---|
| `lenis` class on `<html>` | — | present |
| Lenis in the DOM | no | yes |
| hero char transform | `none` | `matrix(…)` — entrance ran |
| ScrollTrigger pin spacers | 0 | 1 |
| hero opacity | 1 | 1 |

That last row is the one that matters beyond the acceptance: `heroEntrance`
uses `gsap.from`, so elements start visible and skipping it loses nothing.
Had it been `gsap.set` + `to`, a calm direction would have rendered a blank
hero — the same shape as the six reduced-motion content-loss bugs earlier in
this branch.

`pnpm run verify` exits 0 on both the reference config and
`fixtures/calm.config.ts`, all seven gates, including the geometry gate at
all twelve widths.

**A gap the acceptance itself had.** The calm fixture first used the
`default` hero, which never runs an entrance — so the probe reported
`charCount: 0` and the flag was never exercised. Both fixtures now use
`photo-full`, the archetype that actually carries the entrance and the pin.
A fixture that cannot fail is the same bug as the glyph check in A5.

Token reading: the seven section components now take their radius from
`var(--radius)` rather than a hardcoded Tailwind step, so shape follows the
direction. The UI primitives keep their own ladder — `globals.css` already
derives shadcn's radius scale from `--radius`. The rest of §7.2's list
(frame, alignment, density) lands per archetype in B3/B4 rather than as a
blanket pass over components that are about to be rewritten.

## B3 — closing and marquee

Inventory first, as the task says. Of B3's four section types, `statement`
and `visit` were already built (A-phase work); **`closing` and `marquee` did
not exist at all** — no schema, no component, no registry entry. Those are
what B3 added.

`closing` is a server component: one `t-display` line, the ask, and the
number in full. `t-display` is shared with the hero deliberately —
design-rules.md §4 gives that step to "hero + closing statement", so a site
has exactly two places where type is that large. No motion, because every
reveal available to it is the fade-up §3 names as the thing a page must not
be built from.

`marquee` **declares which profiles it supports** (§7.2): it only moves under
`editorial` and `kinetic`. Under `still` and `calm` the same items render as
a static wrapped row — a direction that declares a quiet page should not get
the loudest element on it. Verified both ways on the same template:

| | calm | kinetic |
|---|---|---|
| `.marquee-track` | absent | present |
| transform | `none` | `matrix(…)`, advancing |
| spans | 3 | 8 (3 + duplicates) |
| `aria-hidden` duplicates | 0 | 4 |

Items are the client's own words, minimum three. Generic cluster 5 fails a
band of `A · B · C` with nothing behind it, and three is the floor where a
list stops reading as a slogan.

**The marquee pauses off-screen.** An infinite tween is two problems: a rAF
frame burned forever on every client site, and a visual gate comparing a
moving target. Playwright's `animations: "disabled"` freezes CSS and Web
Animations but **not** GSAP, which drives rAF — the screenshot tolerance
absorbed the drift and the gate passed 3/3, which is luck rather than
design, and §12's "a check that produces false positives is worse than no
check" is not a thing to leave to luck. An `IntersectionObserver` plays and
pauses the tween; measured paused off-screen, advancing once scrolled to.

Workspace: typecheck 0, lint 0, 287 tests. `verify` exits 0 on both fixtures,
all seven gates.

**One flaky gate to be aware of.** A reference run failed LHCI on
`largest-contentful-paint` at 3581ms against a 3500 budget — 2% over, on a
machine mid-build. Two subsequent runs passed. Recorded rather than silently
re-run: LCP sits close enough to its threshold that it will do this again,
and a real regression would fail consistently rather than once.

`/library` now lists 13 archetypes against §7.1's target of 45.

## B4 · `hero/type-only` — accepted, merged (PR #18)

First B4 archetype, reviewed in `/library` and accepted as built on
2026-10-22. Face and weight were explicitly out of scope for that review —
see the font-pin item below — so the judgement was on composition, spacing,
hierarchy and the facts row.

Chosen first because `photo-full` needs a photograph good enough to fill a
screen and most crawled SMB sites do not have one — `quiet-luxury` already
scores thin-imagery clients away from itself for that reason. Without a
type-only hero those clients get a full-bleed hero built on a weak
photograph, which is the most visible way a generated site looks cheap.

Composition from `aspensearch` (headline owning a cell, facts ruled off
beneath) and `leoparpeix` (headline given most of a screen). Composition
only.

Measured across all four directions at both widths: no horizontal overflow,
three facts present, zero tap targets under 44px, headline above the fold
everywhere. Display renders 112 / 68 / 90 / 90 px at weight 700 / 300 / 400 /
300, left-anchored except `quiet-luxury` which centres, on a dark page for
that one alone.

**Two defects the screenshots caught that the measurements did not:**

1. Under a direction whose `rules` are `none`, `--rule-width` is `0`, so the
   secondary CTA had no border *and* no background — indistinguishable from
   body text. It now carries a tinted surface, with the border still adding
   definition where a direction uses rules. A measurement of "is the button
   present" passes either way; only looking catches it.
2. The facts row forced `text-align: left` while `quiet-luxury` centres
   everything else, which reads as a mistake rather than a choice. It
   follows the direction's anchor now.

Both are the argument for B4's shape — a rejection points at a composition,
not a diff.

Two gaps this surfaced, neither fixed here:

- **A pinned font weight silently defeats the direction's weight range.**
  `fonts.ts` loads Archivo at `weight: ["800"]`, so a direction asking for
  300 gets 800 glyphs while `getComputedStyle` reports 300 — **DJ16 passes a
  page that visibly contradicts its direction.** A5's `local-fonts.ts`
  generator already fixes this and is unwired until C3; until then the
  library's weight column is describing CSS, not pixels.
- `closing/statement-cta` and `marquee/ticker` were registered only as type
  defaults, so the named variants would have fallen back silently.
  `archetypes.test.ts` caught it — the test added in an earlier session for
  exactly this. Both are explicit archetype entries now, in both tables.

## Self-hosted faces wired — both open items closed

**The font pin is gone.** `template/src/lib/fonts.ts` self-hosts Archivo and
Inter Tight from `public/fonts` with `weight: "100 900"`. It previously
loaded Archivo at `weight: ["800"]`, so every direction rendered the same
glyphs however light its range said it was — `getComputedStyle` reported 300
and DJ16 passed a page that visibly contradicted its own direction.

**`/library` now shows each direction's real faces.** The library loads all
eleven registry faces, each exposing `--face-<slug>`, and a direction's
injected CSS points `--font-display-face` at whichever it chose. Measured
through the previews:

| direction | display | weight | body |
|---|---|---|---|
| kinetic-bold | Archivo | 700 | Archivo |
| editorial-serif | **Fraunces** | **300** | **Karla** |
| swiss-grid | **Inter Tight** | **400** | Inter Tight |
| quiet-luxury | **Instrument Serif** | **300** | Karla |

Before this, all four read `Archivo / 800`. A `/library` review can now judge
type, which it structurally could not for `hero/type-only` — that archetype
was accepted on composition alone and is worth a second look under its real
faces.

A client site still loads only the two or three faces its own direction
picked; loading all eleven is a library-only cost.

**LCP is fixed, and by the same change.** `largest-contentful-paint` is now
**3.2 s** against the 3500 ms budget, with CLS 0 and TBT 0 — from 3576–3589
ms failing three of five runs. Self-hosting removes the third-party
connection on the critical path and `preload` on the display face puts it
ahead of the headline it sets. The body face is deliberately not preloaded.

`verify` exits 0 on both fixtures, all seven gates.

That also settles the earlier judgement call honestly: I called the LCP miss
noise in B3 after two passing runs, then recorded it as a real regression in
B4 once it failed three of five. The second reading was right, and the cause
was B2's switch of the reference hero to `photo-full`.

## B4 · `hero/split` — **awaiting operator review**

Second B4 archetype. PR open, **not merged**.

The gap in the middle: `photo-full` needs a photograph good enough to fill a
screen, `type-only` needs none, and most crawled SMB sites sit between —
one or two usable interior shots, fine at half a screen and poor at full
bleed. Composition from `noho-ink`.

**Not `hero/default` rebuilt.** The legacy component hardcodes `text-4xl`, a
`brand-*` gradient and its own spacing, so it looks identical under every
direction — which is why the design stage was never allowed to pick it. This
reads only tokens.

Measured across four directions × two widths: no overflow, zero tap targets
under 44px, and now with real faces — Archivo 81px / Fraunces 53 / Inter
Tight 67 / Instrument Serif 67 on desktop.

New tokens: `--image-radius`, `--image-inset`, `--image-aspect` from
`shape.imageFrame`, so an archetype frames a photograph the way its direction
frames photographs instead of branching on the frame's name.

**Two findings worth more than the archetype.**

1. **Images 404'd in every library preview.** `apps/library/public` had no
   images, so any archetype with a photograph rendered a broken-image icon.
   It went unnoticed through B1 and the whole of `hero/type-only`'s review,
   because that archetype has no image and the earlier measurements only
   read type. `public/images` is a symlink to the template's now. Anything
   reviewed before this was reviewed without its photographs.
2. **The library shows one sample per direction, not its range.** All four
   directions list `bleed` or `inset` first and radius `0` first, and the
   library samples option `[0]` — so the image frame looks identical in all
   four previews even though the tokens vary correctly. Proved by unit test
   rather than left looking like a bug: four frames render four distinct
   stylesheets, `masked` is a 3/4 window against `bleed`'s 4/3. The real
   sampler (§6.3) picks per client with a seeded PRNG; the library's
   deterministic `[0]` is a fixture property, not a defect — but it means a
   `/library` review cannot see a direction's whole range.

`verify` exits 0 on both fixtures. 299 tests.

## The library shows a direction's range, not one corner of it

`/library` rendered option `[0]` of every axis, so radius, image frame,
colour mode and type pairing never varied inside a direction — an archetype
was approved against roughly a quarter of what its direction can produce.

`design/sample-spec.ts` implements §6.3's sampler for real:
`mulberry32(hash(seed))`, reproducible, drawing only values the direction
permits. The library draws **three candidates per direction** and the grid
gained a candidate selector, with a line per direction naming what each
candidate drew (face, weight, ratio, mode, frame, radius, alignment,
density).

The same archetype under `kinetic-bold`, across candidates:

| candidate | face | weight | size | image |
|---|---|---|---|---|
| 0 | Anton | 800 | 80px | 3/4 masked |
| 1 | Archivo | 800 | 86px | 4/3 bleed |
| 2 | Anton | 700 | 88px | 4/3 bleed |

27 tests, including that the sampler never draws a value outside the
direction, that the same inputs give the same spec, and that adjacent seeds
decorrelate — `"acme-0"` and `"acme-1"` must not share a first draw, or two
candidates for one client would be the same spec.

Distribution checked over 300 draws rather than assumed: ~50/50 on
two-option axes, and `editorial-serif` constant because it declares single
options. The hue is pinned across candidates on purpose — it is the
client's, not the direction's (§13 Q3), so letting it wander would blame the
direction for something it does not decide.

**A mistake worth recording.** `src/design/sample.ts` already existed —
photograph sampling for the palette — and I overwrote it. `typecheck` caught
it immediately (`readManifest` and `samplePhotographs` missing from
`brief.ts` and `design.ts`), and the original is restored byte-for-byte from
git with the new sampler in `sample-spec.ts`. The lesson is the cheap one:
check whether a filename is taken before writing it.

## B4 · `hero/index` — **awaiting operator review**

Third B4 archetype. PR open, **not merged**.

The headline over an enumerated index of what the business does. For a
business whose services *are* the proposition — a repair shop, a clinic with
six named treatments — that list is the most useful thing in the first
viewport, and scrolling to find it is a cost. Composition from `aspensearch`
and `cerebrium`.

Items come from the services section's own titles via `config.sections`, not
duplicated into the hero's props: the same list in two places is the shape
that drifts, and §9 forbids this section stating anything the client did not.
No services section means no index, and the hero degrades to headline and
facts.

Measured across four directions × two widths: no overflow, zero tap targets
under 44px, four rows everywhere. The index numeral picks up the mono accent
**only where the direction has one** — Space Mono under `kinetic-bold`,
JetBrains Mono under `swiss-grid`, the body face under the two that declare
no mono. Rules are 1px or 0px per direction.

**§7.1 amended: the hero target is 7, not 8.** "Centered statement" is not a
distinct archetype — `type-only` reads `--text-align` from the direction's
`grid.alignment`, so under a `centered` direction it *is* the centered
statement. §7.2 already calls that one archetype with a prop. Counting it
separately would have inflated the target with work producing no variation.

## Open: the LCP budget sits inside this machine's noise

Measured properly this time rather than from one sample. After the font fix,
median LCP over seven `verify` runs is **3.1–3.5 s** against the 3500 ms
budget — so the gate fails roughly one run in four, on unchanged code.

The Lighthouse config already runs **three iterations and asserts the
median**, and its own comment says 3500 was picked to "catch real regressions
without tripping on run-to-run noise". So this is neither a code defect nor a
config defect: it is measuring on a development machine that is
simultaneously running builds.

What distinguishes the two cases, for whoever reads a red LCP next:
**consistently over** (3.58 s on every run, which is what B2's hero change
caused) is a regression; **at the line, sometimes** is this. Re-run on an
idle machine before believing it.

**A fix I tried and reverted, because it measured worse.** Preloading the
body face and setting a metrics-adjusted fallback on both faces — on the
reasoning that the LCP element is the hero's lead paragraph, set in the body
face — gave 3.9 / 4.3 / 3.0 s. Two preloaded faces compete for bandwidth
under throttling. The reverted configuration gives 3.1 / 3.2 / 3.1 / 3.5.
Recorded so the idea is not retried from scratch.

## B4 · `hero/collage` — **awaiting operator review**

Fourth B4 archetype. PR open, **not merged**.

Several of the business's own photographs at mixed sizes and offsets, rather
than one picture doing all the work. The case: a business with five usable
photographs and no single great one — `photo-full` would pick the least bad
and blow it up, `split` shows one and wastes the rest. Composition from
`noho-ink` and `belgradearbor`.

Pictures come from the hero's own `image` plus the gallery section's, via
`config.sections` — the same rule `index` follows for services. One source,
no duplication, nothing stated that the client did not publish.

Irregular by design: a tall lead cell and two squares, the second nudged by
`--offset-y`, which is the direction's own asymmetry (`4rem` under
`kinetic-bold` and `swiss-grid`, `0` under the two that are centred or
left-flush). **Not `offset grid`** — that one, still unbuilt, is a regular
grid whose cells are nudged; this is deliberately irregular, with a
different aspect per cell and no shared row. Two archetypes differing only
in cell count would be one archetype with a prop (§7.2).

Measured across four directions × two widths: three pictures, all loading,
no overflow, zero tap targets under 44px.

It degrades rather than inventing — with one picture it renders one, and the
empty cells do not exist. That is D8 applied to composition. The selector
should still score it away from a client whose `photoProfile.usableCount` is
under three (§6.2): degrading gracefully is not the same as being the right
choice.

`verify` exits 0 on both fixtures. 326 tests.

## B4 · `hero/offset-grid`

Fifth B4 archetype. Merged without a prior review, per the operator's
instruction of 2026-10-22 ("dont ask me to merge, merge it") — the workflow
rule in `CLAUDE.md` and the runbook now say the same, so a future session
does not re-introduce the stop.

A regular twelve-column grid whose cells are nudged off the baseline.
Composition from `aspensearch`. **Not `collage`**: that one is irregular by
design, a different aspect per cell and no shared row; this is regular, every
cell on the same grid, with a single vertical offset as the only
irregularity. Two archetypes differing only in cell count would be one
archetype with a prop (§7.2) — these differ in whether a grid exists at all.

`--offset-y` is the direction's own asymmetry: `4rem` under `kinetic-bold`
and `swiss-grid`, `0` under the two that are centred or left-flush. Same
markup, a stepped grid under one direction and a square one under another.

**A defect the screenshots caught.** The first version defined cells with
borders alone, so under `editorial-serif` and `quiet-luxury` — whose `rules`
are `none`, setting `--rule-width` to 0 — there was no visible grid at all,
the one thing the archetype is named for. It read as loose blocks. Cells now
carry a `--paper-200` surface as well, which is what makes a cell a cell
when a direction uses no rules; the border still adds definition where one
does. This is the third time a measurement passed something only a
screenshot caught, after `hero/type-only`'s invisible CTA and the library's
404'd images.

Measured across four directions × two widths: five cells, no overflow, zero
tap targets under 44px. `verify` exits 0 on both fixtures.

## B4 · `hero/marquee` — heroes complete

Seventh and last hero. §7.1's target is met.

The headline with a running band of the client's own phrases set into the
fold. On the standalone `marquee` section the band divides two parts of the
page; in the fold it shows the *breadth* of what the business does in the
first screen, which a headline cannot and a services list only does at
length. For a trade with many small services that breadth is the
proposition.

It **composes** the `marquee` section rather than reimplementing it. The
band's behaviour is not trivial — runs only under `editorial`/`kinetic`,
pauses off-screen, duplicates items `aria-hidden` for a seamless loop,
degrades to a static wrapped row — and a second copy would be a second place
to get it wrong, with the drifting one being whichever nobody is looking at.

## The library had never shown motion at all

Found by this archetype, and the most useful thing in it.

The band moved under **all four** directions, including the two that are
`calm`. The cause: archetypes gate motion on `config.motion`, which is not a
token, and the library only ever injected per-direction **CSS**. Every
preview therefore ran the template's own kinetic motion regardless of the
direction it claimed to be showing.

So `/library` had been silently unable to show motion differences since B1 —
through B2, which closed K8, and through four archetype reviews. Any
judgement about movement made in that window was made against the wrong
configuration.

The preview now builds a config carrying the sampled candidate's motion
block, and the generator emits it alongside the CSS. Measured after the fix:

| direction | profile | band | spans |
|---|---|---|---|
| kinetic-bold | kinetic | moves | 8 (duplicated) |
| swiss-grid | editorial | moves | 8 |
| editorial-serif | calm | **static** | 4 |
| quiet-luxury | calm | **static** | 4 |

This is the same shape as the font pin and the 404'd images: the library
showed *a* page per direction, not *that direction's* page, and each gap was
invisible until an archetype happened to depend on it. Type, images and now
motion are covered; what remains uncovered is anything else an archetype
reads from `config` rather than from a token.

`verify` exits 0 on both fixtures. 326 tests.

## Next

**Heroes are done: 7 of 7.** `photo-full`, `type-only`, `split`, `index`,
`collage`, `offset-grid`, `marquee` — plus the legacy `default`, which the
design stage will not pick and which B-phase should eventually delete rather
than leave as a trap.

## B4 · `services/alternating`

First services archetype. Each service a full row, photograph and words
swapping sides down the page. Composition from `lpas` and `butter.video`.

This is the archetype that answers an old complaint directly. A Turkish
SMB's services page usually has a real photograph per treatment, and the
card grid the template shipped with renders them as thumbnails — at card
size a missing picture is a hole and a present one is decoration. At row
size the photograph is the argument.

**It degrades per row, not per section.** A service with no `image` takes
the full row as text rather than leaving half of it empty. Mixed is the
normal case, so the reference fixture now carries it: two of four services
photographed, two not. A fixture where every row looks the same would not
have caught the bug below.

**The bug it caught.** Alternation was keyed off the item index, so two
services photographed at positions 0 and 2 both landed left — the page
stopped alternating, which is the one thing the archetype does. It counts
*photographed* rows now: `L-R-` across all four directions, verified.

Image framing follows the direction, 3/4 under `kinetic-bold` and
`quiet-luxury`, 4/3 under the other two. No overflow at either width.

`verify` exits 0 on both fixtures. 326 tests.

## B4 · `services/accordion`

Every service a closed row, opening to its description. Composition from
`seasats` and `heronaiapp`.

**The case: a lot of services.** The clinic this pipeline was built against
publishes nineteen treatments. `rail-pinned` becomes a scroll endurance test
past about five, and `alternating` wants a photograph per row. Nineteen
cards is a wall; nineteen closed rows is a list someone can read, which is
what §8's density rule is for.

**Native `<details>`, no JavaScript.** The toggle is the browser's, so it
works before hydration, under `prefers-reduced-motion` and from the keyboard
without anything from us. An archetype shipping a client bundle to flip a
boolean is spending the 250 KB budget on nothing. `name` on the element
makes the rows mutually exclusive, so a long list does not become a longer
one as someone reads it.

Rows measure 73–83px tall across every direction and width — zero targets
under the §7 floor of 44, which is the rule this template failed on eighteen
elements before A0b. The index numeral takes the mono accent where the
direction has one (Space Mono, JetBrains Mono) and the body face where it
does not.

`verify` exits 0 on both fixtures.

## B4 · `services/image-grid`

Each service a cell, its photograph filling it, its name on the picture.
Composition from `noho-ink` and `lxlcreative`.

**Not the card grid the template shipped with.** That one put a thumbnail, a
title and a paragraph in a bordered card, which makes the photograph an
illustration of the text. Here the photograph *is* the cell and the
description is a line underneath. For a trade whose work is visual — a
salon, a tiler, a clinic with before/after rooms — the pictures are what a
visitor is scanning for.

A scrim rather than a flat tint: an overlay strong enough to carry text
washes the picture out, and a page of washed-out pictures is the
stock-photo-luxury cluster §2 fails. The gradient is strongest exactly where
the name sits.

**A defect only the dark direction showed.** Unphotographed cells used
`--paper-200`, which is one step *darker* than the `--paper-100` page — fine
on the three light directions, invisible on `quiet-luxury`, where the cell
vanished into the background and left a hole in the grid, the one thing this
archetype must not have. They use `--paper-50` now, which is a step away
from the page in both modes: L 0.22 against 0.19 dark, 0.99 against 0.975
light.

That is the second time an inverted ramp has caught me (after the dark-mode
paper ordering in A4) and the fourth defect in this phase that measurements
passed and a screenshot caught.

`verify` exits 0 on both fixtures.

## B4 · `services/index` — services complete

Sixth and last services archetype. §7.1's target is met for both hero and
services.

The whole list visible at once, flowing across columns. Composition from
`cerebrium` and `offforum`.

**Why it is not the accordion with a flag**, which is the question §7.2
asks and which killed "centered statement" earlier. The accordion is one
stack of full-width rows whose descriptions are hidden; this is two or three
columns of short ones with every description shown. Opening every accordion
row does not produce this — it produces a longer stack. The compositions
differ, not a prop.

Columns rather than a grid: a grid gives every entry the same height and
leaves ragged space under the short ones, while flowed columns pack by
content, which is the whole point when a salon lists twenty treatments.

**Verified at realistic length, not at fixture length.** The reference
fixture has four services, which is not enough to exercise a multi-column
flow — so the list was cloned to nineteen, the count the clinic this
pipeline was built against actually publishes. Result: 3 columns, **0
entries split across a column break** (`break-inside: avoid` holding), and a
section 1568px tall where a single stack would be roughly three times that.

A fixture that cannot exercise the behaviour is the same gap as the calm
fixture using the wrong hero in B2, and the half-photographed services list
in `alternating`. Worth doing deliberately each time rather than noticing
afterwards.

`verify` exits 0 on both fixtures.

## B4 is complete — every §7.1 target met

| section | target | built |
|---|---|---|
| hero | 7 | photo-full · type-only · split · index · collage · offset-grid · marquee |
| services | 6 | rail-pinned · alternating · accordion · image-grid · index |
| team | 5 | sticky-swap · grid · roster · lead · portrait-rows |
| gallery | 5 | strip · mosaic · full-bleed · pairs · contact-sheet |
| visit | 4 | rows · map-split · stacked · card |
| statement | 3 | word-reveal · static · quote-split |
| faq | 3 | accordion · two-column · rows |
| closing | 3 | statement-cta · split-panel · banner |
| testimonials | 3 | default · single-large · ruled-list |
| process | 3 | numbered · timeline · rail |
| marquee | 2 | ticker · static-band |

`process` did not exist as a section type at all — schema, three archetypes,
registry, library fixture. It is the one section the plan stage must be
careful with: §9 forbids inventing a process, and "1. Call us 2. We meet 3.
You smile" is generic cluster 4 verbatim. The schema requires three real
steps and the archetypes show `duration` only where the client states one,
because estimating how long someone else's appointment takes is an
invention about their business.

`verify` exits 0 on all three fixtures. typecheck 0, lint 0, 326 tests.

### What the last batches turned up

Three defects older than the work that exposed them, all found by adding a
section rather than by reading code:

- **The template defined none of the eight type-step classes.** Every
  archetype written against `t-display`, `meta`, `btn-label` and the rest
  rendered at browser defaults *in the template* and looked correct only in
  `/library`, which injects the generated stylesheet. `tokens.css` now
  carries the default scale, generated from `kinetic-bold` by the A4 code so
  it cannot drift from a run's output.
- **`.meta` and `.btn-label` had no `nowrap`**, which the site nav had been
  assuming. With it added the nav brand stopped wrapping and started being
  crushed to zero width instead — `min-w-0` in a flex row — so it is
  `shrink-0` now and the link list moves to `lg`.
- **`photo-full` overflowed its own `h-svh`** on a 390px-tall landscape
  phone, dropping its CTA onto the next section's heading.

And one gap in the review surface itself: five archetypes used
`bySectionType()` for sections no fixture carries, so they silently never
appeared in `/library` and their previews 404'd.

That is the fifth, sixth and seventh time in this phase that a measurement
passed something a render caught. The pattern has held all the way through:
**measurements verify presence and dimension; only looking verifies
legibility**, and dark or short-viewport directions break assumptions the
light, tall ones hide.

## Next

Phase B's library is built. What remains is Phase C — the selection
pipeline that chooses among it (`brief`, scorer, `compose`, structural and
visual distance, calibration) — and then Phase D's signature section and
judge work.

**The spec path is wired (C2/C3).** See the section below. What is still
open: the archetype count is now large enough that the fixtures are the
limit. Four services, four gallery images, three team members and no
`process` section in any committed config means most archetypes are
previewed at a size the real client will exceed. The nineteen-service clone
used to check `services/index` was done by hand and thrown away.

Two cleanups worth doing at some point, neither urgent: delete the legacy
`hero/default` and `services/default`, which read no tokens and look
identical under every direction (the design stage will not pick either, so
they are traps rather than options); and the library still cannot show
anything an archetype reads from `config` beyond motion, which is the gap
that produced three separate surprises. Both blocking decisions are settled: `verify` is green on both fixtures and
`/library` renders each direction's own faces, so an archetype review can
now judge type as well as composition.


## C2/C3 — the spec path is wired, and four things were wrong behind it

`design.ts` no longer emits a `DesignDna` for the site to be built from. It
scores the four directions from the brief's new `tone`/`tier`/`audience`/
`contentVolume` enums and the measured photographs, applies the cross-sector
rotation penalty, samples a `DesignSpec` from the winner's ranges, and
generates `tokens.css` and `fonts.ts` from that spec. `design.json` IS the
spec now; the fingerprint ledger survives as `dna.json` beside it, because
the ledger is still what makes "no two neighbours get the same site"
checkable. The DNA renderers are deleted rather than left in place — an
unused generator in that folder is indistinguishable from a second
supported path.

| was | is |
|---|---|
| `renderTokens(dna)` / `renderFonts(dna)` | `renderSpecTokens(spec)` / `planLocalFonts(spec)` |
| `design.json` = DNA | `design.json` = `DesignSpec` v2; `dna.json` = fingerprint + palette |
| sector-scoped fingerprint only | plus a 30-day, **all-sector** direction count (`designs.direction`) |
| fonts from `next/font/google` | self-hosted, copied per run by the generate stage |

`verify` is green on all three fixtures and on a page built from each of the
four directions. typecheck 0, lint 0, 382 tests.

### The catalog named layouts that did not exist

A3 wrote the four directions before B4 built the library, so the archetype
lists were almost entirely fictional: `grid-bordered`, `quote-large`,
`masonry-reveal`, `list-rule`, `inset-pairs`, `word-swap`, `accordion-rule`,
`statement-left`. Three of roughly thirty names were real. Nothing failed,
because no stage read the catalog — the first run to use it would have
produced a page of silent registry fallbacks inside the generate stage,
where the feedback costs a model session. All four are repointed at the real
registry and widened to all eleven section types, and
`archetypes.test.ts` now checks the catalog the same way it has always
checked the DNA table, plus coverage: a direction that lists nothing for
`team` gives every client the same team page.

### Dark mode had never worked

`globals.css` imports `tokens.css` and then redefined `--background`,
`--foreground`, `--muted`, `--card` and `--border` with shadcn's stock light
neutrals, which therefore won. A `mode: "dark"` direction produced a page
whose paper tokens were dark and whose shadcn utilities were still light —
near-black text on a near-black panel, and the generated background
overridden back to white. Those surfaces now follow the paper/ink ramp, the
way `--primary` already did. Nothing caught it because every fixture
previewed a light direction.

### The template never defined the colour ramp

Same shape as the missing type steps in B4, and found the same way. The
template's committed `tokens.css` carried the generated scale but **no**
`--paper-*` / `--ink-*` at all, so every section written against
`--ink-400` or `text-paper-50` emitted an invalid declaration and inherited
its parent's colour. The pages looked right for the wrong reason. The first
real generated ramp replaced the inheritance with an actual colour and axe
immediately failed three elements.

The template's defaults are now generated from a `DEFAULT_SPEC` by
`pnpm --filter @pipeline/orchestrator defaults`, and `template-defaults.test.ts`
fails if the committed files drift from it. The template renders what a run
renders, through the same two generators.

### The ramp itself was not legible, and now checks itself

With the tokens actually defined, the numbers could be measured for the
first time:

| | was | measured | is |
|---|---|---|---|
| light `ink-400` on `paper-200` | L 0.64 | **2.83:1** | L 0.50 → 5.05:1 |
| dark `ink-400` on `paper-50` | L 0.60 | **4.37:1** | L 0.66 → 5.99:1 |
| light accent (c 0.18, hue 190) | L 0.52 | **4.15:1** | L 0.48 → 4.88:1 |

`contrast.ts` does OKLCH → sRGB → WCAG, and `rampViolations` checks every
text-on-background pair the generator can produce **at the worst hue on the
circle**, because the hue is the client's: a pair that passes at 220 fails
at 190. `renderSpecTokens` throws rather than emit a failing ramp, so the
check runs on every spec and not only in tests. The template's own note had
already recorded this failure mode once ("L 0.57 measured ~4.0–4.2:1 and
failed the axe color-contrast gate") — a generator that can emit any
lightness for any hue has to be able to check itself, or every direction
rediscovers it by failing verify.

### Three smaller ones, all on the same path

- **`split` mode rendered as light.** `renderRamp` branches on
  `mode === "dark"`, so a sampled `quiet-luxury` spec saying `split` — a
  direction whose declared `paperLightness` is [0.12, 0.28] — produced a
  white page. `sample-spec.ts` now resolves `split` to the polarity the
  direction states, reading `color.paperLightness`, which the catalog had
  declared since A3 and nothing read. The per-section half of `split` (a
  dark hero above a light body) is still unbuilt and belongs with §9.
- **The same face downloaded twice.** `swiss-grid` is Archivo over Archivo,
  and `planLocalFonts` emitted one `localFont()` per *role*, which Next
  treats as independent fonts. LCP measured 3684 ms against a 3500 ms
  budget; one declaration per family brought it back under. The token
  generator reads `fontRoles()` rather than assuming `--font-body-face`
  exists, because when body reuses the display face it does not.
- **The nav was legible by accident.** `mix-blend-difference` with
  `text-paper-50` over every hero, and `--paper-50` was one of the undefined
  tokens — so the bar inherited near-black text and read correctly on light
  pages. Once the token existed, a `type-only` hero was near-white on
  near-white, and axe cannot see through blend modes. Three of four
  directions prefer a non-photo hero, so this would have failed most real
  runs. The bar now branches on whether the first section is the one
  archetype that puts a photograph behind it.

### The pattern, again

Every one of these was found by rendering, not by reading: four more
instances of **measurements verify presence and dimension; only rendering
verifies legibility**, and three of them specifically because *dark or
flat-light* backgrounds break what a photo hero on a light page hides. The
new twist is a second pattern worth naming — **a token that is referenced
but never defined fails silently in the direction of looking correct**. CSS
drops the invalid declaration and the element inherits, which on this
template meant near-black text on white: exactly what was wanted, for none
of the right reasons, until something finally defined the token.

## C3 `compose` — the archetype rotates, and the DNA is gone

§6.4's other half: "archetype per section from `direction.archetypes[type]`,
preferring archetypes not used by the last N runs". Which sections exist is
unchanged — still a function of which facts exist (D6).

`composeArchetypes` draws a seeded index and then scans **from that index**
for an option the last 12 runs did not use. Scanning from 0 would have been
the obvious implementation and the wrong one: it hands every client with a
fresh catalog the same first option, so "prefer unused" degrades into
"always option [0]" — less variety than no rule at all. When every option is
in play the seeded draw stands and the choice is logged as `recycled`, which
is what distinguishes "this direction's shortlist is smaller than the
window" from "this client happened to match".

### The DNA had become a fingerprint over things nobody sees

C2/C3 moved every decision the `DesignDna` made — type pairing, density,
motion, archetypes — into the spec. What was left was a parallel object
composed on every run purely to produce a fingerprint, and that fingerprint
was over values that no longer reached the page: two sites could collide on
it while looking entirely different, or differ on it while looking
identical. The ledger's guarantee only means something if it fingerprints
what ships.

So `dna.ts` is deleted — `composeDna`, `TYPE_PAIRS`, `chooseTypePair`,
`chooseDensity`, `chooseArchetypes`, `chooseMotion`, `HEADLINE_GRAMMARS`,
`fingerprintOf` — along with `dna.json`. `fingerprintSpec` hashes the spec:
direction, type pairing, colour mode and bucketed hue, alignment and
density, motion profile, archetypes. The ledger row is the spec, and
`recentArchetypes` reads it back.

The `ARCHETYPES` table went with it. It was a second list of layouts beside
the direction catalog's, and once the directions decided what ships it was
describing choices nothing could make — the same two-sources-of-truth trap
that produced the fictional archetype names. What survives is
`sections.ts`, the vocabulary alone. The guarantee the table's test
carried is kept and repointed: every archetype the template implements must
be reachable from at least one direction, or it is a component that was
built, reviewed, and can never appear on a client's site.

### One smaller fix

`recentArchetypes` orders by `createdAt DESC, id DESC`. `createdAt` alone is
not a sort key — two runs in the same millisecond order arbitrarily, and
with a `LIMIT` that means the window silently contains the wrong rows. A
batch of sites queued together is exactly when this ledger matters most.
Found because a test recording two rows in a loop could not reproduce its
own ordering.

## C4 — structural distance, and the multi-candidate draw it unblocks

§8.1 replaces the fingerprint hash with a weighted axis count, and §6.3's
candidate draw finally has something to choose between.

A hash answers one question — *is this exactly a repeat* — and the answer is
almost always no, because two sites sharing their direction, hero layout,
colour mode and type pairing still differ somewhere in the eighth decimal of
a scale ratio. They are the same site to a visitor and a different string to
SHA-256. `specDistance` counts disagreements across ten axes with §8.1's
weights: `direction` and `heroArchetype` are worth three because they are
what someone reads in the first second, `radius` and `displayWeight` one
because nobody notices them alone.

Three rules, all of §8.1's starting values:

| rule | threshold |
|---|---|
| vs every run, last 30 days, **all sectors** | ≥ 0.40 |
| vs every run in the same sector, last 90 days | ≥ 0.55 |
| `direction` **and** `heroArchetype` may not both repeat | within 3 runs |

The stage now draws two specs from each of the top three directions (§6.3),
in preference order, and takes the first that clears all three. The check is
arithmetic and runs before `generate`, so a rejection costs nothing — which
is the whole reason the pipeline can afford to be picky.

The ledger carries the serialized spec in a `spec` column rather than one
column per axis, which would go stale the first time the spec gains an axis.
Rows written before C4 have none and are skipped: a neighbour that cannot be
measured must not silently read as "far away".

### What the gate says about the catalog

Measured against ten identical clinical briefs — the hardest case, since
nothing but the rotation distinguishes those clients:

```
0: swiss-grid/split          rejected=0
1: editorial-serif/type-only rejected=2
2: kinetic-bold/offset-grid  rejected=4
3: quiet-luxury/photo-full   rejected=6   (widened)
4: quiet-luxury/collage      rejected=23  (widened)
5: kinetic-bold/marquee      rejected=19  (widened)
6: quiet-luxury/photo-full   rejected=24  ** fallback **
...
```

Six distinct sites, then the catalog runs out. Four directions offer eleven
direction/hero pairs between them, and with an identical brief the colour
mode and type pairing are nearly fixed per direction, so two runs of the
same direction sit well under 0.40 apart. **This is the number to watch in
the ship test** (§12 wants ten sites, at least three sectors — real clients
differ in brief, which widens it considerably, but not infinitely).

Two deliberate choices around that ceiling:

- **Widening before giving up.** §6.3 stops at six candidates because the
  candidate judge costs a dollar a run. There is no judge yet and the
  distance check is arithmetic, so when all six fail the stage draws from
  the remaining directions and then four more per direction — 24 in the
  worst case, microseconds. It moves the first fallback from the fourth site
  to the seventh, and the survivor is sometimes the twentieth draw. When C5
  adds the judge, the §6.3 shortlist is what it ranks and this tail stays a
  fallback.
- **Never failing the run.** When nothing clears, the stage ships the
  furthest candidate and logs that it did. The operator reviews every site
  before it goes out, so a site resembling last week's is worse than no site
  only if nobody looks — and the real answer is more directions and more
  archetypes, not a lower threshold (design-rules §12: fix the detector
  before the site, and never the other way round).

## C5 — visual distance (§8.2)

Each candidate that clears §8.1 is now built and photographed, both folds,
and compared against the sites that already shipped. A rejection moves to
the next candidate; it never enters the fix loop, and it costs no model
spend, because the whole thing runs before `generate`.

Three pieces:

- **`prerender.ts`** — a buildable `SiteConfig` from the spec plus the
  client's raw crawl, no model call. Not a site and never shipped: the
  tokens, archetypes and photographs are exactly what the real site will
  use, which is what makes the comparison mean anything, but the copy is
  the client's own unedited text. Where a required field has no source the
  fallback is another piece of their text or an obviously-synthetic marker,
  never a plausible sentence — a plausible sentence in a measurement
  artifact is one somebody later mistakes for a fact. `testimonials` and
  `process` are skipped outright rather than filled.
- **`shots.ts`** — production `next build`, serve, screenshot 1350×940 and
  an iPhone 13. Folds, not full pages: a full-page shot would make
  similarity a function of how much the client wrote, so a chatty dentist
  and a terse one would read as different designs. Reduced motion is forced
  on, or a shot taken mid-fade measures whatever opacity the animation
  happened to be at and the gate becomes a coin flip.
- **`embed.ts` / `visual.ts`** — DINOv2-small through
  `@huggingface/transformers`, CLS token, L2-normalised, stored in a
  `vectors` table. Either fold rejects: several archetypes collapse to one
  column under `sm`, so a site that repeats only on a phone is still a
  repeat, and most of these visitors are on a phone.

**Node, not Python** (operator decision, 2026-10-22). §8.2 says "a small
local Python tool"; this machine has no torch and Python 3.14, where the
wheels are doubtful. What §8.2 actually guarantees is that embedding is
local and no client render leaves the machine (§13 Q4), and that holds
either way — with one toolchain instead of two.

### §8.2's threshold was wrong, and the measurement says so

`docs/D10-visual-calibration.md` has the full matrix: eight candidates from
one client, two draws per direction, every pair scored on both folds.

| pair | desktop | mobile | by eye |
|---|---|---|---|
| `swiss-grid` ×2, both `offset-grid` | 0.971 | 0.932 | the same site |
| `kinetic-bold` ×2, both `marquee` | 0.939 | 0.958 | the same site |
| `kinetic-bold` vs `quiet-luxury` | 0.811 | 0.910 | nothing alike |
| `quiet-luxury` vs `swiss-grid` | 0.679 | 0.687 | nothing alike |

The detector orders these the way a person does — the 0.679 pair is a
near-black serif page against a light ruled grid, and both were looked at,
not just measured. But **0.85 would reject correct candidates**: several
pairs a person calls different sit between 0.85 and 0.91. The code uses
0.93, which is where the data separates, with two cautions recorded in that
file: the margin is 0.02, and identical copy with no photographs inflates
every number. §8.3 still owes thirty labelled pairs.

### The gate, exercised end to end

Ship `swiss-grid/index` for one client, then run the stage for a second
with the same brief:

```
candidate ikinci-klinik.com-0 rejected — desktop fold is 0.960 similar
  to ilk-klinik.com (threshold 0.93)
chose swiss-grid/offset-grid
```

It also shows the two halves are not redundant: §8.1 passed that candidate,
because its rules read the `designs` ledger and the first client existed
only as a vector. The structural check measures the decisions we chose to
name; this one measures the result.

### Three rules it follows

- **A gate never fails a run on its own failure.** A pre-render that will
  not build — a client with no hours and no `hoursNote`, say — is a fact
  about the crawl, not the candidate. It is logged, §8.1's verdict stands,
  and the run continues.
- **It compares against shipped sites only.** §8.2 is explicit that the
  post-verify vector is what later runs measure against. A candidate vector
  belongs to a page that may never have shipped, and gating on the
  pipeline's own rejected proposals would narrow the space for nothing.
  Candidate vectors are stored anyway, for provenance.
- **The scaffold is deleted after the screenshots.** A built Next copy is
  ~200 MB and a run can draw two dozen candidates. The PNGs stay — they are
  what the operator reviews and what §8.3 will calibrate against.

`PIPELINE_SKIP_PRERENDER=1` turns off the §8.2 half; §8.1 still gates.

## The direction review — two of four rejected (operator, 2026-10-22)

The B4 archetypes were merged without review on standing instruction, so the
review was owed. It happened against `/library`, all four directions:

| direction | displayWeights | scaleRatio | verdict |
|---|---|---|---|
| `kinetic-bold` | 700–800 | 5.5–7.0 | "çok iyi" |
| `swiss-grid` | 400–500 | 4.0–6.0 | "fena değil" |
| `quiet-luxury` | 300–400 | 4.0–6.0 | "çok sevmedim" |
| `editorial-serif` | 300–400 | 3.0–4.5 | "hepsi kötü" |

The split falls exactly on display weight and scale ratio. Both rejected
directions are the light, small-scale half of the catalog; both accepted
ones are the heavy half. This is consistent with the standing instruction
recorded since 2026-10-19 — modern fonts, large type — and it means
restrained type reads to this operator as unfinished rather than as elegant.

Two renders, looked at rather than inferred:

- `editorial-serif/hero/type-only`, desktop: a thin Fraunces headline over
  about a third of the viewport, right 40% and bottom 30% empty.
- `quiet-luxury/hero/index`, mobile: small centred display type, a wide
  unexplained gap between the `01–04` numbers and their titles, no
  photograph.

**The archetypes are not the problem.** The same `hero/index` under
`swiss-grid` is left-aligned throughout with rules between the rows and
reads as a table. Quiet-luxury renders it centred with `rules: "none"`, so
the gap reads as broken spacing. That is a direction-level decision, which
is why the answer is to replace the direction and not to patch the layout.

### What follows

`editorial-serif` and `quiet-luxury` are to be **replaced, not repaired**.
Raising their weights and ratios to answer the complaint would produce two
more `kinetic-bold`s, which the §8.1 distance gate would then reject against
each other.

Replacing is urgent rather than cosmetic: C4 measured four directions
producing about six distinct sites before the gate falls back. Two
directions take that to roughly three, and §12's ship test wants ten.

**Blocked on the operator for reference screenshots.** A direction needs at
least three (`refs`, §4.1), and A3 established that the reference picks are
the operator's call. Four to six liked sites, enough to see two distinct
languages, and the rest is mechanical: define the ranges, draw the archetype
shortlists from the existing library, re-measure §8.1 and §8.2.

### Note on the calibration data

`docs/D10-visual-calibration.md` measured all four directions. Half that
matrix describes sites that will not exist. The harness is still worth
having and the method still holds, but the numbers have to be re-taken once
the catalog settles — and §8.3's operator labelling should wait for the same
reason.

## Phase D — the signature section and the judge's other half

**D1.** §9's one bold element, as a stage between `generate` and `verify`.
It edits exactly one file — `src/sections/signature/custom.tsx`, a slot the
registry already imports — which is how §9's freedom coexists with
build-rules §4. Write → build → screenshot → critique → revise, at most
three rounds, and the critique is a separate hostile vision session looking
at the page beside the direction's references. Separate because a model
asked whether its own work is good says yes; and the bar is not "is it
good" but "is it better than the competent default it replaced".

It never fails a run. The fallback restores the pristine slot **and** drops
the section's `variant` — restoring alone would leave the config claiming a
bespoke signature that no longer exists.

The signature REPLACES `statement` rather than joining it: both want the
client's own sentence at scale, and a page carrying both says it twice.

**D2.** Two rubric questions compare the page against something that is not
on the page, and neither had its other half. DJ18 asks whether the
signature "resembles its direction's reference set" — the judge had never
been shown the reference set. DJ11 asks whether the bold element is
present — a judge that does not know the §9 loop fell back reads a correct
default as a missing element. Both are now in the prompt, with the
direction's `intent` and `avoid` list.

`docs/D10-judge-examples.md` is the few-shot half: worked pass/fail answers
for the questions easiest to get wrong. Every example is a real page this
pipeline produced, because the failures that actually got through are the
ones a judge most needs to recognise — several of them found by looking at
a render after every automated gate had passed.

### Two bugs D1 turned up

- **`dropSignatureVariant` was a regex, and it was wrong.** Anchored on
  `type: "signature"` with a 400-character window — contained-looking, but
  in the multi-line shape `generate` actually writes, a signature section
  with no variant let the match run past the closing brace and strip **the
  next section's** variant. A fallback whose job is to make one section
  boring must not be able to take a layout choice from another. It is
  brace-matched now and both cases are tested.
- **`plan.ts` had a stale hardcoded section list** — eight types against the
  schema's twelve. It could not produce `statement`, `visit`, `closing`,
  `marquee`, `process` or `team`, let alone `signature`, and nothing said
  so. It takes the list from `design.json` now, which is where the decision
  was already made.

## Phase E — seven directions, because four was measured and found short

Four directions produced **11 mutually-distinct sites across sectors and 6
within one**, against a §12 ship test of ten. Three more, built from four
reference sites the operator picked off awwwards after rejecting everything
video- or WebGL-based:

| direction | from | what it adds |
|---|---|---|
| `technical-accent` | heronaiapp.com | the catalog's first real accent colour — drafting paper, crop marks, mono labels, one hot mark |
| `gallery-wall` | almirakho.com | many photographs tiled edge to edge, type laid on them |
| `night-ruled` | offforum.com | a second dark direction — ruled info table over a dark photograph |

Capacity after: **28 across sectors, ~11–12 within one.** Measured, not
projected; the greedy count is order-dependent, so treat the same-sector
figure as approximate.

### `swiss-grid` could only ever serve one client

Found by the capacity probe, not by a gate. It declared exactly one value
for colour mode, motion profile, alignment, image frame, radius **and**
density — twelve of §8.1's eighteen points frozen, leaving a ceiling of
0.333 against a 0.40 threshold. Two `swiss-grid` clients could never be far
enough apart, so the second was always rejected and the direction yielded
one site. It had been in the catalog through four merges.

`maxInternalDistance` computes that ceiling and `internal-distance.test.ts`
fails any direction below the threshold, so the next one is caught at the
commit rather than by a probe. Four of swiss-grid's axes are unfrozen and
each is argued where it sits; `radius` stays at 0 deliberately, because
buying distance by rounding the corners would trade away the thing being
measured. Its yield went 1 → 4.

### `accent-block` was tinting the whole page

`technical-accent` rendered entirely lavender. Both the ink and the paper
chroma are multiples of `brandC`, so a direction that raises `brandC` to
afford a hot accent was putting that hue into every headline, every
paragraph and the background. The accent cannot read as the only colour on
the page if the page is already that colour.

`accent-block` now keeps ink and paper near-neutral and spends the chroma
on the accent alone — which is what the strategy name always meant. Found
by looking at the render: every number was in range and `rampViolations`
passed, because tinted ink is perfectly legible. It is just not what the
direction says it is.

## Next

**§8.3 calibration — operator.** ~30 labelled pairs. Both thresholds move to
match: the structural 0.40/0.55 and the visual 0.93. A threshold that
disagrees with the operator's eye is a broken detector (design-rules §12).

Phase D's signature section and judge work follow.

### Still open from earlier turns

- `signature` is `{ sectionIndex: 0, concept: "<direction> hero" }` — a true
  statement, not a decision. §9 owns the real one.
- `color.paperLightness` still only decides `split`'s polarity.
- The committed fixtures are smaller than real clients (4 services, 4
  gallery images, 3 team members, no `process` section), so most archetypes
  are previewed at a size a real client exceeds.

Smaller things this turn left open, none blocking:

- `signature` is `{ sectionIndex: 0, concept: "<direction> hero" }` — a true
  statement, not a decision. §9 owns the real one.
- `color.paperLightness` still only decides `split`'s polarity. Sampling the
  page's own lightness from that range would mean re-deriving the contrast
  floors per draw, which is A4 work this did not do.
- `rejected[].distance` carries the score gap, because no visual-distance
  metric exists until C4.
