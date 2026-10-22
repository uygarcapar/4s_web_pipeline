import { describe, expect, it } from "vitest";
import { AUTO_STAGES } from "@pipeline/core";
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
    expect(r.sent[1]).toContain("taranıyor");
    expect(r.sent[2]).toContain("12 sayfa");
    expect(r.sent[2]).toContain("438 içerik bloğu");
  });


  /**
   * The operator's standing instruction (2026-10-23): no icons, formal
   * register. These messages are the only thing they see while a client's
   * site is being built, and they get forwarded — the tone has to be one
   * you would put in front of the client whose site it is.
   *
   * Pinned as a test rather than trusted to review, because an emoji is
   * exactly the kind of thing that creeps back in one helpful line at a
   * time.
   */
  it("sends no icons, in any message", async () => {
    const r = recorder();
    const n = createProgressNotifier({ channel: "telegram", send: r.send });

    n.runStarted("diskent.com", "https://www.diskent.com");
    for (const stage of AUTO_STAGES) {
      n.stageStarted("diskent.com", stage);
      n.stagePassed("diskent.com", stage, { pages: 1, rounds: 2, delivered: true });
    }
    n.stageFailed("diskent.com", "verify", "lighthouse");
    n.runHalted("diskent.com", "deploy");
    await n.flush();

    // Emoji, dingbats, arrows and the check/cross marks the copy used to
    // lead with. Turkish letters and the currency sign stay legal.
    const icons =
      /[\u2190-\u21FF\u2300-\u23FF\u2460-\u27BF\u2B00-\u2BFF\uFE0F]|[\u{1F000}-\u{1FAFF}]/u;
    for (const message of r.sent) {
      expect(message, `icon in: ${message}`).not.toMatch(icons);
    }
    expect(r.sent.length).toBeGreaterThan(AUTO_STAGES.length);
  });

  /** Formal register: full sentences, and never the casual "bitti". */
  it("reports completions formally", async () => {
    const r = recorder();
    const n = createProgressNotifier({ channel: "telegram", send: r.send });
    n.stagePassed("diskent.com", "crawl", { pages: 12, contentBlocks: 438, assets: 56 });
    n.stagePassed("diskent.com", "verify", { passed: true });
    await n.flush();

    for (const message of r.sent) {
      expect(message).not.toContain("bitti");
      expect(message.trimEnd()).toMatch(/[.:]$/);
    }
  });

  /**
   * The fallback, not a real stage. This used `notify` as its example until
   * every stage got copy — `brief`, `signature`, `notify` and `deploy` were
   * all passing silently, which is the opposite of what an operator
   * watching a run wants.
   *
   * The mechanism still matters: a stage added later without copy should
   * say nothing rather than post "✓ undefined".
   */
  it("stays silent on pass for a stage with no copy", async () => {
    const r = recorder();
    const n = createProgressNotifier({ channel: "telegram", send: r.send });

    n.stagePassed("diskent.com", "a-stage-added-later", {});
    await n.flush();

    expect(r.sent).toHaveLength(0);
  });

  /**
   * The complement: every stage the pipeline actually runs DOES report, so
   * a run is legible from Telegram alone. This is the regression that let
   * four stages go quiet.
   */
  it("reports a pass for every stage in the chain", async () => {
    for (const stage of AUTO_STAGES) {
      const r = recorder();
      const n = createProgressNotifier({ channel: "telegram", send: r.send });
      n.stageStarted("diskent.com", stage);
      n.stagePassed("diskent.com", stage, {});
      await n.flush();
      expect(r.sent, `${stage} sent nothing`).toHaveLength(2);
      expect(r.sent[1], `${stage} posted an empty line`).not.toMatch(/undefined|^\s*$/);
    }
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
