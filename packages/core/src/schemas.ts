import { z } from "zod";
import { ISSUE_CATEGORIES, STAGES } from "./types.js";

/** Zod mirrors of the artifact types — used to validate LLM/stage output. */

export const issueSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum(ISSUE_CATEGORIES),
    severity: z.enum(["critical", "high", "medium", "low"]),
    title: z.string().min(1),
    title_tr: z.string().min(1),
    evidence: z.array(z.string()),
    affected_urls: z.array(z.string()),
    fix: z.string(),
    effort: z.enum(["low", "medium", "high"]),
    business_impact: z.string(),
    source_tool: z.string(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const issuesFileSchema = z.array(issueSchema);

const e164Tr = z
  .string()
  .regex(/^\+90\d{10}$/, "must be E.164 Turkish number (+90XXXXXXXXXX)");

export const factsSchema = z
  .object({
    businessName: z.string().min(1),
    legalName: z.string().nullable(),
    phoneE164: e164Tr.nullable(),
    whatsappE164: e164Tr.nullable(),
    email: z.email().nullable(),
    address: z.string().nullable(),
    district: z.string().nullable(),
    city: z.string().nullable(),
    mapsEmbedQuery: z.string().nullable(),
    openingHours: z.array(
      z
        .object({
          day: z.union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(5),
            z.literal(6),
            z.literal(7),
          ]),
          opens: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
          closes: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
        })
        .strict(),
    ),
    /** Hours published without a day mapping, verbatim (DECISIONS D8). */
    hoursNote: z.string().min(1).nullable(),
    services: z.array(z.string()),
    prices: z.array(
      z.object({ service: z.string(), priceTry: z.number() }).strict(),
    ),
    socialLinks: z.array(
      z.object({ platform: z.string(), url: z.url() }).strict(),
    ),
    sources: z.record(z.string(), z.string()),
  })
  .strict();

export const stageStateSchema = z
  .object({
    status: z.enum(["pending", "running", "passed", "failed", "skipped"]),
    attempts: z.number().int().min(0),
    startedAt: z.string().optional(),
    finishedAt: z.string().optional(),
    costUsd: z.number().optional(),
    error: z.string().optional(),
  })
  .strict();

export const runStateSchema = z
  .object({
    domain: z.string().min(1),
    url: z.url(),
    source: z.enum(["discover", "manual"]),
    status: z.enum([
      "queued",
      "running",
      "blocked",
      "completed",
      "failed",
      "cancelled",
    ]),
    // Derived from STAGES rather than restated: the hand-written list had
    // drifted and was missing "design", so every run that reached that stage
    // wrote a state.json this schema then refused to read back.
    currentStage: z.enum(STAGES).nullable(),
    stages: z.record(z.string(), stageStateSchema),
    previewUrl: z.url().optional(),
    vercelProjectId: z.string().optional(),
    totalCostUsd: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
