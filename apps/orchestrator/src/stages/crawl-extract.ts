/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

/**
 * Crawl-stage extraction helpers.
 *
 * `collectPageData` runs INSIDE the browser via `page.evaluate` and must stay
 * fully self-contained (no references to module scope: Playwright serializes
 * the function source and ships it to the page).
 *
 * Everything below it is a pure Node-side text/URL helper, unit-tested in
 * crawl.test.ts without any network or DOM.
 */

/** One semantic content element of a page, in document order. */
export interface ContentBlock {
  /** Lowercased tag name: h1..h4, p, li, dt, dd, blockquote, figcaption. */
  tag: string;
  text: string;
}

/** Raw data collected inside the browser for a single page. */
export interface BrowserPageData {
  url: string;
  title: string;
  metaDescription: string | null;
  htmlLang: string | null;
  h1: string[];
  visibleText: string;
  contentBlocks: ContentBlock[];
  telHrefs: string[];
  whatsappHrefs: string[];
  mailtoHrefs: string[];
  mapsIframeSrcs: string[];
  /**
   * Every absolute http(s) anchor target on the page. The facts stage reads
   * these to find the business's social profiles; without them
   * `facts.socialLinks` can never be populated.
   */
  links: string[];
  /** Open Graph values the facts stage prefers over <title>. */
  og: { siteName: string | null; title: string | null; locale: string | null };
  jsonLd: unknown[];
  fontFamilies: string[];
  cssCustomProps: string[];
  imageUrls: string[];
  backgroundImageUrls: string[];
  faviconUrls: string[];
  viewportMetaPresent: boolean;
}

