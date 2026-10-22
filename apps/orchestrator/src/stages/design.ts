import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageModule } from "./types.js";
import { derivePalette } from "../design/palette.js";
import { readManifest, samplePhotographs } from "../design/sample.js";
import { composeDna } from "../design/dna.js";
import { recentDesigns, recordDesign, sectionsFromFacts } from "../design/ledger.js";
import { takeInventory } from "../design/inventory.js";
import { foldForMatch } from "../design/fold.js";
import { designSpecSchema } from "@pipeline/core";
import { DIRECTIONS, DIRECTION_IDS } from "../design/directions/index.js";
import { recentDirectionUsage } from "../design/ledger.js";
import { photoQualityFrom, rankDirections } from "../design/score.js";
import { pickArchetypes, sampleSpec } from "../design/sample-spec.js";
import { renderSpecTokens } from "../design/spec-tokens.js";
import { assertVendored, planLocalFonts } from "../design/local-fonts.js";

/**
 * Choose this site's design before any copy or markup exists.
 *
 * Deterministic and model-free throughout. Two decisions are made here and
 * nothing downstream may revisit either (D10 §5):
 *
 *  - **Which direction.** Scored from the brief's four classifications and
 *    the measured photographs, minus a penalty for every recent run that
 *    already used it (§6.2). The direction fixes the type pairing, the
 *    colour mode, the motion vocabulary and the archetype shortlist.
 *  - **Which spec.** Sampled from that direction's declared ranges with a
 *    seed derived from the domain (§6.3), so the same client always gets the
 *    same site and two clients on the same direction do not.
 *
 * The palette's HUE still comes from the client's own photographs (§13 Q3),
 * and which sections exist is still a function of which facts exist (D6) —
 * the direction decides how a page looks, never what is on it.
 *
 * The DNA composed below is now only the fingerprint ledger and the palette;
 * its typography and motion no longer reach the site. It is kept because the
 * ledger is what makes "no two neighbours get the same site" checkable, and
 * is written to `dna.json` for anything still reading it.
 *
 * Output:
 *   runs/<domain>/design/design.json  — the DesignSpec, read by plan,
 *                                       generate and the design judge
 *   runs/<domain>/design/dna.json     — the fingerprint and palette
 *   runs/<domain>/design/tokens.css   — generated from the spec
 *   runs/<domain>/design/fonts.ts     — generated from the spec
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
      // D10 §6.1 — the four scales the direction scorer reads.
      tone?: unknown;
      tier?: unknown;
      audience?: unknown;
      contentVolume?: unknown;
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

    // 4. Direction, scored (§6.2).
    const scoringBrief = {
      tone: asEnum(brief?.tone, "clinical"),
      tier: asEnum(brief?.tier, "mid"),
      audience: asEnum(brief?.audience, "local-everyday"),
      contentVolume: asEnum(brief?.contentVolume, "standard"),
      photoProfile: {
        usableCount: sources.length,
        quality: photoQualityFrom(sources.length, largePhotoCount(manifest)),
      },
    };
    const usage = recentDirectionUsage(ctx.store);
    const ranked = rankDirections(
      DIRECTION_IDS.map((id) => DIRECTIONS[id]!),
      scoringBrief,
      usage,
    );
    const winner = ranked[0]!;
    const direction = DIRECTIONS[winner.id]!;
    ctx.log(
      `direction ${winner.id} (score ${winner.score}): ${winner.reason}`,
      {
        direction: winner.id,
        brief: scoringBrief,
        runnersUp: ranked.slice(1).map((r) => `${r.id} ${r.score}`),
        recentUsage: usage,
      },
    );

    // 5. Spec, sampled from that direction's ranges (§6.3), then overridden
    //    on the two axes that belong to the client rather than the direction.
    const sampled = sampleSpec(direction, ctx.domain, 0);
    const spec = designSpecSchema.parse({
      ...sampled,
      color: {
        ...sampled.color,
        brandH: palette.hue,
        brandC: brandChroma(palette.chroma, direction.color.maxChroma),
      },
      sections: pickArchetypes(direction, sections, ctx.domain),
      // §9 (the signature section) and §6.4 (compose) are D-phase work. Until
      // they land, the bold element is the hero and the concept names the
      // direction's own argument, so the plan stage has something true to
      // read rather than a placeholder that reads as a decision.
      signature: { sectionIndex: 0, concept: `${winner.id} hero` },
      rejected: ranked.slice(1).map((r) => ({
        direction: r.id,
        reason: r.reason,
        // No visual-distance metric exists yet (C4); this is the score gap,
        // which is a distance in the only space currently measured.
        distance: Number((winner.score - r.score).toFixed(3)),
      })),
    });

    recordDesign(ctx.store, {
      domain: ctx.domain,
      sector,
      dna,
      direction: spec.direction,
    });

    // 6. Generate the stylesheet and the font module. Both derived — the
    //    model never writes a token value (§5).
    const fonts = planLocalFonts(spec);
    assertVendored(fonts, ctx.repoRoot);
    const tokens = renderSpecTokens(spec);

    const outDir = join(ctx.runDir, "design");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "tokens.css"), tokens);
    writeFileSync(join(outDir, "fonts.ts"), fonts.module);
    writeFileSync(
      join(outDir, "dna.json"),
      JSON.stringify({ sector, sections, ...dna }, null, 2) + "\n",
    );
    // design.json last: it is this stage's idempotency artifact, so it must
    // not exist until everything beside it does.
    writeFileSync(join(outDir, "design.json"), JSON.stringify(spec, null, 2) + "\n");

    ctx.log(
      `spec: ${spec.type.display}/${spec.type.body} at ${spec.type.displayWeight}, ` +
        `${spec.color.mode}/${spec.color.strategy}, ${spec.motion.profile}`,
      { seed: spec.seed, faces: fonts.faces.map((f) => f.family) },
    );

    return {
      ok: true,
      data: {
        direction: spec.direction,
        seed: spec.seed,
        paletteName: palette.name,
        typePair: `${spec.type.display}/${spec.type.body}`,
        density: spec.grid.density,
        fingerprint: dna.fingerprint,
        sections: sections.length,
      },
    };
  },
};

/** A brief enum, or the least opinionated value if the brief predates D10. */
function asEnum(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/** Images large enough to have come from a camera rather than a theme. */
function largePhotoCount(manifest: { width?: number; height?: number }[]): number {
  return manifest.filter((m) => (m.width ?? 0) * (m.height ?? 0) > 1_000_000).length;
}

/**
 * The client's photographs decide how colourful the accent is; the direction
 * decides how colourful it is *allowed* to be.
 *
 * These are two different units and conflating them is how a site comes out
 * grey: `palette.chroma` is HSL-ish saturation on 0–1, `brandC` is OKLCH
 * chroma on 0–0.4, where 0.14 is already vivid. So the saturation is used as
 * a FRACTION of the direction's ceiling, never as a chroma value.
 *
 * The 0.4 floor is deliberate. A client whose photographs are all grey
 * interiors would otherwise get a colourless accent, and the accent is what
 * marks the one call to action on the page — the direction's ceiling is
 * already the cap on loudness, so there is nothing to protect by going
 * quieter than this.
 */
export function brandChroma(saturation: number, maxChroma: number): number {
  const fraction = Math.min(1, Math.max(0.4, saturation / 0.5));
  return Number((maxChroma * fraction).toFixed(3));
}

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

