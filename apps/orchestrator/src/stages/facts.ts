import type { Facts, OpeningHoursEntry } from "@pipeline/core";

/**
 * Normalization of crawl artifacts (runs/<domain>/crawl/{extracted,pages}.json)
 * into typed signals and the ground-truth Facts object. Everything upstream is
 * treated as optional: the crawl stage evolves independently, so every reader
 * here degrades gracefully when fields are missing or oddly shaped.
 */

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

export function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Phone candidates from either shape the crawl has written: a flat array, or
 * the `{ mobile: [...], landline: [...] }` grouping it writes today. Reading
 * only the array shape made `extracted.phones` silently empty on every real
 * site — minaguzellik.com published a landline and a mobile and the facts
 * ended up with neither from this source (the mobile survived only because
 * the same number was also a `tel:` href).
 */
function phoneStrings(v: unknown): string[] {
  if (Array.isArray(v)) return strArray(v);
  if (!isObj(v)) return [];
  // Mobiles first: pickTrPhone prefers a mobile anyway, but ordering here
  // keeps the chosen source honest when both groups are present.
  return [...strArray(v.mobile), ...strArray(v.landline), ...strArray(v.other)];
}

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

/* ------------------------------------------------------------------ */
/* extracted.json reader                                               */
/* ------------------------------------------------------------------ */

/** Normalized view of crawl/extracted.json; every upstream field optional. */
export interface ExtractedSignals {
  phones: string[];
  telHrefs: string[];
  waHrefs: string[];
  mailtos: string[];
  hoursCandidates: string[];
  /** Time ranges published without a day mapping (never auto-mapped). */
  hoursUnmappedCandidates: string[];
  addressCandidates: string[];
  jsonld: unknown[];
  fonts: string[];
  mojibake: boolean | null;
  hasHttps: boolean | null;
  viewportMeta: boolean | null;
  mapsIframes: string[];
}

/** First key present in `raw`, so one spelling change cannot silently drop a signal. */
function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined) return raw[key];
  }
  return undefined;
}

/**
 * Tolerant reader: returns null when the file content is not an object.
 * Accepts both the snake_case spelling the crawl stage writes and the
 * camelCase spelling used throughout the TypeScript types — a mismatch here
 * silently degrades every rule that depends on the signal (it once produced
 * a false "no WhatsApp link" finding on a site that had three of them).
 */
export function readExtracted(raw: unknown): ExtractedSignals | null {
  if (!isObj(raw)) return null;
  return {
    phones: phoneStrings(pick(raw, "phones", "phoneCandidates", "phone_candidates")),
    telHrefs: strArray(pick(raw, "telHrefs", "tel_hrefs")),
    waHrefs: strArray(pick(raw, "waHrefs", "whatsappHrefs", "whatsapp_hrefs")),
    mailtos: strArray(pick(raw, "mailtos", "mailtoHrefs", "mailto_hrefs")),
    hoursCandidates: strArray(pick(raw, "hoursCandidates", "hours_candidates")),
    hoursUnmappedCandidates: strArray(
      pick(raw, "hoursUnmappedCandidates", "hours_unmapped_candidates"),
    ),
    addressCandidates: strArray(pick(raw, "addressCandidates", "address_candidates")),
    jsonld: Array.isArray(raw.jsonld) ? raw.jsonld : [],
    fonts: strArray(raw.fonts),
    mojibake: boolOrNull(raw.mojibake),
    hasHttps: boolOrNull(pick(raw, "hasHttps", "has_https")),
    viewportMeta: boolOrNull(
      pick(raw, "viewportMeta", "viewportMetaPresent", "viewport_meta_present"),
    ),
    mapsIframes: strArray(pick(raw, "mapsIframes", "mapsIframeSrcs", "maps_iframe_srcs")),
  };
}

/* ------------------------------------------------------------------ */
/* pages.json reader                                                   */
/* ------------------------------------------------------------------ */

export interface CrawlPage {
  url: string | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  ogSiteName: string | null;
  links: string[];
  /** Path-only form of `url`, trailing slash stripped ("/" for the root). */
  path: string | null;
  /** Last BreadcrumbList entry: the page's own name as the site states it. */
  breadcrumbName: string | null;
  /** Per-page JSON-LD, kept so site-wide nodes can be read off any page. */
  jsonld: unknown[];
}

