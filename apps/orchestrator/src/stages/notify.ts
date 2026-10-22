import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { StageModule } from "./types.js";
import { sendTelegram } from "../notify/telegram.js";
import { sendWhatsAppSiteReady } from "../notify/whatsapp.js";

/**
 * Notify the operator that a site finished locally (after verify; D1/D3).
 * Channel from NOTIFY_CHANNEL: "telegram" (current) or "whatsapp".
 * A delivery failure is recorded but does NOT fail the run.
 */
export const notifyStage: StageModule = {
  stage: "notify",
  artifactPath: (ctx) => join(ctx.runDir, "notify", "sent.json"),

  async run(ctx) {
    const channel = process.env.NOTIFY_CHANNEL ?? "telegram";
    const businessName = readBusinessName(ctx.runDir) ?? ctx.domain;
    const previewHint = `pipeline preview ${ctx.domain}`;
    const deployUrlFile = join(ctx.runDir, "deploy", "url.txt");
    const deployedUrl = existsSync(deployUrlFile)
      ? readFileSync(deployUrlFile, "utf8").trim()
      : null;
    // No icons, formal register (operator instruction, 2026-10-23). This is
    // the message most likely to be forwarded to the client whose site it
    // is, so it reads as something a business would send.
    const text =
      `${businessName} için yeni site hazır.\n` +
      `Mevcut site: ${ctx.url}\n` +
      (deployedUrl
        ? `Önizleme adresi: ${deployedUrl}`
        : `Yerel önizleme: ${previewHint}`);

    const sent: Record<string, unknown> = {
      channel,
      sentAt: new Date().toISOString(),
      delivered: false,
    };

    try {
      if (channel === "whatsapp") {
        const token = process.env.WA_TOKEN;
        const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
        const to = process.env.OPERATOR_WHATSAPP;
        if (!token || !phoneNumberId || !to) {
          throw new Error("WA_TOKEN / WA_PHONE_NUMBER_ID / OPERATOR_WHATSAPP not set");
        }
        const res = await sendWhatsAppSiteReady({
          token,
          phoneNumberId,
          to,
          businessName,
          oldUrl: ctx.url,
          previewHint: deployedUrl ?? previewHint,
        });
        sent.delivered = true;
        sent.via = res.via;
      } else {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (!token || !chatId) {
          throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set");
        }
        const res = await sendTelegram({ token, chatId, text });
        sent.delivered = true;
        sent.messageId = res.messageId;
      }
      ctx.log(`notification delivered via ${channel}`);
    } catch (err) {
      // Never fail the run over a notification error (D2/D3).
      sent.error = err instanceof Error ? err.message : String(err);
      ctx.log(`notification FAILED via ${channel}: ${String(sent.error)}`);
    }

    mkdirSync(join(ctx.runDir, "notify"), { recursive: true });
    writeFileSync(
      join(ctx.runDir, "notify", "sent.json"),
      JSON.stringify(sent, null, 2) + "\n",
    );
    return { ok: true, data: { delivered: sent.delivered === true, channel } };
  },
};

function readBusinessName(runDir: string): string | null {
  try {
    const facts = JSON.parse(
      readFileSync(join(runDir, "audit", "facts.json"), "utf8"),
    ) as { businessName?: string };
    return facts.businessName ?? null;
  } catch {
    return null;
  }
}
