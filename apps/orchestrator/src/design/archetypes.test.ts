import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "./dna.js";

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
  const start = source.indexOf("const archetypeRegistry");
  expect(start, "archetypeRegistry not found in the template registry").toBeGreaterThan(-1);
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

describe("archetype tables stay in step", () => {
  const template = archetypesInTemplate();

  it("the template actually implements every archetype the design stage can pick", () => {
    const missing: string[] = [];
    for (const [type, options] of Object.entries(ARCHETYPES)) {
      for (const archetype of options) {
        // "default" is the registry's own fallback, not an archetype file
        if (archetype === "default") continue;
        if (!template[type]?.includes(archetype)) {
          missing.push(`${type}/${archetype}`);
        }
      }
    }
    expect(
      missing,
      `the design stage can choose these, but the template cannot render them: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every archetype the template implements is reachable from the design stage", () => {
    const unreachable: string[] = [];
    for (const [type, keys] of Object.entries(template)) {
      for (const key of keys) {
        const options: readonly string[] = ARCHETYPES[type as keyof typeof ARCHETYPES] ?? [];
        if (!options.includes(key)) unreachable.push(`${type}/${key}`);
      }
    }
    expect(
      unreachable,
      `built but never chosen: ${unreachable.join(", ")}`,
    ).toEqual([]);
  });

  it("every section type offers at least one archetype", () => {
    for (const [type, options] of Object.entries(ARCHETYPES)) {
      expect(options.length, `${type} has no archetype`).toBeGreaterThan(0);
    }
  });
});
