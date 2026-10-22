import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRunState, openStore } from "@pipeline/core";

import { judgeContext } from "./design-judge.js";
import { DIRECTIONS } from "../design/directions/index.js";
import { sampleSpec } from "../design/sample-spec.js";
import type { StageContext } from "./types.js";

/**
 * The context D2 added, which is the other half of two rubric questions.
 *
 * Worth testing because every failure here is silent: a judge given no
 * references still answers DJ18, confidently, about a comparison it could
 * not make — and a judge that does not know the §9 loop fell back reads a
 * correct default as a missing bold element.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");

function makeCtx(runDir: string): StageContext {
  return {
    domain: "ornek.com.tr",
    url: "https://ornek.com.tr",
    runDir,
    repoRoot: REPO_ROOT,
    state: createRunState({
      domain: "ornek.com.tr",
      url: "https://ornek.com.tr",
      source: "manual",
    }),
    store: openStore({ memory: true }),
    log: () => {},
  };
}

function seed(
  runDir: string,
  directionId: string,
  signature: Record<string, unknown> | null,
): void {
  mkdirSync(join(runDir, "design"), { recursive: true });
  const spec = sampleSpec(DIRECTIONS[directionId]!, "ornek.com.tr", 0);
  writeFileSync(
    join(runDir, "design", "design.json"),
    JSON.stringify({ ...spec, signature: { sectionIndex: 1, concept: "the sentence, large" } }),
  );
  if (signature !== null) {
    mkdirSync(join(runDir, "signature"), { recursive: true });
    writeFileSync(join(runDir, "signature", "result.json"), JSON.stringify(signature));
  }
}

describe("judgeContext", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "judge-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("names the direction and what it refuses to do", () => {
    seed(dir, "stark-display", { built: true, rounds: 2 });
    const context = judgeContext(makeCtx(dir));
    expect(context).toContain("stark-display");
    expect(context).toContain("refuses to do");
  });

  /** DJ18's whole question. Without these it is unanswerable. */
  it("gives DJ18 the reference screenshots by absolute path", () => {
    seed(dir, "stark-display", { built: true, rounds: 1 });
    const context = judgeContext(makeCtx(dir));
    for (const ref of DIRECTIONS["stark-display"]!.refs) {
      expect(context).toContain(join(REPO_ROOT, ref));
    }
  });

  it("tells the judge a bespoke signature was accepted", () => {
    seed(dir, "kinetic-bold", { built: true, rounds: 2 });
    const context = judgeContext(makeCtx(dir));
    expect(context).toContain("accepted in round 2");
  });

  /**
   * The failure this exists to prevent: §9 permits the fallback explicitly,
   * and a judge that does not know it happened reports a hard fail for a
   * site that behaved correctly.
   */
  it("tells the judge the default shipped, and that it is not a failure", () => {
    seed(dir, "kinetic-bold", {
      built: false,
      reason: "no round converged; the default signature section ships instead",
    });
    const context = judgeContext(makeCtx(dir));
    expect(context).toContain("DEFAULT signature section shipped");
    expect(context).toContain("design note, not a failure");
  });

  it("treats a missing signature result as an absent section", () => {
    seed(dir, "kinetic-bold", null);
    expect(judgeContext(makeCtx(dir))).toContain("treat the section as absent");
  });

  it("carries the concept through, so DJ11 knows what to look for", () => {
    seed(dir, "swiss-grid", { built: true, rounds: 1 });
    expect(judgeContext(makeCtx(dir))).toContain("the sentence, large");
  });

  /**
   * A direction whose references are missing from disk must make DJ18
   * unanswerable rather than guessable — `null` is a real answer in this
   * rubric and an invented comparison is worse than none.
   */
  it("asks for null when the references are not on disk", () => {
    mkdirSync(join(dir, "design"), { recursive: true });
    const spec = sampleSpec(DIRECTIONS["kinetic-bold"]!, "ornek.com.tr", 0);
    writeFileSync(
      join(dir, "design", "design.json"),
      JSON.stringify({ ...spec, direction: "kinetic-bold" }),
    );
    const ctx = { ...makeCtx(dir), repoRoot: dir };
    const context = judgeContext(ctx);
    expect(context).toContain("No reference screenshots");
    expect(context).toContain("`null`");
  });
});
