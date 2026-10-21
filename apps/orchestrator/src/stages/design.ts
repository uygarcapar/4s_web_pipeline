import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageModule } from "./types.js";
import { derivePalette } from "../design/palette.js";
import { readManifest, samplePhotographs } from "../design/sample.js";
import { composeDna } from "../design/dna.js";
import { recentDesigns, recordDesign, sectionsFromFacts } from "../design/ledger.js";
import { takeInventory } from "../design/inventory.js";
import { foldForMatch } from "../design/fold.js";
import { renderTokens } from "../design/tokens.js";
import { renderFonts } from "../design/fonts.js";

/**
 * Derive the site's design DNA before any copy or markup exists.
 *
 * This stage is deliberately deterministic and model-free. The palette comes
 * from the client's own photographs, the structure from which facts actually
 * exist, the typography from their sector — and the combination is
 * fingerprinted against recent runs so two businesses in the same trade
 * cannot be handed the same site (docs/DECISIONS.md D6).
 *
 * Output:
 *   runs/<domain>/design/design.json  — the DNA, read by plan and generate
 *   runs/<domain>/design/tokens.css   — copied into the generated site
 */
export const designStage: StageModule = {
  stage: "design",
  artifactPath: (ctx) => join(ctx.runDir, "design", "design.json"),

  async run(ctx) {
    const facts = readJson<Record<string, unknown>>(join(ctx.runDir, "audit", "facts.json"));
    if (!facts) {
      return { ok: false, error: "audit/facts.json missing — run the audit stage first" };
    }

    const sector = detectSector(facts, ctx.runDir);

    // 1. Colour, from their own photographs.
    const manifest = readManifest(ctx.runDir);
    const sources = await samplePhotographs({ runDir: ctx.runDir, manifest });
    const palette = derivePalette(sources);
    ctx.log(
      sources.length
        ? `palette derived from ${sources.length} photographs: ${palette.name} (hue ${palette.hue})`
        : "no usable photographs — falling back to the warm neutral family",
      { paletteName: palette.name, hue: palette.hue, chroma: palette.chroma },
    );

    // 2. Structure, from what the crawl actually found.
    const content = readJson<{ pages?: unknown; faq?: unknown }>(
      join(ctx.runDir, "crawl", "content.json"),
    );
    const inventory = takeInventory({ content, facts, usablePhotos: sources.length });

    // The brief is advisory on ORDER, and decides one thing outright: whether
    // the sentence the crawl found is really the business speaking about
    // itself. That is a judgement no regex makes well — the heuristic picked
    // a treatment description on the first run — so the statement section
    // exists only when the brief vouched for the sentence (D9). Everything
    // else about which sections exist stays a function of which facts exist
    // (D6). Absent or malformed, the fact-derived set and order stand.
    const brief = readJson<{
      emphasis?: unknown;
      statementUsable?: unknown;
      evidence?: { statementCandidate?: unknown };
    }>(join(ctx.runDir, "brief", "brief.json"));

    const hasStatement =
      brief?.statementUsable === true &&
      typeof brief.evidence?.statementCandidate === "string";
    let sections = sectionsFromFacts({ ...inventory, hasStatement });
    const emphasis = Array.isArray(brief?.emphasis)
      ? brief.emphasis.filter((e): e is string => typeof e === "string")
      : [];
    if (emphasis.length > 0) {
      const reordered = orderByEmphasis(sections, emphasis);
      if (reordered.join() !== sections.join()) {
        ctx.log(`brief reordered sections: ${sections.join(" → ")} ⇒ ${reordered.join(" → ")}`);
        sections = reordered;
      }
    }
    ctx.log(
      `inventory: ${inventory.services.length} services, ${inventory.team.length} people, ` +
        `${inventory.faq} FAQ, ${inventory.contentBlocks} content blocks → ${sections.length} sections`,
      { sections },
    );

    // 3. Typography, motion and layout — re-rolled until the fingerprint is
    //    unlike every recent run in this sector.
    const recent = recentDesigns(ctx.store, sector);
    const dna = composeDna({
      domain: ctx.domain,
      sector,
      palette,
      contentBlocks: inventory.contentBlocks,
      sections,
      recent,
    });

    for (const r of dna.rejected) {
      ctx.log(`rejected fingerprint ${r.fingerprint}: ${r.reason}`);
    }
    ctx.log(
      `design fingerprint ${dna.fingerprint} — ${dna.typePair.id}, ${dna.density}, ` +
        `handoff:${dna.motion.handoff} text:${dna.motion.textTransform}`,
      { fingerprint: dna.fingerprint, sector, recentInSector: recent.length },
    );

    recordDesign(ctx.store, { domain: ctx.domain, sector, dna });

    const outDir = join(ctx.runDir, "design");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, "design.json"),
      JSON.stringify({ sector, sections, ...dna }, null, 2) + "\n",
    );
    writeFileSync(join(outDir, "tokens.css"), renderTokens(dna));
    writeFileSync(join(outDir, "fonts.ts"), renderFonts(dna));

    return {
      ok: true,
      data: {
        paletteName: palette.name,
        typePair: dna.typePair.id,
        density: dna.density,
        fingerprint: dna.fingerprint,
        sections: sections.length,
      },
    };
  },
};

