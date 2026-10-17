import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRunState,
  domainFromUrl,
  readRunState,
  transitionStage,
  writeRunState,
} from "./state.js";
import { openStore, recordEvent, syncRunToDb, schema } from "./db/index.js";

describe("domainFromUrl", () => {
  it("strips www and protocol", () => {
    expect(domainFromUrl("https://www.ornek.com.tr/hizmetler")).toBe("ornek.com.tr");
    expect(domainFromUrl("ornek.com.tr")).toBe("ornek.com.tr");
    expect(domainFromUrl("http://Ornek.COM.tr")).toBe("ornek.com.tr");
  });
});

describe("state.json helpers", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pipeline-state-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips a run state", () => {
    const state = createRunState({
      domain: "ornek.com.tr",
      url: "https://ornek.com.tr",
      source: "manual",
    });
    writeRunState(state, dir);
    const read = readRunState("ornek.com.tr", dir);
    expect(read).not.toBeNull();
    expect(read?.domain).toBe("ornek.com.tr");
    expect(read?.stages.crawl.status).toBe("pending");
  });

  it("returns null for a missing run", () => {
    expect(readRunState("yok.com.tr", dir)).toBeNull();
  });

  it("counts attempts and accumulates cost on transitions", () => {
    const state = createRunState({
      domain: "ornek.com.tr",
      url: "https://ornek.com.tr",
      source: "discover",
    });
    transitionStage(state, "crawl", "running");
    transitionStage(state, "crawl", "failed", { error: "timeout" });
    transitionStage(state, "crawl", "running");
    transitionStage(state, "crawl", "passed", { costUsd: 0.5 });
    expect(state.stages.crawl.attempts).toBe(2);
    expect(state.stages.crawl.status).toBe("passed");
    expect(state.totalCostUsd).toBe(0.5);
  });
});

describe("sqlite store", () => {
  it("mirrors run state and records events in memory", () => {
    const store = openStore({ memory: true });
    const state = createRunState({
      domain: "ornek.com.tr",
      url: "https://ornek.com.tr",
      source: "manual",
    });
    transitionStage(state, "crawl", "running");
    syncRunToDb(store, state);
    recordEvent(store, {
      domain: "ornek.com.tr",
      stage: "crawl",
      type: "stage:start",
      message: "crawl started",
    });

    const runs = store.select().from(schema.runs).all();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.currentStage).toBe("crawl");
    const stages = store.select().from(schema.stages).all();
    expect(stages).toHaveLength(7);
    const events = store.select().from(schema.events).all();
    expect(events[0]?.type).toBe("stage:start");
  });

  it("upserts on repeated sync", () => {
    const store = openStore({ memory: true });
    const state = createRunState({
      domain: "ornek.com.tr",
      url: "https://ornek.com.tr",
      source: "manual",
    });
    syncRunToDb(store, state);
    state.status = "running";
    syncRunToDb(store, state);
    const runs = store.select().from(schema.runs).all();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("running");
  });
});
