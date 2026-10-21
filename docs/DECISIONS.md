# Decision log

Amendments to docs/PLAN.md. Where they conflict, this file wins.

## D1 — Local-first delivery, manual Vercel deploy (2026-10-17)

**Decision (operator):** The pipeline does NOT auto-deploy to Vercel. A
finished site stays local; the operator reviews it on their own machine and
pushes to Vercel manually only when needed (cost: avoid paying Vercel for
every demo).

Consequences:
- Automatic stage chain is `crawl → audit → plan → generate → verify →
  notify`. `deploy` remains implemented but is manual-only:
  `pipeline deploy <domain>` (still hard-gated on `.pipeline/verify-passed`).
- `notify` fires after `verify` passes, not after deploy. Message (Turkish):
  site is ready locally + how to preview it. If a deploy happened, the
  preview URL is appended.
- Local preview: `pipeline preview <domain>` (Milestone 2) serves the built
  site from `runs/<domain>/generate/` on a local port.
- Notification channel: see D2 — WhatsApp only, no Telegram.
- Vercel Pro is NOT required until the first commercial manual deploy.
  `VERCEL_TOKEN`/`VERCEL_ORG_ID` stay optional in `.env`.
- PLAN.md sections that assume auto-deploy (§Vercel deploy, preview
  protection flow, notify-after-deploy) are to be read through this lens.
  SITE_PREVIEW noindex/Basic-Auth hardening still applies to any manual
  deploy.

## D2 — WhatsApp Business (Meta Cloud API) only, no Telegram (2026-10-17)

**Decision (operator):** Skip Telegram entirely. All notifications (notify
stage + discover batch summaries) go to the operator over WhatsApp via the
Meta Cloud API test number — free to up to 5 verified recipients, which is
enough for a single operator.

Consequences:
- PLAN.md's "Telegram first, WhatsApp later" sequencing is void.
  `TELEGRAM_*` env vars removed; `NOTIFY_WHATSAPP_ENABLED` flag removed
  (WhatsApp IS the channel).
- Required env: `WA_TOKEN` (permanent System User token with
  whatsapp_business_messaging), `WA_PHONE_NUMBER_ID`, `OPERATOR_WHATSAPP`.
  Optional: `WA_WABA_ID` (template status checks via API).
- Delivery strategy (M2 notify implementation): try the approved Turkish
  `site_ready` utility template first (works unattended, outside the 24h
  window); if the template is not yet approved, fall back to a free-form
  text message, which succeeds only while the operator's 24h session window
  is open (operator can reopen it by messaging the test number). Failures
  are recorded in notify/sent.json and the run is NOT failed over a
  notification error; the event row is enough to surface it in the admin
  panel.
- If WhatsApp delivery proves flaky in practice, a fallback channel can be
  revisited; nothing else in the pipeline depends on the channel choice.

## D3 — Telegram until WhatsApp business verification (2026-10-17)

**Decision (operator):** D2 is suspended, not reversed. Meta permanently
restricted the fresh test WABA ("Hesap Kısıtlandı", duration: permanent)
and the only unlock path it offers is business verification, which requires
a registered company — the operator does not have one yet.

Consequences:
- Interim notification channel: Telegram bot (operator picked it over
  ntfy.sh/e-mail). `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` return to .env.
- The notify stage is written channel-pluggable: `telegram` now, `whatsapp`
  activates once the operator registers a company (şahıs şirketi planned —
  also needed for invoicing/Vercel commercial use), passes Meta business
  verification with the tax certificate, and the `site_ready` template is
  approved. WA_* env vars stay documented but optional until then.
- Discover summaries follow the same channel abstraction.

## D4 — LHCI gate calibration after the first real runs (2026-10-17)

**Decision (operator):** resolves the `TODO(uygar)` in build-rules.md about
LHCI thresholds. Measured on the reference template (static Next.js 16 page,
LHCI simulated Slow 4G + 4x CPU on localhost, median of 3 runs):
performance 0.94–0.96, accessibility 1.0, best-practices 1.0, SEO 1.0, but
LCP swinging 2.7–3.2 s with ±400 ms run-to-run noise.

- `largest-contentful-paint`: hard gate at **3500 ms**, with 2500 ms (the
  field CWV target) kept as a digest recommendation. A 2500 ms hard gate
  would fail every generated site on measurement noise alone and burn the
  3-iteration fix loop.
- Preset: **`lighthouse:recommended`** instead of `lighthouse:no-pwa`. The
  latter asserts every audit at error, making `legacy-javascript-insight`
  (Next.js polyfills) and `network-dependency-tree-insight` (framework chunk
  chain) permanent blockers that a generated site cannot fix from
  site.config.ts / sections / tokens.css.
