import { createHash } from "node:crypto";
import type { Palette } from "./palette.js";

/**
 * The site's DNA: everything that decides how a generated site *looks* before
 * a single word of its copy is written (design-rules.md §10).
 *
 * Every field here is derived from the client — their photographs, their
 * sector, how much they had to say — and the combination is fingerprinted so
 * two businesses in the same sector cannot be handed the same site.
 */

export interface TypePair {
  id: string;
  /** next/font/google export names. */
  display: string;
  body: string;
  /** Weight the display face needs to read as display (design-rules.md §4). */
  displayWeight: 700 | 800 | 900;
  /** What this pairing feels like; used to match it to a sector. */
  temperament: Temperament;
}

export type Temperament = "clinical" | "warm" | "sharp" | "crafted" | "quiet";

export type Density = "poster" | "standard" | "editorial";

/**
 * Curated pairings. Not a free choice: a model picking fonts per site lands on
 * the same two every time, and exotic faces break Turkish. Every face here is
 * variable, on Google Fonts, and carries latin-ext.
 *
 * No Inter and no Roboto. docs/PLAN.md lists them as a hard ban unless the
 * client's own brand uses the face, because they are the default every
 * generated page reaches for and are the single clearest tell that a site was
 * not designed for its owner. Four of these six pairings used Inter as the
 * body face, so most clients were getting it.
 */
export const TYPE_PAIRS: TypePair[] = [
  { id: "grotesk-tight", display: "Archivo", body: "Public_Sans", displayWeight: 800, temperament: "clinical" },
  { id: "grotesk-wide", display: "Schibsted_Grotesk", body: "Karla", displayWeight: 800, temperament: "sharp" },
  { id: "humanist", display: "Figtree", body: "Source_Sans_3", displayWeight: 800, temperament: "warm" },
  { id: "editorial-serif", display: "Fraunces", body: "Work_Sans", displayWeight: 700, temperament: "crafted" },
  { id: "neo-grotesk", display: "Manrope", body: "IBM_Plex_Sans", displayWeight: 800, temperament: "quiet" },
  { id: "display-contrast", display: "Bricolage_Grotesque", body: "Plus_Jakarta_Sans", displayWeight: 800, temperament: "crafted" },
];

/** Which temperament a sector wants, in preference order. */
const SECTOR_TEMPERAMENT: Record<string, Temperament[]> = {
  dentist: ["clinical", "quiet", "warm"],
  doctor: ["clinical", "quiet", "warm"],
  vet: ["warm", "clinical", "quiet"],
  lawyer: ["quiet", "clinical", "sharp"],
  restaurant: ["warm", "crafted", "sharp"],
  cafe: ["crafted", "warm", "quiet"],
  bakery: ["crafted", "warm", "quiet"],
  barber: ["sharp", "crafted", "clinical"],
  salon: ["crafted", "warm", "sharp"],
  gym: ["sharp", "clinical", "quiet"],
  hotel: ["quiet", "crafted", "warm"],
  realestate: ["quiet", "clinical", "sharp"],
};

const DEFAULT_TEMPERAMENT: Temperament[] = ["quiet", "clinical", "warm"];

/**
 * Section archetypes. The template ships several layouts per section type and
 * the DNA picks one, so the structure varies along with the colour
 * (design-rules.md §10.2).
 */
/**
 * Only archetypes the template can actually render. Listing an aspirational
 * one here does not produce variety — the registry falls back to the section
 * default and the site quietly comes out looking like every other one, which
 * is the exact failure this table exists to prevent. Keep in step with
 * `template/src/sections/registry.ts`.
 */
