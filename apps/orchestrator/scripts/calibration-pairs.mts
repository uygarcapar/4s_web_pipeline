/**
 * Build the pairs the operator labels in §8.3.
 *
 *     pnpm --filter @pipeline/orchestrator calibrate
 *
 * Renders candidate specs from the live catalog, screenshots both folds,
 * embeds them, computes both distances for every pair, and writes a
 * stratified sample to `data/calibration/`. The `/calibrate` page in
 * `apps/library` is what the operator clicks through.
 *
 * **Stratified, not random.** 7 directions × 2 draws is 91 pairs and most of
 * them are obviously different — labelling those teaches the thresholds
 * nothing. The sample is spread evenly across the structural-distance range
 * so the operator spends their hour on the pairs that actually discriminate,
 * which is the band between "clearly the same" and "clearly not".
 *
 * Everything is local: the renders, the screenshots and the embeddings all
 * stay on this machine (§13 Q4).
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DIRECTIONS, DIRECTION_IDS } from "../src/design/directions/index.js";
import { sampleSpec } from "../src/design/sample-spec.js";
import { composeArchetypes } from "../src/design/compose.js";
import { prerenderConfig } from "../src/design/prerender.js";
import { shootCandidate } from "../src/design/shots.js";
import { cosine, embedImage } from "../src/design/embed.js";
import { sharedAxes, specAxes, specDistance } from "../src/design/distance.js";
import type { DesignSpec, Facts } from "@pipeline/core";

const REPO = join(import.meta.dirname, "..", "..", "..");
const OUT = join(REPO, "data", "calibration");
const SHOTS = join(OUT, "shots");

/** Draws per direction. Two is enough to include within-direction pairs. */
const DRAWS = 2;

/** §8.3 asks for about thirty. */
const SAMPLE = 30;

/**
 * One fixture for every candidate, so the ONLY difference between two
 * screenshots is the design. A pair that also differs in its words and its
 * photographs would be labelled on those, and the thresholds would be
 * calibrated against the wrong thing.
 */
const facts: Facts = {
  businessName: "Moda Diş Kliniği",
  legalName: null,
  phoneE164: "+905321234567",
  whatsappE164: null,
  email: "bilgi@modadis.com.tr",
  address: "Caferağa Mah. Moda Cad. No: 44",
  district: "Kadıköy",
  city: "İstanbul",
  mapsEmbedQuery: "Moda Diş Kliniği Kadıköy",
  openingHours: [
    { day: 1, opens: "09:00", closes: "18:00" },
    { day: 6, opens: "10:00", closes: "15:00" },
  ],
  hoursNote: null,
  services: ["İmplant", "Ortodonti", "Zirkonyum", "Diş Beyazlatma", "Çocuk Diş Hekimliği"],
  prices: [],
  socialLinks: [],
  sources: {},
};

const content = {
  pages: [
    {
      slug: "/",
      title: "Moda Diş Kliniği",
      h1: "Kadıköy'de güvenle gülümseyin",
      contentBlocks: [
        { tag: "h1", text: "Kadıköy'de güvenle gülümseyin" },
        {
          tag: "p",
          text:
            "Moda Diş Kliniği'nde implant, ortodonti ve estetik diş hekimliği " +
            "uygulamaları deneyimli ekibimizle yapılır. Yirmi yıldır aynı sokaktayız.",
        },
      ],
    },
    { slug: "/ekip/dt-ayse-kaya", h1: "Dt. Ayşe Kaya", contentBlocks: [] },
    { slug: "/ekip/dt-mehmet-demir", h1: "Dt. Mehmet Demir", contentBlocks: [] },
    ...["implant", "ortodonti", "zirkonyum", "beyazlatma"].map((s) => ({
      slug: `/hizmetler/${s}`,
      title: s,
      contentBlocks: Array.from({ length: 10 }, (_, i) => ({ tag: "p", text: `blok ${i}` })),
    })),
  ],
  faq: [
    { question: "Randevu nasıl alınır?", answer: "Telefonla ulaşabilirsiniz." },
    { question: "Anlaşmalı kurum var mı?", answer: "Lütfen arayınız." },
  ],
  headings: [{ text: "Kadıköy'de güvenle gülümseyin", level: 1 }],
  services: facts.services.map((name) => ({ name })),
};

const SECTIONS = ["hero", "statement", "services", "team", "visit", "faq", "contact"];

