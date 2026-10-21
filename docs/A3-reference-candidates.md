# A3 — reference screenshot candidates

**Operator review. A3 stops here** (RUNBOOK §2): the four direction files are
written and their `refs` are filled with my picks so the catalog parses and
the acceptance test passes. Swap any of them before this merges.

Each direction below lists candidates with the measured evidence that
surfaced them, then my pick and why. **✓ = I opened the screenshot**;
everything else is measurement only. I looked at ten of the fifty-seven.

Shots live in `data/corpus/shots/` (gitignored, local). The four picks per
direction are copied into `data/directions/<id>/refs/` and committed — 16
files, 1.5 MB.

## How the shortlist was built, and why the measurements lie

I scored all 56 usable corpus sites against each direction's ranges — display
weight, tracking, display/body ratio, serif/mono hints, pin count, text
splitting, entrance, smooth scroll, background luminance, colour count,
`filter` tweens. Then I opened the leaders, and the top-ranked site was wrong
in three of the four directions:

- **`butter.video`** topped quiet-luxury on "dark · 9 colours · filter tween".
  It is a bright SaaS page; the dark reading came from a **cookie banner**
  filling the lower half of the shot. Rejected — and the banner makes the
  screenshot useless as a composition reference regardless.
- **`overworldaudio.com`** scored 12 on quiet-luxury. It is an *enter with
  sound* splash gate: no nav, no content, no structure to reference.
- **`leoparpeix.com`** ranked 2nd for editorial-serif on a "serif" flag that
  matched a **font name**, not a serif. It is a grotesk portfolio.
- **`hobro.digital`** scored 13 for quiet-luxury at "w300". The display is a
  heavy condensed grotesk across a full-bleed video — it is kinetic-bold, and
  I moved it there.
- **`odysseeclinic.com.au`** topped editorial-serif. It is unmistakably
  quiet-luxury: full-bleed portrait, hairline serif wordmark, nav as thin
  caps — and it is an aesthetics clinic, which is quiet-luxury's stated
  intent. Moved.

So: the ranking is a filter, not a verdict. Worth knowing before A3's sequel
(§14 intake) treats a score as a decision.

---

## `kinetic-bold`

| | Site | Measured | Note |
|---|---|---|---|
| **✓ pick** | `hobro.digital` | w-heavy · filter · dark · parallax | Heavy condensed display across full-bleed video, mono micro-label stack under it. The clearest statement of this language in the corpus. |
| **✓ pick** | `sharplink.com` | tr−0.03 · r6.8 · pin×7 · split:char | Large grotesk display left-flush over a product render, two stacked CTAs. Closest to an actual SMB layout. *Caveat: a cookie bar crosses the top 24px.* |
| **pick** | `unitedcarriers.com` | w700 · pin×99 · split:word | Highest pin count measured; word-level splitting. |
| **pick** | `trevornoah.com` | w700 · pin×70 · split:word | Personality-led, heavy display, photo-forward. |
| | `meermohsin.me` | w700 · pin×21 · split:char · entrance | Portfolio; char splitting plus an entrance. |
| | `paulkalkbrenner.net` | w700 · tr−0.05 · pin×4 | Tightest tracking in the corpus. |
| | `aardvarkbookclub.com` | w700 · pin×77 · split:word | |
| | `kononenkogroup.com` | tr−0.03 · pin×7 · split:word | |

## `editorial-serif`

Thinnest shortlist of the four: the corpus is award sites, and calm serif
pages rarely win awards. All four picks are measurement-only.

| | Site | Measured | Note |
|---|---|---|---|
| **pick** | `neutomni.com` | serif · w400 · tr0 · light · 11 colours | |
| **pick** | `brand.squarespace.com` | serif · w400 · r3.3 · no pin · 5 colours | Lowest ratio measured — the restraint this direction needs. |
| **pick** | `huyml.co` | serif · w400 · no pin · light | |
| **pick** | `gionatannese.com` | w400 · tr0 · no pin · no entrance · light · 3 colours | |
| | `leoparpeix.com` ✓ | w400 · tr0 · r4.8 | **Not a serif** — grotesk portfolio. Keep only if you want it as a whitespace reference. |
| | `milledollars.fr` ✓ | w400 · tr0 · no pin · 3 colours | Moved to quiet-luxury; it is dark and photo-led. |
| | `odysseeclinic.com.au` ✓ | serif · w400 · r3.2 · light | Moved to quiet-luxury. |
| | `belgradearbor.rs` ✓ | serif · w300 · light | Moved to quiet-luxury. |

**Worth your call:** if none of the four reads right to you, this is the
direction to re-harvest for. It is also the direction most of your actual
leads will land in, so a weak reference set here costs more than elsewhere.

## `swiss-grid`

| | Site | Measured | Note |
|---|---|---|---|
| **✓ pick** | `aspensearch.com` | mono · w450 · tr−0.022 · lateral · pin×17 | Textbook: hard modular rules, grotesk 400, mono micro-labels (`08:41 AM LA`, `START A CONVERSATION`), accent as a filled cell rather than a highlight. |
| **pick** | `seasats.com` | mono · w400 · tr−0.01 · pin×33 · no entrance | |
| **pick** | `cerebrium.ai` | mono · tr−0.025 · r5.1 · pin×51 | |
| **✓ pick** | `noho.ink` | w600 · tr−0.04 · r5.7 · pin×6 | Left-flush display against a photo grid. Ranked for kinetic-bold but reads calm and gridded. |
| | `lxlcreative.co.uk` | w400 · lateral · pin×64 | Also a quiet-luxury candidate. |
| | `lpas.com` | w400 · r4.7 · lateral · pin×20 | |
| | `heronaiapp.com` | mono · tr−0.02 · r4 | |
| | `offforum.com` | w400 · tr−0.02 · r4.1 | |

## `quiet-luxury`

| | Site | Measured | Note |
|---|---|---|---|
| **✓ pick** | `odysseeclinic.com.au` | serif · w400 · filter · pin×1 · 5 colours | An aesthetics clinic — this direction's stated intent, and the closest thing in the corpus to a real client. |
| **✓ pick** | `milledollars.fr` | w400 · tr0 · filter · 3 colours · parallax | Dark, photo-led, hairline frame, small-caps micro-type. No display step at all. |
| **✓ pick** | `belgradearbor.rs` | serif · w300 · light | Serif wordmark set into a full-bleed render. |
| **pick** | `lxlcreative.co.uk` | w400 · r5.8 · filter · dark · parallax | |
| | `offforum.com` | filter · dark · 3 colours · pin×0 | |
| | `lpas.com` | filter · 10 colours · parallax | |
| | ~~`butter.video`~~ ✓ | — | **Rejected:** cookie banner over half the fold. |
| | ~~`overworldaudio.com`~~ ✓ | — | **Rejected:** splash gate, no page structure. |

---

## What to tell me

Per direction: which of the four picks to keep, and which candidate to swap
in. "Fine as-is" is a complete answer. If you want to see any of the
measurement-only ones first, they are at `data/corpus/shots/<host>.jpg`.

Two things I would like a view on beyond the picks:

1. **editorial-serif's reference set is the weakest.** Accept it, or hold A3
   open and harvest for calm serif pages specifically?
2. **`quiet-luxury` carries a condition** already recorded against Q1: it
   needs real photography, so a thin-imagery client should score away from it
   via `affinity.photoProfile` rather than get built in it and repaired. The
   weights are set hard for that (`pro: 4`, `stock-heavy: −4`). Say if that
   is too aggressive.