/** Path-only, trailing slash stripped. Returns null for an unparseable URL. */
export function pathOf(url: string | null): string | null {
  if (url === null) return null;
  try {
    return new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

/**
 * The page's own name from its BreadcrumbList trail. Preferred over `<title>`
 * for service names because it carries no brand suffix and no separator to
 * guess at: `/kas-kontur` is titled "Kıl Tekniği - Mina Güzellik Merkezi" and
 * its last crumb is exactly "Kıl Tekniği".
 */
function breadcrumbNameOf(jsonld: unknown[]): string | null {
  let last: string | null = null;
  for (const node of flattenJsonld(jsonld)) {
    if (!typesOf(node).includes("BreadcrumbList")) continue;
    const items = Array.isArray(node.itemListElement) ? node.itemListElement : [];
    for (const item of items) {
      if (!isObj(item)) continue;
      const name = isObj(item.item) ? str(item.item.name) : str(item.name);
      if (name) last = name;
    }
  }
  return last;
}

/** Tolerant reader for crawl/pages.json (array of pages or { pages: [...] }). */
export function readPages(raw: unknown): CrawlPage[] {
  const list = Array.isArray(raw)
    ? raw
    : isObj(raw) && Array.isArray(raw.pages)
      ? raw.pages
      : [];
  const pages: CrawlPage[] = [];
  for (const item of list) {
    if (!isObj(item)) continue;
    const og = isObj(item.og) ? item.og : {};
    // crawl/pages.json stores `h1` as an array of headings; older/other
    // shapes use a scalar `h1` or an `h1s` array. Reading only the scalar
    // made every page look heading-less and fired a false "missing H1".
    const h1s = [...strArray(item.h1), ...strArray(item.h1s)];
    const linksRaw = Array.isArray(item.links) ? item.links : [];
    const links: string[] = [];
    for (const l of linksRaw) {
      if (typeof l === "string") links.push(l);
      else if (isObj(l)) {
        const href = str(l.href) ?? str(l.url);
        if (href) links.push(href);
      }
    }
    const url = str(item.url) ?? str(item.finalUrl);
    const jsonld = Array.isArray(item.jsonLd)
      ? item.jsonLd
      : Array.isArray(item.jsonld)
        ? item.jsonld
        : [];
    pages.push({
      url,
      title: str(item.title),
      metaDescription:
        str(item.metaDescription) ?? str(item.meta_description) ?? str(item.description),
      h1: str(item.h1) ?? h1s[0] ?? null,
      ogSiteName: str(item.ogSiteName) ?? str(item.og_site_name) ?? str(og.site_name),
      links,
      path: pathOf(url),
      breadcrumbName: breadcrumbNameOf(jsonld),
      jsonld,
    });
  }
  return pages;
}

/* ------------------------------------------------------------------ */
/* JSON-LD helpers                                                     */
/* ------------------------------------------------------------------ */

/** Flattens JSON-LD nodes, descending into arrays and @graph containers. */
export function flattenJsonld(jsonld: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    if (!isObj(node)) return;
    out.push(node);
    if (node["@graph"] !== undefined) visit(node["@graph"]);
  };
  visit(jsonld);
  return out;
}

function typesOf(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

/** Well-known schema.org LocalBusiness subtypes without "business" in the name. */
const LB_SUBTYPES = new Set([
  "dentist",
  "hairsalon",
  "beautysalon",
  "daycare",
  "restaurant",
  "cafeorcoffeeshop",
  "bakery",
  "store",
  "autorepair",
  "hotel",
  "legalservice",
  "physician",
  "medicalclinic",
  "veterinarycare",
  "realestateagent",
  "plumber",
  "electrician",
  "locksmith",
  "travelagency",
]);

function isLocalBusinessType(t: string): boolean {
  const low = t.toLocaleLowerCase("en-US");
  return low.includes("business") || LB_SUBTYPES.has(low);
}

/** First JSON-LD node typed as LocalBusiness (or a known subtype), if any. */
export function findLocalBusinessNode(jsonld: unknown[]): Record<string, unknown> | null {
  for (const node of flattenJsonld(jsonld)) {
    if (typesOf(node).some(isLocalBusinessType)) return node;
  }
  return null;
}

/** First Organization-typed JSON-LD node (fallback source for facts). */
export function findOrganizationNode(jsonld: unknown[]): Record<string, unknown> | null {
  for (const node of flattenJsonld(jsonld)) {
    if (typesOf(node).some((t) => t.toLocaleLowerCase("en-US").includes("organization"))) {
      return node;
    }
  }
  return null;
}

/**
 * First WebSite-typed JSON-LD node. Yoast and most WordPress SEO plugins emit
 * `WebSite.name` on every page and nothing typed Organization or
 * LocalBusiness at all, so without this the business name falls through to
 * `<title>` — which on minaguzellik.com gave "Galeri", the gallery page's
 * title, while "Mina Güzellik Merkezi" sat in `WebSite.name` on all 29 pages.
 */
export function findWebSiteNode(jsonld: unknown[]): Record<string, unknown> | null {
  for (const node of flattenJsonld(jsonld)) {
    if (typesOf(node).some((t) => t.toLocaleLowerCase("en-US") === "website")) return node;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Phone normalization                                                 */
/* ------------------------------------------------------------------ */

/**
 * Normalize a Turkish phone string to E.164 (+90XXXXXXXXXX).
 * Handles "0532 123 45 67", "+90 (212) 345 67 89", "5321234567",
 * "0090 ..." and tel:/wa.me prefixes. Returns null when not a valid
 * 10-digit TR national number.
 */
export function normalizeTrPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith("90")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 10 || digits.startsWith("0")) return null;
  const e164 = `+90${digits}`;
  return /^\+90\d{10}$/.test(e164) ? e164 : null;
}

export function isMobileTr(e164: string): boolean {
  return /^\+905\d{9}$/.test(e164);
}

/** Normalize a list of raw phone strings; prefer the first mobile-looking one. */
export function pickTrPhone(candidates: string[]): string | null {
  const normalized = candidates
    .map((c) => normalizeTrPhone(c))
    .filter((p): p is string => p !== null);
  return normalized.find(isMobileTr) ?? normalized[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Opening hours parsing                                               */
/* ------------------------------------------------------------------ */

type IsoDay = OpeningHoursEntry["day"];

/** Longest-first alternation so "cumartesi" wins over "cuma", "pazartesi" over "pazar". */
const DAY_TOKEN_RE =
  /pazartesi|cumartesi|çarşamba|carsamba|perşembe|persembe|salı|sali|pazar|cuma|pzt|cmt|sal|çar|car|per|cum|paz/g;

const DAY_OF_TOKEN: Record<string, IsoDay> = {
  pazartesi: 1,
  pzt: 1,
  salı: 2,
  sali: 2,
  sal: 2,
  çarşamba: 3,
  carsamba: 3,
  çar: 3,
  car: 3,
  perşembe: 4,
  persembe: 4,
  per: 4,
  cuma: 5,
  cum: 5,
  cumartesi: 6,
  cmt: 6,
  pazar: 7,
  paz: 7,
};

const EN_DAY: Record<string, IsoDay> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const TIME_RANGE_RE = /(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/;

function toHHMM(h: string, m: string): string | null {
  const hn = Number(h);
  const mn = Number(m);
  if (!Number.isInteger(hn) || !Number.isInteger(mn) || hn > 23 || mn > 59) return null;
  return `${String(hn).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}

interface DayMatch {
  day: IsoDay;
  start: number;
  end: number;
}

function matchDays(text: string): DayMatch[] {
  const matches: DayMatch[] = [];
  DAY_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DAY_TOKEN_RE.exec(text)) !== null) {
    const day = DAY_OF_TOKEN[m[0]];
    if (day !== undefined) matches.push({ day, start: m.index, end: m.index + m[0].length });
  }
  return matches;
}

/**
 * Parse free-text Turkish opening-hour candidates ("Pzt - Cum 09:00 - 18:00",
 * "Pazar Kapalı") into OpeningHoursEntry[]. Unparseable input yields [].
 * The first candidate mentioning a day wins for that day.
 */
export function parseOpeningHours(candidates: string[]): OpeningHoursEntry[] {
  const byDay = new Map<IsoDay, OpeningHoursEntry>();
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const text = raw.toLocaleLowerCase("tr-TR");
    const dayMatches = matchDays(text);
    let dayList: IsoDay[] = [];
    // "Tüm günler" is as common as "her gün" and means the same thing; the
    // crawl now joins such a label to its time range before it gets here.
    if (/(tüm|her)\s*gün(ler)?|hergün|haftanın\s*(7|yedi)\s*günü|7\s*\/\s*24/.test(text)) {
      dayList = [1, 2, 3, 4, 5, 6, 7];
    } else if (dayMatches.length === 2) {
      const [a, b] = dayMatches as [DayMatch, DayMatch];
      const between = text.slice(a.end, b.start);
      if (/^[\s\-–—>./,]*$/.test(between) && /[-–—>]/.test(between) && b.day >= a.day) {
        for (let d = a.day; d <= b.day; d++) dayList.push(d as IsoDay);
      } else {
        dayList = dayMatches.map((d) => d.day);
      }
    } else {
      dayList = dayMatches.map((d) => d.day);
    }
    if (dayList.length === 0) continue;

    const closed = /kapalı|kapali|closed/.test(text);
    const time = TIME_RANGE_RE.exec(text);
    for (const day of dayList) {
      if (byDay.has(day)) continue;
      if (closed) {
        byDay.set(day, { day, opens: null, closes: null });
      } else if (time) {
        const opens = toHHMM(time[1] ?? "", time[2] ?? "");
        const closes = toHHMM(time[3] ?? "", time[4] ?? "");
        if (opens && closes) byDay.set(day, { day, opens, closes });
      }
    }
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

/** Parse schema.org openingHoursSpecification nodes into OpeningHoursEntry[]. */
export function parseJsonldHours(spec: unknown): OpeningHoursEntry[] {
  const list = Array.isArray(spec) ? spec : spec !== undefined ? [spec] : [];
  const byDay = new Map<IsoDay, OpeningHoursEntry>();
  for (const item of list) {
    if (!isObj(item)) continue;
    const daysRaw = Array.isArray(item.dayOfWeek) ? item.dayOfWeek : [item.dayOfWeek];
    const opens = normalizeJsonldTime(item.opens);
    const closes = normalizeJsonldTime(item.closes);
    for (const d of daysRaw) {
      if (typeof d !== "string") continue;
      const key = (d.split("/").pop() ?? d).toLocaleLowerCase("en-US");
      const day = EN_DAY[key];
      if (day === undefined || byDay.has(day)) continue;
      byDay.set(day, { day, opens, closes });
    }
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

function normalizeJsonldTime(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(v.trim());
  if (!m) return null;
  return toHHMM(m[1] ?? "", m[2] ?? "");
}

/* ------------------------------------------------------------------ */
/* Facts builder                                                       */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function firstEmail(mailtos: string[]): string | null {
  for (const raw of mailtos) {
    const cleaned = (raw.replace(/^mailto:/i, "").split("?")[0] ?? "").trim();
    if (EMAIL_RE.test(cleaned)) return cleaned;
  }
  return null;
}

function whatsappFromHrefs(waHrefs: string[]): string | null {
  for (const href of waHrefs) {
    const m =
      /wa\.me\/(?:send\/?\?phone=)?(\+?\d[\d%+]*)/i.exec(href) ??
      /whatsapp\.com\/send\/?\?[^#]*phone=(\+?\d[\d%+]*)/i.exec(href);
    if (!m?.[1]) continue;
    const normalized = normalizeTrPhone(decodeURIComponent(m[1]));
    if (normalized) return normalized;
  }
  return null;
}

function jsonldAddressToString(address: unknown): {
  text: string | null;
  locality: string | null;
  region: string | null;
  postalCode: string | null;
} {
  if (typeof address === "string") {
    return { text: str(address), locality: null, region: null, postalCode: null };
  }
  const node = Array.isArray(address) ? address.find(isObj) : address;
  if (!isObj(node)) return { text: null, locality: null, region: null, postalCode: null };
  // addressRegion often holds the licence-plate code on Turkish sites; render
  // the province name so the address does not read "Kadıköy, 34, 34724".
  const rawRegion = str(node.addressRegion);
  const region = resolveTrProvince(rawRegion)?.name ?? rawRegion;
  const parts = [
    str(node.streetAddress),
    str(node.addressLocality),
    region,
    str(node.postalCode),
  ].filter((p): p is string => p !== null);
  return {
    text: parts.length > 0 ? parts.join(", ") : null,
    locality: str(node.addressLocality),
    region: rawRegion,
    postalCode: str(node.postalCode),
  };
}

function mapsQueryFromIframes(mapsIframes: string[]): string | null {
  for (const src of mapsIframes) {
    const m = /[?&]q=([^&#]+)/.exec(src);
    if (!m?.[1]) continue;
    try {
      const q = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
      if (q.length > 0 && !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(q)) return q;
    } catch {
      /* malformed URI component — skip */
    }
  }
  // The `?pb=` embed form carries no `q=`; the place string lives in its
  // `!2s` field ("!2sCumhuriyet+Mahallesi,+...+Esenyurt/İstanbul"). Reading
  // only `q=` meant every pb-style embed — which is what the Google Maps
  // "share > embed" button produces — contributed nothing.
  for (const src of mapsIframes) {
    const m = /!2s([^!]+)/.exec(src);
    if (!m?.[1]) continue;
    try {
      const q = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
      // `!2s` is also used for short locale codes ("tr") elsewhere in the
      // payload; a place string is longer than that.
      if (q.length > 8) return q;
    } catch {
      /* malformed URI component — skip */
    }
  }
  return null;
}

/**
 * Turkish street-address markers. A candidate carrying none of these is prose
 * that happened to be picked up by the address heuristic.
 *
 * Guarded with `\p{L}` rather than `\b`, because JavaScript's `\b` is defined
 * on ASCII word characters: after "Sokağı" the preceding "ı" is not a word
 * character, so `\b` finds no boundary and the token silently fails to match
 * exactly the Turkish spellings this list exists to catch.
 */
const ADDRESS_TOKEN_RE =
  /(?<!\p{L})(mah(\.|alle(si)?)?|cad(\.|de(si)?)?|sok(\.|ak|ağı)?|bulvar[ıi]?|blv\.?|no\s*:|kat\s*:|daire|apt\.?|apartman|sit(\.|esi)?|blok|plaza|iş\s*merkezi|sanayi|osb)(?!\p{L})/iu;

/**
 * How strongly a crawl candidate looks like a postal address.
 *
 * Replaces "longest candidate wins", which on the first real client chose a
 * 100-character microblading aftercare sentence ("Duş alırken kaşları ...
 * vazelin uygulayabilirsiniz") over the salon's actual 71-character address,
 * and then fed it to `mapsEmbedQuery`. Length is not evidence; the address
 * vocabulary and a resolvable province tail are.
 *
 * Returns 0 for anything that carries no address marker at all, so prose is
 * excluded outright rather than merely outranked.
 */
export function addressScore(candidate: string): number {
  const text = candidate.trim();
  if (text.length < 12) return 0;
  // A sentence is prose, not an address. Addresses abbreviate ("Mah.",
  // "No:"); they do not end in a full stop after a finite verb.
  if (/[.!?]\s+[A-ZÇĞİÖŞÜ]/.test(text) && !ADDRESS_TOKEN_RE.test(text)) return 0;
  if (!ADDRESS_TOKEN_RE.test(text)) return 0;

  let score = 1;
  // Each distinct marker is independent evidence.
  const markers = text.match(new RegExp(ADDRESS_TOKEN_RE.source, "gi"));
  score += new Set((markers ?? []).map((m) => m.toLocaleLowerCase("tr-TR"))).size;
  // A tail that resolves to a real province is the strongest single signal.
  if (trLocalityFromAddress(text) !== null) score += 4;
  if (/\b\d{5}\b/.test(text)) score += 1;
  if (/\bno\s*:?\s*\d/i.test(text)) score += 1;
  return score;
}

/** Highest-scoring address candidate; null when none looks like an address. */
export function pickAddress(candidates: string[]): string | null {
  const ranked = candidates
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .map((c) => ({ text: c, score: addressScore(c) }))
    .filter((c) => c.score > 0)
    // Longest only breaks ties between equally address-like candidates.
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);
  return ranked[0]?.text ?? null;
}

const SOCIAL_PLATFORMS: { platform: string; pattern: RegExp }[] = [
  { platform: "instagram", pattern: /(^|\.)instagram\.com$/i },
  { platform: "facebook", pattern: /(^|\.)facebook\.com$/i },
];

function socialLinksFromPages(pages: CrawlPage[]): { platform: string; url: string }[] {
  const found = new Map<string, string>();
  for (const page of pages) {
    for (const link of page.links) {
      let parsed: URL;
      try {
        parsed = new URL(link);
      } catch {
        continue;
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      for (const { platform, pattern } of SOCIAL_PLATFORMS) {
        if (!found.has(platform) && pattern.test(parsed.hostname)) {
          found.set(platform, parsed.toString());
        }
      }
    }
  }
  return [...found.entries()].map(([platform, url]) => ({ platform, url }));
}

/* ------------------------------------------------------------------ */
/* Services                                                            */
/* ------------------------------------------------------------------ */

/**
 * Page kinds every SMB site has that are never a service. Matched against the
 * slug and against the page's own name, so a site may spell them either way.
 *
 * This is deliberately a list of *page kinds* rather than a list of
 * non-services: it stays the same size as clients change, whereas guessing
 * which words are services would need editing per sector.
 */
const BOILERPLATE_SLUG_RE =
  /^\/?(|home|anasayfa|index|hakk[ıi]m[ıi]zda|about(-us)?|biz-kimiz|ekibimiz|team|galeri|gallery|foto(graf)?(-galeri)?|ileti[şs]im|contact(-us)?|randevu(-formu)?|appointment|te[şs]ekk[üu]rler|thank(s|-you)|blog|haberler|news|yaz[ıi]lar|makaleler|sss|faq|s[ıi]k-sorulan-sorular|hizmetler(imiz)?|services|sepet|cart|[öo]deme|checkout|gizlilik(-politikas[ıi])?|privacy|kvkk|[çc]erez|cookie|[şs]artlar|terms|site-haritas[ıi]|sitemap|404|arama|search|yorumlar|referanslar|fiyat(lar)?|price(s|-list)?)$/i;

const BOILERPLATE_NAME_RE =
  /^(ana\s*sayfa|anasayfa|home|hakk[ıi]m[ıi]zda|about\s*us?|ekibimiz|galeri|gallery|ileti[şs]im|contact|randevu\s*formu|randevu|te[şs]ekk[üu]rler|blog|haberler|sss|s[ıi]k\s*sorulan\s*sorular|hizmetler(imiz)?|services|gizlilik\s*politikas[ıi]|kvkk|[çc]erez\s*politikas[ıi]|kullan[ıi]m\s*[şs]artlar[ıi]|yorumlar|referanslar|fiyat\s*listesi)$/i;

/** Pages whose own name a services index would be titled with. */
const SERVICES_INDEX_NAME_RE =
  /^(hizmetler(imiz)?|services|tedaviler|uygulamalar|[üu]r[üu]nler(imiz)?|b[öo]l[üu]mler(imiz)?)$/i;

/** Latin/Turkish script only: a Turkish site's service names are Turkish. */
const LATIN_NAME_RE = /^[\p{Script=Latin}\p{Nd}\s\-–—&/'’.,()+%]+$/u;

/** The page's own name: breadcrumb tail, then H1, then the title's own part. */
function pageName(page: CrawlPage, brand: string | null): string | null {
  if (page.breadcrumbName) return page.breadcrumbName;
  if (page.h1) return page.h1;
  const title = page.title;
  if (!title) return null;
  // "Microblading - Mina Güzellik Merkezi" → "Microblading". Strip the brand
  // wherever it sits rather than assuming it comes second: Turkish SEO titles
  // use both orders, and splitting on the first separator is how "Galeri -
  // Mina Güzellik Merkezi" became the business name.
  if (brand) {
    const stripped = title
      .split(/\s*[|–—·•]\s*|\s+-\s+/)
      .map((part) => part.trim())
      .filter(
        (part) =>
          part.length > 0 &&
          part.toLocaleLowerCase("tr-TR") !== brand.toLocaleLowerCase("tr-TR"),
      );
    if (stripped.length > 0) return stripped.join(" ");
  }
  return (title.split(/\s*[|–—·•]\s*|\s+-\s+/)[0] ?? title).trim() || null;
}

/**
 * Link targets that appear on nearly every crawled page: site chrome.
 *
 * The services index links its children *and* the main nav, so without this
 * the "pages linked from the services index" rule returns `/`, `/about-us`,
 * `/gallery` and `/contact` alongside the real services. A link's presence on
 * almost every page is what makes it navigation rather than content.
 */
function chromePaths(pages: CrawlPage[], domain: string): Set<string> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const link of page.links) {
      const target = internalPath(link, domain, page.url);
      if (target === null || seen.has(target)) continue;
      seen.add(target);
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
  }
  const threshold = Math.max(2, Math.ceil(pages.length * 0.8));
  const chrome = new Set<string>();
  for (const [path, count] of counts) {
    if (count >= threshold) chrome.add(path);
  }
  return chrome;
}

/** Path of `link` when it points at `domain`, else null. Resolves relatives. */
function internalPath(link: string, domain: string, base: string | null): string | null {
  let parsed: URL;
  try {
    parsed = new URL(link, base ?? `https://${domain}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.hostname.replace(/^www\./i, "") !== domain.replace(/^www\./i, "")) return null;
  return parsed.pathname.replace(/\/+$/, "") || "/";
}

/**
 * Service names, from the pages the business published for them.
 *
 * `buildFacts` returned a hardcoded `[]` here, so no client has ever had a
 * service in its facts — minaguzellik.com publishes 21 service pages and the
 * design stage was told it had two, then reasonably chose a gallery-led
 * layout for a business whose entire offering is its service list.
 *
 * A page is a service when it is an internal page, is not site chrome, and is
 * not one of the boilerplate page kinds above. Pages the site's own services
 * index links come first and in its order — that is the business stating both
 * the set and the priority — with the remaining service pages after it.
 * Nothing is invented: every name is the page's own breadcrumb or heading.
 */
export function extractServices(
  pages: CrawlPage[],
  domain: string,
  brand: string | null,
): string[] {
  const chrome = chromePaths(pages, domain);
  const byPath = new Map<string, CrawlPage>();
  for (const page of pages) {
    if (page.path !== null && !byPath.has(page.path)) byPath.set(page.path, page);
  }

  const isService = (page: CrawlPage): boolean => {
    if (page.path === null || page.path === "/") return false;
    if (chrome.has(page.path)) return false;
    const slug = page.path.split("/").filter(Boolean).pop() ?? "";
    if (BOILERPLATE_SLUG_RE.test(decodeURIComponent(slug))) return false;
    const name = pageName(page, brand);
    if (name === null || BOILERPLATE_NAME_RE.test(name)) return false;
    return LATIN_NAME_RE.test(name);
  };

  const ordered: CrawlPage[] = [];
  const taken = new Set<string>();
  const take = (page: CrawlPage): void => {
    if (page.path === null || taken.has(page.path)) return;
    taken.add(page.path);
    ordered.push(page);
  };

  // The services index first, in its own link order.
  for (const index of pages) {
    const name = pageName(index, brand);
    const slug = index.path?.split("/").filter(Boolean).pop() ?? "";
    const isIndex =
      (name !== null && SERVICES_INDEX_NAME_RE.test(name)) ||
      SERVICES_INDEX_NAME_RE.test(decodeURIComponent(slug));
    if (!isIndex) continue;
    for (const link of index.links) {
      const target = internalPath(link, domain, index.url);
      const page = target === null ? undefined : byPath.get(target);
      if (page && isService(page)) take(page);
    }
  }
  // Then every other service page, in crawl order.
  for (const page of pages) {
    if (isService(page)) take(page);
  }

  const names: string[] = [];
  const seen = new Set<string>();
  for (const page of ordered) {
    const name = pageName(page, brand);
    if (name === null) continue;
    const key = name.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export interface BuildFactsInput {
  domain: string;
  extracted: ExtractedSignals | null;
  pages: CrawlPage[];
}

/**
 * Deterministic Facts from crawl signals. JSON-LD LocalBusiness/Organization
 * fields win over text extraction; every non-null field records its source.
 */
export function buildFacts(input: BuildFactsInput): Facts {
  const extracted = input.extracted;
  const pages = input.pages;
  const jsonld = extracted?.jsonld ?? [];
  const lb = findLocalBusinessNode(jsonld);
  const org = lb ?? findOrganizationNode(jsonld);
  const sources: Record<string, string> = {};

  // businessName: JSON-LD LocalBusiness/Organization name > WebSite name >
  // og:site_name > the HOME page's title > domain.
  //
  // Both later steps were wrong on the first real client. WordPress SEO
  // plugins publish the site name only as `WebSite.name`, which neither
  // node finder matched, and the title fallback took whichever page the
  // crawl happened to return first — `/gallery`, giving "Galeri".
  let businessName: string | null = null;
  const jsonldName = org ? str(org.name) : null;
  const siteNode = findWebSiteNode(jsonld);
  const siteName = siteNode ? str(siteNode.name) : null;
  const ogSiteName = pages.map((p) => p.ogSiteName).find((n) => n !== null) ?? null;
  const home = pages.find((p) => p.path === "/") ?? pages[0];
  const homeTitle = home?.title ?? null;
  if (jsonldName) {
    businessName = jsonldName;
    sources.businessName = "jsonld:name";
  } else if (siteName) {
    businessName = siteName;
    sources.businessName = "jsonld:WebSite.name";
  } else if (ogSiteName) {
    businessName = ogSiteName;
    sources.businessName = "og:site_name";
  } else if (homeTitle) {
    // On the home page the brand is usually the longest segment, not the
    // first: "Anasayfa - Mina Güzellik Merkezi".
    const segments = homeTitle
      .split(/\s*[|–—·•]\s*|\s+-\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !BOILERPLATE_NAME_RE.test(s));
    businessName =
      segments.sort((a, b) => b.length - a.length)[0] ??
      (homeTitle.split(/[|–—·•]|\s-\s/)[0] ?? homeTitle).trim() ??
      homeTitle;
    sources.businessName = "title";
  } else {
    businessName = input.domain;
    sources.businessName = "domain";
  }

  const legalName = org ? str(org.legalName) : null;
  if (legalName) sources.legalName = "jsonld:legalName";

  // phone: text phones > tel: hrefs > JSON-LD telephone (first mobile wins)
  let phoneE164: string | null = null;
  const jsonldPhone = org ? str(org.telephone) : null;
  const phonePools: { pool: string[]; source: string }[] = [
    { pool: extracted?.phones ?? [], source: "extracted.phones" },
    {
      pool: (extracted?.telHrefs ?? []).map((h) => h.replace(/^tel:/i, "")),
      source: "extracted.telHrefs",
    },
    { pool: jsonldPhone ? [jsonldPhone] : [], source: "jsonld:telephone" },
  ];
  for (const { pool, source } of phonePools) {
    const candidate = pickTrPhone(pool);
    if (candidate && (phoneE164 === null || (!isMobileTr(phoneE164) && isMobileTr(candidate)))) {
      phoneE164 = candidate;
      sources.phoneE164 = source;
      if (isMobileTr(candidate)) break;
    }
  }

  const whatsappE164 = whatsappFromHrefs(extracted?.waHrefs ?? []);
  if (whatsappE164) sources.whatsappE164 = "extracted.waHrefs";

  let email = firstEmail(extracted?.mailtos ?? []);
  if (email) {
    sources.email = "extracted.mailtos";
  } else {
    const jsonldEmail = org ? str(org.email) : null;
    if (jsonldEmail && EMAIL_RE.test(jsonldEmail.replace(/^mailto:/i, ""))) {
      email = jsonldEmail.replace(/^mailto:/i, "");
      sources.email = "jsonld:email";
    }
  }

  // address: JSON-LD address > longest crawl candidate
  const jsonldAddr = jsonldAddressToString(org?.address);
  let address: string | null = null;
  if (jsonldAddr.text) {
    address = jsonldAddr.text;
    sources.address = "jsonld:address";
  } else {
    const best = pickAddress(extracted?.addressCandidates ?? []);
    if (best) {
      address = best;
      sources.address = "extracted.addressCandidates";
    }
  }

  // district/city from JSON-LD postal address when present. Turkish sites
  // routinely put the licence-plate province code in addressRegion ("34")
  // and the postal code encodes the same number in its first two digits, so
  // both are resolved to a province name before falling back to locality.
  let district: string | null = null;
  let city: string | null = null;
  const regionCity = resolveTrProvince(jsonldAddr.region);
  if (regionCity) {
    city = regionCity.name;
    district = jsonldAddr.locality;
    sources.city = `jsonld:addressRegion${regionCity.fromPlateCode ? " (plate code)" : ""}`;
    if (district) sources.district = "jsonld:addressLocality";
  } else if (jsonldAddr.postalCode) {
    const postalCity = resolveTrProvince(jsonldAddr.postalCode.slice(0, 2));
    if (postalCity?.fromPlateCode) {
      city = postalCity.name;
      district = jsonldAddr.locality;
      sources.city = "jsonld:postalCode (plate code)";
      if (district) sources.district = "jsonld:addressLocality";
    }
  }
  if (!city && jsonldAddr.locality) {
    city = jsonldAddr.locality;
    sources.city = "jsonld:addressLocality";
  }
  if ((!city || !district) && address) {
    const fromAddress = trLocalityFromAddress(address);
    if (fromAddress) {
      if (!city) {
        city = fromAddress.city;
        sources.city = "derived:addressTail";
      }
      if (!district && fromAddress.district) {
        district = fromAddress.district;
        sources.district = "derived:addressTail";
      }
    }
  }

  let mapsEmbedQuery = mapsQueryFromIframes(extracted?.mapsIframes ?? []);
  if (mapsEmbedQuery) {
    sources.mapsEmbedQuery = "extracted.mapsIframes";
  } else if (address) {
    mapsEmbedQuery = `${businessName}, ${address}`;
    sources.mapsEmbedQuery = "derived:businessName+address";
  }

  // opening hours: JSON-LD spec > free-text candidates
  let openingHours = parseJsonldHours(org?.openingHoursSpecification);
  if (openingHours.length > 0) {
    sources.openingHours = "jsonld:openingHoursSpecification";
  } else {
    openingHours = parseOpeningHours(extracted?.hoursCandidates ?? []);
    if (openingHours.length > 0) sources.openingHours = "extracted.hoursCandidates";
  }

  // Hours published without a day mapping stay a verbatim note: the site
  // states "10.00-19.30" and never which days, so no openingHours entry can
  // be derived from it without inventing the mapping (DECISIONS D8).
  let hoursNote: string | null = null;
  if (openingHours.length === 0) {
    const published = (extracted?.hoursUnmappedCandidates ?? [])
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .sort((a, b) => a.length - b.length)[0];
    if (published) {
      hoursNote = published;
      sources.hoursNote = "extracted.hoursUnmappedCandidates";
    }
  }

  const socialLinks = socialLinksFromPages(pages);
  if (socialLinks.length > 0) sources.socialLinks = "pages:links";

  const services = extractServices(pages, input.domain, businessName);
  if (services.length > 0) sources.services = "pages:servicePages";

  return {
    businessName,
    legalName,
    phoneE164,
    whatsappE164,
    email,
    address,
    district,
    city,
    mapsEmbedQuery,
    openingHours,
    hoursNote,
    services,
    // TODO(uygar): prices need a published price list to read; no client has
    // had one yet. Left empty rather than derived — a wrong price is the
    // worst fact the pipeline could invent.
    prices: [],
    socialLinks,
    sources,
  };
}

/* ------------------------------------------------------------------ */
/* Turkish province resolution                                         */
/* ------------------------------------------------------------------ */

/**
 * Licence-plate code → province name. Turkish sites commonly store the plate
 * code in schema.org `addressRegion` (and it is also the first two digits of
 * every postal code), which would otherwise surface as a city literally
 * named "34".
 */
const TR_PROVINCES_BY_PLATE_CODE: Record<number, string> = {
  1: "Adana", 2: "Adıyaman", 3: "Afyonkarahisar", 4: "Ağrı", 5: "Amasya",
  6: "Ankara", 7: "Antalya", 8: "Artvin", 9: "Aydın", 10: "Balıkesir",
  11: "Bilecik", 12: "Bingöl", 13: "Bitlis", 14: "Bolu", 15: "Burdur",
  16: "Bursa", 17: "Çanakkale", 18: "Çankırı", 19: "Çorum", 20: "Denizli",
  21: "Diyarbakır", 22: "Edirne", 23: "Elazığ", 24: "Erzincan", 25: "Erzurum",
  26: "Eskişehir", 27: "Gaziantep", 28: "Giresun", 29: "Gümüşhane",
  30: "Hakkâri", 31: "Hatay", 32: "Isparta", 33: "Mersin", 34: "İstanbul",
  35: "İzmir", 36: "Kars", 37: "Kastamonu", 38: "Kayseri", 39: "Kırklareli",
  40: "Kırşehir", 41: "Kocaeli", 42: "Konya", 43: "Kütahya", 44: "Malatya",
  45: "Manisa", 46: "Kahramanmaraş", 47: "Mardin", 48: "Muğla", 49: "Muş",
  50: "Nevşehir", 51: "Niğde", 52: "Ordu", 53: "Rize", 54: "Sakarya",
  55: "Samsun", 56: "Siirt", 57: "Sinop", 58: "Sivas", 59: "Tekirdağ",
  60: "Tokat", 61: "Trabzon", 62: "Tunceli", 63: "Şanlıurfa", 64: "Uşak",
  65: "Van", 66: "Yozgat", 67: "Zonguldak", 68: "Aksaray", 69: "Bayburt",
  70: "Karaman", 71: "Kırıkkale", 72: "Batman", 73: "Şırnak", 74: "Bartın",
  75: "Ardahan", 76: "Iğdır", 77: "Yalova", 78: "Karabük", 79: "Kilis",
  80: "Osmaniye", 81: "Düzce",
};

/**
 * Resolves a raw `addressRegion` / postal-code prefix to a province name.
 * Returns null when the value is empty or a number outside 1-81 (which is
 * not a plate code and not a usable city name either).
 */
/** Province name (Turkish-lowercased) → canonical spelling. */
const TR_PROVINCE_BY_NORMALIZED_NAME: ReadonlyMap<string, string> = new Map(
  Object.values(TR_PROVINCES_BY_PLATE_CODE).map((name) => [
    name.toLocaleLowerCase("tr-TR"),
    name,
  ]),
);

/**
 * District and province read off the tail of a Turkish address. Addresses are
 * conventionally written "... <postal> <neighbourhood>/<district>/<province>"
 * (slash- or comma-separated), so the last segment that is a real province
 * name gives the city and the segment before it gives the district. Only used
 * when the site publishes no JSON-LD postal address — without this, a site
 * whose address plainly ends "Küçükçekmece/İstanbul" still yields a null
 * district and city, which the template schema then rejects.
 */
/**
 * The district out of the segment that precedes the province.
 *
 * Turkish addresses are only sometimes punctuated between the street line and
 * the district: "Cumhuriyet Mah. Nazım Hikmet Bulvarı No: 25 Kat:2
 * Beylikdüzü / İstanbul" puts both in one slash-delimited segment. Returning
 * the whole segment made `district` the entire street address, which the
 * generated site then printed as the neighbourhood.
 *
 * When the segment carries street vocabulary, the district is what follows
 * the last of it. When it carries none ("..., Kadıköy, İstanbul") the segment
 * already *is* the district. If the tail cannot be isolated, this returns
 * null — no district is better than the street line labelled as one.
 */
function districtFromSegment(segment: string): string | null {
  const text = segment.trim();
  if (!ADDRESS_TOKEN_RE.test(text)) return text.length > 0 ? text : null;

  const marker = new RegExp(ADDRESS_TOKEN_RE.source, "gi");
  let end = -1;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(text)) !== null) end = m.index + m[0].length;
  if (end < 0) return null;

  // Skip the marker's own operand ("No: 25", "Kat:2") and keep what is left.
  const tail = text
    .slice(end)
    .replace(/^[\s:.]*\d+\s*(\/\s*\d+)?/, "")
    .replace(/^[\s:.,-]+/, "")
    .trim();
  if (tail.length === 0 || /\d/.test(tail)) return null;
  // A district is a place name, not a remaining clause.
  return tail.split(/\s+/).length <= 3 ? tail : null;
}

export function trLocalityFromAddress(
  address: string,
): { district: string | null; city: string } | null {
  const segments = address
    .split(/[/,]/)
    .map((part) => part.replace(/\b\d{5}\b/g, "").trim())
    .filter((part) => part.length > 0);

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const canonical = TR_PROVINCE_BY_NORMALIZED_NAME.get(
      segments[i]!.toLocaleLowerCase("tr-TR"),
    );
    if (!canonical) continue;
    const previous = i > 0 ? segments[i - 1]! : null;
    const district =
      previous !== null &&
      previous.toLocaleLowerCase("tr-TR") !== canonical.toLocaleLowerCase("tr-TR")
        ? districtFromSegment(previous)
        : null;
    return { district, city: canonical };
  }
  return null;
}

export function resolveTrProvince(
  raw: string | null | undefined,
): { name: string; fromPlateCode: boolean } | null {
  const value = raw?.trim();
  if (!value) return null;
  if (/^\d{1,2}$/.test(value)) {
    const name = TR_PROVINCES_BY_PLATE_CODE[Number.parseInt(value, 10)];
    return name ? { name, fromPlateCode: true } : null;
  }
  // Any other all-numeric value is not a province designator.
  if (/^\d+$/.test(value)) return null;
  return { name: value, fromPlateCode: false };
}
