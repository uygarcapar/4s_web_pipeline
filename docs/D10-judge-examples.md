# Worked examples for the design judge

Few-shot calibration for the rubric in `template/design-rules.md` §11 (D10
task D2). The judge reads this file before answering.

Every example below is a **real page this pipeline produced** and a real
verdict, not an invented illustration. That matters more than the format:
the failures here are the ones that actually got through, so they are the
ones a judge most needs to recognise — and several of them were found by
looking at a render after every automated gate had passed.

Two rules the examples are meant to teach, before any specific question:

1. **Evidence is something you saw.** "The hero looks unbalanced" is not
   evidence. "At 1440px the headline occupies the left 35% and the right 40%
   of the viewport is empty" is. A verdict with no observation behind it is
   worse than no verdict, because it reads as authority.
2. **A thing can be correct for the wrong reason.** Twice in this project a
   page looked right because a CSS token was *undefined* and the element
   inherited a colour that happened to work. If you cannot say which rule
   produced what you see, say the answer could not be determined rather than
   guessing.

---

## DJ1 — does the first mobile viewport say what, where and how to contact?

**Pass.** A dental clinic at 390×844: eyebrow reads `KADIKÖY, İSTANBUL`,
headline "Kadıköy'de güvenle gülümseyin", and a `HEMEN ARA` button with the
number beside it, all above the fold. What, where, how — three for three.

**Fail.** The same page with the headline at `scaleRatio` 9: the headline
alone fills the fold and the number is two scrolls down. The business is
named and nothing else is answered. Scale is not an excuse — if the bold
element pushes the contact out of the fold, the answer is no.

---

## DJ3 — uppercase tracking above 0.08em, or a label repeating its heading

**Pass (the trait is absent).** `.meta` renders at `letter-spacing: 0.07em`
— measured in the computed style, not estimated from the screenshot — and
the eyebrow above "Hizmetlerimiz" reads `KADIKÖY, İSTANBUL`, which is
information the heading does not carry.

**Fail.** An eyebrow reading `HİZMETLER` directly above a heading reading
"Hizmetlerimiz". The label is the heading in capitals; it adds nothing.

Note the measurement: §4 caps uppercase tracking at 0.08em **because
Turkish is agglutinative** and wide tracking slows reading of long
compounds. One direction in the catalog, `cinematic-calm`, tracks its
*display* positively up to 0.12em — that is a different step and a
deliberate choice. DJ3 is about uppercase labels.

---

## DJ4 — three or more sections as the same card grid

**Fail.** Services, team and testimonials all rendering as 3-up grids of
rounded cards with the same shadow. This is generic cluster 4 and it is the
single most common failure in this project's history — the fix is that the
archetypes differ, not that the shadow is softened.

**Pass.** Services as a pinned lateral rail, team as sticky-swap portraits,
testimonials as a ruled list. Three sections, three structures.

---

## DJ6 — palette matches generic cluster 1 or 2

**Fail.** `#6366f1` indigo on white with a violet gradient: cluster 1, the
default startup palette, and a hex value in the first place — every colour
on a generated page comes from the OKLCH ramp.

**Pass.** Near-black `oklch(0.18 …)` ink on `oklch(0.975 …)` paper, hue 203,
derived from the client's own photographs. Low chroma is not cluster 2 —
cluster 2 is a **bright accent** on near-black.

---

## DJ11 — is the one bold element from design.json actually present?

Read `design.json`'s `signature.concept`, then look for it. The question is
presence, not quality.

**Pass.** `concept` says "the client's own sentence as the one bold element,
in kinetic-bold's register", and the page has the sentence at display scale
across the full width, nothing else competing on that screen.

**Fail.** The same `concept`, and the sentence renders at `t-lead` inside a
two-column block between services and the team. It is on the page; it is not
the bold element.

**Also pass.** `runs/<domain>/signature/result.json` says `built: false`
with the reason that no round converged. The default signature section
shipped, which §9 explicitly permits. Say so in the evidence — the design
note is useful, the hard fail would be wrong.

---

## DJ13 — every section has body content, not just labels and headings

**Fail.** A `process` section with three steps whose titles are "Randevu",
"Muayene", "Tedavi" and no descriptions. Headings and nothing under them.

**Pass.** The same section where each step carries the client's own sentence
about what happens in it. Note what this is *not* asking: a section with
three real steps and no `duration` field is fine — the client never
published durations, and inventing one is forbidden (§9, DECISIONS D8).

---

## DJ14 — photographs from the crawl, not placeholders

**Fail.** `/images/hero-placeholder.svg` rendering in the hero. The template
ships generic SVGs named `hero-placeholder` and `gallery-N`; any of them on
a client page is a fail, and this one is checkable by filename alone.

**Pass.** Every `<img>` resolves under `/images/crawl/`, and the files match
entries in `crawl/asset-manifest.json`.

**Could not be determined.** A section renders a CSS background with no
`<img>` and no manifest entry to compare against. Say so rather than
guessing — `null` is a real answer and this rubric has a place for it.

---

## DJ18 — does the signature resemble its direction's reference set?

**This is the question the references exist for**, and until D2 the judge was
asked it without ever being shown them. The reference screenshots are given
to you by absolute path; open them.

**Pass.** Direction `stark-display`, references `paulkalkbrenner.net` and
`bennettandclive.com`. The page's signature section runs the client's
sentence at viewport width in a heavy grotesk, monochrome, flush left,
bleeding toward the right edge. It is recognisably the same argument as the
references: the type is the image.

**Fail.** The same direction, and the signature is a centred sentence at
`t-h2` inside a rounded card with a soft shadow. It is a perfectly good
section and it belongs to a different site — closer to the default kit than
to the references.

**Fail, the subtler one.** Direction `cinematic-calm`, references Montfort
and Oryzo — light wide-tracked type over an enormous photograph. The page's
signature has the right type treatment and **no photograph**, because the
client's imagery was thin. It resembles the references in every respect
except the one they are actually about. The register is not the argument.

This is a **design note, not a hard fail** (§11, until the thresholds are
calibrated in §8.3). Report what you saw and let the operator decide.

---

## On "pass" meaning "no"

DJ3, DJ4, DJ5, DJ6, DJ7 and DJ15 are phrased as questions about an unwanted
trait. `pass: true` means the trait is **absent**. The phrasing is
deliberate — the rubric is written neutrally so that a question cannot lead
the answer — but it is the easiest thing in this file to get backwards, and
getting it backwards inverts a hard fail.
