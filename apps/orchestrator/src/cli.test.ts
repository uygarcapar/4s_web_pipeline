import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("pipeline CLI", () => {
  it("prints help with all commands", () => {
    const out = execFileSync("npx", ["tsx", "src/cli.ts", "--help"], {
      encoding: "utf8",
    });
    for (const cmd of ["discover", "approve", "queue", "run", "status", "retry", "cancel"]) {
      expect(out).toContain(cmd);
    }
  });
});
