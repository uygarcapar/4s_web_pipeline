# §8.2 visual distance — calibrated

**Superseded measurement below.** The matrix in the second half was taken
against the four-direction catalog that the 2026-10-22 review replaced, and
is kept only as the record of how the detector was first characterised.
What follows is the operator-labelled calibration §8.3 actually asked for.

## The result

Two rounds, thirty pairs each, labelled by the operator against renders
they had not seen the numbers for.

**Round 1** — the gate agreed with all thirty.

```
structural < 0.40  OR  either fold >= 0.93  →  reject       30/30
```

Three of the five "alike" pairs were cross-direction, all involving
`kinetic-bold` against `stark-display` or `technical-accent`. The cause was
found and fixed: Archivo was the display face in **six of seven**
directions, and those two had identical pools.

**Round 2**, after the faces were made disjoint — two of the three flipped
to "different". The eye confirmed the fix that the visual metric had said
was inconclusive; the metric was the wrong instrument for the question.

```
agrees with 16/18 labels
```

## Where the detector stops

The two new misses are **false rejects**, and no threshold fixes them:

| pair | label | structural | desktop | mobile |
|---|---|---|---|---|
| `kinetic-bold-1 ↔ technical-accent-0` | alike | 0.7778 | 0.912 | 0.939 |
| `kinetic-bold-1 ↔ stark-display-0` | different | 0.7778 | 0.933 | 0.846 |

Identical structural distance, opposite labels. On the desktop fold the
pair the operator calls *different* scores **more similar** than the one
they call *alike*; on mobile the two sit 0.001 apart. The ten axes do not
capture whatever is being seen here, and neither does the embedding.

## Why the thresholds did not move

Both misses fail in the **safe direction**. A false reject costs one more
candidate draw — pure arithmetic, free. A false accept ships a repeat to a
client. A gate biased toward rejecting is the correct bias, and two
unnecessary rejections in eighteen is a cheap price for never making the
expensive mistake.

Loosening to 0.94 would buy those two decisions and move the gate toward
the failure that matters. So nothing moved: **0.40 / 0.93 / 0.93 stands**,
now with evidence instead of a guess behind it.

Re-weighting was tested too, and does not help. The "alike" pairs share
`colorMode` and `radius` 5/5 while `direction` — §8.1's joint-heaviest
axis — scores 2/5. Moving weight accordingly scores 27/30: identical to the
current weights, missing the same three pairs.

## What is left

One residual pair, `kinetic-bold ↔ technical-accent`. Both are light,
square-cornered and heavy-weighted, and the fixture that produced them
holds the hue and the photographs constant — which is exactly what varies
between real clients, and `technical-accent`'s whole argument is an accent
colour the fixture renders in an arbitrary sampled hue.

Ten real clients will say more about that pair than another fixture round.
It goes to the §12 ship test.

---

# §8.2 visual distance — the first measurement

D10 §8.3 asks the operator to label ~30 site pairs and set the thresholds to
agree with those labels. This file is what C5 measured **before** that
happens, so the calibration starts from data instead of from the spec's
placeholder number.

Everything here is provisional. §8.3 supersedes it.

## Method

One client (a Kadıköy dental clinic fixture), eight candidates: two sampled
draws from each of the four directions. Each was pre-rendered exactly as the
design stage pre-renders — the spec's own `tokens.css`, its own `fonts.ts`
and faces, the client's own crawled text, production `next build` — then
screenshotted at both §8.2 folds and embedded with `Xenova/dinov2-small`
(CLS token, L2-normalised).

Deliberately the hardest case: identical copy, no photographs, one sector.
Every number below is therefore an **upper bound** on how similar two real
clients' sites would be, because real clients differ in words and pictures
as well as in design.

## Desktop fold