/**
 * Reorder the fact-derived sections by the brief's emphasis.
 *
 * Emphasis is a PARTIAL preference, not a complete ordering: it reshuffles
 * only the sections it names, and every other section keeps the slot the
 * facts gave it. Treating unnamed sections as "least important" and sorting
 * them to the end pushed `statement` and `visit` below `contact` on the first
 * run, simply because the brief had not used those words.
 *
 * Concretely: collect the positions the named sections occupy, then refill
 * exactly those positions in emphasis order. The hero is never named and so
 * never moves. Emphasis entries matching no section are ignored rather than
 * treated as an instruction to invent one.
 */
export function orderByEmphasis<T extends string>(
  sections: T[],
  emphasis: string[],
): T[] {
  // Section ids are ASCII identifiers, so the locale fold is en-US; tr-TR
  // would map the "I" in a future id to a dotless ı and stop it matching.
  const fold = (s: string): string => s.toLocaleLowerCase("en-US");
  const rank = new Map<T, number>();
  emphasis.forEach((name, i) => {
    const match = sections.find((s) => s === name || fold(name).includes(fold(s)));
    if (match !== undefined && !rank.has(match)) rank.set(match, i);
  });
  if (rank.size === 0) return sections;

  // The slots the named sections currently occupy, in page order.
  const slots: number[] = [];
  sections.forEach((s, i) => {
    if (rank.has(s) && (s as string) !== "hero") slots.push(i);
  });
  if (slots.length < 2) return sections;

  const named = slots
    .map((i) => sections[i]!)
    .sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));

  const out = [...sections];
  slots.forEach((slot, i) => {
    out[slot] = named[i]!;
  });
  return out;
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Which trade this is. The sector drives the type pairing and scopes the
 * fingerprint ledger, so it only has to be as precise as those two decisions
 * need — "dentist" vs "barber", not a taxonomy.
 */
export function detectSector(facts: Record<string, unknown>, runDir: string): string {
  const explicit = typeof facts.sector === "string" ? facts.sector : null;
  if (explicit) return explicit;

  // JSON-LD on the old site is the most reliable signal we have.
  const schemaType = typeof facts.schemaType === "string" ? foldForMatch(facts.schemaType) : "";
  const bySchema: Record<string, string> = {
    dentist: "dentist",
    physician: "doctor",
    medicalclinic: "doctor",
    veterinarycare: "vet",
    hairsalon: "salon",
    beautysalon: "salon",
    healthandbeautybusiness: "salon",
    restaurant: "restaurant",
    cafeorcoffeeshop: "cafe",
    bakery: "bakery",
    healthclub: "gym",
    hotel: "hotel",
    realestateagent: "realestate",
    legalservice: "lawyer",
    attorney: "lawyer",
  };
  if (bySchema[schemaType]) return bySchema[schemaType];

  // Otherwise look at what the business calls itself.
  const name = foldForMatch([facts.businessName, facts.legalName].filter((v) => typeof v === "string").join(" "));
  const pages = readJson<unknown>(join(runDir, "crawl", "pages.json"));
  const haystack = foldForMatch(`${name} ${JSON.stringify(pages ?? "").slice(0, 20_000)}`);

  const byWord: [string, string][] = [
    ["dis", "dentist"],
    ["dent", "dentist"],
    ["ortodonti", "dentist"],
    ["veteriner", "vet"],
    ["kuafor", "salon"],
    ["guzellik", "salon"],
    ["berber", "barber"],
    ["restoran", "restaurant"],
    ["lokanta", "restaurant"],
    ["kebap", "restaurant"],
    ["kafe", "cafe"],
    ["pastane", "bakery"],
    ["firin", "bakery"],
    ["spor salonu", "gym"],
    ["fitness", "gym"],
    ["otel", "hotel"],
    ["emlak", "realestate"],
    ["avukat", "lawyer"],
    ["hukuk", "lawyer"],
  ];
  for (const [word, sector] of byWord) if (haystack.includes(word)) return sector;
  return "general";
}