- The explicit error assertions (category scores, CLS 0.1, script budget
  250 KB) remain the real gates, matching the plan's intent.

Template fixes made while calibrating (all kept):
- Google Maps embed replaced with a click-to-load facade: −476 KB of
  third-party JS off the critical path, and no Google cookies before the
  visitor makes a KVKK choice.
- KVKK consent banner is now server-rendered with a pre-paint script that
  hides it for visitors who already decided (it used to render only after
  hydration and became a ~3.3 s LCP element).
- Fonts pinned to the weights actually used instead of full variable faces.
- Total page weight 873 KB → 375 KB; script 610 KB → 164 KB.

## D5 — Design language adopted from the hand-built reference (2026-10-19)

**Decision (operator):** the generated-site design language is the one proven
by hand at `~/diskent-landing`, not the template's original output. Approved
after three review rounds; the brief was Aventura Dental Arts' scroll
choreography plus 4ourstack.com and speaktable.com's typography and colour.

Settled invariants — these are quality floor, identical on every client site:

- **Motion**: Lenis smooth scroll driven by `gsap.ticker`, ScrollTrigger for
  everything. Scroll must *change* the page, not merely translate it: at
  least one pinned scrub where two elements trade places, and at least one
  place where the text itself changes (word-by-word reveal or in-place swap).
- **Type**: one shared six-step scale, no section inventing its own size. A
  grotesk display needs weight 700–800 *and* negative tracking; 400 at display
  size reads timid. Body ≥ 17 px, small caps meta ≥ 13 px.
- **Colour**: one hue family. The dark ground is the paper hue pushed to
  near-black, tinted toward the accent. At most one non-neutral accent, used
  only for hover/focus — never as a surface. The photographs are the chroma.
- **Turkish typography**: display line masks need padding for descenders and
  for the İ dot. Cropping them silently renames the business ("Dişkent" →
  "Diskent"). `text-transform: uppercase` inside `lang="tr"` is correct and
  is the only casing mechanism allowed in CSS.
- **Interface floor**: every interactive target ≥ 44 px on both axes; a phone
  number never wraps; `scroll-margin-top` on every anchor target; no
  horizontal overflow at any width; `prefers-reduced-motion` disables every
  timeline while leaving all content visible.
- **Above the fold**: hours, address, a pressable phone number and a CTA. The
  award-winning references omit these; an SMB site cannot.

Verified across 375/390/430/844-landscape/768/820/1023/1024/1280.

## D6 — Generated sites must not be copies of each other (2026-10-19)

**Decision (operator):** adopting one design language must not produce one
site repeated per client. Sameness has four distinct failure modes —
structural, chromatic, typographic and rhetorical — and each needs its own
remedy. Variation is **derived from the client's own material**, never
random: random variation produces incoherent sites, derived variation
produces sites that differ because the businesses differ.

- Palette is extracted from the client's own photographs (Dişkent's dark
  ground came from the turquoise of their treatment chair).
- The section set follows which facts actually exist, not a fixed list.
- Layout archetype and motion signature are chosen per section from a kit of
  variants; density follows crawled content volume.
- A **design fingerprint** is recorded per run and a new run may not reuse a
  recent fingerprint in the same sector. This is the hard guarantee; the
  derivation above is what makes the result coherent rather than merely
  different.

Status: recorded, not yet implemented. Supersedes the "same template per
client" assumption in PLAN.md's generate stage.

## D7 — design-rules.md amended over the protect-tests hook (2026-10-19)

**Decision (operator, after being shown the conflict):** `template/design-rules.md`
is a protected quality-gate file and the hook correctly refused the write. It
was amended anyway, deliberately, because the file as written **rejected the
design language the operator had just approved**:

- Old DJ3 failed any "tracked-out ALL-CAPS eyebrow label". The approved
  language uses uppercase eyebrows. DJ3 now tests what was actually wrong:
  letter-spacing above 0.08em, or an eyebrow that adds nothing the heading
  does not already say.
- Old DJ10 failed when "more than one section animates on scroll". The
  approved language is built on scroll-driven motion. DJ10 now fails the real
  defect: fade-and-slide-up being the *only* motion, with no pinned hand-off
  and no text transformation anywhere.
- Generic-cluster 5 no longer lists the uppercase eyebrow.

Added: §4 type scale (six steps, display/body ≈ 6:1), §5 one-hue-family
colour derived from the client's photographs, §6 Turkish typography including
the line-mask descender rule, §10 variation axes and the design fingerprint,
DJ16–DJ17, and §12 automated geometry checks.

The previous file is preserved in git history. Any further change to this file
needs the same explicit approval.