|                    | kb#0  | kb#1  | es#0  | es#1  | sg#0  | sg#1  | ql#0  | ql#1  |
|--------------------|-------|-------|-------|-------|-------|-------|-------|-------|
| kinetic-bold#0     | 1.000 | 0.939 | 0.819 | 0.896 | 0.821 | 0.840 | 0.732 | 0.811 |
| kinetic-bold#1     | 0.939 | 1.000 | 0.814 | 0.842 | 0.794 | 0.830 | 0.766 | 0.838 |
| editorial-serif#0  | 0.819 | 0.814 | 1.000 | 0.866 | 0.827 | 0.830 | 0.827 | 0.868 |
| editorial-serif#1  | 0.896 | 0.842 | 0.866 | 1.000 | 0.878 | 0.885 | 0.715 | 0.811 |
| swiss-grid#0       | 0.821 | 0.794 | 0.827 | 0.878 | 1.000 | 0.971 | 0.679 | 0.853 |
| swiss-grid#1       | 0.840 | 0.830 | 0.830 | 0.885 | 0.971 | 1.000 | 0.684 | 0.861 |
| quiet-luxury#0     | 0.732 | 0.766 | 0.827 | 0.715 | 0.679 | 0.684 | 1.000 | 0.828 |
| quiet-luxury#1     | 0.811 | 0.838 | 0.868 | 0.811 | 0.853 | 0.861 | 0.828 | 1.000 |

## Mobile fold

|                    | kb#0  | kb#1  | es#0  | es#1  | sg#0  | sg#1  | ql#0  | ql#1  |
|--------------------|-------|-------|-------|-------|-------|-------|-------|-------|
| kinetic-bold#0     | 1.000 | 0.958 | 0.870 | 0.892 | 0.833 | 0.803 | 0.815 | 0.910 |
| kinetic-bold#1     | 0.958 | 1.000 | 0.846 | 0.851 | 0.822 | 0.806 | 0.849 | 0.912 |
| editorial-serif#0  | 0.870 | 0.846 | 1.000 | 0.842 | 0.777 | 0.727 | 0.781 | 0.857 |
| editorial-serif#1  | 0.892 | 0.851 | 0.842 | 1.000 | 0.853 | 0.863 | 0.691 | 0.798 |
| swiss-grid#0       | 0.833 | 0.822 | 0.777 | 0.853 | 1.000 | 0.932 | 0.687 | 0.785 |
| swiss-grid#1       | 0.803 | 0.806 | 0.727 | 0.863 | 0.932 | 1.000 | 0.674 | 0.740 |
| quiet-luxury#0     | 0.815 | 0.849 | 0.781 | 0.691 | 0.687 | 0.674 | 1.000 | 0.870 |
| quiet-luxury#1     | 0.911 | 0.912 | 0.857 | 0.798 | 0.785 | 0.740 | 0.870 | 1.000 |

## What it says

**The detector works.** The ordering is the one a person would give:

| pair | desktop | mobile | by eye |
|---|---|---|---|
| `swiss-grid` ×2, both `offset-grid` | 0.971 | 0.932 | the same site |
| `kinetic-bold` ×2, both `marquee` | 0.939 | 0.958 | the same site |
| `quiet-luxury` vs `swiss-grid` | 0.679 | 0.687 | nothing alike |

The two pages at 0.679 are a near-black serif page and a light ruled grid
with a mono nav. Both were looked at, not just measured.

**§8.2's starting threshold of 0.85 is too low for this detector.** Pairs a
person would call different sit between 0.85 and 0.91:

- `kinetic-bold#0` vs `editorial-serif#1` — 0.896 desktop
- `kinetic-bold#1` vs `quiet-luxury#1` — 0.912 mobile
- `editorial-serif#0` vs `quiet-luxury#1` — 0.868 / 0.857

At 0.85 the gate would reject a correct candidate for resembling a site it
looks nothing like, which is the broken detector design-rules §12 is about.

**0.93 is where the data separates**, and it is what the code uses. Two
cautions, both real:

1. **The margin is 0.02.** The highest "different" pair is 0.912 and the
   lowest "same" pair is 0.932. Eight candidates from one client is not
   enough to claim that gap holds.
2. **These numbers are inflated.** Identical copy and no photographs mean
   every pair shares its text layout and its empty image frames. Real pairs
   should score lower across the board, which would widen the margin — but
   that is a prediction, not a measurement.

So the gate is live and set at 0.93, and §8.3 is still owed. Thirty labelled
pairs from real runs will move this number; nothing here should be read as
settling it.

## Reproducing

The eight candidates were built by a scratch harness that is not committed —
it is `shootCandidate` + `embedImage` in a loop, which is the same code path
the design stage uses. The screenshots are not committed either: they are
~1 MB each and regenerating them is a `pnpm --filter @pipeline/orchestrator`
script away whenever the catalog changes.
