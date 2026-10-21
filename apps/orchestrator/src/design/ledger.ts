import { desc, eq } from "drizzle-orm";
import { designs, type Store } from "@pipeline/core";
import type { DesignDna, SectionType } from "./dna.js";

/**
 * The fingerprint ledger. Reading it is what lets a new run know which
 * designs its neighbours already got; writing to it is what makes the next
 * run's check meaningful (template/design-rules.md §10.4).
 */

/** How far back a sector's history counts as "recent". */
export const RECENT_WINDOW = 25;

export function recentDesigns(
  store: Store,
  sector: string,
  limit = RECENT_WINDOW,
): { fingerprint: string; typePairId: string; domain: string }[] {
  return store
    .select({
      fingerprint: designs.fingerprint,
      typePairId: designs.typePairId,
      domain: designs.domain,
    })
    .from(designs)
    .where(eq(designs.sector, sector))
    .orderBy(desc(designs.createdAt))
    .limit(limit)
    .all();
}

export function recordDesign(
  store: Store,
  input: { domain: string; sector: string; dna: DesignDna },
): void {
  const { domain, sector, dna } = input;

  // A re-run of the same client replaces its own row rather than piling up —
  // otherwise a client that is rebuilt three times crowds its own sector's
  // window and starts pushing other businesses' designs out of view.
  store.delete(designs).where(eq(designs.domain, domain)).run();

  store
    .insert(designs)
    .values({
      domain,
      sector,
      fingerprint: dna.fingerprint,
      paletteName: dna.palette.name,
      paletteHue: dna.palette.hue,
      typePairId: dna.typePair.id,
      density: dna.density,
      headlineGrammar: dna.headlineGrammar,
      archetypes: JSON.stringify(dna.archetypes),
      motion: JSON.stringify(dna.motion),
      createdAt: new Date().toISOString(),
    })
    .run();
}

/** Sections the DNA should choose archetypes for, given what the crawl found. */
export function sectionsFromFacts(input: {
  hasServices: boolean;
  hasTeam: boolean;
  hasFaq: boolean;
  hasGallery: boolean;
  hasTestimonials: boolean;
  hasHours: boolean;
  /** The business wrote a sentence about itself the brief judged usable. */
  hasStatement?: boolean;
}): SectionType[] {
  // Order is the visitor's question order (design-rules.md §10.2); a section
  // with no source content is simply absent, never padded.
  const out: SectionType[] = ["hero"];
  // Straight after the fold, in the business's own words — and it is where
  // the text transformation lives (template/pattern-library.md §2.1).
  if (input.hasStatement) out.push("statement");
  if (input.hasServices) out.push("services");
  if (input.hasTeam) out.push("team");
  if (input.hasGallery) out.push("gallery");
  if (input.hasTestimonials) out.push("testimonials");
  // Address, hours and the number as one section rather than three: split up
  // they read as a form, together as a decision (§2.2).
  if (input.hasHours) out.push("visit");
  if (input.hasFaq) out.push("faq");
  out.push("contact");
  return out;
}