## D9 — A deliberation layer: brief, composition, comparative judgement (2026-10-20)

**Decision (operator):** the pipeline selects where it should decide. Three
gaps, found while running dermaguzellik.com end to end:

1. **`design` picks from a kit, it does not compose.** Palette is derived from
   the client's own photographs (good), but the type pairing is one row of a
   six-row table keyed by sector, the archetypes come from a closed kit, and
   density is a function of content volume. A beauty centre with 19 treatments,
   no staff and no prices gets the same skeleton as a dental clinic with six
   doctors. D6's fingerprint ledger guarantees two sites *differ*; it does not
   make either one *right for its business*.
2. **A new component cannot exist.** `sectionSchema` is `.strict()` and
   `registry.ts` is keyed by a fixed enum — which is what keeps facts safe and
   is also why every site has the same parts. There is no way for the pipeline
   to say "this client needs something the kit does not have".
3. **There is no judgement of quality, only of defects.** `design-judge` runs
   inside `verify` and answers DJ1–DJ12 as binary questions with evidence.
   That catches faults ("is the phone number an image?"). It cannot answer
   "is this good?", and a rubric score produced in a vacuum would not either.

The three remedies, buildable independently:

- **Brief** — a cheap LLM step before `design` that reads `facts.json` and the
  content inventory and writes a problem statement: what the business is, who
  walks in, the one job the site has, what material exists and what is
  missing. The composition answers the brief instead of the sector.
- **Composition over selection** — `design` proposes a section composition for
  that brief and may report that the kit has nothing for it, rather than
  silently falling back to the nearest variant.
- **Comparative judgement** — the judge is given the reference corpus as
  few-shot and asked to compare, not to score. The research PLAN.md already
  cites is explicit: generic "critique this UI" prompts fall below human
  designers, while rubric + few-shot + per-finding evidence closes about half
  the gap (arXiv 2412.16829; UICrit few-shot ≈ 55% gain), and multimodal
  judges correlate 0.69–0.73 with humans on concrete factors (clarity,
  hierarchy, trustworthiness) while failing systematically on "aesthetic
  pleasure" (arXiv 2510.08783). So the judge compares against known-good work
  on concrete factors and never scores beauty in the abstract.

**The corpus is the training set, and it already exists on disk:**
`~/{fourstack,lit,naks,vibecheck,diskent}-landing`, plus Aventura Dental Arts,
4ourstack.com and speaktable.com as live references. Nothing in the pipeline
reads it. Step one is a one-off extraction into a pattern library
(`template/pattern-library.md`) so the corpus informs every run instead of
being re-read by eye each time.

**Constraint carried over from the geometry gate:** a check that produces
false positives is worse than no check, because it trains the fix loop to
ignore it. The judge's output is therefore "X is worse than reference Y
because Z", not a number.

Status: recorded; pattern library first, then the brief step, then the judge.
Extends D6 — D6 makes sites differ, D9 makes them considered.

## D8 — Unpublished facts stay absent; the template degrades (2026-10-20)

**Decision (operator):** when the client's site does not publish a fact the
template used to require, the generated site omits it. Nothing is derived,
guessed, or defaulted. Found while running dermaguzellik.com (Atakent Derma
Güzellik, Küçükçekmece) through the pipeline: the site publishes no day-mapped
hours, no WhatsApp number and no registered trade name, so
`siteConfigSchema` rejected a facts set that was *correct* — and the only way
to satisfy it was to invent data, which the verbatim-facts rule forbids.

Schema changes (`template/src/lib/schema.ts`):
- `business.legalName` → nullable. The footer and the JSON-LD `legalName`
  are omitted when null rather than showing the brand name as a legal entity.
- `contact.whatsappE164` → nullable. Every WhatsApp CTA disappears: the
  sticky mobile bar becomes a single full-width call button and the contact
  section drops its WhatsApp button. A `wa.me` link derived from a mobile
  number would promise a channel nobody reads.
- `openingHours` → `.max(7)` without `.min(1)`, plus a new sibling
  `hoursNote: string | null` carrying hours the business publishes with no
  day mapping, verbatim ("10.00-19.30"). A config-level refine requires
  `hoursNote` whenever `openingHours` is empty, so no site can ship with no
  hours at all.
- `buildLocalBusinessJsonLd` omits `openingHoursSpecification` entirely when
  there are no day-mapped hours: an unmapped range cannot be expressed as one,
  and an empty array is a structured-data error.

This narrows D5's "above the fold: hours, address, a pressable phone number
and a CTA" to *hours in whatever form the business publishes them*. The intent
survives — a visitor still learns when the business is open — but a site is no
longer blocked because its owner wrote one range instead of seven.

