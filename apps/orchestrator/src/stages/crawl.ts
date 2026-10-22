import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Configuration, PlaywrightCrawler, Sitemap } from "crawlee";
import { chromium, devices } from "playwright";
import type { StageContext, StageModule, StageResult } from "./types.js";
import {
  buildContentArtifact,
  collectPageData,
  findAddressCandidates,
  findHoursCandidates,
  findPhoneCandidates,
  findUnmappedHoursCandidates,
  hasMojibake,
  isTooSmallImage,
  normalizeUrl,
  originalAssetUrl,
  servicesFromPages,
  readImageDimensions,
  slugForUrl,
  type ContentBlock,
  type ImageDimensions,
  type PhoneCandidates,
} from "./crawl-extract.js";

const MAX_PAGES = 30;
const MAX_CONCURRENCY = 2;
const MAX_SCREENSHOT_PAGES = 10;
const MAX_ASSETS = 60;
const MAX_ASSET_CANDIDATES = 300;
const MAX_ASSET_BYTES = 5 * 1024 * 1024;
/**
 * Below this, an image is an icon/spacer/tracking pixel, not photography.
 *
 * 2 KB, not 10 KB: the byte test runs before the pixel test and vetoes it, and
 * a well-compressed WebP photograph is routinely under 10 KB. On the first
 * real salon site this threw away twelve of the client's own service
 * photographs — 424x240 at 7 KB, 450x200 at 5.6 KB — and left most of the
 * services section with empty cards. Genuine spacers and tracking pixels sit
 * far below 2 KB; anything above it is judged on MIN_ASSET_LONG_EDGE instead.
 */
const MIN_ASSET_BYTES = 2_000;
const MIN_ASSET_LONG_EDGE = 200;
const MAX_VISIBLE_TEXT = 20_000;
const NAV_TIMEOUT_SECS = 30;

/**
 * Paths that are never a public content page: API routes, auth/login screens,
 * admin areas and cart/checkout funnels. A client-side-routed site often links
 * these from its header; the crawl is read-only and has no business rendering
 * a sign-in form (CLAUDE.md: never submits forms, never enters login fields).
 */
const EXCLUDED_PATH_RE =
  /(?:^|\/)(?:api|auth|signin|sign-in|login|logout|giris|giriş|admin|wp-admin|wp-login|worker|hesabim|hesabım|sepet|cart|checkout|odeme|ödeme)(?:\/|$)/i;

/** Sitemaps list assets and feeds too; only HTML pages are crawl targets. */
const NON_PAGE_EXT_RE =
  /\.(?:png|jpe?g|webp|avif|gif|svg|ico|bmp|pdf|xml|txt|json|csv|zip|rar|mp[34]|webm|mov|css|js|woff2?|ttf|eot)$/i;

interface PageExtraction {
  url: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  htmlLang: string | null;
  h1: string[];
  /** Visible text, capped at MAX_VISIBLE_TEXT characters. */
  visibleText: string;
  /** True length of the page's visible text, before the cap. */
  visibleTextLength: number;
  /** Ordered semantic copy of the page (headings, paragraphs, list items). */
  contentBlocks: ContentBlock[];
  telHrefs: string[];
  whatsappHrefs: string[];
  mailtoHrefs: string[];
  mapsIframeSrcs: string[];
  /** Absolute http(s) anchor targets; the facts stage mines social profiles. */
  links: string[];
  og: { siteName: string | null; title: string | null; locale: string | null };
  jsonLd: unknown[];
  fontFamilies: string[];
  cssCustomProps: string[];
  imageUrls: string[];
  backgroundImageUrls: string[];
  faviconUrls: string[];
  viewportMetaPresent: boolean;
  phoneCandidates: PhoneCandidates;
  hoursCandidates: string[];
  /** Time ranges published without a day mapping; never auto-mapped to days. */
  hoursUnmappedCandidates: string[];
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
  /** Pixel size when readable from the file header, else null. */
  width: number | null;
  height: number | null;
  /** Page URLs this image appeared on. */
  referenced_on: string[];
}

/** An image URL to try, with the pages that referenced it. */
interface AssetCandidate {
  url: string;
  referencedOn: string[];
  /** Favicons are kept regardless of size (they are never photography). */
  isFavicon: boolean;
}

interface FetchedAsset {
  url: string;
  bytes: Buffer;
  contentType: string;
}

