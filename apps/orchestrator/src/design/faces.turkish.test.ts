import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  FACES,
  FREE_LICENCES,
  SUBSET_CHARSET,
  TURKISH_TEST_STRING,
} from "./faces.js";
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
  text: string = TURKISH_TEST_STRING,
): Promise<string[]> {
  const page = await browser.newPage();
  try {
    // One file per face now: the registry is subset to SUBSET_CHARSET rather
    // than shipping Google's latin + latin-ext pair, so there is a single
    // @font-face and no question of which of two rules the browser consults.
    const file = join(FONT_DIR, slug, `${slug}-tr.woff2`);
    if (!existsSync(file)) throw new Error(`${family}: ${slug}-tr.woff2 not vendored`);
    const b64 = readFileSync(file).toString("base64");

    const rules = `@font-face {
          font-family: "UnderTest";
          src: url(data:font/woff2;base64,${b64}) format('woff2');
          font-display: block;
        }`;

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
    await page.evaluate(async (probe) => {
      await document.fonts.load('100px "UnderTest"', probe);
      await document.fonts.ready;
    }, text);

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
      { text },
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
 * This used to withhold `latin-ext` and assert that ş/ğ/İ went missing. The
 * faces are one file now, so the control instead probes characters the
 * subset provably does not carry: `SUBSET_CHARSET` is Latin, and Cyrillic
 * and Han are deliberately outside it. That is a stronger control than the
 * old one, because it depends on this repo's charset rather than on where
 * Google chose to draw a subset boundary.
 */
describe("the check can actually fail", () => {
  it("reports characters the subset does not carry", async () => {
    // Cyrillic, not CJK: headless Chromium ships no Han face at all, so a
    // Han character measures the same in both arms for a reason that has
    // nothing to do with the subset under test — which would make the
    // control pass without testing anything.
    const missing = await missingGlyphs("karla", "Karla", "Жфщ");
    expect([...missing].sort()).toEqual(["Ж", "ф", "щ"].sort());
  }, 60_000);

  it("does not report the Turkish letters alongside them", async () => {
    const missing = await missingGlyphs("karla", "Karla", "Жşğİıçöü");
    for (const char of ["ş", "ğ", "İ", "ı", "ç", "ö", "ü"]) {
      expect(missing, `${char} should be in the subset`).not.toContain(char);
    }
    expect(missing).toContain("Ж");
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

  it("every face is vendored as a single Turkish subset", () => {
    for (const face of FACES) {
      expect(
        existsSync(join(FONT_DIR, face.slug, `${face.slug}-tr.woff2`)),
        `${face.family}: expected one ${face.slug}-tr.woff2`,
      ).toBe(true);
    }
  });

  /**
   * The two-file layout this replaced. A leftover pair would still load and
   * still render, so nothing would fail — the page would just quietly carry
   * twice the fonts it needs, which is the cost the subset exists to remove.
   */
  it("no face still carries the latin/latin-ext pair", () => {
    for (const face of FACES) {
      for (const stale of ["latin", "latin-ext"]) {
        expect(
          existsSync(join(FONT_DIR, face.slug, `${face.slug}-${stale}.woff2`)),
          `${face.family}: ${stale} is left over from the two-file layout`,
        ).toBe(false);
      }
    }
  });

  /**
   * The subset is only safe if it covers what the render check probes;
   * otherwise a face could pass vendoring and fail on a client's page.
   */
  it("the charset covers every character the Turkish check probes", () => {
    const uncovered = [...new Set([...TURKISH_TEST_STRING])].filter(
      (char) => !SUBSET_CHARSET.includes(char),
    );
    expect(uncovered, `not in SUBSET_CHARSET: ${uncovered.join(" ")}`).toEqual([]);
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
