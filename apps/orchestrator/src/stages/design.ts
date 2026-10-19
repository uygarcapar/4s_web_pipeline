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
    const sections = sectionsFromFacts(inventory);
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

