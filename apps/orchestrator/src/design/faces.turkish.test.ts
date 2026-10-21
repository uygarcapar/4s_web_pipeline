import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FACES, FREE_LICENCES, TURKISH_TEST_STRING } from "./faces.js";
import { DIRECTIONS, DIRECTION_IDS } from "./directions/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const FONT_DIR = join(ROOT, "data", "fonts");

/**
 * A5's acceptance: every vendored face renders the Turkish string with no
 * fallback glyph, **checked by rendering** rather than by trusting a
 * catalogue page (design-rules.md §6, build-rules.md §4).
 *
 * How the check works. A face is loaded twice into the same page: once under
 * its own name with a `local()`-free `@font-face`, and once as a reference
 * that deliberately does not exist, so the browser falls back. If a glyph is
 * missing from the real face the browser silently substitutes the same
 * fallback, and the two measurements agree — which is exactly the failure
 * `latin-ext` in a catalogue listing does not rule out. Measuring per
 * character, rather than on the whole string, is what localises it: one bad
 * ı in an otherwise fine face would disappear into a string-width average.
 */

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

async function missingGlyphs(
  slug: string,
  family: string,
  subsets: readonly string[] = ["latin", "latin-ext"],
): Promise<string[]> {
  const page = await browser.newPage();
  try {
    const files = subsets
      .map((subset) => join(FONT_DIR, slug, `${slug}-${subset}.woff2`))
      .filter((p) => existsSync(p))
      .map((p) => readFileSync(p).toString("base64"));

    // One @font-face per subset, each with the full unicode range it covers.
    // A single rule listing both files would use only the first that loads —
    // latin — and latin-ext, where ş/ğ/ı/İ live, would never be consulted.
    const rules = files
      .map(
        (b64) => `@font-face {
          font-family: "UnderTest";
          src: url(data:font/woff2;base64,${b64}) format('woff2');
          font-display: block;
        }`,
      )
      .join("\n");

    await page.setContent(`<!doctype html><meta charset="utf-8">
      <style>
        ${rules}
        span { font-size: 100px; }
        .t { font-family: "UnderTest", "AbsentReference"; }
        /* No @font-face at all: this resolves to the browser default, which
           is also what a missing glyph in UnderTest falls back to. */
        .f { font-family: "AbsentReference"; }
      </style><body></body>`);

    // `document.fonts.ready` alone is not enough: a face is only fetched when
    // something asks to render in it, so ready resolves against an empty
    // pending set and every later measurement reads the fallback. The first
    // version of this check reported all 11 faces as missing every glyph for
    // exactly that reason.
    await page.evaluate(async (text) => {
      await document.fonts.load('100px "UnderTest"', text);
      await document.fonts.ready;
    }, TURKISH_TEST_STRING);

    const loaded = await page.evaluate(() =>
      [...document.fonts].some((f) => f.status === "loaded"),
    );
    if (!loaded) throw new Error(`${family}: the vendored woff2 did not load`);

    return await page.evaluate(
      ({ text }) => {
        const chars = [...new Set([...text])].filter((c) => /\p{L}/u.test(c));
        const measure = (char: string, cls: string): number => {
          const span = document.createElement("span");
          span.className = cls;
          span.textContent = char;
          document.body.appendChild(span);
          const w = span.getBoundingClientRect().width;
          span.remove();
          return w;
        };
        const out: string[] = [];
        for (const char of chars) {
          const tested = measure(char, "t");
          const fallback = measure(char, "f");
          // Identical advance width to the fallback means the glyph was not
          // in the face and the browser substituted it.
          if (tested === 0 || Math.abs(tested - fallback) < 0.01) out.push(char);
        }
        return out;
      },
      { text: TURKISH_TEST_STRING },
    );
  } finally {
    await page.close();
  }
}

describe("every vendored face carries Turkish", () => {
  it.each(FACES.map((f) => [f.family, f.slug] as const))(
    "%s renders the test string with no fallback",
    async (family, slug) => {
      const missing = await missingGlyphs(slug, family);
      expect(
        missing,
        `${family} falls back on: ${missing.join(" ")} — not vendorable ` +
          "for Turkish sites (design-rules.md §6)",
      ).toEqual([]);
    },
    60_000,
  );
});

/**
 * Negative control. A check that has only ever passed proves nothing — the
 * first version of this file reported all eleven faces as missing every
 * glyph, and a version that always passes is the same bug with the sign
 * flipped.
 *
 * `latin` alone genuinely lacks ş U+015F, ğ U+011F and İ U+0130, which live
 * in `latin-ext`. ç/ö/ü sit at U+00E7/F6/FC inside `latin`, and so — this
 * surprised me — does **ı U+0131**: Google's `latin` subset carries the
 * dotless i explicitly, alongside basic Latin and a handful of other
 * exceptions. So withholding latin-ext must fail exactly three characters,
 * not four, and a face that renders ı is not thereby Turkish-capable.
 */
describe("the check can actually fail", () => {
  it("catches the Turkish-only letters when latin-ext is withheld", async () => {
    const missing = await missingGlyphs("karla", "Karla", ["latin"]);
    expect([...missing].sort()).toEqual(["İ", "ğ", "ş"].sort());
  }, 60_000);

  it("still finds ç, ö and ü in latin alone, so it is not failing everything", async () => {
    const missing = await missingGlyphs("karla", "Karla", ["latin"]);
    for (const char of ["ç", "ö", "ü"]) expect(missing).not.toContain(char);
  }, 60_000);
});

describe("the registry satisfies Q2", () => {
  it("every face is free open-licence", () => {
    for (const face of FACES) {
      expect(FREE_LICENCES, face.family).toContain(face.licence);
    }
  });

  it("every face ships its licence file", () => {
    for (const face of FACES) {
      expect(
        existsSync(join(FONT_DIR, face.slug, "OFL.txt")),
        `${face.family}: OFL §2 requires the licence travel with the font`,
      ).toBe(true);
    }
  });

  it("every face is vendored for both latin and latin-ext", () => {
    for (const face of FACES) {
      for (const subset of ["latin", "latin-ext"]) {
        expect(
          existsSync(join(FONT_DIR, face.slug, `${face.slug}-${subset}.woff2`)),
          `${face.family}/${subset}`,
        ).toBe(true);
      }
    }
  });

  /**
   * The registry and the catalog have to agree, or a direction names a face
   * nothing can serve and the run fails at build time with a missing import.
   */
  it("every face the catalog lists is registered", () => {
    const registered = new Set(FACES.map((f) => f.family));
    for (const id of DIRECTION_IDS) {
      const d = DIRECTIONS[id]!;
      const named = [
        ...d.type.pairs.flatMap((p) => [p.display, p.body]),
        ...d.type.mono,
      ];
      for (const family of named) {
        expect(registered, `${id} lists ${family}`).toContain(family);
      }
    }
  });

  it("keeps variable faces unpinned", () => {
    for (const face of FACES.filter((f) => f.variable)) {
      expect(face.axes, face.family).not.toBe("");
      expect(face.axes, face.family).toMatch(/\.\./);
    }
  });
});
