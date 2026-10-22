import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageContext, StageModule } from "./types.js";
import { runLlmSession } from "../llm/session.js";
import { detectSector } from "./design.js";
import { readManifest } from "../design/sample.js";

/**
 * Brief stage (LLM, cheap). The deliberation step the pipeline was missing
 * (docs/DECISIONS.md D9).
 *
 * `design` picks a type pairing from the sector and a layout from a kit, so a
 * beauty centre with nineteen treatments and no staff got the same skeleton as
 * a dental clinic with six doctors. This stage reads what the crawl actually
 * found and writes a problem statement first: what the business is, who walks
 * in, the one job the site has to do, and which of its material is strong
 * enough to lead with.
 *
 * The model is handed a measured inventory rather than raw pages, for the
 * reason PLAN.md gives about UX critique: feed it the facts extracted from the
 * DOM so it reasons over evidence instead of guessing. It is explicitly told
 * it may not invent anything about the business.
 *
 * Output:
 *   runs/<domain>/brief/brief.json — read by design, plan and generate
 *   runs/<domain>/brief/brief.md   — the same thing for the operator
 */
export const briefStage: StageModule = {
  stage: "brief",
  artifactPath: (ctx) => join(ctx.runDir, "brief", "brief.json"),

  async run(ctx) {
    const facts = readJson<Record<string, unknown>>(
      join(ctx.runDir, "audit", "facts.json"),
    );
    if (!facts) {
      return { ok: false, error: "audit/facts.json missing — run the audit stage first" };
    }

    const evidence = collectEvidence(ctx, facts);
    ctx.log(
      `evidence: ${evidence.services.total} services ` +
        `(${evidence.services.withPhoto} with a photograph), ` +
        `${evidence.team} people, ${evidence.faq} FAQ, ${evidence.photos} photographs`,
      { sector: evidence.sector },
    );

    const result = await runLlmSession({
      prompt: buildPrompt(evidence),
      cwd: ctx.runDir,
      model: process.env.BRIEF_MODEL ?? "claude-sonnet-5",
      maxTurns: Number.parseInt(process.env.BRIEF_MAX_TURNS ?? "4", 10),
      maxBudgetUsd: Number.parseFloat(process.env.BRIEF_BUDGET_USD ?? "0.5"),
      allowedTools: [],
      effort: "medium",
      outputSchema: BRIEF_SCHEMA,
      log: ctx.log,
    });

    if (!result.ok) {
      return { ok: false, error: result.error ?? "brief session failed", costUsd: result.costUsd };
    }

    let brief: Brief;
    try {
      brief = JSON.parse(result.text) as Brief;
    } catch {
      return {
        ok: false,
        error: "brief session returned output that is not JSON",
        costUsd: result.costUsd,
      };
    }

    const outDir = join(ctx.runDir, "brief");
    mkdirSync(outDir, { recursive: true });
    // brief.md first: brief.json is the idempotency artifact and must be last.
    writeFileSync(join(outDir, "brief.md"), renderBriefMarkdown(brief, evidence));
    writeFileSync(
      join(outDir, "brief.json"),
      JSON.stringify({ ...brief, evidence }, null, 2) + "\n",
    );

    ctx.log(`brief: ${brief.theOneJob}`, { emphasis: brief.emphasis });
    return {
      ok: true,
      costUsd: result.costUsd,
      data: { theOneJob: brief.theOneJob, emphasis: brief.emphasis.length },
    };
  },
};

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

export interface BriefEvidence {
  businessName: string;
  sector: string;
  district: string | null;
  city: string | null;
  services: { total: number; withPhoto: number; names: string[] };
  team: number;
  faq: number;
  photos: number;
  hasPrices: boolean;
  hoursShape: "per-day" | "note-only" | "none";
  hasWhatsapp: boolean;
  socialPlatforms: string[];
  /** The client's own longest sentence — the candidate for a statement section. */
  statementCandidate: string | null;
  contentBlocks: number;
}

/**
 * Everything the brief reasons over, measured rather than inferred. Nothing
 * here is a judgement; the model supplies those.
 */