/** Runs in the page context. Read-only: never submits forms or types. */
export function collectPageData(): BrowserPageData {
  const MAX_TEXT = 300_000;

  const toAbsolute = (value: string): string | null => {
    try {
      return new URL(value, document.baseURI).toString();
    } catch {
      return null;
    }
  };

  const unique = (values: (string | null)[]): string[] => [
    ...new Set(
      values.filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  ];

  const anchors = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("a[href]"),
  );
  const rawHref = (a: HTMLAnchorElement): string =>
    (a.getAttribute("href") ?? "").trim();
  const telHrefs = unique(
    anchors.map(rawHref).filter((h) => h.startsWith("tel:")),
  );
  const mailtoHrefs = unique(
    anchors.map(rawHref).filter((h) => h.startsWith("mailto:")),
  );
  const whatsappHrefs = unique(
    anchors
      .map((a) => a.href)
      .filter((h) => h.includes("wa.me/") || h.includes("api.whatsapp.com")),
  );

  const mapsIframeSrcs = unique(
    Array.from(
      document.querySelectorAll<HTMLIFrameElement>(
        'iframe[src*="google.com/maps"]',
      ),
    ).map((f) => f.src),
  );

  const links = unique(
    anchors
      .map((a) => a.href)
      .filter((h) => h.startsWith("http://") || h.startsWith("https://")),
  ).slice(0, 400);

  const metaContent = (property: string): string | null => {
    const el = document.querySelector<HTMLMetaElement>(
      `meta[property="${property}"], meta[name="${property}"]`,
    );
    const value = (el?.content ?? "").trim();
    return value === "" ? null : value;
  };

  const jsonLd: unknown[] = [];
  for (const script of Array.from(
    document.querySelectorAll<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    ),
  )) {
    try {
      jsonLd.push(JSON.parse(script.textContent ?? "") as unknown);
    } catch {
      // Invalid JSON-LD blocks are skipped.
    }
  }

  const fontFamilies = unique(
    Array.from(document.fonts).map((face) =>
      face.family.replace(/^["']|["']$/g, ""),
    ),
  );

  const cssCustomProps = new Set<string>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules; // Throws on cross-origin stylesheets.
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      if (!rule.selectorText.split(",").some((s) => s.trim() === ":root")) {
        continue;
      }
      for (let i = 0; i < rule.style.length; i++) {
        const name = rule.style.item(i);
        if (name.startsWith("--")) cssCustomProps.add(name);
      }
    }
  }

  const imageUrls = unique(
    Array.from(document.querySelectorAll<HTMLImageElement>("img"))
      .map((img) => img.currentSrc || img.src)
      .filter((src) => src !== "" && !src.startsWith("data:"))
      .map(toAbsolute),
  ).slice(0, 100);

  const backgroundImageUrls = new Set<string>();
  const urlPattern = /url\((['"]?)([^'")]+)\1\)/g;
  for (const el of Array.from(
    document.querySelectorAll<HTMLElement>("body, body *"),
  ).slice(0, 3000)) {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (!bg || bg === "none") continue;
    for (const match of bg.matchAll(urlPattern)) {
      const rawUrl = match[2];
      if (!rawUrl || rawUrl.startsWith("data:")) continue;
      const abs = toAbsolute(rawUrl);
      if (abs) backgroundImageUrls.add(abs);
      if (backgroundImageUrls.size >= 50) break;
    }
  }

  const faviconUrls = unique(
    Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
      ),
    )
      .map((l) => l.href)
      .filter((h) => !h.startsWith("data:")),
  );

  // Ordered semantic copy of the page: what a later stage lifts verbatim
  // (a service description, an FAQ answer) instead of inventing new text.
  const MAX_BLOCKS = 400;
  const CHROME_TAGS = ["NAV", "HEADER", "FOOTER", "SCRIPT", "STYLE", "NOSCRIPT"];
  const hiddenCache = new Map<Element, boolean>();
  // True when the element (or any ancestor) is page chrome or not rendered.
  const isExcluded = (el: Element): boolean => {
    const cached = hiddenCache.get(el);
    if (cached !== undefined) return cached;
    let result: boolean;
    if (CHROME_TAGS.indexOf(el.tagName) !== -1) {
      result = true;
    } else {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") {
        result = true;
      } else {
        const parent = el.parentElement;
        result = parent === null ? false : isExcluded(parent);
      }
    }
    hiddenCache.set(el, result);
    return result;
  };

  const contentBlocks: { tag: string; text: string }[] = [];
  const emitted = new Map<Element, string>();
  const blockEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      "h1, h2, h3, h4, p, li, dt, dd, blockquote, figcaption",
    ),
  ).slice(0, 4000);
  for (const el of blockEls) {
    if (contentBlocks.length >= MAX_BLOCKS) break;
    if (isExcluded(el)) continue;
    const text = (el.innerText || el.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 2) continue;
    // A nested block repeating an ancestor block verbatim (blockquote > p)
    // would otherwise be stored twice.
    let duplicate = false;
    for (let p = el.parentElement; p !== null; p = p.parentElement) {
      if (emitted.get(p) === text) {
        duplicate = true;
        break;
      }
    }
    if (duplicate) continue;
    emitted.set(el, text);
    contentBlocks.push({ tag: el.tagName.toLocaleLowerCase("en-US"), text });
  }

  return {
    url: window.location.href,
    title: document.title,
    metaDescription:
      document.querySelector<HTMLMetaElement>('meta[name="description"]')
        ?.content ?? null,
    htmlLang: document.documentElement.getAttribute("lang"),
    h1: Array.from(document.querySelectorAll("h1"))
      .map((h) => (h.textContent ?? "").trim())
      .filter((t) => t !== "")
      .slice(0, 20),
    visibleText: (document.body?.innerText ?? "").slice(0, MAX_TEXT),
    contentBlocks,
    telHrefs,
    whatsappHrefs,
    mailtoHrefs,
    mapsIframeSrcs,
    links,
    og: {
      siteName: metaContent("og:site_name"),
      title: metaContent("og:title"),
      locale: metaContent("og:locale"),
    },
    jsonLd,
    fontFamilies,
    cssCustomProps: [...cssCustomProps],
    imageUrls,
    backgroundImageUrls: [...backgroundImageUrls],
    faviconUrls,
    viewportMetaPresent:
      document.querySelector('meta[name="viewport"]') !== null,
  };
}

/* ------------------------------------------------------------------ */
/* Pure Node-side helpers (unit-tested, no DOM, no network).          */
/* ------------------------------------------------------------------ */

/** Turkish mobile numbers, e.g. "0532 123 45 67", "+90 532 123 45 67". */
export const TR_MOBILE_PHONE_RE =
  /(\+90|0)?\s*5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;

