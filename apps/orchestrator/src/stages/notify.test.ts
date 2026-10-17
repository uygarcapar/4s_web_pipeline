import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRunState, openStore } from "@pipeline/core";
import { notifyStage } from "./notify.js";
import type { StageContext } from "./types.js";

function makeCtx(runDir: string): StageContext {
  return {
    domain: "ornek.com.tr",
    url: "https://ornek.com.tr",
    runDir,
    repoRoot: runDir,
    state: createRunState({
      domain: "ornek.com.tr",
      url: "https://ornek.com.tr",
      source: "manual",
    }),
    store: openStore({ memory: true }),
    log: () => {},
  };
}

describe("notify stage", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "notify-"));
    process.env.NOTIFY_CHANNEL = "telegram";
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("sends via telegram, includes facts business name, writes sent.json", async () => {
    mkdirSync(join(dir, "audit"), { recursive: true });
    writeFileSync(
      join(dir, "audit", "facts.json"),
      JSON.stringify({ businessName: "Moda Diş Kliniği" }),
    );
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 7 } })),
    );

    const result = await notifyStage.run(makeCtx(dir));
    expect(result.ok).toBe(true);
    expect(result.data?.delivered).toBe(true);

    const call = fetchMock.mock.calls[0];
    expect(String(call?.[0])).toContain("api.telegram.org");
    const body = JSON.parse(String(call?.[1]?.body)) as { text: string };
    expect(body.text).toContain("Moda Diş Kliniği");
    expect(body.text).toContain("pipeline preview ornek.com.tr");

    const sent = JSON.parse(readFileSync(join(dir, "notify", "sent.json"), "utf8")) as {
      delivered: boolean;
      messageId: number;
    };
    expect(sent.delivered).toBe(true);
    expect(sent.messageId).toBe(7);
  });

  it("records failure but does not fail the run", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "chat not found" })),
    );
    const result = await notifyStage.run(makeCtx(dir));
    expect(result.ok).toBe(true);
    expect(result.data?.delivered).toBe(false);
    const sent = JSON.parse(readFileSync(join(dir, "notify", "sent.json"), "utf8")) as {
      delivered: boolean;
      error?: string;
    };
    expect(sent.delivered).toBe(false);
    expect(sent.error).toContain("chat not found");
  });

  it("prefers the deployed URL when deploy/url.txt exists", async () => {
    mkdirSync(join(dir, "deploy"), { recursive: true });
    writeFileSync(join(dir, "deploy", "url.txt"), "https://demo.vercel.app\n");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 8 } })),
    );
    const result = await notifyStage.run(makeCtx(dir));
    expect(result.ok).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { text: string };
    expect(body.text).toContain("https://demo.vercel.app");
  });
});
