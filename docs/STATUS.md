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

It is conservative in both directions, and false positives are the price. Two
hit during this verification, both from a protected *name* appearing in a
command that merely *looked* like a write:

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

Not covered by a committed fixture: the template's `site.config.ts` publishes
a WhatsApp number, so the null branch is only exercised when a real client has
none (dermaguzellik is one). Worth a second fixture config if you want the
branch gated rather than spot-checked.

**4 · The geometry gate had never run — and it fails.** Found while verifying
A0. `scripts/verify.mjs:477` did `await import("playwright")`, but the bare
package is a dependency of `apps/orchestrator`; a generated site copy only has
`@playwright/test`, which re-exports the same launchers. So the gate died with
`Cannot find package 'playwright'` — and because it is the **last** gate and
fails hard, every verify exited 1 and `.pipeline/verify-passed` was never
written, which is what the deploy hook waits for. Fixed here, one line.

With the gate actually running, it reports real violations of the §7 invariant
`44px tap targets` on the template's own fixture:

```
fold 344×882     "Hemen Ara"            129×36
fold 344×882     "WhatsApp'tan Yaz"     179×36
fold 344×882     "+905551234567"        105×18
fold 344×882     FAQ summary rows       270×24
iphone-se 375×667  same four
```

Not fixed — these are section and token changes, outside this task. They are
the first genuine output of a gate that has been silently absent, so the
template has never satisfied §7 at mobile widths.

**5 · Two softer findings from the same run.**

- `links` WARN: `http://localhost:3000/` is reported as a broken external
  link. It is the documented local-build fallback in `src/lib/seo.ts:16` when
  neither `SITE_URL` nor `VERCEL_PROJECT_PRODUCTION_URL` is set, so it is
  correct locally and absent in a deploy — but it will WARN on every local
  verify. Harmless; mentioned so it is not re-investigated.
- D8 edge, `src/lib/cta.ts:17`: a `whatsapp` CTA with no published WhatsApp
  degrades its **href** to `tel:` but keeps its **label**. On the null fixture
  the hero still read "WhatsApp'tan Yaz" while dialling the phone. No dead
  link, so no gate catches it, and the file's own comment says such a CTA
  "should not be planned in that case" — but nothing enforces that. The plan
  stage must not emit a `whatsapp` action when `whatsappE164` is null.

## Next

A2 (`directionSchema` + `designSpecSchema` + `briefSchema` in
`packages/core`), then A3 (the four real directions with their reference sets,
replacing `design/directions/stub.ts`). Phase B refactors the archetypes to
read only tokens, which is where K8 finally closes.
