import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRunState,
  designSpecSchema,
  openStore,
  type DesignSpec,
  type Store,
} from "@pipeline/core";

import { brandChroma, designStage } from "./design.js";
import type { StageContext } from "./types.js";

/**
 * The spec path end to end (D10 C3): brief + facts in, a validated
 * `DesignSpec` and a generated stylesheet and font module out.
 *
 * No model and no browser, so this is the cheapest place to catch the two
 * failures that would otherwise surface inside a paid stage: a spec that
 * does not validate, and a spec naming a face or a layout nothing can
 * render.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");

function makeCtx(runDir: string, store: Store, domain = "ornek.com.tr"): StageContext {
  return {
    domain,
    url: `https://${domain}`,
    runDir,
    repoRoot: REPO_ROOT,
    state: createRunState({ domain, url: `https://${domain}`, source: "manual" }),
    store,
    log: () => {},
  };
}

/** A client with services, people, hours and a usable sentence. */
function seedRun(
  dir: string,
  brief: Record<string, unknown> = {},
): void {
  mkdirSync(join(dir, "audit"), { recursive: true });
  mkdirSync(join(dir, "crawl"), { recursive: true });
  mkdirSync(join(dir, "brief"), { recursive: true });
  writeFileSync(
    join(dir, "audit", "facts.json"),
    JSON.stringify({
      businessName: "Moda Diş Kliniği",
      sector: "dentist",
      openingHours: [
        { day: "pazartesi", open: "09:00", close: "18:00" },
        { day: "cumartesi", open: "10:00", close: "15:00" },
      ],
    }),
  );
  // Written in the shape the CRAWL produces, not the shape the facts take:
  // `takeInventory` infers roles from slugs and titles because the crawl
  // does not label pages, and a fixture that puts `services` in facts.json
  // produces a four-section site and silently tests nothing.
  writeFileSync(
    join(dir, "crawl", "content.json"),
    JSON.stringify({
      pages: [
        ...["implant", "ortodonti", "dis-beyazlatma", "zirkonyum"].map((s) => ({
          slug: `/hizmetler/${s}`,
          title: s,
          contentBlocks: Array.from({ length: 12 }, (_, i) => ({ text: `blok ${i}` })),
        })),
        ...["dt-ayse-kaya", "dt-mehmet-demir", "dr-selin-arslan"].map((s) => ({
          slug: `/ekip/${s}`,
          title: `Dt. ${s}`,
          contentBlocks: [{ text: "özgeçmiş" }],
        })),
        { slug: "/yorumlar", title: "Hasta Yorumları", contentBlocks: [{ text: "yorum" }] },
      ],
      // Twelve treatments, which is what a real clinic's services page has —
      // the committed fixtures carry four, so every multi-column archetype
      // was previewed at a third of its real content.
      services: Array.from({ length: 12 }, (_, i) => ({ name: `Tedavi ${i + 1}` })),
      faq: Array.from({ length: 6 }, (_, i) => ({
        q: `Soru ${i + 1}`,
        a: "Cevap.",
      })),
    }),
  );
  writeFileSync(
    join(dir, "brief", "brief.json"),
    JSON.stringify({
      tone: "clinical",
      tier: "mid",
      audience: "local-everyday",
      contentVolume: "standard",
      statementUsable: true,
      evidence: { statementCandidate: "Yirmi yıldır Moda'dayız." },
      ...brief,
    }),
  );
}

/** The spec the stage actually wrote. */
function specIn(runDir: string): DesignSpec {
  return designSpecSchema.parse(
    JSON.parse(readFileSync(join(runDir, "design", "design.json"), "utf8")),
  );
}