/** Turkish landlines, e.g. "0212 345 67 89", "(216) 345 67 89". */
export const TR_LANDLINE_PHONE_RE =
  /(\+90|0)?\s*\(?[2348]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;

/** Turkish weekday names and abbreviations. */
/**
 * A Turkish weekday name or abbreviation. The token must not be glued to
 * another letter: JS `\b` is ASCII-only, so it fires inside Turkish words
 * ("Çarşısı" would read as the abbreviation "Çar" and turn a street address
 * into an opening-hours line). Unicode letter classes are used instead, and
 * long forms are listed before the abbreviations that prefix them.
 */
export const TR_DAY_RE =
  /(?:^|[^\p{L}])(Pazartesi|Salı|Çarşamba|Perşembe|Cumartesi|Cuma|Pazar|Pzt|Sal|Çar|Per|Cmt|Cum|Paz)(?![\p{L}])/iu;

/** A clock time like "09:00" or "9.30". */
export const TIME_RE = /\d{1,2}[:.]\d{2}/;

/** A time range like "10.00-19.30" or "09:00 - 18:00". */
export const TIME_RANGE_RE =
  /\d{1,2}[:.]\d{2}\s*[-–—/]\s*\d{1,2}[:.]\d{2}/;

/**
 * A label meaning "every day", which maps a single time range onto all seven
 * days without inventing anything. minaguzellik.com publishes its only hours
 * as "Tüm Günler:" / "09:00 – 20:00"; neither label matched, so the facts
 * recorded no hours at all for a salon that states them plainly.
 */
export const ALL_DAYS_LABEL_RE =
  /((tüm|her)\s*gün(ler)?|hergün|haftan[ıi]n\s*(7|yedi)\s*günü|7\s*\/\s*24)/i;

/** Labels an SMB site puts above its opening hours. */
export const HOURS_LABEL_RE =
  /(çalışma\s*saat|açılış|kapanış|saatler|mesai|hafta\s*içi|hafta\s*sonu|(tüm|her)\s*gün(ler)?|hergün|7\s*\/\s*24)/i;

/**
 * Turkish street-address tokens. Case-insensitive on purpose: SMB sites write
 * "Atakent mah. 227. sokak ... no: 2/S" as often as the title-cased form, and
 * a case-sensitive match silently loses the whole address.
 *
 * The leading lookbehind is load-bearing: without it `Kat:` matched inside
 * "Dik**kat:**", so a microblading aftercare sentence ("Duş Alırken Dikkat:
 * ...") was collected as an address candidate and — being the longest one —
 * became the published address of the first real client.
 */
export const ADDRESS_TOKEN_RE =
  /(?<!\p{L})(Mah\.|Mahalle|Cad\.|Cadde|Sok\.|Sokak|Bulvar|Blv\.|Sitesi|Çarşı|Plaza|Blok|Daire|Apt\.|No\s*:|Kat\s*:)/iu;

/** UTF-8-as-Latin-1 mojibake sequences for ç/ı/ş. */
export const MOJIBAKE_RE = /(Ã§|Ä±|ÅŸ)/;

export interface PhoneCandidates {
  mobile: string[];
  landline: string[];
}

function normalizeMatch(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

/** Extract Turkish mobile + landline phone candidates from visible text. */
export function findPhoneCandidates(text: string): PhoneCandidates {
  const mobile = dedupe(
    [...text.matchAll(TR_MOBILE_PHONE_RE)].map((m) =>
      normalizeMatch(m[0] ?? ""),
    ),
  ).filter((v) => v !== "");
  const landline = dedupe(
    [...text.matchAll(TR_LANDLINE_PHONE_RE)].map((m) =>
      normalizeMatch(m[0] ?? ""),
    ),
  ).filter((v) => v !== "");
  return { mobile, landline };
}

/**
 * Lines that state hours for days that can be identified: a Turkish weekday
 * with a clock time, or an "every day" label with a time range.
 *
 * The all-days pass joins the label to the range when they sit on separate
 * lines, which is how sites lay them out ("Tüm Günler:" then "09:00 – 20:00").
 * Emitting the range alone would strip the only thing that says which days it
 * covers, and the day mapping may never be guessed back (DECISIONS D8).
 */
export function findHoursCandidates(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const out: string[] = [];
  for (const trimmed of lines) {
    if (trimmed === "" || trimmed.length > 200) continue;
    if (TR_DAY_RE.test(trimmed) && TIME_RE.test(trimmed)) out.push(trimmed);
    if (out.length >= 40) break;
  }

  for (let i = 0; i < lines.length && out.length < 40; i += 1) {
    const label = lines[i]!;
    if (label === "" || label.length > 200) continue;
    if (!ALL_DAYS_LABEL_RE.test(label)) continue;
    if (TR_DAY_RE.test(label)) continue;
    if (TIME_RANGE_RE.test(label)) {
      out.push(label);
      continue;
    }
    // The range sits within the next two lines, as for the unmapped case.
    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j += 1) {
      const candidate = lines[j]!;
      if (candidate === "" || candidate.length > 200) continue;
      if (!TIME_RANGE_RE.test(candidate)) continue;
      if (TR_DAY_RE.test(candidate)) continue;
      out.push(`${label} ${candidate}`.replace(/\s+/g, " ").trim());
      break;
    }
  }
  return dedupe(out);
}

/**
 * Time ranges the site publishes WITHOUT saying which days they apply to
 * ("Çalışma Saatleri :" / "10.00-19.30"). These must not become per-day
 * openingHours entries — inventing the day mapping is precisely what the
 * verbatim-facts rule forbids — but dropping them would lose the only hours
 * the business published, so they are kept verbatim for the audit to flag.
 * Lines that do name a weekday are left to findHoursCandidates.
 */
export function findUnmappedHoursCandidates(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!HOURS_LABEL_RE.test(lines[i]!)) continue;
    // The range sits on the label line itself or within the next two lines.
    const last = Math.min(i + 2, lines.length - 1);
    for (let j = i; j <= last; j += 1) {
      const candidate = lines[j]!;
      if (candidate === "" || candidate.length > 200) continue;
      if (!TIME_RANGE_RE.test(candidate)) continue;
      if (TR_DAY_RE.test(candidate)) continue;
      out.push(candidate);
    }
    if (out.length >= 10) break;
  }
  return dedupe(out);
}