/**
 * Crawl stage (deterministic, no LLM). Crawls the lead's site same-hostname
 * with Crawlee's PlaywrightCrawler (robots.txt respected, polite UA, never
 * submits forms), extracts business signals AND the client's own copy per
 * page, captures desktop + iPhone 13 screenshots, downloads content images
 * from any origin (Wix/WordPress CDNs included) with a license manifest,
 * writes crawl/content.json for the plan+generate stages, and writes
 * pages.json (the idempotency artifact) last.
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
  const seenUrls = new Set<string>();
  const startHostname = new URL(ctx.url).hostname;
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

        // A link can redirect into an excluded area (e.g. /worker ->
        // /api/auth/signin): judge the URL we actually landed on, not the one
        // we enqueued, so no sign-in screen is ever recorded as a page.
        if (!isCrawlablePageUrl(pageUrl, startHostname)) {
          ctx.log(`skipped non-content page: ${pageUrl}`);
          return;
        }

        // Two seeds can land on one page (a sitemap lists the bare hostname
        // while the start URL carries "www.", and both redirect to the same
        // place). Dedupe on the final URL so the page is recorded once.
        if (seenUrls.has(pageUrl)) {
          ctx.log(`skipped duplicate page: ${pageUrl}`);
          return;
        }
        seenUrls.add(pageUrl);

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
          visibleText: raw.visibleText.slice(0, MAX_VISIBLE_TEXT),
          visibleTextLength: raw.visibleText.length,
          contentBlocks: raw.contentBlocks,
          telHrefs: raw.telHrefs,
          whatsappHrefs: raw.whatsappHrefs,
          mailtoHrefs: raw.mailtoHrefs,
          mapsIframeSrcs: raw.mapsIframeSrcs,
          links: raw.links,
          og: raw.og,
          jsonLd: raw.jsonLd,
          fontFamilies: raw.fontFamilies,
          cssCustomProps: raw.cssCustomProps,
          imageUrls: raw.imageUrls,
          backgroundImageUrls: raw.backgroundImageUrls,
          faviconUrls: raw.faviconUrls,
          viewportMetaPresent: raw.viewportMetaPresent,
          phoneCandidates: findPhoneCandidates(raw.visibleText),
          hoursCandidates: findHoursCandidates(raw.visibleText),
          hoursUnmappedCandidates: findUnmappedHoursCandidates(raw.visibleText),
          addressCandidates: findAddressCandidates(raw.visibleText),
          mojibake: hasMojibake(textAndTitle),
          screenshots: { desktop: desktopShot, mobile: null },
        });
        ctx.log(`crawled ${pageUrl}`, {
          title: raw.title,
          screenshot: desktopShot !== null,
          textLength: raw.visibleText.length,
          contentBlocks: raw.contentBlocks.length,
        });

        await enqueueLinks({
          strategy: "same-hostname",
          transformRequestFunction: (req) =>
            isCrawlablePageUrl(req.url, startHostname) ? req : false,
        });
      },
      failedRequestHandler: ({ request }, err) => {
        ctx.log(`page failed: ${request.url}: ${errorMessage(err)}`);
      },
    },
    config,
  );

  const seedUrls = await discoverSeedUrls(ctx.url, userAgent, ctx.log);
  await crawler.run(seedUrls);

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

  const assetCandidates = collectAssetCandidates(pages);
  const { manifest, skippedSmall } = await downloadAssets(
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

  // The client's own copy, merged cross-page: the plan and generate stages
  // reuse this text verbatim instead of inventing new Turkish. `services`
  // carries individual services whether the business gives each one its own
  // page or lists them all on one, and is the single list `facts.services`
  // is built from — the two used to disagree, and the design stage read the
  // one that was wrong.
  const content = buildContentArtifact(pages);
  const services = servicesFromPages(pages);
  writeFileSync(
    join(crawlDir, "content.json"),
    JSON.stringify({ ...content, services }, null, 2) + "\n",
  );

  // The idempotency artifact is written last so a partial run is retried.
  writeFileSync(
    join(crawlDir, "pages.json"),
    JSON.stringify(pages, null, 2) + "\n",
  );

  const totalBlocks = pages.reduce((n, p) => n + p.contentBlocks.length, 0);
  ctx.log(
    `crawl done: ${pages.length} pages, ${manifest.length} assets ` +
      `(${skippedSmall} skipped as too small), ${desktopShots} ` +
      `screenshotted pages, ${totalBlocks} content blocks, ` +
      `${content.faq.length} FAQ pairs`,
  );
  return {
    ok: true,
    data: {
      pages: pages.length,
      assets: manifest.length,
      assetsSkippedSmall: skippedSmall,
      contentBlocks: totalBlocks,
      faqPairs: content.faq.length,
    },
  };
}

/**
 * Is this a URL the crawl should fetch as a content page? Same hostname
 * (www-insensitive), http(s), not an asset, not an API/auth/admin path.
 */
