/**
 * Turn the operator's labels into thresholds (D10 §8.3).
 *
 *     pnpm --filter @pipeline/orchestrator calibrate:report
 *
 * Reads `data/calibration/labels.json` — exported from the `/calibrate`
 * page — and reports, for each of the three thresholds, the value that
 * agrees with the labels best and how many pairs it still gets wrong.
 *
 * It does **not** edit the thresholds. §8.3 is a decision and this is the
 * evidence for it; a script that silently rewrote `distance.ts` would mean
 * nobody ever looked at the disagreements, and the disagreements are the
 * interesting part. A detector that cannot separate the labels at any
 * threshold is a broken detector, and no number fixes that
 * (design-rules §12).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { SIMILARITY_THRESHOLD } from "../src/design/visual.js";
import { THRESHOLDS } from "../src/design/distance.js";

const OUT = join(import.meta.dirname, "..", "..", "..", "data", "calibration");

interface Pair {
  a: string;
  b: string;
  structural: number;
  visualDesktop: number;
  visualMobile: number;
  sameDirection: boolean;
  shared: string[];
}

type Label = "alike" | "different";

const pairsPath = join(OUT, "pairs.json");
const labelsPath = join(OUT, "labels.json");

if (!existsSync(pairsPath)) {
  console.error(`no pairs yet — run \`pnpm --filter @pipeline/orchestrator calibrate\` first`);
  process.exit(1);
}
if (!existsSync(labelsPath)) {
  console.error(
    `no labels yet.\n\n` +
      `  1. pnpm --filter @pipeline/library dev\n` +
      `  2. open http://localhost:3106/calibrate\n` +
      `  3. label the pairs, then "Download labels.json" into data/calibration/\n`,
  );
  process.exit(1);
}

const { pairs } = JSON.parse(readFileSync(pairsPath, "utf8")) as { pairs: Pair[] };
const labels = JSON.parse(readFileSync(labelsPath, "utf8")) as Record<string, Label>;

const labelled = pairs
  .map((p) => ({ pair: p, label: labels[`${p.a}|${p.b}`] }))
  .filter((x): x is { pair: Pair; label: Label } => x.label !== undefined);

if (labelled.length === 0) {
  console.error("labels.json has no labels matching the current pairs.json");
  process.exit(1);
}

const alike = labelled.filter((x) => x.label === "alike");
const different = labelled.filter((x) => x.label === "different");

console.log(
  `${labelled.length} labelled — ${alike.length} alike, ${different.length} different\n`,
);

if (alike.length === 0 || different.length === 0) {
  console.log(
    "Every pair got the same label, so there is nothing to separate. Either\n" +
      "the sample missed the interesting band or the catalog really is that\n" +
      "uniform — regenerate with more draws before reading anything into it.",
  );
  process.exit(0);
}

/**
 * The cut that agrees with the labels most often.
 *
 * `below` says which side of the cut counts as "alike": the structural
 * distance is small when two sites look alike, the visual similarity is
 * large. Ties go to the stricter value — a threshold that rejects one extra
 * site costs a redraw, and a redraw is free.
 */
function bestCut(
  values: { value: number; label: Label }[],
  aliketIsBelow: boolean,
): { cut: number; wrong: number; total: number; misses: string[] } {
  const candidates = [...new Set(values.map((v) => v.value))].sort((a, b) => a - b);
  let best = { cut: candidates[0]!, wrong: Number.MAX_SAFE_INTEGER };

  for (const cut of candidates) {
    let wrong = 0;
    for (const { value, label } of values) {
      const predicted: Label = aliketIsBelow
        ? value < cut
          ? "alike"
          : "different"
        : value >= cut
          ? "alike"
          : "different";
      if (predicted !== label) wrong += 1;
    }
    if (wrong < best.wrong) best = { cut, wrong };
  }

  const misses: string[] = [];
  for (const { value, label } of values) {
    const predicted: Label = aliketIsBelow
      ? value < best.cut
        ? "alike"
        : "different"
      : value >= best.cut
        ? "alike"
        : "different";
    if (predicted !== label) misses.push(`${value} labelled ${label}`);
  }

  return { ...best, total: values.length, misses };
}

function report(
  name: string,
  current: number,
  values: { value: number; label: Label }[],
  alikeIsBelow: boolean,
): void {
  const { cut, wrong, total, misses } = bestCut(values, alikeIsBelow);
  const agree = (((total - wrong) / total) * 100).toFixed(0);

  console.log(`## ${name}`);
  console.log(`   current   ${current}`);
  console.log(`   best cut  ${cut}  (agrees with ${agree}% of labels, ${wrong}/${total} wrong)`);

  const aliketValues = values.filter((v) => v.label === "alike").map((v) => v.value);
  const diffValues = values.filter((v) => v.label === "different").map((v) => v.value);
  const span = (xs: number[]): string =>
    xs.length === 0 ? "—" : `${Math.min(...xs)} … ${Math.max(...xs)}`;
  console.log(`   alike     ${span(aliketValues)}`);
  console.log(`   different ${span(diffValues)}`);

  if (wrong > 0) {
    console.log(`   disagrees on: ${misses.join("; ")}`);
    console.log(
      `   → this metric ALONE cannot separate the labels. Check the gate\n` +
        `     section above before concluding anything: the three rules are a\n` +
        `     disjunction and they cover for each other.`,
    );
  }
  console.log();
}

