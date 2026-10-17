import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Configuration, PlaywrightCrawler } from "crawlee";
import { chromium, devices } from "playwright";
import type { StageContext, StageModule, StageResult } from "./types.js";
import {
  collectPageData,
  findAddressCandidates,
  findHoursCandidates,
  findPhoneCandidates,
  hasMojibake,
  normalizeUrl,
  slugForUrl,
  type PhoneCandidates,
} from "./crawl-extract.js";

const MAX_PAGES = 30;
const MAX_CONCURRENCY = 2;
const MAX_SCREENSHOT_PAGES = 10;
const MAX_ASSETS = 30;
const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const NAV_TIMEOUT_SECS = 30;

interface PageExtraction {
  url: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  htmlLang: string | null;
  h1: string[];
  visibleTextLength: number;
  telHrefs: string[];
  whatsappHrefs: string[];
  mailtoHrefs: string[];
  mapsIframeSrcs: string[];
  jsonLd: unknown[];
  fontFamilies: string[];
  cssCustomProps: string[];
  imageUrls: string[];
  backgroundImageUrls: string[];
  faviconUrls: string[];
  viewportMetaPresent: boolean;
  phoneCandidates: PhoneCandidates;
  hoursCandidates: string[];
  addressCandidates: string[];
  mojibake: boolean;
  /** Paths relative to runs/<domain>/, null when not captured. */
  screenshots: { desktop: string | null; mobile: string | null };
}

interface AssetManifestEntry {
  file: string;
  source_url: string;
  fetched_at: string;
  sha256: string;
  content_type: string;
  license_unknown: true;
}

/**
 * Crawl stage (deterministic, no LLM). Crawls the lead's site same-hostname
 * with Crawlee's PlaywrightCrawler (robots.txt respected, polite UA, never
 * submits forms), extracts business signals per page, captures desktop +
 * iPhone 13 screenshots, downloads same-origin images/favicon with a license
 * manifest, and writes pages.json (the idempotency artifact) last.
 */
export const crawlStage: StageModule = {
  stage: "crawl",
  artifactPath: (ctx) => join(ctx.runDir, "crawl", "pages.json"),

  async run(ctx) {
    try {
      return await runCrawl(ctx);
    } catch (err) {
      const error = errorMessage(err);
      ctx.log(`crawl stage failed: ${error}`);
      return { ok: false, error };
    }
  },
};