export const ARCHETYPES = {
  // Sections rebuilt in the approved design language. "default" is
  // deliberately NOT an option here: leaving it in made the choice a coin
  // flip, and a client who lost the toss silently got the old template back.
  // `type-only` carries no photograph at all, which is what most crawled
  // SMB sites can actually support (B4).
  hero: [
    "photo-full",
    "type-only",
    "split",
    "index",
    "collage",
    "offset-grid",
    "marquee",
  ],
  // The business's own sentence, lit word by word (pattern-library.md §2.1).
  statement: ["word-reveal"],
  // Address, hours and the number as one section, not three (§2.2).
  visit: ["rows"],
  // B3: the last screen, and the band of the client's own phrases.
  closing: ["statement-cta"],
  marquee: ["ticker"],
  services: ["rail-pinned"],
  team: ["sticky-swap"],
  // Not yet rebuilt — these still render through the template's original
  // component. Listing "default" keeps that explicit rather than implied.
  gallery: ["default"],
  faq: ["default"],
  contact: ["default"],
  hours: ["default"],
  testimonials: ["default"],
} as const satisfies Record<string, readonly string[]>;

export type SectionType = keyof typeof ARCHETYPES;

/** Which section carries the required pinned hand-off / text transformation. */
export interface MotionSignature {
  handoff: SectionType;
  textTransform: SectionType;
  lateral: SectionType | null;
}

export interface DesignDna {
  palette: Palette;
  typePair: TypePair;
  density: Density;
  archetypes: Partial<Record<SectionType, string>>;
  motion: MotionSignature;
  /** Headline grammar id, so the rhetorical shape varies too (§9, §10.3). */
  headlineGrammar: string;
  fingerprint: string;
  /** Fingerprints rejected as too close to a recent run, with the reason. */
  rejected: { fingerprint: string; reason: string }[];
}

/**
 * Headline shapes. The generate stage fills the slots from facts; keeping
 * several shapes stops "X onaran klinik" becoming every client's hero.
 */
export const HEADLINE_GRAMMARS = [
  "verb-subject", // "Gülüşünüzü onaran klinik"
  "place-claim", // "Kadıköy'ün diş kliniği"
  "plain-name", // the business's own name, set large
  "promise", // "Randevu almak bir telefon"
  "duration", // "2009'dan beri Feneryolu'nda"
] as const;

/** Deterministic integer from a string — the per-client source of variation. */
function seedFrom(text: string): number {
  const h = createHash("sha256").update(text).digest();
  return h.readUInt32BE(0);
}

/**
 * Pick from a list using the seed, skipping options already ruled out.
 * The list is required to be non-empty by every caller; the fallback exists
 * only to satisfy the index check, never to be taken.
 */
function pick<T>(list: readonly [T, ...T[]] | readonly T[], seed: number, offset: number, exclude: (v: T) => boolean = () => false): T {
  const usable = list.filter((v) => !exclude(v));
  const pool = usable.length ? usable : list;
  const chosen = pool[(seed + offset) % pool.length];
  if (chosen === undefined) throw new Error("pick: empty option list");
  return chosen;
}

export function chooseTypePair(input: {
  sector: string;
  seed: number;
  /** Pair ids used by recent runs in this sector, to be avoided. */
  avoid?: string[];
}): TypePair {
  const wanted = SECTOR_TEMPERAMENT[input.sector] ?? DEFAULT_TEMPERAMENT;
  const avoid = new Set(input.avoid ?? []);

  // Walk the sector's temperaments in order; inside a temperament, the seed
  // decides. Only if every candidate is taken do we reuse one.
  for (const temperament of wanted) {
    const options = TYPE_PAIRS.filter((p) => p.temperament === temperament && !avoid.has(p.id));
    if (options.length) return pick(options, input.seed, 0);
  }
  const anyFree = TYPE_PAIRS.filter((p) => !avoid.has(p.id));
  return pick(anyFree.length ? anyFree : TYPE_PAIRS, input.seed, 1);
}

export function chooseDensity(contentBlocks: number): Density {
  if (contentBlocks >= 250) return "editorial";
  if (contentBlocks >= 80) return "standard";
  return "poster";
}

export function chooseArchetypes(input: {
  sections: SectionType[];
  seed: number;
  avoid?: Partial<Record<SectionType, string>>;
}): Partial<Record<SectionType, string>> {
  const out: Partial<Record<SectionType, string>> = {};
  input.sections.forEach((section, i) => {
    const options = ARCHETYPES[section];
    if (!options) return;
    const taken = input.avoid?.[section];
    out[section] = pick(options, input.seed, i * 7 + 1, (v) => v === taken && options.length > 1);
  });
  return out;
}

