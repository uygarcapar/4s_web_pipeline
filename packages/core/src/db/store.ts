import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema.js";

export type Store = BetterSQLite3Database<typeof schema> & {
  $client: Database.Database;
};

/**
 * Hand-written DDL kept in sync with schema.ts. Milestone 1 keeps migrations
 * this simple on purpose (single-file DB, additive changes only); if the
 * schema starts churning, switch to drizzle-kit generated migrations.
 *
 * `CREATE TABLE IF NOT EXISTS` covers a fresh database and does nothing at
 * all to an existing one, so a column added here never reaches the operator's
 * `data/pipeline.db` — `ADDED_COLUMNS` below closes that, which is the whole
 * of "additive changes only" made to actually work.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL,
  sector TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  palette_name TEXT NOT NULL,
  palette_hue INTEGER NOT NULL,
  type_pair_id TEXT NOT NULL,
  density TEXT NOT NULL,
  headline_grammar TEXT NOT NULL,
  archetypes TEXT NOT NULL,
  motion TEXT NOT NULL,
  direction TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_designs_sector ON designs(sector, created_at);
CREATE INDEX IF NOT EXISTS idx_designs_domain ON designs(domain);
CREATE TABLE IF NOT EXISTS runs (
  domain TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  current_stage TEXT,
  preview_url TEXT,
  vercel_project_id TEXT,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  lighthouse_before INTEGER,
  lighthouse_after INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  finished_at TEXT,
  cost_usd REAL,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_stages_domain ON stages(domain);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT,
  stage TEXT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_domain ON events(domain);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE TABLE IF NOT EXISTS queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'waiting',
  lead_place_id TEXT,
  added_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
  place_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  rating REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  district TEXT NOT NULL,
  uses_website INTEGER NOT NULL DEFAULT 0,
  activity_score INTEGER,
  psi_mobile INTEGER,
  tier TEXT,
  top_issues_tr TEXT,
  batch_id TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  called_at TEXT,
  outcome TEXT NOT NULL DEFAULT 'not_called',
  opted_out INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_leads_batch ON leads(batch_id);
CREATE TABLE IF NOT EXISTS approvals (
  batch_id TEXT PRIMARY KEY,
  sector TEXT NOT NULL,
  district TEXT NOT NULL,
  found_count INTEGER NOT NULL DEFAULT 0,
  tier_a_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE TABLE IF NOT EXISTS costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT,
  stage TEXT,
  model TEXT,
  cost_usd REAL NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  num_turns INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_costs_domain ON costs(domain);
`;

/**
 * Columns added to a table after it shipped, applied to databases that
 * already exist.
 *
 * Every entry must be nullable or carry a DEFAULT — SQLite's `ADD COLUMN`
 * cannot add a NOT NULL column without one, and a column the existing rows
 * genuinely have no value for should be nullable anyway.
 */
const ADDED_COLUMNS: { table: string; column: string; type: string }[] = [
  { table: "designs", column: "direction", type: "TEXT" },
];

function applyAddedColumns(client: Database.Database): void {
  for (const { table, column, type } of ADDED_COLUMNS) {
    const existing = client
      .prepare(`PRAGMA table_info(${table})`)
      .all() as { name: string }[];
    if (existing.some((c) => c.name === column)) continue;
    client.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

export interface OpenStoreOptions {
  /** Path to the SQLite file. Defaults to data/pipeline.db under cwd/repo root. */
  dbPath?: string;
  /** In-memory database for tests. */
  memory?: boolean;
}

export function openStore(options: OpenStoreOptions = {}): Store {
  const path = options.memory ? ":memory:" : (options.dbPath ?? "data/pipeline.db");
  if (!options.memory) {
    mkdirSync(dirname(path), { recursive: true });
  }
  const client = new Database(path);
  client.pragma("journal_mode = WAL");
  client.pragma("foreign_keys = ON");
  client.exec(DDL);
  applyAddedColumns(client);
  return drizzle(client, { schema }) as Store;
}
