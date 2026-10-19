import { describe, expect, it } from "vitest";
import { buildPalette } from "./palette.js";
import {
  chooseDensity,
  chooseTypePair,
  composeDna,
  fingerprintOf,
  TYPE_PAIRS,
  type SectionType,
} from "./dna.js";

const SECTIONS: SectionType[] = ["hero", "services", "team", "faq", "hours", "contact"];
const clinicPalette = buildPalette({ hue: 197, chroma: 0.61 });
const kebabPalette = buildPalette({ hue: 24, chroma: 0.55 });

describe("type pairing", () => {
  it("matches the sector's temperament", () => {
    const pair = chooseTypePair({ sector: "dentist", seed: 1 });
    expect(["clinical", "quiet", "warm"]).toContain(pair.temperament);
  });

  it("avoids a pairing a recent run in the sector already used", () => {
    const first = chooseTypePair({ sector: "dentist", seed: 1 });
    const second = chooseTypePair({ sector: "dentist", seed: 1, avoid: [first.id] });
    expect(second.id).not.toBe(first.id);
  });

  it("reuses rather than failing when every pairing is taken", () => {
    const all = TYPE_PAIRS.map((p) => p.id);
    const pair = chooseTypePair({ sector: "dentist", seed: 3, avoid: all });
    expect(all).toContain(pair.id);
  });

  it("every curated face is declared with a display weight of at least 700", () => {
    for (const p of TYPE_PAIRS) expect(p.displayWeight).toBeGreaterThanOrEqual(700);
  });
});

describe("density", () => {
  it("reads the client's content volume, not a default", () => {
    expect(chooseDensity(438)).toBe("editorial");
    expect(chooseDensity(120)).toBe("standard");
    expect(chooseDensity(20)).toBe("poster");
  });
});

describe("fingerprint", () => {
  it("is stable for the same decisions", () => {
    const args = {
      paletteName: "turkuaz",
      typePairId: "grotesk-tight",
      archetypes: { hero: "photo-full" } as Partial<Record<SectionType, string>>,
      motion: { handoff: "hero" as SectionType, textTransform: "team" as SectionType, lateral: null },
    };
    expect(fingerprintOf(args)).toBe(fingerprintOf(args));
  });

  it("changes when any visible decision changes", () => {
    const base = {
      paletteName: "turkuaz",
      typePairId: "grotesk-tight",
      archetypes: { hero: "photo-full" } as Partial<Record<SectionType, string>>,
      motion: { handoff: "hero" as SectionType, textTransform: "team" as SectionType, lateral: null },
    };
    expect(fingerprintOf({ ...base, paletteName: "kiremit" })).not.toBe(fingerprintOf(base));
    expect(fingerprintOf({ ...base, typePairId: "humanist" })).not.toBe(fingerprintOf(base));
    expect(fingerprintOf({ ...base, archetypes: { hero: "poster" } })).not.toBe(fingerprintOf(base));
  });
});

describe("composeDna", () => {
  it("is deterministic for the same client", () => {
    const a = composeDna({ domain: "diskent.com", sector: "dentist", palette: clinicPalette, contentBlocks: 438, sections: SECTIONS, recent: [] });
    const b = composeDna({ domain: "diskent.com", sector: "dentist", palette: clinicPalette, contentBlocks: 438, sections: SECTIONS, recent: [] });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.typePair.id).toBe(b.typePair.id);
  });

  it("gives two clinics different sites even with the same palette and content", () => {
    const a = composeDna({ domain: "diskent.com", sector: "dentist", palette: clinicPalette, contentBlocks: 438, sections: SECTIONS, recent: [] });
    const b = composeDna({ domain: "baskaklinik.com", sector: "dentist", palette: clinicPalette, contentBlocks: 438, sections: SECTIONS, recent: [] });
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("never reuses a recent fingerprint in the same sector", () => {
    const first = composeDna({ domain: "diskent.com", sector: "dentist", palette: clinicPalette, contentBlocks: 438, sections: SECTIONS, recent: [] });

    // the same client run again while its own fingerprint is on the books
    const second = composeDna({
      domain: "diskent.com",
      sector: "dentist",
      palette: clinicPalette,
      contentBlocks: 438,
      sections: SECTIONS,
      recent: [{ fingerprint: first.fingerprint, typePairId: first.typePair.id }],
    });

    expect(second.fingerprint).not.toBe(first.fingerprint);
  });

  it("logs the collision when one actually has to be re-rolled", () => {
    // A ledger entry with no type pairing recorded: the cheap guard (avoiding
    // a recently used pairing) cannot fire, so the collision reaches the
    // fingerprint check and the re-roll has to do the work.
    const first = composeDna({ domain: "diskent.com", sector: "dentist", palette: clinicPalette, contentBlocks: 438, sections: SECTIONS, recent: [] });

    const second = composeDna({
      domain: "diskent.com",
      sector: "dentist",
      palette: clinicPalette,
      contentBlocks: 438,
      sections: SECTIONS,
      recent: [{ fingerprint: first.fingerprint }],
    });

    expect(second.fingerprint).not.toBe(first.fingerprint);
    expect(second.rejected.map((r) => r.fingerprint)).toContain(first.fingerprint);
    expect(second.rejected[0]?.reason).toContain("dentist");
  });

  it("different sectors are free to land on the same decisions", () => {
    // the ledger is per-sector: a barber reusing a clinic's layout is fine
    const clinic = composeDna({ domain: "a.com", sector: "dentist", palette: clinicPalette, contentBlocks: 300, sections: SECTIONS, recent: [] });
    const barber = composeDna({
      domain: "a.com",
      sector: "barber",
      palette: kebabPalette,
      contentBlocks: 300,
      sections: SECTIONS,
      recent: [{ fingerprint: clinic.fingerprint }],
    });
    expect(barber.fingerprint).toBeDefined();
  });

  it("always assigns the two required motion moments", () => {
    const dna = composeDna({ domain: "x.com", sector: "cafe", palette: kebabPalette, contentBlocks: 90, sections: SECTIONS, recent: [] });
    expect(dna.motion.handoff).toBeTruthy();
    expect(dna.motion.textTransform).toBeTruthy();
    expect(SECTIONS).toContain(dna.motion.handoff);
  });

  it("picks an archetype for every section it was given", () => {
    const dna = composeDna({ domain: "x.com", sector: "cafe", palette: kebabPalette, contentBlocks: 90, sections: SECTIONS, recent: [] });
    for (const s of SECTIONS) expect(dna.archetypes[s]).toBeTruthy();
  });

  it("varies the headline grammar between clients", () => {
    const seen = new Set<string>();
    for (const d of ["a.com", "b.com", "c.com", "d.com", "e.com", "f.com", "g.com", "h.com"]) {
      seen.add(composeDna({ domain: d, sector: "dentist", palette: clinicPalette, contentBlocks: 300, sections: SECTIONS, recent: [] }).headlineGrammar);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
