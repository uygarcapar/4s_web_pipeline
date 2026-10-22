/**
 * Regenerate the template's own tokens.css and fonts.ts from `DEFAULT_SPEC`.
 *
 *     pnpm --filter @pipeline/orchestrator defaults
 *
 * Run this after changing `spec-tokens.ts`, `local-fonts.ts`, `scale.ts` or
 * the `swiss-grid` direction; `template-defaults.test.ts` fails until you do.
 * The template is a copy source, so a stylesheet that disagrees with the
 * generators is a stylesheet every generated site starts out contradicting.
 */
import { cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { planLocalFonts } from "../src/design/local-fonts.js";
import { renderSpecTokens } from "../src/design/spec-tokens.js";
import { DEFAULT_SPEC } from "../src/design/template-defaults.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const TEMPLATE = join(REPO_ROOT, "template");

const plan = planLocalFonts(DEFAULT_SPEC);

writeFileSync(join(TEMPLATE, "src", "styles", "tokens.css"), renderSpecTokens(DEFAULT_SPEC));
writeFileSync(join(TEMPLATE, "src", "lib", "fonts.ts"), plan.module);

for (const face of plan.faces) {
  cpSync(join(REPO_ROOT, "data", "fonts", face.slug), join(TEMPLATE, "public", "fonts", face.slug), {
    recursive: true,
  });
}

console.log(
  `template defaults written from ${DEFAULT_SPEC.direction}: ` +
    plan.faces.map((f) => f.family).join(", "),
);
