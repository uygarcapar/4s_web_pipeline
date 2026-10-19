/**
 * Shared domain types for the pipeline.
 * File-system artifacts (state.json, issues.json, facts.json) are the source
 * of truth; the SQLite store mirrors them for the admin panel.
 */

export const STAGES = [
  "crawl",
  "audit",
  // `design` derives the site's DNA — palette, type pairing, section
  // archetypes, motion signature — before any copy or markup exists, so that
  // two clients in the same sector cannot come out as the same site
  // (docs/DECISIONS.md D6, template/design-rules.md §10).
  "design",
  "plan",
  "generate",
  "verify",
  "notify",
  "deploy",
] as const;
export type Stage = (typeof STAGES)[number];

/**
 * Stages the `run` command executes automatically. `deploy` is manual-only
 * (docs/DECISIONS.md D1): sites finish locally, the operator is notified
 * after verify, and Vercel deploys happen only via `pipeline deploy <domain>`.
 */
export const AUTO_STAGES = [
  "crawl",
  "audit",
  "design",
  "plan",
  "generate",
  "verify",
  "notify",
] as const satisfies readonly Stage[];

export type StageStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped";

export type RunStatus =
  | "queued"
  | "running"
  | "blocked" // escalated to human (BLOCKED.md written)
  | "completed"
  | "failed"
  | "cancelled";

export interface StageState {
  status: StageStatus;
  attempts: number;
  startedAt?: string; // ISO 8601
  finishedAt?: string;
  costUsd?: number;
  error?: string;
}

/** Persisted at runs/<domain>/state.json on every transition. */
export interface RunState {
  domain: string;
  url: string;
  source: "discover" | "manual";
  status: RunStatus;
  currentStage: Stage | null;
  stages: Record<Stage, StageState>;
  previewUrl?: string;
  vercelProjectId?: string;
  totalCostUsd: number;
  createdAt: string;
  updatedAt: string;
}

export type LeadTier = "A" | "B" | "C";

export type LeadOutcome =
  | "not_called"
  | "no_answer"
  | "interested"
  | "meeting"
  | "sold"
  | "rejected";

/** One discovered business (Ek A). Persisted in leads/*.csv and the DB. */
export interface Lead {
  placeId: string;
  name: string;
  phone: string | null; // E.164 (+90...)
  website: string | null;
  rating: number;
  reviewCount: number;
  category: string; // sector query, e.g. "diş kliniği"
  district: string;
  usesWebsite: boolean;
  activityScore: number | null; // website-activity.ts score
  psiMobile: number | null; // PSI mobile performance 0-100, candidates only
  tier: LeadTier | null;
  topIssuesTr: string[]; // max 3, Turkish, for the pre-call mini report
  batchId: string; // discovery batch this lead belongs to
  approved: boolean;
  calledAt: string | null;
  outcome: LeadOutcome;
  optedOut: boolean; // 6563 / KVKK: never contact or crawl again
}

export interface QueueItem {
  id: number;
  url: string;
  domain: string;
  source: "discover" | "manual";
  approved: boolean;
  priority: number; // lower = earlier
  status: "waiting" | "running" | "done" | "failed" | "cancelled";
  leadPlaceId: string | null;
  addedAt: string;
}

export const ISSUE_CATEGORIES = [
  "performance",
  "seo_technical",
  "seo_local",
  "accessibility",
  "ux_design",
  "content_conversion",
  "legal_tr",
  "security",
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

export type IssueSeverity = "critical" | "high" | "medium" | "low";

/** One audit finding. Array persisted at runs/<domain>/audit/issues.json. */
export interface Issue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string; // English, engineering backlog
  title_tr: string; // Turkish, customer report
  evidence: string[];
  affected_urls: string[];
  fix: string;
  effort: "low" | "medium" | "high";
  business_impact: string;
  source_tool: string; // "lighthouse" | "axe" | "rule:<id>" | "psi" | ...
  confidence: number; // 0-1
}

export interface OpeningHoursEntry {
  /** ISO weekday 1 = Monday ... 7 = Sunday */
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  opens: string | null; // "09:00", null = closed
  closes: string | null;
}

/**
 * Ground-truth business facts extracted deterministically by crawl/audit.
 * Verbatim in generated sites — the LLM never invents or edits these.
 * Persisted at runs/<domain>/audit/facts.json.
 */
export interface Facts {
  businessName: string;
  legalName: string | null;
  phoneE164: string | null; // +905XXXXXXXXX
  whatsappE164: string | null;
  email: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  mapsEmbedQuery: string | null; // place query for Maps Embed API
  openingHours: OpeningHoursEntry[];
  services: string[];
  prices: { service: string; priceTry: number }[];
  socialLinks: { platform: string; url: string }[];
  /** Per-fact provenance: where each value was extracted from. */
  sources: Record<string, string>;
}

/** A row in the events table; drives the admin panel SSE stream. */
export interface PipelineEvent {
  id: number;
  domain: string | null;
  stage: Stage | null;
  type: string; // "stage:start" | "stage:pass" | "stage:fail" | "run:*" | "queue:*" | ...
  message: string; // English, for logs/traces
  data: Record<string, unknown> | null;
  createdAt: string;
}