describe("design stage — the spec path", () => {
  let dir: string;
  let store: Store;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "design-"));
    store = openStore({ memory: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("writes a design.json that validates as a DesignSpec", async () => {
    seedRun(dir);
    const result = await designStage.run(makeCtx(dir, store));
    expect(result.ok, result.error).toBe(true);

    const spec = designSpecSchema.parse(
      JSON.parse(readFileSync(join(dir, "design", "design.json"), "utf8")),
    );
    expect(spec.version).toBe(2);
    expect(spec.direction).toBe(result.data?.direction);
  });

  /**
   * §5: the spec is the single source of style. A token file that does not
   * carry the sampled numbers means something downstream is still deciding
   * them.
   */
  it("generates tokens.css and fonts.ts from that spec, not from a default", async () => {
    seedRun(dir);
    await designStage.run(makeCtx(dir, store));

    const spec = designSpecSchema.parse(
      JSON.parse(readFileSync(join(dir, "design", "design.json"), "utf8")),
    );
    const tokens = readFileSync(join(dir, "design", "tokens.css"), "utf8");
    expect(tokens).toContain(`--brand-h: ${spec.color.brandH}`);
    expect(tokens).toContain(`direction: ${spec.direction}`);

    const fonts = readFileSync(join(dir, "design", "fonts.ts"), "utf8");
    expect(fonts).toContain("next/font/local");
    // Never pinned — a variable face at one weight is the tell D10 §11 C1
    // exists to remove.
    expect(fonts).not.toMatch(/weight: "[1-9]00"/);
  });

  /** Every section the facts produced has to name a layout, not inherit one. */
  it("assigns an archetype to every section it emitted", async () => {
    seedRun(dir);
    await designStage.run(makeCtx(dir, store));
    const spec = designSpecSchema.parse(
      JSON.parse(readFileSync(join(dir, "design", "design.json"), "utf8")),
    );

    expect(spec.sections.map((s) => s.type)).toContain("services");
    for (const section of spec.sections) {
      expect(section.archetype.length, `${section.type} has no archetype`).toBeGreaterThan(0);
      // "default" is legitimate only where the template has one layout.
      if (section.type !== "contact") {
        expect(section.archetype, `${section.type} fell back`).not.toBe("default");
      }
    }
  });

  it("is deterministic for the same client and different across clients", async () => {
    seedRun(dir);
    const first = await designStage.run(makeCtx(dir, store));

    const again = mkdtempSync(join(tmpdir(), "design-"));
    const other = mkdtempSync(join(tmpdir(), "design-"));
    try {
      seedRun(again);
      seedRun(other);
      const repeat = await designStage.run(makeCtx(again, openStore({ memory: true })));
      const different = await designStage.run(
        makeCtx(other, openStore({ memory: true }), "baska-klinik.com"),
      );

      expect(repeat.data?.seed).toBe(first.data?.seed);
      expect(different.data?.seed).not.toBe(first.data?.seed);
    } finally {
      rmSync(again, { recursive: true, force: true });
      rmSync(other, { recursive: true, force: true });
    }
  });

  /**
   * The rotation penalty, exercised through the stage rather than the scorer:
   * what matters is that the ledger write and the ledger read agree, which a
   * unit test of `scoreDirection` cannot show.
   *
   * Asserted as a MIX, not a round-robin, because that is what λ = 2
   * actually produces. Ten identical clinical briefs measure as
   *
   *     swiss swiss editorial swiss editorial swiss editorial kinetic …
   *
   * — swiss-grid wins its affinity by 3 points, so one use (−2) is not
   * enough to unseat it and two are; then editorial-serif carries its own
   * penalty and swiss-grid comes back. That is the intended trade: the
   * penalty exists to break sameness, not to hand a photo-less clinical
   * client `quiet-luxury` for the sake of a clean rotation.
   */
  it("does not give six identical briefs the same direction", async () => {
    const chosen: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const d = mkdtempSync(join(tmpdir(), "design-"));
      try {
        seedRun(d);
        const result = await designStage.run(makeCtx(d, store, `klinik-${i}.com`));
        expect(result.ok, result.error).toBe(true);
        chosen.push(result.data?.direction as string);
      } finally {
        rmSync(d, { recursive: true, force: true });
      }
    }

    expect(new Set(chosen).size, `all six got ${chosen[0]}`).toBeGreaterThan(1);
    // No direction may take the clear majority of a run of six.
    for (const direction of new Set(chosen)) {
      const used = chosen.filter((c) => c === direction).length;
      expect(used, `${direction} took ${used} of 6: ${chosen.join(", ")}`).toBeLessThan(5);
    }
  });

  /**
   * §6.4 through the stage, not the unit: what matters is that the archetype
   * the ledger records and the archetype the next run avoids are the same
   * string. A unit test of `composeArchetypes` cannot show that.
   */
  it("gives the next client a different hero", async () => {
    seedRun(dir);
    const first = await designStage.run(makeCtx(dir, store));
    expect(first.ok, first.error).toBe(true);
    const firstHero = specIn(dir).sections.find((s) => s.type === "hero")!.archetype;

    const next = mkdtempSync(join(tmpdir(), "design-"));
    try {
      seedRun(next);
      const second = await designStage.run(makeCtx(next, store, "ikinci-klinik.com"));
      expect(second.ok, second.error).toBe(true);
      const secondHero = specIn(next).sections.find((s) => s.type === "hero")!.archetype;
      expect(secondHero).not.toBe(firstHero);
    } finally {
      rmSync(next, { recursive: true, force: true });
    }
  });

  /** The fingerprint has to be over what ships, or it guarantees nothing. */
  it("records a fingerprint that changes with the archetypes", async () => {
    seedRun(dir);
    const first = await designStage.run(makeCtx(dir, store));

    const next = mkdtempSync(join(tmpdir(), "design-"));
    try {
      seedRun(next);
      const second = await designStage.run(makeCtx(next, store, "ikinci-klinik.com"));
      expect(second.data?.fingerprint).not.toBe(first.data?.fingerprint);
    } finally {
      rmSync(next, { recursive: true, force: true });
    }
  });

  /** A brief written before §6.1 added the four scales still has to build. */
  it("builds from a brief with no classifications", async () => {
    seedRun(dir, {
      tone: undefined,
      tier: undefined,
      audience: undefined,
      contentVolume: undefined,
    });
    const result = await designStage.run(makeCtx(dir, store));
    expect(result.ok, result.error).toBe(true);
    expect(result.data?.direction).toBeTruthy();
  });

  it("records the direction in the ledger", async () => {
    seedRun(dir);
    const result = await designStage.run(makeCtx(dir, store));
    const rows = store.$client.prepare("SELECT direction FROM designs").all();
    expect(rows).toEqual([{ direction: result.data?.direction }]);
  });
});

describe("brandChroma", () => {
  /**
   * Two different units: saturation on 0–1, OKLCH chroma on 0–0.4. Reading
   * one as the other is how a site comes out either grey or radioactive.
   */
  it("never exceeds the direction's ceiling", () => {
    expect(brandChroma(1, 0.06)).toBeLessThanOrEqual(0.06);
    expect(brandChroma(0.9, 0.04)).toBeLessThanOrEqual(0.04);
  });

  it("gives a grey-photograph client a visible accent anyway", () => {
    expect(brandChroma(0, 0.14)).toBeGreaterThan(0.05);
  });

  it("gives a vivid client more colour than a muted one", () => {
    expect(brandChroma(0.5, 0.14)).toBeGreaterThan(brandChroma(0.1, 0.14));
  });
});
