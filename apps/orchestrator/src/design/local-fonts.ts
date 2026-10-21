import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DesignSpec } from "@pipeline/core";

import { FACE_BY_FAMILY, type Face } from "./faces.js";

/**
 * `DesignSpec` → the generated site's `src/lib/fonts.ts`, self-hosted
 * (D10 §11 C1, A5).
 *
 * Self-hosted rather than `next/font/google` for the reason C1 gives: the
 * direction decides the faces, and a direction may list a face Google does
 * not serve. It also removes a third-party request from a KVKK-sensitive
 * demo page.
 *
 * **No weight is pinned.** A variable face loaded at a single weight cannot
 * do an optical-size curve, which is what made every run before D10 read as
 * the same 2014 web page whatever family was chosen. `next/font/local` takes
 * the full range through `weight: "100 900"` on the variable faces.
 */
export interface LocalFontPlan {
  /** Faces to copy into the run's `public/fonts/`. */
  faces: Face[];
  /** The contents of `src/lib/fonts.ts`. */
  module: string;
}

export function planLocalFonts(spec: DesignSpec): LocalFontPlan {
  const wanted: Array<[role: string, family: string]> = [
    ["display", spec.type.display],
    ["body", spec.type.body],
    ...(spec.type.mono === undefined
      ? []
      : ([["mono", spec.type.mono]] as Array<[string, string]>)),
  ];

  const faces: Face[] = [];
  const decls: string[] = [];

  for (const [role, family] of wanted) {
    const face = FACE_BY_FAMILY.get(family);
    if (!face) {
      throw new Error(
        `${family} is not in the face registry (design/faces.ts). ` +
          "A direction may only list a vendored, free-licence face " +
          "(D10 §13 Q2).",
      );
    }
    // display and body may legitimately be the same family — several
    // directions pair a face with itself. Copy it once.
    if (!faces.some((f) => f.slug === face.slug)) faces.push(face);
    decls.push(declaration(role, face));
  }

  return {
    faces,
    module: `// Generated from design.json by the design stage — do not hand-edit.
// direction: ${spec.direction}
//
// Self-hosted from public/fonts (D10 §11 C1); every face is free
// open-licence (§13 Q2) and its OFL.txt ships beside the woff2.
//
// Weights are NOT pinned: a variable face loaded at one weight cannot do an
// optical-size curve, which is what made earlier runs read as the same page
// whatever family was chosen.
import localFont from "next/font/local";

${decls.join("\n\n")}

/** Every variable, for the <html> className. */
export const fontVariables = ${variablesExpr(wanted.map(([role]) => role))};
`,
  };
}

function declaration(role: string, face: Face): string {
  const name = `${role}Font`;
  const sources = ["latin", "latin-ext"]
    .map(
      (subset) =>
        `    { path: "../../public/fonts/${face.slug}/${face.slug}-${subset}.woff2", style: "normal" }`,
    )
    .join(",\n");

  return `/** ${face.family} — ${face.licence}${face.variable ? ", variable" : ""}. */
export const ${name} = localFont({
  src: [
${sources},
  ],
  variable: "--font-${role}-face",
  display: "swap",${face.variable ? '\n  weight: "100 900",' : ""}
  // The browser falls back here only while the face loads; a Turkish page
  // with a metric-mismatched fallback shifts visibly, so the adjustment
  // stays with the system stack rather than an arbitrary alternative.
  fallback: ["system-ui", "sans-serif"],
});`;
}

const variablesExpr = (roles: string[]): string =>
  "`" + roles.map((r) => `\${${r}Font.variable}`).join(" ") + "`";

/**
 * Copy the planned faces into a run's site directory.
 *
 * The woff2 files live once in `data/fonts/` and are copied per run rather
 * than vendored into every template copy: a client site needs the two or
 * three faces its direction chose, not all eleven. The OFL.txt travels with
 * them — OFL §2 requires it, and a generated site is a redistribution.
 */
export function copyFaces(
  plan: LocalFontPlan,
  repoRoot: string,
  siteDir: string,
): void {
  for (const face of plan.faces) {
    const from = join(repoRoot, "data", "fonts", face.slug);
    const to = join(siteDir, "public", "fonts", face.slug);
    if (!existsSync(from)) {
      throw new Error(
        `${face.family} is not vendored: run apps/orchestrator/scripts/vendor-fonts.mjs`,
      );
    }
    mkdirSync(to, { recursive: true });
    cpSync(from, to, { recursive: true });
  }
}
