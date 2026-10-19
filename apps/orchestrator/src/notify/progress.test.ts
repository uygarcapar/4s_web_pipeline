import { describe, expect, it } from "vitest";
import { createProgressNotifier } from "./progress.js";

function recorder() {
  const sent: string[] = [];
  return {
    sent,
    send: async (text: string) => {
      sent.push(text);
    },
  };
}

describe("progress notifier", () => {
  it("sends one Turkish line per stage transition", async () => {
    const r = recorder();
    const n = createProgressNotifier({ channel: "telegram", send: r.send });

    n.runStarted("diskent.com", "https://www.diskent.com");
    n.stageStarted("diskent.com", "crawl");
    n.stagePassed("diskent.com", "crawl", { pages: 12, contentBlocks: 438, assets: 56 });
    await n.flush();

    expect(r.sent).toHaveLength(3);
    expect(r.sent[1]).toContain("Eski site taranıyor");
    expect(r.sent[2]).toContain("12 sayfa");
    expect(r.sent[2]).toContain("438 içerik bloğu");
  });

  it("stays silent for a stage with nothing worth reporting on pass", async () => {
    const r = recorder();
    const n = createProgressNotifier({ channel: "telegram", send: r.send });

    n.stagePassed("diskent.com", "notify", {});
    await n.flush();

    expect(r.sent).toHaveLength(0);
  });

  it("reports a failure with the reason, truncated", async () => {
    const r = recorder();
    const n = createProgressNotifier({ channel: "telegram", send: r.send });

    n.stageFailed("diskent.com", "verify", "x".repeat(900));
    await n.flush();

    expect(r.sent[0]).toContain("verify adımı başarısız");
    // the message must stay inside Telegram's limits
    expect(r.sent[0]?.length ?? 0).toBeLessThan(500);
  });

  it("never throws when the channel fails — a notification cannot fail a run", async () => {
    const n = createProgressNotifier({
      channel: "telegram",
      send: async () => {
        throw new Error("network down");
      },
    });

    n.runStarted("diskent.com", "https://x");
    n.stageStarted("diskent.com", "crawl");
    await expect(n.flush()).resolves.toBeUndefined();
  });

  it("is silent when switched off", async () => {
    const r = recorder();
    const n = createProgressNotifier({ channel: "none", send: r.send });

    n.runStarted("diskent.com", "https://x");
    n.stageStarted("diskent.com", "crawl");
    await n.flush();

    expect(r.sent).toHaveLength(0);
  });

  it("is silent when the bot is not configured, rather than erroring", async () => {
    // no token, no chat id, no injected sender
    const n = createProgressNotifier({ channel: "telegram" });
    n.runStarted("diskent.com", "https://x");
    await expect(n.flush()).resolves.toBeUndefined();
  });
});
