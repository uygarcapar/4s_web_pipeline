import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import lighthouse, { desktopConfig } from "lighthouse";
import { launch } from "chrome-launcher";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { factsSchema, issuesFileSchema } from "@pipeline/core";
import type { StageModule, StageContext } from "./types.js";
import { buildFacts, isObj, readExtracted, readPages } from "./facts.js";
import { runRules, summarizeAxe, summarizeLhr } from "./audit-rules.js";
import type { AxeViolation } from "./audit-rules.js";

/**
 * Audit stage: deterministic measurement of the live site.
 * - Lighthouse (programmatic, median of AUDIT_LH_RUNS runs per form factor)
 * - axe-core via Playwright (WCAG 2.0/2.1 A+AA)
 * - deterministic rule checks over crawl artifacts (audit-rules.ts)
 * - normalized Facts (facts.ts)
 *
 * Artifacts under runs/<domain>/audit/: axe.json, lighthouse-mobile.json,
 * lighthouse-desktop.json, facts.json, and issues.json LAST (idempotency
 * marker). A Lighthouse or axe failure degrades the audit but does not
 * fail the stage; only an unrecoverable error returns ok:false.
 */
export const auditStage: StageModule = {
  stage: "audit",
  artifactPath: (ctx) => join(ctx.runDir, "audit", "issues.json"),

  async run(ctx) {
    try {
      const auditDir = join(ctx.runDir, "audit");
      mkdirSync(auditDir, { recursive: true });

      ctx.log("reading crawl artifacts");
      const extracted = readExtracted(readJson(join(ctx.runDir, "crawl", "extracted.json")));
      const pages = readPages(readJson(join(ctx.runDir, "crawl", "pages.json")));
      if (!extracted) {
        ctx.log("crawl/extracted.json missing or unreadable; auditing with reduced signal");
      }

      const runs = clampRuns(process.env.AUDIT_LH_RUNS);
      ctx.log(`running lighthouse against ${ctx.url} (${runs} run(s) per form factor)`);
      const lh = await collectLighthouse(ctx.url, runs, ctx.log);

      ctx.log("running axe (wcag2a, wcag2aa, wcag21aa)");
      const axe = await collectAxe(ctx.url);
      if (axe.error) ctx.log(`axe FAILED: ${axe.error}`);
      else ctx.log(`axe found ${axe.violations.length} violation rule(s)`);

      // Write order matters: issues.json last (it is the idempotency artifact).
      writeFileSync(join(auditDir, "axe.json"), stringify(axe.raw ?? []));
      if (lh.mobile) {
        writeFileSync(join(auditDir, "lighthouse-mobile.json"), stringify(lh.mobile));
      }
      if (lh.desktop) {
        writeFileSync(join(auditDir, "lighthouse-desktop.json"), stringify(lh.desktop));
      }

      const lhMobile = lh.mobile ? summarizeLhr(lh.mobile, "mobile") : null;
      const lhDesktop = lh.desktop ? summarizeLhr(lh.desktop, "desktop") : null;

      ctx.log("building facts from crawl signals");
      const facts = buildFacts({ domain: ctx.domain, extracted, pages });
      if (lh.error) facts.sources.lighthouse = `failed: ${lh.error}`;
      if (axe.error) facts.sources.axe = `failed: ${axe.error}`;
      const safeFacts = factsSchema.parse(facts);
      writeFileSync(join(auditDir, "facts.json"), stringify(safeFacts));

      ctx.log("running deterministic rule checks");
      const issues = issuesFileSchema.parse(
        runRules({
          url: ctx.url,
          extracted,
          pages,
          lhMobile,
          lhDesktop,
          axeViolations: axe.violations,
        }),
      );
      writeFileSync(join(auditDir, "issues.json"), stringify(issues));

      const lhMobilePerf = lhMobile?.categories.performance ?? null;
      const lhDesktopPerf = lhDesktop?.categories.performance ?? null;
      ctx.log(`audit complete: ${issues.length} issue(s)`, {
        lhMobilePerf,
        lhDesktopPerf,
        axeViolations: axe.violations.length,
      });
      return {
        ok: true,
        data: {
          issues: issues.length,
          lhMobilePerf,
          lhDesktopPerf,
          axeViolations: axe.violations.length,
          lighthouse: lh.error ? `failed: ${lh.error}` : "ok",
          axe: axe.error ? `failed: ${axe.error}` : "ok",
        },
      };
    } catch (err) {
      return { ok: false, error: message(err) };
    }
  },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function clampRuns(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isInteger(n) || n < 1) return 3;
  return Math.min(n, 9);
}

