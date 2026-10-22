import { desc, eq, gte, isNotNull, and } from "drizzle-orm";
import { designs, type DesignSpec, type Store } from "@pipeline/core";

import { ARCHETYPE_WINDOW, fingerprintSpec } from "./compose.js";
import type { SectionType } from "./sections.js";

/**
 * The design ledger. Reading it is what lets a new run know what its
 * neighbours already got; writing to it is what makes the next run's check
 * meaningful (template/design-rules.md §10.4).
 *
 * Every row is now a `DesignSpec`, not a `DesignDna`. The DNA's palette,
 * type pairing, density and motion stopped reaching the page at C3, so a
 * ledger over them was recording decisions no visitor could see.
 */

/** How far back a direction counts as "recently used" (D10 §6.2). */
export const DIRECTION_WINDOW_DAYS = 30;

/**
 * How many times each direction was used recently, across **all** sectors.
 *
 * Deliberately not scoped to one sector, unlike `recentDesigns` above. D6's
 * ledger was per-sector, which let a dentist and the barber next door receive
 * the same visual language — and the operator reviews every run, so sameness
 * is perceived globally rather than within a trade (D10 §6.2).
 *
 * `now` is a parameter rather than a `Date.now()` call so the window can be
 * tested without waiting thirty days.
 */
export function recentDirectionUsage(
  store: Store,
  now: Date = new Date(),
  windowDays = DIRECTION_WINDOW_DAYS,
): Record<string, number> {
  const cutoff = new Date(
    now.getTime() - windowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const rows = store
    .select({ direction: designs.direction })
    .from(designs)
    .where(and(isNotNull(designs.direction), gte(designs.createdAt, cutoff)))
    .all();

  const out: Record<string, number> = {};
  for (const row of rows) {
    if (row.direction === null) continue;
    out[row.direction] = (out[row.direction] ?? 0) + 1;
  }
  return out;
}

/**
 * How many of the last `limit` runs used each `type/archetype`.
 *
 * Keyed `services/accordion` rather than nested, because that is the shape
 * `composeArchetypes` asks about and flattening at the call site would put
 * the same `${type}/${archetype}` template in two files.
 *
 * Counted across all sectors for the same reason the direction penalty is
 * (§6.2): the operator reviews every run, so a repeated layout is noticed
 * whether or not the two businesses are in the same trade.
 */
export function recentArchetypes(
  store: Store,
  limit = ARCHETYPE_WINDOW,
): Record<string, number> {
  const rows = store
    .select({ archetypes: designs.archetypes })
    .from(designs)
    // `id` breaks the tie, because `createdAt` does not: two runs in the
    // same millisecond sort arbitrarily, and with a LIMIT that means the
    // window silently contains the wrong rows. A batch of sites queued
    // together is exactly when this ledger is most load-bearing.
    .orderBy(desc(designs.createdAt), desc(designs.id))
    .limit(limit)
    .all();

  const out: Record<string, number> = {};
  for (const row of rows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.archetypes);
    } catch {
      // A row written before C3 holds the DNA's own shape, or nothing
      // parseable. Skipping it costs one run's worth of rotation; guessing
      // at it would mean avoiding layouts nobody was served.
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const entry of parsed) {
      if (
        typeof entry !== "object" ||
        entry === null ||
        typeof (entry as { type?: unknown }).type !== "string" ||
        typeof (entry as { archetype?: unknown }).archetype !== "string"
      ) {
        continue;
      }
      const { type, archetype } = entry as { type: string; archetype: string };
      const key = `${type}/${archetype}`;
      out[key] = (out[key] ?? 0) + 1;
    }
  }
  return out;
}

/**
 * Record what this client was actually built as.
 *
 * `paletteName` and `paletteHue` are passed separately because they are the
 * one thing the spec does not own: the hue comes from the client's own
 * photographs (§13 Q3) and the name is the Turkish colour family used in
 * logs and the admin panel.
 */
export function recordSpec(
  store: Store,
  input: {
    domain: string;
    sector: string;
    spec: DesignSpec;
    palette: { name: string; hue: number };
  },
): void {
  const { domain, sector, spec, palette } = input;

  // A re-run of the same client replaces its own row rather than piling up —
  // otherwise a client rebuilt three times crowds the window and starts
  // pushing other businesses' designs out of view.
  store.delete(designs).where(eq(designs.domain, domain)).run();

  store
    .insert(designs)
    .values({
      domain,
      sector,
      fingerprint: fingerprintSpec(spec),
      paletteName: palette.name,
      paletteHue: palette.hue,
      typePairId: `${spec.type.display}/${spec.type.body}`,
      density: spec.grid.density,
      headlineGrammar: spec.type.displayCase,
      archetypes: JSON.stringify(spec.sections),
      motion: JSON.stringify(spec.motion),
      direction: spec.direction,
      createdAt: new Date().toISOString(),
    })
    .run();
}

/** Sections the site should have, given what the crawl found. */
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