async function runCrawl(ctx: StageContext): Promise<StageResult> {
  const crawlDir = join(ctx.runDir, "crawl");
  const screenshotsDir = join(crawlDir, "screenshots");
  const assetsDir = join(crawlDir, "assets");
  const crawleeDir = join(crawlDir, ".crawlee");
  for (const dir of [crawlDir, screenshotsDir, assetsDir, crawleeDir]) {
    mkdirSync(dir, { recursive: true });
  }

  const userAgent =
    "Mozilla/5.0 (compatible; 4sPipelineBot/0.1; " +
    `+mailto:${process.env.CRAWLER_CONTACT_EMAIL ?? "not-set@example.com"})`;

  ctx.log(`crawl start: ${ctx.url}`, {
    maxPages: MAX_PAGES,
    userAgent,
  });

  const pages: PageExtraction[] = [];
  const usedSlugs = new Set<string>();
  let desktopShots = 0;

  // Keep Crawlee's storage out of the repo root: in-memory client whose
  // on-disk directory (if anything is persisted) lives under the run dir.
  const config = new Configuration({
    persistStorage: false,
    purgeOnStart: true,
    storageClientOptions: { localDataDirectory: crawleeDir },
  });

  const crawler = new PlaywrightCrawler(
    {
      launchContext: { launcher: chromium, userAgent },
      respectRobotsTxtFile: true,
      maxRequestsPerCrawl: MAX_PAGES,
      maxConcurrency: MAX_CONCURRENCY,
      navigationTimeoutSecs: NAV_TIMEOUT_SECS,
      requestHandlerTimeoutSecs: 120,
      preNavigationHooks: [
        async ({ page }) => {
          // Desktop pass: same emulation size Lighthouse uses for desktop.
          await page.setViewportSize({ width: 1350, height: 940 });
          // tsx/esbuild (--keep-names) injects __name() helper calls into
          // the serialized page.evaluate function; shim it in the page.
          await page.addInitScript(
            "globalThis.__name = globalThis.__name ?? ((fn) => fn);",
          );
        },
      ],
      requestHandler: async ({ page, request, enqueueLinks }) => {
        // Read-only extraction; this stage never submits forms or types.
        const raw = await page.evaluate(collectPageData);
        const pageUrl = normalizeUrl(raw.url) ?? request.url;
        const slug = uniqueSlug(slugForUrl(pageUrl), usedSlugs);

        let desktopShot: string | null = null;
        if (desktopShots < MAX_SCREENSHOT_PAGES) {
          const file = `${slug}.desktop.png`;
          await page.screenshot({
            fullPage: true,
            path: join(screenshotsDir, file),
          });
          desktopShot = join("crawl", "screenshots", file);
          desktopShots += 1;
        }

        const textAndTitle = `${raw.title}\n${raw.visibleText}`;
        pages.push({
          url: pageUrl,
          slug,
          title: raw.title,
          metaDescription: raw.metaDescription,
          htmlLang: raw.htmlLang,
          h1: raw.h1,
          visibleTextLength: raw.visibleText.length,
          telHrefs: raw.telHrefs,
          whatsappHrefs: raw.whatsappHrefs,
          mailtoHrefs: raw.mailtoHrefs,
          mapsIframeSrcs: raw.mapsIframeSrcs,
          jsonLd: raw.jsonLd,
          fontFamilies: raw.fontFamilies,
          cssCustomProps: raw.cssCustomProps,
          imageUrls: raw.imageUrls,
          backgroundImageUrls: raw.backgroundImageUrls,
          faviconUrls: raw.faviconUrls,
          viewportMetaPresent: raw.viewportMetaPresent,
          phoneCandidates: findPhoneCandidates(raw.visibleText),
          hoursCandidates: findHoursCandidates(raw.visibleText),
          addressCandidates: findAddressCandidates(raw.visibleText),
          mojibake: hasMojibake(textAndTitle),
          screenshots: { desktop: desktopShot, mobile: null },
        });
        ctx.log(`crawled ${pageUrl}`, {
          title: raw.title,
          screenshot: desktopShot !== null,
        });

        await enqueueLinks({ strategy: "same-hostname" });
      },
      failedRequestHandler: ({ request }, err) => {
        ctx.log(`page failed: ${request.url}: ${errorMessage(err)}`);
      },
    },
    config,
  );

  await crawler.run([ctx.url]);

  if (pages.length === 0) {
    return {
      ok: false,
      error:
        `no pages crawled from ${ctx.url} ` +
        "(robots.txt disallow, navigation failure, or unreachable site)",
    };
  }

  // Second sequential pass: mobile screenshots with a plain Playwright
  // browser (Crawlee drives a single desktop-configured browser pool).
  await takeMobileScreenshots(pages, screenshotsDir, userAgent, ctx.log);

  const assetCandidates = collectAssetCandidates(pages, ctx.url);
  const manifest = await downloadAssets(
    assetCandidates,
    assetsDir,
    userAgent,
    ctx.log,
  );
  writeFileSync(
    join(crawlDir, "asset-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  writeFileSync(
    join(crawlDir, "extracted.json"),
    JSON.stringify(mergeSignals(ctx, pages), null, 2) + "\n",
  );

  // The idempotency artifact is written last so a partial run is retried.
  writeFileSync(
    join(crawlDir, "pages.json"),
    JSON.stringify(pages, null, 2) + "\n",
  );

  ctx.log(
    `crawl done: ${pages.length} pages, ${manifest.length} assets, ` +
      `${desktopShots} screenshotted pages`,
  );
  return { ok: true, data: { pages: pages.length, assets: manifest.length } };
}

/** Merged signals across all crawled pages (input for audit/facts). */
function mergeSignals(
  ctx: StageContext,
  pages: PageExtraction[],
): Record<string, unknown> {
  const flat = (pick: (p: PageExtraction) => string[]): string[] => [
    ...new Set(pages.flatMap(pick)),
  ];
  return {
    domain: ctx.domain,
    start_url: ctx.url,
    pages_crawled: pages.length,
    phones: {
      mobile: flat((p) => p.phoneCandidates.mobile),
      landline: flat((p) => p.phoneCandidates.landline),
    },
    tel_hrefs: flat((p) => p.telHrefs),
    whatsapp_hrefs: flat((p) => p.whatsappHrefs),
    mailto_hrefs: flat((p) => p.mailtoHrefs),
    maps_iframe_srcs: flat((p) => p.mapsIframeSrcs),
    hours_candidates: flat((p) => p.hoursCandidates),
    address_candidates: flat((p) => p.addressCandidates),
    jsonld: pages.flatMap((p) => p.jsonLd),
    fonts: flat((p) => p.fontFamilies),
    css_custom_props: flat((p) => p.cssCustomProps),
    mojibake: pages.some((p) => p.mojibake),
    has_https: pages.some((p) => p.url.startsWith("https://")),
    viewport_meta_present: pages.some((p) => p.viewportMetaPresent),
  };
}

/** iPhone 13 (tr-TR, Europe/Istanbul) full-page screenshots, sequential. */
async function takeMobileScreenshots(
  pages: PageExtraction[],
  screenshotsDir: string,
  userAgent: string,
  log: StageContext["log"],
): Promise<void> {
  const targets = pages.filter((p) => p.screenshots.desktop !== null);
  if (targets.length === 0) return;

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      ...(devices["iPhone 13"] ?? {}),
      locale: "tr-TR",
      timezoneId: "Europe/Istanbul",
      userAgent,
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_SECS * 1000);
    for (const target of targets) {
      try {
        await page.goto(target.url, { waitUntil: "load" });
        const file = `${target.slug}.mobile.png`;
        await page.screenshot({
          fullPage: true,
          path: join(screenshotsDir, file),
        });
        target.screenshots.mobile = join("crawl", "screenshots", file);
        log(`mobile screenshot: ${target.url}`);
      } catch (err) {
        log(`mobile screenshot failed: ${target.url}: ${errorMessage(err)}`);
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

/** Same-origin image + favicon URLs, favicon first, capped at MAX_ASSETS. */
function collectAssetCandidates(
  pages: PageExtraction[],
  startUrl: string,
): string[] {
  const allowedHosts = new Set<string>();
  for (const raw of [startUrl, ...pages.map((p) => p.url)]) {
    try {
      allowedHosts.add(new URL(raw).hostname);
    } catch {
      // Ignore unparseable URLs.
    }
  }
  const sameOrigin = (raw: string): boolean => {
    try {
      return allowedHosts.has(new URL(raw).hostname);
    } catch {
      return false;
    }
  };

  const favicons = pages
    .flatMap((p) => p.faviconUrls)
    .filter(sameOrigin)
    .slice(0, 3);
  const firstPage = pages[0];
  if (favicons.length === 0 && firstPage !== undefined) {
    try {
      favicons.push(new URL("/favicon.ico", firstPage.url).toString());
    } catch {
      // No favicon candidate.
    }
  }

  const images = pages
    .flatMap((p) => [...p.imageUrls, ...p.backgroundImageUrls])
    .filter(sameOrigin);

  return [...new Set([...favicons, ...images])]
    .filter((u) => !u.startsWith("data:"))
    .slice(0, MAX_ASSETS);
}

async function downloadAssets(
  candidates: string[],
  assetsDir: string,
  userAgent: string,
  log: StageContext["log"],
): Promise<AssetManifestEntry[]> {
  const manifest: AssetManifestEntry[] = [];
  const usedNames = new Set<string>();

  for (const [index, sourceUrl] of candidates.entries()) {
    if (manifest.length >= MAX_ASSETS) break;
    try {
      const res = await fetch(sourceUrl, {
        headers: { "user-agent": userAgent },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        log(`asset skipped (HTTP ${res.status}): ${sourceUrl}`);
        continue;
      }
      const declared = Number(res.headers.get("content-length") ?? "0");
      if (declared > MAX_ASSET_BYTES) {
        log(`asset skipped (>5MB declared): ${sourceUrl}`);
        continue;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.byteLength > MAX_ASSET_BYTES) {
        log(`asset skipped (>5MB body): ${sourceUrl}`);
        continue;
      }
      const contentType =
        res.headers.get("content-type")?.split(";")[0]?.trim() ??
        "application/octet-stream";
      const file = assetFileName(sourceUrl, contentType, index, usedNames);
      writeFileSync(join(assetsDir, file), bytes);
      manifest.push({
        file,
        source_url: sourceUrl,
        fetched_at: new Date().toISOString(),
        sha256: createHash("sha256").update(bytes).digest("hex"),
        content_type: contentType,
        license_unknown: true,
      });
    } catch (err) {
      log(`asset download failed: ${sourceUrl}: ${errorMessage(err)}`);
    }
  }
  return manifest;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
};

function assetFileName(
  sourceUrl: string,
  contentType: string,
  index: number,
  used: Set<string>,
): string {
  let base = "";
  try {
    base = new URL(sourceUrl).pathname.split("/").pop() ?? "";
  } catch {
    // Fall through to the generated name.
  }
  base = base
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);
  const ext = EXT_BY_TYPE[contentType] ?? "";
  if (base === "") base = `asset-${index}${ext}`;
  else if (!base.includes(".") && ext !== "") base = `${base}${ext}`;

  let name = base;
  if (used.has(name)) name = `${index}-${base}`;
  used.add(name);
  return name;
}

function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base;
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