function isCrawlablePageUrl(candidate: string, hostname: string): boolean {
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const bare = (h: string): string => h.replace(/^www\./, "");
  if (bare(u.hostname) !== bare(hostname)) return false;
  if (NON_PAGE_EXT_RE.test(u.pathname)) return false;
  if (EXCLUDED_PATH_RE.test(u.pathname)) return false;
  return true;
}

/** `Sitemap:` directives declared in robots.txt (RFC 9309 §2.2.3). */
async function sitemapsFromRobots(
  startUrl: string,
  userAgent: string,
): Promise<string[]> {
  const robotsUrl = new URL("/robots.txt", startUrl).toString();
  const res = await fetch(robotsUrl, { headers: { "user-agent": userAgent } });
  if (!res.ok) return [];
  const body = await res.text();
  return [...body.matchAll(/^[ \t]*sitemap:[ \t]*(\S+)/gim)].map((m) => m[1]!);
}

/**
 * Seed URLs for the crawl. Anchor discovery alone loses most of a
 * client-side-routed site — a Next.js/React header renders router buttons,
 * not `<a href>`, so `enqueueLinks` sees almost nothing and the fact-bearing
 * pages (contact, hours, prices) are never visited. The sitemap the site
 * already advertises is therefore read first: robots.txt `Sitemap:`
 * directives, falling back to the conventional locations. Start URL first,
 * then same-hostname content pages, capped at MAX_PAGES.
 */