/** Lines that contain Turkish street-address tokens. */
export function findAddressCandidates(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.length > 300) continue;
    if (ADDRESS_TOKEN_RE.test(trimmed)) out.push(trimmed);
    if (out.length >= 20) break;
  }
  return dedupe(out);
}

/** True when the text contains UTF-8 mojibake sequences (Ã§, Ä±, ÅŸ). */
export function hasMojibake(text: string): boolean {
  return MOJIBAKE_RE.test(text);
}

/**
 * Canonical form of a page URL: http(s) only, fragment stripped, hostname
 * lowercased, trailing slash removed (except for the root path).
 * Returns null for non-http(s) or unparseable input.
 */
export function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    url.hostname = url.hostname.toLocaleLowerCase("en-US");
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * File-name slug for a page path: "index" for "/", otherwise the path with
 * every non [a-z0-9] run collapsed to "-" (max 80 chars).
 */
export function slugForUrl(raw: string): string {
  let pathname = "/";
  try {
    pathname = new URL(raw).pathname;
  } catch {
    // Keep the root path for unparseable input.
  }
  let trimmed = pathname.replace(/^\/+|\/+$/g, "");
  if (trimmed === "") return "index";
  try {
    trimmed = decodeURIComponent(trimmed);
  } catch {
    // Keep the percent-encoded form on malformed escapes.
  }
  const slug = trimmed
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug === "" ? "index" : slug;
}

/* ------------------------------------------------------------------ */
/* Content merge: FAQ pairs + headings across pages (crawl/content.json) */
/* ------------------------------------------------------------------ */

export interface FaqPair {
  question: string;
  answer: string;
  sourceUrl: string;
}

export interface HeadingEntry {
  text: string;
  level: number;
  sourceUrl: string;
}

/** Per-page input for {@link buildContentArtifact}. */
export interface ContentSourcePage {
  url: string;
  slug: string;
  title: string;
  h1: string[];
  contentBlocks: ContentBlock[];
  jsonLd: unknown[];
}

/** One service the business describes on its own site, verbatim. */
export interface ServiceItem {
  title: string;
  description: string;
  sourceUrl: string;
}