`Facts.hoursNote` (`packages/core`) is populated by the facts stage from the
crawl's new `hours_unmapped_candidates` signal. Day mapping is never inferred:
an LLM extraction of this same page returned "Mon–Sat 10:00–19:30, Sunday
closed", none of which the page states.

## D10 — Design variation through a declared design space (2026-10-21)

**Decision (operator):** creativity moves out of the runtime and into a
curated design space that is declared up front. Taste enters the system once,
offline, as operator-approved **directions** (named design languages: token
ranges, allowed archetypes, motion profile, font options, reference
screenshots) and **archetypes**; at runtime the model selects from that space
and fills it, and does not invent. Variation comes from discrete enumerated
axes sampled per client and checked against recent runs by measured distance —
structural and visual — rather than by hash inequality. The model keeps exactly
one place for bespoke work per site, the signature section, guided by reference
screenshots instead of prose rules. The quality ceiling of the pipeline becomes
the quality of the library, which is intended: design quality is curation, and
the pipeline's job is to scale the curation.

The cause this fixes is architectural, not a prompt problem. `design-rules.md`
§3–§6 were written from `diskent-landing` and then enforced globally, so every
rule that made that one site good — the exact `clamp()` scale, display weight
700–800, tracking −0.045em, a mandatory pinned hand-off, a mandatory text
transformation, one hue family, Google fonts only — was fed to `generate` and
the fix loop as an instruction. The 57-site corpus study did not help, because
it produced medians, and designing toward the median produces the average site.
Award sites are good because each commits hard to one coherent concept.

**Amends:**

- **D5** — the design language adopted from the hand-built reference stops
  being global. `design-rules.md` §3–§6 split into invariants (§3.1: the
  reduced-motion contract, transform/opacity/filter only, one declared scale,
  Turkish typography, the geometry and facts rules — all still hard gates for
  every site) and style (§3.2: moves into direction files). D5's language
  survives intact as the `kinetic-bold` direction; it is no longer the floor.
- **D6** — "generated sites must not be copies of each other" is kept but
  re-measured. The fingerprint ledger detects inequality, and changing one
  archetype changes the hash while the eye still sees the same site.
  Replaced by structural + visual distance (§8), and DJ17 becomes
  distance-based.
- **D7** — amends the amendment. D7 added §4's fixed type scale, §5's
  one-hue colour and DJ16–DJ17 as globals; those are exactly the rules that
  encoded one site, and they now live per direction. D7's procedural point
  stands: `design-rules.md` is protected and changes to it are operator edits
  applied from patches.
- **D4** — `next/font/google` only is widened to `next/font/local` **or**
  `next/font/google`, so a direction may self-host (§11 C1). Each self-hosted
  face needs a licence permitting commercial use across unlimited client
  domains *and* a rendered Turkish glyph check — the catalogue page is not
  evidence. Settled 2026-10-22 (§13 Q2): **free open-licence faces only, no
  foundry licence is bought**, so a per-domain or pageview-capped licence
  disqualifies a face — the pipeline deploys one site per client across
  unlimited domains and nobody reviews the licence per run.
- **D9** — the deliberation layer stands and gains a composition pass on
  harvest intake (§14). The brief it introduced becomes the input to
  deterministic direction selection rather than advice to a generator.

**Consequences:**

- **Inter is no longer banned outright** (§11 C4): never a display face, and
  permitted as a **body** face only where a direction lists it. Reaching for
  it by default remains the clearest tell that a page was not designed for its
  owner. "Max two families" becomes two display/body families plus an optional
  mono accent (§11 C3).
- **DJ10 and DJ16 stop being judge questions and become deterministic code**
  (§3.3). Computed styles from Playwright are compared with the selected
  direction's ranges; a model reading a screenshot cannot tell weight 400 from
  500, and a check that produces false positives trains the fix loop to ignore
  it — D9's constraint. DJ10 checks both halves: every signature the profile
  requires is present, and nothing the direction disables is.
- **`design.json` becomes a resolved, validated `DesignSpec`** (§5) that every
  downstream stage reads; nothing re-decides style after it.
- **`docs/corpus-findings.md` is demoted to distributions** — the legal range
  for a direction's token ranges, never a direction. Directions come from the
  reference sets in §4.
- The pipeline gains offline work that is not per-run: authoring directions,
  copying reference screenshots into `data/directions/<id>/refs/`, and
  curating intake from new references (§14). This is operator time, by design.

A1 (the rule split) is applied and merged. Full text, direction catalog,
selection pipeline, distance metrics and the phased plan:
[docs/D10-design-variation.md](D10-design-variation.md).