async function discoverSeedUrls(
  startUrl: string,
  userAgent: string,
  log: StageContext["log"],
): Promise<string[]> {
  const hostname = new URL(startUrl).hostname;
  const seeds = new Set<string>([startUrl]);

  try {
    const declared = await sitemapsFromRobots(startUrl, userAgent).catch(
      () => [] as string[],
    );
    let found = declared.length > 0 ? await Sitemap.load(declared) : { urls: [] };
    if (found.urls.length === 0) {
      found = await Sitemap.tryCommonNames(startUrl);
    }
    let skipped = 0;
    for (const url of found.urls) {
      if (!isCrawlablePageUrl(url, hostname)) {
        skipped += 1;
        continue;
      }
      // Adopt the start URL's www-ness so a sitemap listing the bare
      // hostname does not enqueue a second request for the same page.
      const canonical = new URL(url);
      canonical.hostname = hostname;
      seeds.add(canonical.toString());
    }
    log(
      `sitemap discovery: ${found.urls.length} urls listed, ` +
        `${seeds.size - 1} crawlable, ${skipped} skipped (asset/api/auth)`,
      { declaredSitemaps: declared },
    );
  } catch (err) {
    log(
      `sitemap discovery failed, falling back to anchors only: ${errorMessage(err)}`,
    );
  }

  return [...seeds].slice(0, MAX_PAGES);
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
    hours_unmapped_candidates: flat((p) => p.hoursUnmappedCandidates),
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

/**
 * Image + favicon candidates with the pages that referenced them, favicons
 * first. Images are taken from ANY origin: most Turkish SMB sites are
 * Wix/WordPress and serve every photo from a CDN host (static.wixstatic.com,
 * i0.wp.com, …), so a same-origin rule downloads nothing usable.
 */
function collectAssetCandidates(
  pages: PageExtraction[],
): AssetCandidate[] {
  const isHttp = (raw: string): boolean => {
    try {
      const url = new URL(raw);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  // url -> referencing page URLs, in first-seen order.
  const refs = new Map<string, Set<string>>();
  const addRef = (url: string, pageUrl: string): void => {
    if (!isHttp(url)) return;
    const existing = refs.get(url);
    if (existing === undefined) refs.set(url, new Set([pageUrl]));
    else existing.add(pageUrl);
  };

  const faviconUrls = new Set<string>();
  for (const page of pages) {
    for (const url of page.faviconUrls.slice(0, 3)) {
      if (!isHttp(url) || faviconUrls.size >= 3) continue;
      faviconUrls.add(url);
      addRef(url, page.url);
    }
  }
  const firstPage = pages[0];
  if (faviconUrls.size === 0 && firstPage !== undefined) {
    try {
      const fallback = new URL("/favicon.ico", firstPage.url).toString();
      faviconUrls.add(fallback);
      addRef(fallback, firstPage.url);
    } catch {
      // No favicon candidate.
    }
  }

  const imageUrls: string[] = [];
  for (const page of pages) {
    for (const url of [...page.imageUrls, ...page.backgroundImageUrls]) {
      if (!isHttp(url) || faviconUrls.has(url)) continue;
      if (!refs.has(url)) imageUrls.push(url);
      addRef(url, page.url);
    }
  }
  const candidates: AssetCandidate[] = [
    ...[...faviconUrls].map((url) => ({ url, isFavicon: true })),
    ...imageUrls.map((url) => ({ url, isFavicon: false })),
  ].map(({ url, isFavicon }) => ({
    url,
    isFavicon,
    referencedOn: [...(refs.get(url) ?? new Set<string>())],
  }));
  return candidates.slice(0, MAX_ASSET_CANDIDATES);
}

/** GET one asset, enforcing the per-asset size cap. Null when unusable. */
async function fetchAsset(
  sourceUrl: string,
  userAgent: string,
  log: StageContext["log"],
): Promise<FetchedAsset | null> {
  const res = await fetch(sourceUrl, {
    headers: {
      "user-agent": userAgent,
      // Ask for formats whose headers we can measure (not AVIF).
      accept: "image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    log(`asset skipped (HTTP ${res.status}): ${sourceUrl}`);
    return null;
  }
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_ASSET_BYTES) {
    log(`asset skipped (>5MB declared): ${sourceUrl}`);
    return null;
  }
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() ??
    "application/octet-stream";
  if (
    !contentType.startsWith("image/") &&
    contentType !== "application/octet-stream" &&
    contentType !== "binary/octet-stream"
  ) {
    log(`asset skipped (content-type ${contentType}): ${sourceUrl}`);
    return null;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.byteLength > MAX_ASSET_BYTES) {
    log(`asset skipped (>5MB body): ${sourceUrl}`);
    return null;
  }
  return { url: sourceUrl, bytes, contentType };
}

/**
 * Download the candidates into assets/ and build the provenance manifest.
 *
 * For every CDN-resized URL the untransformed original is tried too and the
 * larger successful response wins; identical photos (same sha256) are stored
 * once with their referencing pages merged. Icons, spacers and tracking
 * pixels (<10KB, or <200px on the long edge when measurable) are skipped.
 */
async function downloadAssets(
  candidates: AssetCandidate[],
  assetsDir: string,
  userAgent: string,
  log: StageContext["log"],
): Promise<{ manifest: AssetManifestEntry[]; skippedSmall: number }> {
  const manifest: AssetManifestEntry[] = [];
  const usedNames = new Set<string>();
  const bySha = new Map<string, AssetManifestEntry>();
  const attempted = new Set<string>();
  let skippedSmall = 0;

  for (const [index, candidate] of candidates.entries()) {
    if (manifest.length >= MAX_ASSETS) break;

    const urls = [candidate.url];
    const original = originalAssetUrl(candidate.url);
    if (original !== null) urls.unshift(original);

    let best: FetchedAsset | null = null;
    for (const url of urls) {
      if (attempted.has(url)) continue;
      attempted.add(url);
      try {
        const fetched = await fetchAsset(url, userAgent, log);
        if (fetched === null) continue;
        if (best === null || fetched.bytes.byteLength > best.bytes.byteLength) {
          best = fetched;
        }
      } catch (err) {
        log(`asset download failed: ${url}: ${errorMessage(err)}`);
      }
    }
    if (best === null) continue;

    const dimensions: ImageDimensions = readImageDimensions(best.bytes);
    if (
      !candidate.isFavicon &&
      isTooSmallImage(
        best.bytes.byteLength,
        dimensions,
        MIN_ASSET_BYTES,
        MIN_ASSET_LONG_EDGE,
      )
    ) {
      skippedSmall += 1;
      log(`asset skipped (too small): ${best.url}`, {
        bytes: best.bytes.byteLength,
        width: dimensions.width,
        height: dimensions.height,
      });
      continue;
    }

    const sha256 = createHash("sha256").update(best.bytes).digest("hex");
    const duplicate = bySha.get(sha256);
    if (duplicate !== undefined) {
      for (const pageUrl of candidate.referencedOn) {
        if (!duplicate.referenced_on.includes(pageUrl)) {
          duplicate.referenced_on.push(pageUrl);
        }
      }
      log(`asset deduped (same sha256 as ${duplicate.file}): ${best.url}`);
      continue;
    }

    const file = assetFileName(best.url, best.contentType, index, usedNames);
    writeFileSync(join(assetsDir, file), best.bytes);
    const entry: AssetManifestEntry = {
      file,
      source_url: best.url,
      fetched_at: new Date().toISOString(),
      sha256,
      content_type: best.contentType,
      license_unknown: true,
      width: dimensions.width,
      height: dimensions.height,
      referenced_on: [...candidate.referencedOn],
    };
    manifest.push(entry);
    bySha.set(sha256, entry);
  }
  return { manifest, skippedSmall };
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
