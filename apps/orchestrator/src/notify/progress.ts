import { sendTelegram } from "./telegram.js";

/**
 * Per-stage progress messages to the operator, so a run is legible while it
 * happens rather than only when it finishes.
 *
 * Three rules this module exists to keep:
 *  - A notification must never fail a run. Every send is swallowed.
 *  - It must never block a stage. Sends are fire-and-forget; the engine awaits
 *    only `flush()` at the end of a run.
 *  - It must not spam. One line per stage transition, in Turkish, carrying the
 *    numbers that actually tell the operator how it is going.
 */

export type ProgressChannel = "telegram" | "none";

/** Turkish copy per stage. Keyed by stage name; unknown stages fall back. */
const STAGE_START: Record<string, string> = {
  crawl: "📥 Eski site taranıyor — metinler, fotoğraflar, çalışma saatleri",
  audit: "📊 Mevcut site ölçülüyor — hız, erişilebilirlik, SEO",
  design: "🎨 Tasarım DNA'sı çıkarılıyor — palet, tipografi, bölüm düzenleri",
  plan: "🧩 Sayfa planı hazırlanıyor",
  generate: "🛠 Yeni site üretiliyor",
  verify: "🔍 Doğrulanıyor — testler, Lighthouse, tasarım jürisi",
  notify: "📨 Bildirim hazırlanıyor",
  deploy: "🚀 Yayına alınıyor",
};

/**
 * Numbers worth repeating back. Each entry turns a stage's result payload into
 * a short Turkish summary; anything not listed just reports that it passed.
 */
const STAGE_PASS: Record<string, (data: Record<string, unknown>) => string> = {
  crawl: (d) =>
    `✓ Tarama bitti — ${num(d.pages, "sayfa")}, ${num(d.contentBlocks, "içerik bloğu")}, ${num(d.assets, "görsel")}`,
  audit: (d) =>
    `✓ Ölçüm bitti — performans ${pct(d.performance)}, erişilebilirlik ${pct(d.accessibility)}, SEO ${pct(d.seo)}`,
  design: (d) =>
    `✓ Tasarım DNA'sı hazır — palet ${str(d.paletteName)}, tipografi ${str(d.typePair)}`,
  plan: (d) => `✓ Plan hazır — ${num(d.sections, "bölüm")}`,
  generate: (d) => `✓ Site üretildi${d.costUsd ? ` — $${Number(d.costUsd).toFixed(2)}` : ""}`,
  verify: (d) =>
    d.passed === true
      ? "✓ Tüm kapılar geçildi"
      : `⚠️ Doğrulama başarısız — ${str(d.failedGate ?? "bilinmeyen kapı")}`,
};

function num(v: unknown, label: string): string {
  return typeof v === "number" ? `${v} ${label}` : label;
}

function pct(v: unknown): string {
  return typeof v === "number" ? `${Math.round(v * 100)}` : "—";
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "—";
}

export interface ProgressNotifier {
  runStarted(domain: string, url: string): void;
  stageStarted(domain: string, stage: string): void;
  stagePassed(domain: string, stage: string, data?: Record<string, unknown>): void;
  stageFailed(domain: string, stage: string, error: string): void;
  runHalted(domain: string, stage: string): void;
  /** Awaits every in-flight send. Call once, at the end of a run. */
  flush(): Promise<void>;
}

/** A notifier that does nothing — used when the channel is off or unconfigured. */
const SILENT: ProgressNotifier = {
  runStarted: () => {},
  stageStarted: () => {},
  stagePassed: () => {},
  stageFailed: () => {},
  runHalted: () => {},
  flush: async () => {},
};

/**
 * Reads its configuration from the orchestrator's own environment. The bot
 * token never reaches a model-visible shell (see llm/session.ts scopedEnv).
 *
 * `NOTIFY_PROGRESS=off` silences per-stage messages while leaving the
 * end-of-run notification in the notify stage untouched.
 */
export function createProgressNotifier(options?: {
  channel?: ProgressChannel;
  token?: string;
  chatId?: string;
  /** Injected in tests; defaults to the real Telegram sender. */
  send?: (text: string) => Promise<unknown>;
}): ProgressNotifier {
  const channel =
    options?.channel ??
    ((process.env.NOTIFY_PROGRESS === "off"
      ? "none"
      : (process.env.NOTIFY_CHANNEL ?? "telegram")) as ProgressChannel);

  if (channel === "none") return SILENT;

  const token = options?.token ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options?.chatId ?? process.env.TELEGRAM_CHAT_ID;
  const send =
    options?.send ??
    (token && chatId
      ? (text: string) => sendTelegram({ token, chatId, text })
      : undefined);

  // Unconfigured is not an error: a developer without a bot token still gets a
  // working pipeline, just a quiet one.
  if (!send) return SILENT;

  const inFlight: Promise<unknown>[] = [];
  const post = (text: string) => {
    inFlight.push(send(text).catch(() => undefined));
  };

  return {
    runStarted: (domain, url) => post(`🔎 ${domain}\nÇalışma başladı — kaynak: ${url}`),
    stageStarted: (domain, stage) =>
      post(`${domain}\n${STAGE_START[stage] ?? `▶ ${stage} başladı`}`),
    stagePassed: (domain, stage, data) => {
      const line = STAGE_PASS[stage]?.(data ?? {});
      if (line) post(`${domain}\n${line}`);
    },
    stageFailed: (domain, stage, error) =>
      post(`${domain}\n⚠️ ${stage} adımı başarısız:\n${error.slice(0, 400)}`),
    runHalted: (domain, stage) =>
      post(`${domain}\n⏸ ${stage} adımında durdu — bu adım henüz uygulanmadı.`),
    async flush() {
      await Promise.allSettled(inFlight);
      inFlight.length = 0;
    },
  };
}