export function chooseMotion(input: { sections: SectionType[]; seed: number }): MotionSignature {
  const { sections, seed } = input;
  // The hero carries the pinned hand-off whenever there is one; a page
  // without a hero is not something the planner produces, but the fallback
  // keeps this total.
  const handoff: SectionType = sections.includes("hero") ? "hero" : (sections[0] ?? "contact");
  // The text transformation goes to a section that has prose to transform.
  const textCandidates = sections.filter((s) => s === "team" || s === "testimonials" || s === "faq" || s === "contact");
  const textTransform = textCandidates.length ? pick(textCandidates, seed, 3) : handoff;
  const lateralCandidates = sections.filter((s) => s === "services" || s === "gallery");
  return {
    handoff,
    textTransform,
    lateral: lateralCandidates.length ? pick(lateralCandidates, seed, 5) : null,
  };
}

/**
 * The fingerprint is the hard guarantee (design-rules.md §10.4): derivation
 * makes a site coherent, this makes it distinct. Deliberately coarse — it
 * hashes the decisions a visitor would actually notice, not every token, so
 * two sites that merely differ by a hex digit still collide and one of them
 * is forced to change.
 */
export function fingerprintOf(input: {
  paletteName: string;
  /** Source hue, bucketed. Two clinics can both be "mavi" and still look nothing alike. */
  paletteHue?: number;
  typePairId: string;
  archetypes: Partial<Record<SectionType, string>>;
  motion: MotionSignature;
  /** The hero's sentence shape — the loudest text on the site. */
  headlineGrammar?: string;
}): string {
  const archetypes = Object.keys(input.archetypes)
    .sort()
    .map((k) => `${k}:${input.archetypes[k as SectionType]}`)
    .join(",");
  // 12° buckets: finer than the colour-name bands, coarse enough that two
  // sites a couple of degrees apart still count as the same palette and one
  // of them is forced to change.
  const hueBucket =
    input.paletteHue === undefined ? "-" : String(Math.round(input.paletteHue / 12));
  const payload = [
    input.paletteName,
    hueBucket,
    input.typePairId,
    archetypes,
    `${input.motion.handoff}>${input.motion.textTransform}>${input.motion.lateral ?? "-"}`,
    input.headlineGrammar ?? "-",
  ].join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/**
 * Assemble the DNA, re-rolling the parts that collide with a recent run in
 * the same sector. Each attempt perturbs the seed, so the second attempt is
 * a different site rather than the same one with one token swapped.
 */
export function composeDna(input: {
  domain: string;
  sector: string;
  palette: Palette;
  contentBlocks: number;
  sections: SectionType[];
  /** Fingerprints of recent runs in this sector. */
  recent: { fingerprint: string; typePairId?: string }[];
  maxAttempts?: number;
}): DesignDna {
  const taken = new Set(input.recent.map((r) => r.fingerprint));
  const takenPairs = input.recent.map((r) => r.typePairId).filter((v): v is string => Boolean(v));
  const density = chooseDensity(input.contentBlocks);
  const rejected: { fingerprint: string; reason: string }[] = [];

  const attempts = input.maxAttempts ?? 8;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const seed = seedFrom(`${input.domain}#${attempt}`);
    const typePair = chooseTypePair({ sector: input.sector, seed, avoid: takenPairs });
    const archetypes = chooseArchetypes({ sections: input.sections, seed });
    const motion = chooseMotion({ sections: input.sections, seed });
    const headlineGrammar = pick(HEADLINE_GRAMMARS, seed, 11);
    const fingerprint = fingerprintOf({
      paletteName: input.palette.name,
      paletteHue: input.palette.hue,
      typePairId: typePair.id,
      archetypes,
      motion,
      headlineGrammar,
    });

    if (taken.has(fingerprint) && attempt < attempts - 1) {
      rejected.push({ fingerprint, reason: `matches a recent ${input.sector} run` });
      continue;
    }

    return {
      palette: input.palette,
      typePair,
      density,
      archetypes,
      motion,
      headlineGrammar,
      fingerprint,
      rejected,
    };
  }

  // Unreachable: the final attempt always returns.
  throw new Error("composeDna: exhausted attempts without returning");
}
