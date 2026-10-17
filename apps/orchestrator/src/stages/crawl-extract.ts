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

/** Raw data collected inside the browser for a single page. */
export interface BrowserPageData {
  url: string;
  title: string;
  metaDescription: string | null;
  htmlLang: string | null;
  h1: string[];
  visibleText: string;
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
    telHrefs,
    whatsappHrefs,
    mailtoHrefs,
    mapsIframeSrcs,
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
export const TR_DAY_RE =
  /(Pzt|Sal|Çar|Per|Cum|Cmt|Paz|Pazartesi|Salı|Çarşamba|Perşembe|Cuma|Cumartesi|Pazar)/;

/** A clock time like "09:00" or "9.30". */
export const TIME_RE = /\d{1,2}[:.]\d{2}/;

/** Turkish street-address tokens. */
export const ADDRESS_TOKEN_RE =
  /(Mah\.|Mahallesi|Cad\.|Caddesi|Sok\.|Sokak|No:|Kat:)/;

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

/** Lines that mention a Turkish weekday AND a clock time. */
export function findHoursCandidates(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.length > 200) continue;
    if (TR_DAY_RE.test(trimmed) && TIME_RE.test(trimmed)) out.push(trimmed);
    if (out.length >= 40) break;
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
