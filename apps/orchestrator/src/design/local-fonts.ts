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

export type FontRoleName = "display" | "body" | "mono";

export interface FontRole {
  role: FontRoleName;
  family: string;
  face: Face;
  /** The CSS variable that actually carries this face. */
  variable: string;
  /** False when an earlier role already declared this family. */
  declares: boolean;
}

/**
 * Which face serves each role, with families declared exactly once.
 *
 * Several directions pair a face with itself — `swiss-grid` is Archivo over
 * Archivo — and the first version of this emitted two `localFont()` calls
 * over the same two woff2 files. Next treats those as independent fonts, so
 * the page downloaded Archivo twice and LCP measured 3684 ms against a
 * 3500 ms budget. Deduplicating here is also why the token generator reads
 * this function rather than assuming `--font-body-face` always exists: when
 * body reuses the display face, it does not.
 */
export function fontRoles(spec: DesignSpec): FontRole[] {
  const wanted: Array<[FontRoleName, string]> = [
    ["display", spec.type.display],
    ["body", spec.type.body],
    ...(spec.type.mono === undefined
      ? []
      : ([["mono", spec.type.mono]] as Array<[FontRoleName, string]>)),
  ];

  const declared = new Map<string, string>();
  return wanted.map(([role, family]) => {
    const face = FACE_BY_FAMILY.get(family);
    if (!face) {
      throw new Error(
        `${family} is not in the face registry (design/faces.ts). ` +
          "A direction may only list a vendored, free-licence face " +
          "(D10 §13 Q2).",
      );
    }
    const existing = declared.get(face.slug);
    if (existing !== undefined) {
      return { role, family, face, variable: existing, declares: false };
    }
    const variable = `--font-${role}-face`;
    declared.set(face.slug, variable);
    return { role, family, face, variable, declares: true };
  });
}

export function planLocalFonts(spec: DesignSpec): LocalFontPlan {
  const roles = fontRoles(spec);
  const declaring = roles.filter((r) => r.declares);

  return {
    faces: declaring.map((r) => r.face),
    module: `// Generated from design.json by the design stage — do not hand-edit.
// direction: ${spec.direction}
//
// Self-hosted from public/fonts (D10 §11 C1); every face is free
// open-licence (§13 Q2) and its OFL.txt ships beside the woff2.
//
// Weights are NOT pinned: a variable face loaded at one weight cannot do an
// optical-size curve, which is what made earlier runs read as the same page
// whatever family was chosen.
//
// One declaration per FAMILY, not per role: ${describeRoles(roles)}
import localFont from "next/font/local";

${declaring.map((r) => declaration(r.role, r.face)).join("\n\n")}

/** Every variable, for the <html> className. */
export const fontVariables = ${variablesExpr(declaring.map((r) => r.role))};
`,
  };
}

/** `display+body: Archivo · mono: JetBrains Mono`, for the module header. */
function describeRoles(roles: FontRole[]): string {
  const byVariable = new Map<string, FontRoleName[]>();
  for (const r of roles) {
    byVariable.set(r.variable, [...(byVariable.get(r.variable) ?? []), r.role]);
  }
  return [...byVariable.entries()]
    .map(([variable, names]) => {
      const family = roles.find((r) => r.variable === variable)!.family;
      return `${names.join("+")}: ${family}`;
    })
    .join(" · ");
}

function declaration(role: string, face: Face): string {
  const name = `${role}Font`;
  // One file per family, subset to SUBSET_CHARSET by the vendoring script.
  // This was Google's `latin` + `latin-ext` pair until the first real client:
  // three families meant six requests and 235 KB, the page's heaviest
  // resource class and three times the font budget, and its LCP failed at
  // 3.95 s against a 2.7-3.2 s baseline. Turkish straddles both Google
  // subsets — `ı` is in `latin`, `ğ ş İ` in `latin-ext` — so neither could be
  // dropped; asking for the characters instead gives one file (D10 §11).
  const sources = `    { path: "../../public/fonts/${face.slug}/${face.slug}-tr.woff2", style: "normal" }`;

  // Matched to template/src/lib/fonts.ts, which is the configuration the
  // LCP budget was actually measured against. A generated site loading its
  // fonts differently from the template would be measured against a budget
  // nothing ever met: `preload` on the display face only (it sets the
  // largest text, so it is on the LCP path; the body face resolves below
  // the fold often enough that the extra request costs more than it saves),
  // and `adjustFontFallback: false` because the synthetic metric adjustment
  // measured WORSE here, not better.
  return `/** ${face.family} — ${face.licence}${face.variable ? ", variable" : ""}. */
export const ${name} = localFont({
  src: [
${sources},
  ],
  variable: "--font-${role}-face",
  display: "swap",${face.variable ? '\n  weight: "100 900",' : ""}
  preload: ${role === "display"},
  // A metric-compatible stack: the swap from fallback to face should not
  // move the headline, which is both a CLS cost and visibly cheap.
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
  adjustFontFallback: false,
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
  assertVendored(plan, repoRoot);
  for (const face of plan.faces) {
    const from = join(repoRoot, "data", "fonts", face.slug);
    const to = join(siteDir, "public", "fonts", face.slug);
    mkdirSync(to, { recursive: true });
    cpSync(from, to, { recursive: true });
  }
}

/**
 * Fail now if a planned face is not on disk.
 *
 * Separate from `copyFaces` because the two happen at different stages: the
 * design stage plans the fonts, the generate stage copies them into a site
 * that does not exist yet. Without this, "Instrument Serif was never
 * vendored" surfaces after the plan and generate stages have each spent a
 * model session — the cheapest possible check, placed at the cheapest
 * possible moment.
 */
export function assertVendored(plan: LocalFontPlan, repoRoot: string): void {
  // The woff2 itself, not just the directory. A face vendored under the old
  // two-file layout leaves a populated directory with no `-tr.woff2` in it,
  // which would pass a directory check and then 404 on the generated site —
  // where the only symptom is the page silently rendering in the fallback.
  const missing = plan.faces
    .filter(
      (f) =>
        !existsSync(join(repoRoot, "data", "fonts", f.slug, `${f.slug}-tr.woff2`)),
    )
    .map((f) => f.family);
  if (missing.length > 0) {
    throw new Error(
      `not vendored: ${missing.join(", ")} — run ` +
        "apps/orchestrator/scripts/vendor-fonts.mjs",
    );
  }
}