/**
 * **The gate, as it actually runs.**
 *
 * This is the number that matters and the first version of this script did
 * not print it. It reported each metric alone, found that each one's alike
 * and different ranges overlap, and concluded three times over that "no
 * threshold separates these labels" — which read as a broken detector.
 *
 * The gate is not one metric. A candidate is rejected when the structural
 * distance is too small **or** either fold is too similar, so the three
 * rules cover for each other: a pair the structural check waves through can
 * still be caught on the mobile fold. Evaluated that way the deployed
 * thresholds agreed with the operator's first thirty labels 30/30, while
 * every single metric was reporting failure.
 *
 * The per-metric sections below are still worth reading — they say which
 * rule is carrying the decision — but they are diagnostics, not verdicts.
 */
function gate(S: number, Vd: number, Vm: number): { wrong: number; misses: string[] } {
  const misses: string[] = [];
  for (const { pair, label } of labelled) {
    const rejected =
      pair.structural < S || pair.visualDesktop >= Vd || pair.visualMobile >= Vm;
    const predicted: Label = rejected ? "alike" : "different";
    if (predicted !== label) {
      misses.push(
        `${pair.a}|${pair.b} (${label}; structural ${pair.structural}, ` +
          `desktop ${pair.visualDesktop.toFixed(3)}, mobile ${pair.visualMobile.toFixed(3)})`,
      );
    }
  }
  return { wrong: misses.length, misses };
}

const deployed = gate(THRESHOLDS.allSectors, SIMILARITY_THRESHOLD, SIMILARITY_THRESHOLD);
console.log("## the gate as deployed");
console.log(
  `   structural < ${THRESHOLDS.allSectors}  OR  either fold >= ${SIMILARITY_THRESHOLD}  →  reject`,
);
console.log(
  `   agrees with ${labelled.length - deployed.wrong}/${labelled.length} labels`,
);
for (const m of deployed.misses) console.log(`   miss: ${m}`);

/**
 * How much room is left before a label flips.
 *
 * A gate that agrees on every pair but trips one of them by 0.001 is not
 * calibrated, it is lucky — and the difference matters, because the next
 * client's render will not be pixel-identical to this fixture's.
 */
const alikePairs = alike.map((x) => x.pair);
const diffPairs = different.map((x) => x.pair);
const trip = Math.min(
  ...alikePairs.map((p) =>
    Math.max(
      THRESHOLDS.allSectors - p.structural,
      p.visualDesktop - SIMILARITY_THRESHOLD,
      p.visualMobile - SIMILARITY_THRESHOLD,
    ),
  ),
);
const nearestFalseReject = Math.min(
  Math.min(...diffPairs.map((p) => p.structural)) - THRESHOLDS.allSectors,
  SIMILARITY_THRESHOLD - Math.max(...diffPairs.map((p) => p.visualDesktop)),
  SIMILARITY_THRESHOLD - Math.max(...diffPairs.map((p) => p.visualMobile)),
);
console.log(`   margin before a false ACCEPT  ${trip.toFixed(4)}`);
console.log(`   margin before a false REJECT  ${nearestFalseReject.toFixed(4)}`);
if (trip < 0.01) {
  console.log(
    `   → one 'alike' pair is caught by ${trip.toFixed(4)}. That is luck, not
` +
      `     calibration; the next client's render will not be pixel-identical.`,
  );
}
console.log();

report(
  "structural distance (§8.1), alone",
  THRESHOLDS.allSectors,
  labelled.map((x) => ({ value: x.pair.structural, label: x.label })),
  true,
);

report(
  "visual similarity, desktop (§8.2), alone",
  SIMILARITY_THRESHOLD,
  labelled.map((x) => ({ value: x.pair.visualDesktop, label: x.label })),
  false,
);

report(
  "visual similarity, mobile (§8.2), alone",
  SIMILARITY_THRESHOLD,
  labelled.map((x) => ({ value: x.pair.visualMobile, label: x.label })),
  false,
);

/**
 * Which axes the operator's "alike" pairs share.
 *
 * More useful than the thresholds in one way: if every alike pair shares
 * `direction` and `heroArchetype`, those two weights are carrying the
 * judgement and the other eight are noise — which is a change to §8.1's
 * weights, not to its threshold.
 */
const shareCount: Record<string, number> = {};
for (const { pair } of alike) {
  for (const axis of pair.shared) shareCount[axis] = (shareCount[axis] ?? 0) + 1;
}
console.log("## what the 'alike' pairs have in common");
for (const [axis, n] of Object.entries(shareCount).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${axis.padEnd(16)} ${n}/${alike.length}`);
}
console.log(
  `\nAn axis at ${alike.length}/${alike.length} is doing the work. An axis near 0 is\n` +
    `weighted in §8.1 and earning nothing — worth moving weight toward the first.`,
);
