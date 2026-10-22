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
      `   → the ranges overlap, so NO threshold separates these labels.\n` +
        `     That is a detector problem, not a number problem (design-rules §12).`,
    );
  }
  console.log();
}

report(
  "structural distance (§8.1)",
  THRESHOLDS.allSectors,
  labelled.map((x) => ({ value: x.pair.structural, label: x.label })),
  true,
);

report(
  "visual similarity, desktop (§8.2)",
  SIMILARITY_THRESHOLD,
  labelled.map((x) => ({ value: x.pair.visualDesktop, label: x.label })),
  false,
);

report(
  "visual similarity, mobile (§8.2)",
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