function collectEvidence(
  ctx: StageContext,
  facts: Record<string, unknown>,
): BriefEvidence {
  const content = readJson<{
    pages?: { contentBlocks?: { tag: string; text: string }[] }[];
    faq?: unknown[];
    services?: { title: string; description: string }[];
  }>(join(ctx.runDir, "crawl", "content.json"));

  const services = content?.services ?? [];
  const manifest = readManifest(ctx.runDir);
  const photos = manifest.filter(
    (m) => typeof m.width === "number" && m.width > 0,
  ).length;

  const blocks = (content?.pages ?? []).flatMap((p) => p.contentBlocks ?? []);
  const businessName = String(facts.businessName ?? "");
  const statementCandidate = pickStatementSentence(blocks, businessName);

  const openingHours = Array.isArray(facts.openingHours) ? facts.openingHours : [];
  const hoursShape: BriefEvidence["hoursShape"] =
    openingHours.length > 0
      ? "per-day"
      : typeof facts.hoursNote === "string"
        ? "note-only"
        : "none";

  const social = Array.isArray(facts.socialLinks)
    ? (facts.socialLinks as { platform?: string }[])
        .map((s) => s.platform)
        .filter((p): p is string => typeof p === "string")
    : [];

  return {
    businessName: businessName || ctx.domain,
    sector: detectSector(facts, ctx.runDir),
    district: typeof facts.district === "string" ? facts.district : null,
    city: typeof facts.city === "string" ? facts.city : null,
    services: {
      total: services.length,
      withPhoto: 0, // photographs are matched to services in generate, not here
      names: services.slice(0, 40).map((s) => s.title),
    },
    team: 0,
    faq: (content?.faq ?? []).length,
    photos,
    hasPrices: Array.isArray(facts.prices) && facts.prices.length > 0,
    hoursShape,
    hasWhatsapp: typeof facts.whatsappE164 === "string",
    socialPlatforms: social,
    statementCandidate,
    contentBlocks: blocks.length,
  };
}

const MIN_STATEMENT = 60;
const MAX_STATEMENT = 320;

/**
 * The longest single paragraph sentence the business wrote about itself — the
 * candidate for a statement section (pattern-library.md §2.1). Returned
 * verbatim: the generate stage may trim it at punctuation but never rewrite
 * it, because no claim on a client's site may be ours.
 */
export function pickStatementSentence(
  blocks: { tag: string; text: string }[],
  businessName?: string,
): string | null {
  const sentences: string[] = [];
  for (const block of blocks) {
    if (block.tag !== "p") continue;
    for (const raw of block.text.split(/(?<=[.!?])\s+/)) {
      const s = raw.trim();
      if (s.length >= MIN_STATEMENT && s.length <= MAX_STATEMENT) sentences.push(s);
    }
  }
  if (sentences.length === 0) return null;

  // Scored, not just filtered. Ranking first-person sentences by length alone
  // picked a treatment description ("Yosun Peeling ... kabul edilir") over the
  // business's own "X olarak ... hizmet vermekteyiz" — longest wins is the
  // wrong tie-break when a services page is full of long prose. Naming the
  // business is the strongest signal that a sentence is about the business.
  const nameWords = (businessName ?? "")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4);

  const score = (s: string): number => {
    let n = 0;
    if (nameWords.length > 0 && nameWords.every((w) => s.includes(w))) n += 100;
    else if (nameWords.some((w) => s.includes(w))) n += 60;
    // The business speaking about itself, rather than about a treatment.
    if (/\b(olarak)\b/i.test(s)) n += 25;
    if (/(vermekteyiz|sunmaktayız|hizmet veriyoruz|sunuyoruz|ediyoruz|yapıyoruz)/i.test(s)) n += 25;
    if (/(amacımız|misyonumuz|ekibimiz|merkezimiz|kliniğimiz|firmamız)/i.test(s)) n += 20;
    // Third-person product copy: a sentence that explains a treatment is not
    // a statement about the business.
    if (/(tedavisi|uygulaması|yöntemidir|kabul edilir|kullanılır|sağlar)\b/i.test(s)) n -= 40;
    return n;
  };

  const ranked = sentences
    .map((s) => ({ s, n: score(s) }))
    .sort((a, b) => (b.n !== a.n ? b.n - a.n : b.s.length - a.s.length));
  const best = ranked[0];
  // Nothing scored as the business speaking: let the brief decide it is
  // unusable rather than handing it a product paragraph.
  return best && best.n > 0 ? best.s : null;
}

/* ------------------------------------------------------------------ */
/* Prompt + schema                                                     */
/* ------------------------------------------------------------------ */

interface Brief {
  businessKind: string;
  whoWalksIn: string;
  theOneJob: string;
  emphasis: string[];
  leadWith: string;
  thinnest: string;
  missing: string[];
  statementUsable: boolean;
}

/**
 * The section ids the template can actually render. The brief orders these
 * and nothing else: on the first run it answered "location-and-hours", which
 * matched no section and silently dropped out of the ordering. Keep in step
 * with `ARCHETYPES` in design/dna.ts.
 */
