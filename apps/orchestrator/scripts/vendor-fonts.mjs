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
 * Only the `latin` and `latin-ext` subsets are kept. latin-ext is where
 * ş/ğ/ı/İ live; the other subsets Google serves (vietnamese, cyrillic,
 * greek) are dead weight in a Turkish SMB site and count against the
 * 250 KB script budget's spirit even though fonts are not script bytes.
 *
 * Each face also gets its OFL.txt alongside, because redistributing an OFL
 * font without its licence file is the one way to break OFL while using it
 * correctly in every other respect.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = join(ROOT, "data", "fonts");
const WANTED_SUBSETS = new Set(["latin", "latin-ext"]);

// A modern UA, or the CSS API serves truetype instead of woff2.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const { FACES, FREE_LICENCES } = await import(
  join(ROOT, "apps/orchestrator/src/design/faces.ts")
).catch(async () => {
  // The registry is TypeScript; read it with tsx when run directly.
  const { execSync } = await import("node:child_process");
  const json = execSync(
    `pnpm --filter @pipeline/orchestrator exec tsx -e ` +
      `"import {FACES,FREE_LICENCES} from './src/design/faces.js';` +
      `console.log(JSON.stringify({FACES,FREE_LICENCES}))"`,
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  return JSON.parse(json.trim().split("\n").pop());
});

async function cssFor(face) {
  const query = face.axes
    ? `family=${encodeURIComponent(face.family)}:${face.axes}`
    : `family=${encodeURIComponent(face.family)}`;
  const url = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${face.family}: CSS ${res.status}`);
  return res.text();
}

/** Split the CSS into `/* subset *\/ @font-face { ... }` blocks. */
function blocks(css) {
  const out = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
  let m;
  while ((m = re.exec(css)) !== null) out.push({ subset: m[1], block: m[2] });
  return out;
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
  const faces = blocks(css).filter((b) => WANTED_SUBSETS.has(b.subset));
  if (faces.length === 0) throw new Error(`${face.family}: no latin/latin-ext block`);

  const meta = [];
  for (const { subset, block } of faces) {
    const url = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
    const unicodeRange = /unicode-range:\s*([^;]+);/.exec(block)?.[1]?.trim();
    const weight = /font-weight:\s*([^;]+);/.exec(block)?.[1]?.trim();
    if (!url) continue;
    const file = `${face.slug}-${subset}.woff2`;
    const path = join(dir, file);
    if (!existsSync(path)) {
      const bin = await fetch(url, { headers: { "User-Agent": UA } });
      if (!bin.ok) throw new Error(`${face.family}/${subset}: ${bin.status}`);
      writeFileSync(path, Buffer.from(await bin.arrayBuffer()));
    }
    meta.push({ subset, file, weight, unicodeRange });
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
  console.log(`${face.family.padEnd(18)} ${meta.map((m) => m.subset).join(" + ")}`);
}

console.log(`\n${vendored} faces vendored into data/fonts/`);