export interface ContentArtifact {
  pages: {
    url: string;
    slug: string;
    title: string;
    h1: string[];
    contentBlocks: ContentBlock[];
  }[];
  faq: FaqPair[];
  headings: HeadingEntry[];
}

const HEADING_TAG_RE = /^h([1-6])$/;
const QUESTION_END_RE = /[?？]$/;
const MAX_FAQ_PAIRS = 200;
const MAX_HEADINGS = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Strip tags/entities from a schema.org answer body and collapse spaces. */
export function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function schemaTypes(value: unknown): string[] {
  const raw = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  return raw
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.replace(/^https?:\/\/schema\.org\//, "").replace(/^schema:/, ""));
}

/** First usable string out of a schema.org value (string, array, or node). */
function schemaString(value: unknown): string {
  if (typeof value === "string") return plainText(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = schemaString(item);
      if (found !== "") return found;
    }
    return "";
  }
  if (isRecord(value)) {
    return schemaString(value.text ?? value.name ?? value["@value"]);
  }
  return "";
}

/** Dedupe FAQ pairs by question text (case- and whitespace-insensitive). */
export function dedupeFaqPairs(pairs: FaqPair[]): FaqPair[] {
  const seen = new Set<string>();
  const out: FaqPair[] = [];
  for (const pair of pairs) {
    const key = pair.question.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR");
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(pair);
    if (out.length >= MAX_FAQ_PAIRS) break;
  }
  return out;
}

/**
 * FAQ pairs from JSON-LD: any `Question` node (inside an `FAQPage`,
 * a `@graph`, or standalone) with a name and an accepted answer.
 */
export function faqFromJsonLd(nodes: unknown[], sourceUrl: string): FaqPair[] {
  const out: FaqPair[] = [];
  const seen = new Set<object>();
  const visit = (node: unknown): void => {
    if (out.length >= MAX_FAQ_PAIRS) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isRecord(node)) return;
    if (seen.has(node)) return;
    seen.add(node);
    if (schemaTypes(node["@type"]).includes("Question")) {
      const question = schemaString(node.name ?? node.text ?? node.headline);
      const answer = schemaString(node.acceptedAnswer ?? node.suggestedAnswer);
      if (question !== "" && answer !== "") {
        out.push({ question, answer, sourceUrl });
      }
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(nodes);
  return dedupeFaqPairs(out);
}

/**
 * FAQ pairs from the DOM: a content block whose text ends with "?" followed
 * by a non-heading block. The answer block must not itself be a question, so
 * a run of questions does not consume the next question as its own answer.
 */
export function faqFromContentBlocks(
  blocks: ContentBlock[],
  sourceUrl: string,
): FaqPair[] {
  const out: FaqPair[] = [];
  for (let i = 0; i + 1 < blocks.length; i += 1) {
    const q = blocks[i];
    const a = blocks[i + 1];
    if (q === undefined || a === undefined) continue;
    const question = q.text.trim();
    const answer = a.text.trim();
    if (!QUESTION_END_RE.test(question)) continue;
    if (HEADING_TAG_RE.test(a.tag)) continue;
    if (QUESTION_END_RE.test(answer)) continue;
    if (answer.length < 2) continue;
    out.push({ question, answer, sourceUrl });
  }
  return dedupeFaqPairs(out);
}

/** Cross-page content view consumed by the plan and generate stages. */
/** An H1 that announces a services listing on a Turkish SMB site. */
const SERVICES_HEADING_RE = /(hizmet|tedavi|uygulama|işlem|bakım)/i;

const MAX_SERVICE_ITEMS = 60;
const MIN_SERVICE_DESCRIPTION = 20;

/**
 * Services read off a page that announces them in its H1 ("Hizmetlerimiz"):
 * each heading below the H1 is a service title and the first paragraph under
 * it is that service's description, both copied verbatim. Sites routinely
 * repeat the same name as an h2 and then an h3, so titles are deduped.
 */
export function servicesFromContentBlocks(
  pages: ContentSourcePage[],
): ServiceItem[] {
  const out: ServiceItem[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    if (!page.h1.some((heading) => SERVICES_HEADING_RE.test(heading))) continue;

    let pendingTitle: string | null = null;
    for (const block of page.contentBlocks) {
      const headingMatch = HEADING_TAG_RE.exec(block.tag);
      if (headingMatch?.[1] !== undefined) {
        // h1 is the page title, not a service.
        if (Number(headingMatch[1]) >= 2) pendingTitle = block.text.trim();
        continue;
      }
      if (block.tag !== "p" || pendingTitle === null) continue;

      const description = block.text.trim();
      const title = pendingTitle;
      pendingTitle = null;
      if (title === "" || description.length < MIN_SERVICE_DESCRIPTION) continue;

      const key = title.toLocaleLowerCase("tr-TR");
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ title, description, sourceUrl: page.url });
      if (out.length >= MAX_SERVICE_ITEMS) return out;
    }
  }
  return out;
}

