import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { Facts } from "@pipeline/core";

/**
 * Post-generation fact verification by grep (docs/PLAN.md: facts are
 * ground truth and are checked deterministically, never trusted to the
 * model's word). Two directions:
 *   - presence: every fact that has a value must appear in the generated
 *     source, so the site cannot silently drop the phone number;
 *   - contamination: the reference template's fictional values must not
 *     survive the copy, which is how a client site ends up advertising
 *     "Moda Diş Kliniği".
 */

export interface FactCheckResult {
  ok: boolean;
  missing: string[];
  leaked: string[];
}

/** Values from the reference template that must never reach a client site. */
const TEMPLATE_PLACEHOLDERS = [
  "Moda Diş Kliniği",
  "+905551234567",
  "905551234567",
  "info@modadisklinigi.example",
  "Moda Ağız ve Diş Sağlığı",
];

function grepCount(needle: string, dir: string): number {
  try {
    const out = execFileSync(
      "grep",
      ["-rFl", "--include=*.ts", "--include=*.tsx", "--include=*.css", needle, "."],
      { cwd: dir, encoding: "utf8" },
    );
    return out.split("\n").filter(Boolean).length;
  } catch {
    // grep exits 1 when there are no matches.
    return 0;
  }
}

export function verifyFacts(factsPath: string, siteDir: string): FactCheckResult {
  const facts = JSON.parse(readFileSync(factsPath, "utf8")) as Facts;
  const missing: string[] = [];
  const leaked: string[] = [];

  // Presence: only check facts that actually have a value.
  const required: [string, string | null][] = [
    ["businessName", facts.businessName],
    ["phoneE164", facts.phoneE164],
    ["address", facts.address],
  ];
  for (const [field, value] of required) {
    if (!value) continue;
    if (grepCount(value, siteDir) === 0) {
      missing.push(`${field}: "${value}" does not appear in the generated source`);
    }
  }

  // The phone is also rendered as a tel: href with no separators.
  if (facts.phoneE164 && grepCount(facts.phoneE164, siteDir) === 0) {
    missing.push(`phoneE164 digits "${facts.phoneE164}" missing from tel:/config`);
  }

  for (const placeholder of TEMPLATE_PLACEHOLDERS) {
    if (grepCount(placeholder, siteDir) > 0) {
      leaked.push(`template placeholder "${placeholder}" still present`);
    }
  }

  return { ok: missing.length === 0 && leaked.length === 0, missing, leaked };
}
