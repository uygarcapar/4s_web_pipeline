import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIRECTIONS, DIRECTION_IDS } from "./directions/index.js";
import { SECTION_TYPES } from "./sections.js";

/**
 * The design stage and the template keep two separate lists of layout
 * archetypes, and nothing in the type system connects them — the orchestrator
 * cannot import template code.
 *
 * A mismatch fails silently and in the worst possible way: the stage picks a
 * layout, the template's registry does not find it, falls back to the section
 * default, and every site comes out looking the same. That is precisely the
 * failure the archetype table exists to prevent, so it gets a test rather
 * than a comment.
 */
const REGISTRY = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "template",
  "src",
  "sections",
  "registry.ts",
);

function archetypesInTemplate(): Record<string, string[]> {
  const source = readFileSync(REGISTRY, "utf8");
  const decl = source.indexOf("const archetypeRegistry");
  expect(decl, "archetypeRegistry not found in the template registry").toBeGreaterThan(-1);
  // Past the mapped-type annotation to the object literal itself. Starting at
  // the declaration instead captured `archetypeRegistry` as if it were a
  // section type with no archetypes — harmless for the two tests below it,
  // but it made the coverage test report four phantom gaps.
  const start = source.indexOf("} = {", decl);
  expect(start, "archetypeRegistry is not the annotated object literal").toBeGreaterThan(-1);
  const block = source.slice(start, source.indexOf("};", start));

  const out: Record<string, string[]> = {};
  // hero: { "photo-full": HeroPhotoFull },
  const line = /(\w+):\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = line.exec(block)) !== null) {
    const type = match[1];
    const body = match[2] ?? "";
    const keys = [...body.matchAll(/"([^"]+)"\s*:/g)].map((m) => m[1] ?? "");
    if (type) out[type] = keys;
  }
  return out;
}

/**
 * Every archetype the template implements must be reachable from at least
 * one direction.
 *
 * This used to check the D6 `ARCHETYPES` table, which C3 deleted: it was a
 * second list of layouts beside the direction catalog's, and once the
 * directions decided what ships, the table was describing choices nothing
 * could make. The guarantee it carried is worth keeping, though — an
 * archetype that no direction lists is a component that was built,
 * reviewed, and can never appear on a client's site.
 */
describe("every built archetype is reachable", () => {
  const template = archetypesInTemplate();

  it("no archetype is built but unreachable", () => {
    const reachable = new Set<string>();
    for (const id of DIRECTION_IDS) {
      for (const [type, options] of Object.entries(DIRECTIONS[id]!.archetypes)) {
        for (const archetype of options) reachable.add(`${type}/${archetype}`);
      }
    }

    const unreachable: string[] = [];
    for (const [type, keys] of Object.entries(template)) {
      for (const key of keys) {
        if (!reachable.has(`${type}/${key}`)) unreachable.push(`${type}/${key}`);
      }
    }
    expect(
      unreachable,
      `built but no direction can choose them: ${unreachable.join(", ")}`,
    ).toEqual([]);
  });

  /**
   * The vocabulary and the registry are still two lists, and this is the
   * one assertion keeping them in step: a section type the template can
   * render but `sectionsFromFacts` can never emit is dead code, and one it
   * emits but cannot render is a crash.
   */
  it("the section vocabulary matches the template's", () => {
    const rendered = Object.keys(template).sort();
    const known = SECTION_TYPES.filter((t) => t !== "contact").sort();
    expect(rendered).toEqual(known);
  });
});

/**
 * The same check for the D10 direction catalog, which is a second, separate
 * list of archetype names — and was wrong on arrival.
 *
 * A3 wrote the four directions before B4 built the library, so every
 * direction named layouts like `grid-bordered`, `quote-large` and
 * `masonry-reveal` that no component ever existed for. Three of roughly
 * thirty names happened to be real. Nothing failed, because no stage read
 * the catalog yet: the first run to use it would have produced a page of
 * silent fallbacks inside the generate stage, where the feedback costs a
 * model session.
 */
describe("the direction catalog names layouts the template has", () => {
  const template = archetypesInTemplate();

  it.each(DIRECTION_IDS)("%s", (id) => {
    const direction = DIRECTIONS[id]!;
    const missing: string[] = [];
    for (const [type, options] of Object.entries(direction.archetypes)) {
      for (const archetype of options) {
        // The registry's own per-type fallback, not a component file. It is
        // the honest answer for `contact`, which has one layout.
        if (archetype === "default") continue;
        if (!template[type]?.includes(archetype)) missing.push(`${type}/${archetype}`);
      }
    }
    expect(missing, `${id} would silently fall back for: ${missing.join(", ")}`).toEqual([]);
  });

  /**
   * Coverage, not just validity. A direction that lists nothing for `team`
   * renders every team section at the registry default, so all four
   * directions produce the same team page — the sameness D10 exists to end,
   * reintroduced one unlisted section at a time.
   */
  it("covers every section type the template can render", () => {
    const types = Object.keys(template);
    const gaps: string[] = [];
    for (const id of DIRECTION_IDS) {
      for (const type of types) {
        if (!DIRECTIONS[id]!.archetypes[type]) gaps.push(`${id}/${type}`);
      }
    }
    expect(gaps, `no archetype listed, so the default wins: ${gaps.join(", ")}`).toEqual([]);
  });
});