interface Candidate {
  id: string;
  spec: DesignSpec;
  desktop: string;
  mobile: string;
  vectors: { desktop: Float32Array; mobile: Float32Array };
}

/**
 * Clear the renders, NOT the labels.
 *
 * The first version removed the whole directory, which silently destroyed
 * `labels.json` — an hour of the operator's judgement — the first time the
 * pairs were regenerated after a catalog change. Regenerating is exactly
 * when you most want the old labels: they are what tells you whether the
 * change did what it was supposed to.
 *
 * Labels key on `<a>|<b>`, so they survive a regeneration and simply stop
 * matching for any pair that is no longer sampled. `calibrate:report`
 * already ignores labels with no matching pair.
 */
rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });

if (existsSync(join(OUT, "labels.json"))) {
  console.log("keeping the existing labels.json — pairs are keyed by name\n");
}

const candidates: Candidate[] = [];
let port = 3200;

for (const id of DIRECTION_IDS) {
  const direction = DIRECTIONS[id]!;
  for (let draw = 0; draw < DRAWS; draw += 1) {
    const spec: DesignSpec = {
      ...sampleSpec(direction, "calibration.com", draw),
      sections: composeArchetypes({
        direction,
        sections: SECTIONS,
        seed: `calibration.com-${draw}`,
        recentUsage: {},
      }).map(({ type, archetype }) => ({ type, archetype })),
    };
    const label = `${id}-${draw}`;
    process.stdout.write(`rendering ${label} … `);
    const shots = await shootCandidate({
      repoRoot: REPO,
      outDir: join(SHOTS, label),
      spec,
      config: prerenderConfig({ facts, content, spec, images: [] }),
      port: port++,
    });
    const vectors = {
      desktop: await embedImage(shots.desktop),
      mobile: await embedImage(shots.mobile),
    };
    candidates.push({ id: label, spec, desktop: shots.desktop, mobile: shots.mobile, vectors });
    console.log("done");
  }
}

interface Pair {
  a: string;
  b: string;
  structural: number;
  visualDesktop: number;
  visualMobile: number;
  sameDirection: boolean;
  shared: string[];
  shots: { aDesktop: string; bDesktop: string; aMobile: string; bMobile: string };
}

const all: Pair[] = [];
for (let i = 0; i < candidates.length; i += 1) {
  for (let j = i + 1; j < candidates.length; j += 1) {
    const a = candidates[i]!;
    const b = candidates[j]!;
    const axesA = specAxes(a.spec);
    const axesB = specAxes(b.spec);
    all.push({
      a: a.id,
      b: b.id,
      structural: specDistance(axesA, axesB),
      visualDesktop: cosine(a.vectors.desktop, b.vectors.desktop),
      visualMobile: cosine(a.vectors.mobile, b.vectors.mobile),
      sameDirection: a.spec.direction === b.spec.direction,
      shared: sharedAxes(axesA, axesB),
      shots: {
        // Relative to data/calibration, so the library can serve them.
        aDesktop: `shots/${a.id}/desktop.png`,
        bDesktop: `shots/${b.id}/desktop.png`,
        aMobile: `shots/${a.id}/mobile.png`,
        bMobile: `shots/${b.id}/mobile.png`,
      },
    });
  }
}

/**
 * Spread the sample across the structural range.
 *
 * Sorting by distance and taking every Nth gives an even spread without
 * needing to guess where the interesting band is — which is the thing §8.3
 * is trying to discover, so guessing it here would be assuming the answer.
 */
all.sort((x, y) => x.structural - y.structural);
const step = Math.max(1, Math.floor(all.length / SAMPLE));
const sample = all.filter((_, i) => i % step === 0).slice(0, SAMPLE);

writeFileSync(
  join(OUT, "pairs.json"),
  JSON.stringify(
    {
      generatedFrom: {
        directions: DIRECTION_IDS,
        draws: DRAWS,
        candidates: candidates.length,
        pairsConsidered: all.length,
      },
      pairs: sample,
    },
    null,
    2,
  ) + "\n",
);

console.log(
  `\n${candidates.length} candidates, ${all.length} pairs, ${sample.length} sampled ` +
    `(structural ${sample[0]!.structural} … ${sample[sample.length - 1]!.structural})`,
);
console.log(`→ ${join(OUT, "pairs.json")}`);
console.log("\nNow label them: pnpm --filter @pipeline/library dev, then /calibrate");
