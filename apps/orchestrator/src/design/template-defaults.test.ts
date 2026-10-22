import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { planLocalFonts } from "./local-fonts.js";
import { renderSpecTokens } from "./spec-tokens.js";
import { DEFAULT_FACE_SLUGS, DEFAULT_SPEC } from "./template-defaults.js";

/**
 * The template's committed stylesheet and font module must be exactly what
 * the generators produce for `DEFAULT_SPEC`.
 *
 * Not pedantry. The template is the copy source for every generated site, so
 * a hand-edit there is a divergence every client inherits — and the two
 * times it diverged, the symptom was invisible: the eight type steps were
 * undefined (archetypes fell back to browser defaults and looked right only
 * in `/library`, which injects a generated stylesheet), and the whole
 * paper/ink ramp was undefined (sections inherited their parent's colour and
 * looked right only because the parent happened to be near-black on white).
 *
 * `pnpm --filter @pipeline/orchestrator defaults` regenerates both.
 */
const TEMPLATE = join(import.meta.dirname, "..", "..", "..", "..", "template");
const REGENERATE = "pnpm --filter @pipeline/orchestrator defaults";

describe("the template's committed defaults are generated", () => {
  it("tokens.css matches renderSpecTokens(DEFAULT_SPEC)", () => {
    const committed = readFileSync(join(TEMPLATE, "src", "styles", "tokens.css"), "utf8");
    expect(committed, `stale — run \`${REGENERATE}\``).toBe(renderSpecTokens(DEFAULT_SPEC));
  });

  it("fonts.ts matches planLocalFonts(DEFAULT_SPEC)", () => {
    const committed = readFileSync(join(TEMPLATE, "src", "lib", "fonts.ts"), "utf8");
    expect(committed, `stale — run \`${REGENERATE}\``).toBe(
      planLocalFonts(DEFAULT_SPEC).module,
    );
  });

  /** The module `next/font/local`s these; a missing one fails the build. */
  it("ships the faces its own font module loads", () => {
    for (const face of planLocalFonts(DEFAULT_SPEC).faces) {
      const dir = join(TEMPLATE, "public", "fonts", face.slug);
      expect(existsSync(dir), `${face.family} is not in template/public/fonts`).toBe(true);
      // OFL §2: a redistribution ships the licence.
      expect(existsSync(join(dir, "OFL.txt")), `${face.family} has no OFL.txt`).toBe(true);
    }
  });

  it("declares the faces it actually pins", () => {
    expect(planLocalFonts(DEFAULT_SPEC).faces.map((f) => f.slug).sort()).toEqual(
      [...DEFAULT_FACE_SLUGS].sort(),
    );
  });

  /**
   * The ramp the template renders has to pass the same contrast gate a run's
   * does — `renderSpecTokens` throws otherwise, so reaching this assertion
   * at all is the check.
   */
  it("defines the ramp and the scale it asks sections to use", () => {
    const css = renderSpecTokens(DEFAULT_SPEC);
    for (const token of ["--paper-100", "--paper-200", "--ink-900", "--ink-600", "--ink-400"]) {
      expect(css, `${token} is referenced by sections but never defined`).toContain(`${token}:`);
    }
    for (const step of [".t-display", ".t-h2", ".t-h3", ".t-lead", ".t-body", ".meta", ".btn-label"]) {
      expect(css, `${step} is undefined, so it renders at browser defaults`).toContain(step);
    }
  });
});
