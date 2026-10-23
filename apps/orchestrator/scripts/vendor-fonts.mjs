#!/usr/bin/env node
/**
 * Vendor the registry's faces as woff2 under `data/fonts/<slug>/`.
 *
 *   node apps/orchestrator/scripts/vendor-fonts.mjs
 *
 * Operator-run, not per-run: the files are committed, like the direction
 * reference screenshots. D10 §13 Q2 is settled as free open-licence faces
 * only, so this refuses anything the registry does not mark free.
 *
 * ONE file per face, subset to `SUBSET_CHARSET` (faces.ts) via the CSS API's
 * `text=` parameter.
 *
 * This used to keep Google's `latin` + `latin-ext` subsets, two files per
 * family. Three families then cost six requests and 235 KB — the heaviest
 * resource class on a generated page, more than all of its JavaScript, and
 * three times the `font:count` budget. The first real client's LCP failed
 * its gate at 3.95 s against a template baseline of 2.7-3.2 s, and the
 * difference was the third family's two extra files.
 *
 * Neither Google subset could simply be dropped — Turkish straddles them,
 * with dotless `ı` in `latin` and `ğ ş İ` in `latin-ext` — so the fix is to
 * stop using their split at all and ask for exactly the characters a Turkish
 * SMB site can contain: 3 requests and 119 KB, down 49%.
 *
 * `faces.turkish.test.ts` renders every vendored face in a browser and fails
 * on any character that arrives from the fallback, which is what makes an
 * aggressive subset safe to ship rather than merely small.
 *
 * Each face also gets its OFL.txt alongside, because redistributing an OFL
 * font without its licence file is the one way to break OFL while using it
 * correctly in every other respect.
 */
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = join(ROOT, "data", "fonts");

/** The single subset's filename suffix: `<slug>-tr.woff2`. */
const SUBSET = "tr";

// A modern UA, or the CSS API serves truetype instead of woff2.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const { FACES, FREE_LICENCES, SUBSET_CHARSET } = await import(
  join(ROOT, "apps/orchestrator/src/design/faces.ts")
).catch(async () => {
  // The registry is TypeScript; read it with tsx when run directly.
  const { execSync } = await import("node:child_process");
  const json = execSync(
    `pnpm --filter @pipeline/orchestrator exec tsx -e ` +
      `"import {FACES,FREE_LICENCES,SUBSET_CHARSET} from './src/design/faces.js';` +
      `console.log(JSON.stringify({FACES,FREE_LICENCES,SUBSET_CHARSET}))"`,
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return JSON.parse(json.trim().split("\n").pop());
});

/**
 * The CSS for one face, subset to `SUBSET_CHARSET`.
 *
 * With `text=` the API answers with a single `@font-face` whose `src` is a
 * `/l/font?kit=…` URL — note it carries no `.woff2` extension, only
 * `format('woff2')`, so the file must be matched on the format and not the
 * path.
 */
async function cssFor(face) {
  const params = new URLSearchParams({
    family: face.axes ? `${face.family}:${face.axes}` : face.family,
    display: "swap",
    text: SUBSET_CHARSET,
  });
  const res = await fetch(`https://fonts.googleapis.com/css2?${params}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`${face.family}: CSS ${res.status}`);
  return res.text();
}

let vendored = 0;
for (const face of FACES) {
  if (!FREE_LICENCES.includes(face.licence)) {
    throw new Error(
      `${face.family} is licensed ${face.licence}, which D10 §13 Q2 does not permit`,
    );
  }
  const dir = join(OUT, face.slug);
  mkdirSync(dir, { recursive: true });

  const css = await cssFor(face);
  const url = /src:\s*url\(([^)]+)\)\s*format\('woff2'\)/.exec(css)?.[1];
  if (!url) throw new Error(`${face.family}: no woff2 in the subset CSS`);
  const unicodeRange = /unicode-range:\s*([^;]+);/.exec(css)?.[1]?.trim();
  const weight = /font-weight:\s*([^;]+);/.exec(css)?.[1]?.trim();

  // Always refetch: the file is keyed to SUBSET_CHARSET, and a stale one
  // from a narrower charset would be missing glyphs that nothing re-checks
  // until a client publishes one.
  const file = `${face.slug}-${SUBSET}.woff2`;
  const bin = await fetch(url, { headers: { "User-Agent": UA } });
  if (!bin.ok) throw new Error(`${face.family}: woff2 ${bin.status}`);
  const bytes = Buffer.from(await bin.arrayBuffer());
  writeFileSync(join(dir, file), bytes);
  const meta = [{ subset: SUBSET, file, weight, unicodeRange }];

  // Remove the two-file layout this replaces, so a stale latin/latin-ext
  // pair cannot sit in the tree looking vendored.
  for (const old of [`${face.slug}-latin.woff2`, `${face.slug}-latin-ext.woff2`]) {
    if (existsSync(join(dir, old))) rmSync(join(dir, old));
  }

  // OFL §2 requires the licence travel with the font. Redistributing the
  // woff2 without it is the one way to break OFL while complying with it in
  // every other respect.
  const oflPath = join(dir, "OFL.txt");
  if (!existsSync(oflPath)) {
    const dirName = face.family.toLowerCase().replace(/\s+/g, "");
    const res = await fetch(
      `https://raw.githubusercontent.com/google/fonts/main/ofl/${dirName}/OFL.txt`,
    );
    if (!res.ok) {
      throw new Error(
        `${face.family}: no OFL.txt at google/fonts/ofl/${dirName} (${res.status}). ` +
          "Vendoring an OFL face without its licence is not permitted.",
      );
    }
    writeFileSync(oflPath, await res.text());
  }

  writeFileSync(
    join(dir, "face.json"),
    JSON.stringify(
      { family: face.family, licence: face.licence, variable: face.variable, files: meta },
      null,
      2,
    ) + "\n",
  );
  vendored += 1;
  console.log(
    `${face.family.padEnd(18)} ${String(Math.round(bytes.length / 1024)).padStart(4)} KB` +
      ` (${SUBSET_CHARSET.length} chars)`,
  );
}

console.log(`\n${vendored} faces vendored into data/fonts/`);