function perfScore(lhr: unknown): number | null {
  if (!isObj(lhr) || !isObj(lhr.categories)) return null;
  const perf = lhr.categories.performance;
  return isObj(perf) && typeof perf.score === "number" ? perf.score : null;
}

/** Median run by performance score (lower median for even counts). */
function medianByPerformance(lhrs: Record<string, unknown>[]): Record<string, unknown> | null {
  if (lhrs.length === 0) return null;
  const sorted = [...lhrs].sort((a, b) => (perfScore(a) ?? -1) - (perfScore(b) ?? -1));
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? null;
}

interface LighthouseRuns {
  mobile: Record<string, unknown> | null;
  desktop: Record<string, unknown> | null;
  error: string | null;
}

async function collectLighthouse(
  url: string,
  runs: number,
  log: StageContext["log"],
): Promise<LighthouseRuns> {
  const out: LighthouseRuns = { mobile: null, desktop: null, error: null };
  let chrome: Awaited<ReturnType<typeof launch>> | null = null;
  try {
    chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });
    for (const formFactor of ["mobile", "desktop"] as const) {
      try {
        const lhrs: Record<string, unknown>[] = [];
        for (let i = 0; i < runs; i++) {
          const flags = { port: chrome.port, output: "json", logLevel: "error" } as Parameters<
            typeof lighthouse
          >[1];
          const result =
            formFactor === "mobile"
              ? await lighthouse(url, flags)
              : await lighthouse(url, flags, desktopConfig);
          const lhr = result?.lhr;
          if (isObj(lhr)) {
            lhrs.push(lhr as Record<string, unknown>);
            log(`lighthouse ${formFactor} run ${i + 1}/${runs} done`, {
              perf: perfScore(lhr),
            });
          } else {
            log(`lighthouse ${formFactor} run ${i + 1}/${runs} returned no result`);
          }
        }
        out[formFactor] = medianByPerformance(lhrs);
        if (out[formFactor] === null) {
          out.error ??= `${formFactor}: no successful lighthouse run`;
        }
      } catch (err) {
        out.error ??= `${formFactor}: ${message(err)}`;
        log(`lighthouse ${formFactor} FAILED: ${message(err)}`);
      }
    }
  } catch (err) {
    out.error ??= message(err);
    log(`lighthouse FAILED: ${message(err)}`);
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
      } catch {
        /* chrome already gone */
      }
    }
  }
  return out;
}

interface AxeRun {
  violations: AxeViolation[];
  raw: unknown;
  error: string | null;
}

async function collectAxe(url: string): Promise<AxeRun> {
  const out: AxeRun = { violations: [], raw: null, error: null };
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    // AxeBuilder rejects pages from browser.newPage() ("Please use
    // browser.newContext()"), so the context is created explicitly. Mobile
    // Turkish emulation matches how the audited businesses are actually
    // browsed, and some a11y issues only appear at that width.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "tr-TR",
      timezoneId: "Europe/Istanbul",
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 60_000 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    out.raw = results.violations;
    out.violations = summarizeAxe(results.violations);
  } catch (err) {
    out.error = message(err);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* browser already gone */
      }
    }
  }
  return out;
}
