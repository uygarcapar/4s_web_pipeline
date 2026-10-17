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
    phones: strArray(raw.phones),
    telHrefs: strArray(pick(raw, "telHrefs", "tel_hrefs")),
    waHrefs: strArray(pick(raw, "waHrefs", "whatsappHrefs", "whatsapp_hrefs")),
    mailtos: strArray(pick(raw, "mailtos", "mailtoHrefs", "mailto_hrefs")),
    hoursCandidates: strArray(pick(raw, "hoursCandidates", "hours_candidates")),
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
    pages.push({
      url: str(item.url) ?? str(item.finalUrl),
      title: str(item.title),
      metaDescription:
        str(item.metaDescription) ?? str(item.meta_description) ?? str(item.description),
      h1: str(item.h1) ?? h1s[0] ?? null,
      // TODO(uygar): crawl/pages.json has no generic `links` array yet, so
      // facts.socialLinks stays empty. Add link collection to the crawl
      // extraction when social profiles start mattering for generated sites.
      ogSiteName: str(item.ogSiteName) ?? str(item.og_site_name) ?? str(og.site_name),
      links,
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
    if (/her\s*gün|hergün/.test(text)) {
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
  return null;
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

  // businessName: JSON-LD name > og:site_name > <title> first segment > domain
  let businessName: string | null = null;
  const jsonldName = org ? str(org.name) : null;
  const ogSiteName = pages.map((p) => p.ogSiteName).find((n) => n !== null) ?? null;
  const firstTitle = pages.map((p) => p.title).find((t) => t !== null) ?? null;
  if (jsonldName) {
    businessName = jsonldName;
    sources.businessName = "jsonld:name";
  } else if (ogSiteName) {
    businessName = ogSiteName;
    sources.businessName = "og:site_name";
  } else if (firstTitle) {
    businessName = (firstTitle.split(/[|–—·•]|\s-\s/)[0] ?? firstTitle).trim() || firstTitle;
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
    const longest = (extracted?.addressCandidates ?? [])
      .map((a) => a.trim())
      .filter((a) => a.length > 0)
      .sort((a, b) => b.length - a.length)[0];
    if (longest) {
      address = longest;
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

  const socialLinks = socialLinksFromPages(pages);
  if (socialLinks.length > 0) sources.socialLinks = "pages:links";

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
    services: [],
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
