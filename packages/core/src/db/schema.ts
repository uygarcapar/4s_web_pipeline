import {
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * SQLite mirror of the file-system artifacts (Ek C.2).
 * The orchestrator writes here on every stage transition; the admin panel
 * only reads (plus command endpoints that shell out to the CLI).
 */

export const runs = sqliteTable("runs", {
  domain: text("domain").primaryKey(),
  url: text("url").notNull(),
  source: text("source", { enum: ["discover", "manual"] }).notNull(),
  status: text("status", {
    enum: ["queued", "running", "blocked", "completed", "failed", "cancelled"],
  }).notNull(),
  currentStage: text("current_stage"),
  previewUrl: text("preview_url"),
  vercelProjectId: text("vercel_project_id"),
  totalCostUsd: real("total_cost_usd").notNull().default(0),
  lighthouseBefore: integer("lighthouse_before"),
  lighthouseAfter: integer("lighthouse_after"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const stages = sqliteTable("stages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain").notNull(),
  stage: text("stage").notNull(),
  status: text("status", {
    enum: ["pending", "running", "passed", "failed", "skipped"],
  }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  costUsd: real("cost_usd"),
  error: text("error"),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain"),
  stage: text("stage"),
  type: text("type").notNull(),
  message: text("message").notNull(),
  data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at").notNull(),
});

export const queue = sqliteTable("queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull(),
  domain: text("domain").notNull().unique(),
  source: text("source", { enum: ["discover", "manual"] }).notNull(),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  priority: integer("priority").notNull().default(100),
  status: text("status", {
    enum: ["waiting", "running", "done", "failed", "cancelled"],
  })
    .notNull()
    .default("waiting"),
  leadPlaceId: text("lead_place_id"),
  addedAt: text("added_at").notNull(),
});

export const leads = sqliteTable("leads", {
  placeId: text("place_id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  website: text("website"),
  rating: real("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  category: text("category").notNull(),
  district: text("district").notNull(),
  usesWebsite: integer("uses_website", { mode: "boolean" })
    .notNull()
    .default(false),
  activityScore: integer("activity_score"),
  psiMobile: integer("psi_mobile"),
  tier: text("tier", { enum: ["A", "B", "C"] }),
  topIssuesTr: text("top_issues_tr", { mode: "json" }).$type<string[]>(),
  batchId: text("batch_id").notNull(),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  calledAt: text("called_at"),
  outcome: text("outcome", {
    enum: ["not_called", "no_answer", "interested", "meeting", "sold", "rejected"],
  })
    .notNull()
    .default("not_called"),
  optedOut: integer("opted_out", { mode: "boolean" }).notNull().default(false),
});

export const approvals = sqliteTable("approvals", {
  batchId: text("batch_id").primaryKey(),
  sector: text("sector").notNull(),
  district: text("district").notNull(),
  foundCount: integer("found_count").notNull().default(0),
  tierACount: integer("tier_a_count").notNull().default(0),
  status: text("status", {
    enum: ["pending_approval", "approved", "dismissed"],
  })
    .notNull()
    .default("pending_approval"),
  createdAt: text("created_at").notNull(),
  decidedAt: text("decided_at"),
});

export const costs = sqliteTable("costs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain"),
  stage: text("stage"),
  model: text("model"),
  costUsd: real("cost_usd").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  numTurns: integer("num_turns"),
  createdAt: text("created_at").notNull(),
});

/**
 * One row per generated site's design DNA. This is the ledger that makes
 * "sites must not be copies of each other" a guarantee rather than a hope
 * (docs/DECISIONS.md D6, template/design-rules.md §10.4): the design stage
 * reads recent rows for the same sector and refuses to emit a fingerprint
 * that is already there.
 */
export const designs = sqliteTable("designs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain").notNull(),
  sector: text("sector").notNull(),
  fingerprint: text("fingerprint").notNull(),
  paletteName: text("palette_name").notNull(),
  paletteHue: integer("palette_hue").notNull(),
  typePairId: text("type_pair_id").notNull(),
  density: text("density").notNull(),
  headlineGrammar: text("headline_grammar").notNull(),
  /** JSON: the per-section archetype choices and the motion signature. */
  archetypes: text("archetypes").notNull(),
  motion: text("motion").notNull(),
  /**
   * The D10 direction this run was built in (§6.2). Nullable because rows
   * written before the design space existed have no answer, and inventing
   * one for them would skew the rotation penalty against whichever direction
   * we guessed. The scorer counts across ALL sectors, unlike `fingerprint`
   * above, which is scoped to one — see `recentDirectionUsage`.
   */
  direction: text("direction"),
  createdAt: text("created_at").notNull(),
});