const SECTION_VOCABULARY = [
  "statement",
  "services",
  "team",
  "gallery",
  "testimonials",
  "visit",
  "faq",
  "contact",
] as const;

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessKind",
    "whoWalksIn",
    "theOneJob",
    "emphasis",
    "leadWith",
    "thinnest",
    "missing",
    "statementUsable",
    "tone",
    "tier",
    "audience",
    "contentVolume",
  ],
  properties: {
    /*
     * D10 §6.1. Enum-heavy on purpose: these four are what the direction
     * scorer reads (§6.2), and a free-text "premium-ish, quite warm" cannot
     * be scored. They sit in the same call as the prose fields because the
     * judgement is the same judgement — asking twice would cost a second
     * session to reach a less consistent answer.
     */
    tone: {
      type: "string",
      enum: ["warm", "clinical", "premium", "playful", "traditional", "technical"],
      description:
        "How this business presents itself in its OWN words, not how its sector usually does.",
    },
    tier: {
      type: "string",
      enum: ["budget", "mid", "premium"],
      description:
        "Price positioning as the current site implies it. Absent prices and plain language read mid, not premium.",
    },
    audience: {
      type: "string",
      enum: ["local-everyday", "local-premium", "b2b", "tourist"],
      description: "Who the site is for, from who the current site addresses.",
    },
    contentVolume: {
      type: "string",
      enum: ["poster", "standard", "editorial"],
      description:
        "How much of their own usable text exists: poster is a handful of lines, editorial is pages someone wrote.",
    },
    businessKind: {
      type: "string",
      description:
        "What this business actually is, in one English clause. Specific to this client, not the sector slug.",
    },
    whoWalksIn: {
      type: "string",
      description: "Who the customer is and what they arrive wanting.",
    },
    theOneJob: {
      type: "string",
      description: "The single job this site must do for this business.",
    },
    emphasis: {
      type: "array",
      items: { type: "string", enum: [...SECTION_VOCABULARY] },
      description:
        "Sections in the order they should lead, strongest first. Use only the listed ids, and only ones this client has material for.",
    },
    leadWith: {
      type: "string",
      description: "The strongest piece of material this business has.",
    },
    thinnest: {
      type: "string",
      description: "The weakest part of the material, which the design must not lean on.",
    },
    missing: {
      type: "array",
      items: { type: "string" },
      description:
        "Facts or sections this site cannot have because the business does not publish them.",
    },
    statementUsable: {
      type: "boolean",
      description:
        "Whether the supplied statement candidate is a sentence the business would stand behind as a headline claim.",
    },
  },
} as const;

function buildPrompt(e: BriefEvidence): string {
  return `You are writing the design brief for a rebuild of a Turkish small-business website.

This is a problem statement, not a design. Do not choose colours, fonts or layouts — later stages do that, deterministically.

EVIDENCE (measured from the client's current site; nothing here is a guess):
- business: ${e.businessName}
- detected sector: ${e.sector}
- location: ${e.district ?? "unknown"} / ${e.city ?? "unknown"}
- services published: ${e.services.total}
${e.services.names.length ? `  ${e.services.names.join(", ")}` : "  (none found)"}
- people/staff published: ${e.team}
- FAQ pairs: ${e.faq}
- usable photographs: ${e.photos}
- prices published: ${e.hasPrices ? "yes" : "no"}
- opening hours: ${e.hoursShape === "per-day" ? "per-day mapping" : e.hoursShape === "note-only" ? "a single range with no days named" : "not published"}
- WhatsApp: ${e.hasWhatsapp ? "advertised" : "not advertised"}
- social profiles: ${e.socialPlatforms.length ? e.socialPlatforms.join(", ") : "none"}
- total content blocks crawled: ${e.contentBlocks}
- the business's own longest sentence about itself:
${e.statementCandidate ? `  "${e.statementCandidate}"` : "  (none found)"}

SECTIONS the template can render (use these exact ids in "emphasis", and only ones this client has material for):
${SECTION_VOCABULARY.join(", ")}

RULES:
- Every claim you make must follow from the evidence above. You may not invent a speciality, a history, a staff member, a price or a selling point.
- If the evidence is thin, say so in "thinnest" rather than filling the gap.
- "missing" lists what this site cannot truthfully have, so later stages do not plan a section for it.
- Judge "statementUsable" on whether that sentence reads as the business speaking about itself. If it is a cookie notice, a nav fragment or boilerplate, it is not usable.
- Write in English. The generated site's copy is Turkish, but this brief is engineering input.

Return only the JSON object.`;
}

function renderBriefMarkdown(brief: Brief, e: BriefEvidence): string {
  return `# Design brief — ${e.businessName}

Generated by the brief stage (docs/DECISIONS.md D9). Everything below follows
from measured evidence; nothing about the business is invented.

- **What it is:** ${brief.businessKind}
- **Who walks in:** ${brief.whoWalksIn}
- **The one job:** ${brief.theOneJob}
- **Lead with:** ${brief.leadWith}
- **Thinnest material:** ${brief.thinnest}

## Emphasis, strongest first

${brief.emphasis.map((x, i) => `${i + 1}. ${x}`).join("\n") || "_none_"}

## Cannot have

${brief.missing.map((x) => `- ${x}`).join("\n") || "_nothing flagged_"}

## Statement sentence

${
  e.statementCandidate
    ? `${brief.statementUsable ? "**Usable.**" : "**Not usable.**"}\n\n> ${e.statementCandidate}`
    : "_The business published no sentence about itself._"
}

## Evidence

| | |
|---|---|
| sector | ${e.sector} |
| services | ${e.services.total} |
| people | ${e.team} |
| FAQ | ${e.faq} |
| photographs | ${e.photos} |
| prices | ${e.hasPrices ? "published" : "not published"} |
| hours | ${e.hoursShape} |
| WhatsApp | ${e.hasWhatsapp ? "advertised" : "not advertised"} |
| content blocks | ${e.contentBlocks} |
`;
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}