export function buildContentArtifact(
  pages: ContentSourcePage[],
): ContentArtifact {
  const faq: FaqPair[] = [];
  const headings: HeadingEntry[] = [];
  for (const page of pages) {
    faq.push(...faqFromJsonLd(page.jsonLd, page.url));
    faq.push(...faqFromContentBlocks(page.contentBlocks, page.url));
    for (const block of page.contentBlocks) {
      if (headings.length >= MAX_HEADINGS) break;
      const match = HEADING_TAG_RE.exec(block.tag);
      if (match?.[1] === undefined) continue;
      headings.push({
        text: block.text,
        level: Number(match[1]),
        sourceUrl: page.url,
      });
    }
  }
  return {
    pages: pages.map((p) => ({
      url: p.url,
      slug: p.slug,
      title: p.title,
      h1: p.h1,
      contentBlocks: p.contentBlocks,
    })),
    faq: dedupeFaqPairs(faq),
    headings,
  };
}

/* ------------------------------------------------------------------ */
/* Asset helpers: CDN variant URLs + image header dimensions          */
/* ------------------------------------------------------------------ */

/**
 * Original-size URL behind a CDN resize variant, or null when the URL has no
 * recognizable transform segment.
 *
 * Wix (`static.wixstatic.com/media/<id>.png/v1/fill/w_320,h_240,.../x.png`)
 * and other `/v1/<op>/` CDNs keep the untouched file at the path prefix, so
 * everything from `/v1/` on is dropped. WordPress-style `-320x240` filename
 * suffixes are dropped too.
 */
export function originalAssetUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const marker = url.pathname.indexOf("/v1/");
  if (marker > 0) {
    const base = url.pathname.slice(0, marker);
    // Only useful when the prefix is itself a file (…/<id>.png/v1/…).
    if (/\.[a-z0-9]{2,5}$/i.test(base)) return `${url.origin}${base}`;
  }

  const resized = /^(.*)-\d{2,5}x\d{2,5}(\.[a-z0-9]{2,5})$/i.exec(url.pathname);
  if (resized?.[1] !== undefined && resized[2] !== undefined) {
    return `${url.origin}${resized[1]}${resized[2]}${url.search}`;
  }
  return null;
}

export interface ImageDimensions {
  width: number | null;
  height: number | null;
}

const UNKNOWN_DIMENSIONS: ImageDimensions = { width: null, height: null };

function u8(bytes: Uint8Array, i: number): number | null {
  return i >= 0 && i < bytes.length ? (bytes[i] as number) : null;
}

function be16(bytes: Uint8Array, i: number): number | null {
  const a = u8(bytes, i);
  const b = u8(bytes, i + 1);
  return a === null || b === null ? null : (a << 8) | b;
}

function be32(bytes: Uint8Array, i: number): number | null {
  const a = be16(bytes, i);
  const b = be16(bytes, i + 2);
  return a === null || b === null ? null : a * 65536 + b;
}

function le16(bytes: Uint8Array, i: number): number | null {
  const a = u8(bytes, i);
  const b = u8(bytes, i + 1);
  return a === null || b === null ? null : a | (b << 8);
}

function le24(bytes: Uint8Array, i: number): number | null {
  const a = le16(bytes, i);
  const b = u8(bytes, i + 2);
  return a === null || b === null ? null : a + b * 65536;
}

function ascii(bytes: Uint8Array, i: number, length: number): string {
  let out = "";
  for (let k = 0; k < length; k += 1) {
    const byte = u8(bytes, i + k);
    if (byte === null) return "";
    out += String.fromCharCode(byte);
  }
  return out;
}

function sized(width: number | null, height: number | null): ImageDimensions {
  if (width === null || height === null || width <= 0 || height <= 0) {
    return UNKNOWN_DIMENSIONS;
  }
  return { width, height };
}

/** JPEG: walk the marker chain to the first SOFn frame header. */
function jpegDimensions(bytes: Uint8Array): ImageDimensions {
  let pos = 2;
  while (pos + 3 < bytes.length) {
    if (u8(bytes, pos) !== 0xff) {
      pos += 1; // Resynchronize on padding/garbage.
      continue;
    }
    const marker = u8(bytes, pos + 1);
    if (marker === null) return UNKNOWN_DIMENSIONS;
    // Fill bytes and standalone markers carry no payload.
    if (marker === 0xff) {
      pos += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      pos += 2;
      continue;
    }
    const segment = be16(bytes, pos + 2);
    if (segment === null || segment < 2) return UNKNOWN_DIMENSIONS;
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 && // DHT
      marker !== 0xc8 && // JPG extension
      marker !== 0xcc; // DAC
    if (isSof) {
      return sized(be16(bytes, pos + 7), be16(bytes, pos + 5));
    }
    if (marker === 0xda) return UNKNOWN_DIMENSIONS; // Start of scan.
    pos += 2 + segment;
  }
  return UNKNOWN_DIMENSIONS;
}

/** WebP: VP8 (lossy), VP8L (lossless) and VP8X (extended) chunk headers. */
function webpDimensions(bytes: Uint8Array): ImageDimensions {
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8 ") {
    // 3-byte frame tag, then the 0x9d 0x01 0x2a sync code at offset 23.
    if (
      u8(bytes, 23) !== 0x9d ||
      u8(bytes, 24) !== 0x01 ||
      u8(bytes, 25) !== 0x2a
    ) {
      return UNKNOWN_DIMENSIONS;
    }
    const w = le16(bytes, 26);
    const h = le16(bytes, 28);
    if (w === null || h === null) return UNKNOWN_DIMENSIONS;
    return sized(w & 0x3fff, h & 0x3fff);
  }
  if (chunk === "VP8L") {
    if (u8(bytes, 20) !== 0x2f) return UNKNOWN_DIMENSIONS;
    const a = u8(bytes, 21);
    const b = u8(bytes, 22);
    const c = u8(bytes, 23);
    const d = u8(bytes, 24);
    if (a === null || b === null || c === null || d === null) {
      return UNKNOWN_DIMENSIONS;
    }
    const bits = a + b * 256 + c * 65536 + d * 16777216;
    return sized((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8X") {
    const w = le24(bytes, 24);
    const h = le24(bytes, 27);
    if (w === null || h === null) return UNKNOWN_DIMENSIONS;
    return sized(w + 1, h + 1);
  }
  return UNKNOWN_DIMENSIONS;
}

/**
 * Pixel size read straight out of the file header (PNG IHDR, JPEG SOFn, GIF
 * logical screen, WebP VP8/VP8L/VP8X). No image library, no decoding: only
 * the first bytes are inspected. Unknown/unsupported formats (SVG, AVIF, ICO)
 * yield nulls.
 */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions {
  if (bytes.length < 16) return UNKNOWN_DIMENSIONS;

  if (
    u8(bytes, 0) === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    ascii(bytes, 12, 4) === "IHDR"
  ) {
    return sized(be32(bytes, 16), be32(bytes, 20));
  }
  if (ascii(bytes, 0, 4) === "GIF8") {
    return sized(le16(bytes, 6), le16(bytes, 8));
  }
  if (u8(bytes, 0) === 0xff && u8(bytes, 1) === 0xd8) {
    return jpegDimensions(bytes);
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return webpDimensions(bytes);
  }
  return UNKNOWN_DIMENSIONS;
}

/** True when the asset is too small to be content photography. */
export function isTooSmallImage(
  byteLength: number,
  dimensions: ImageDimensions,
  minBytes: number,
  minLongEdge: number,
): boolean {
  if (byteLength < minBytes) return true;
  const { width, height } = dimensions;
  if (width !== null && height !== null) {
    return Math.max(width, height) < minLongEdge;
  }
  return false;
}
