import { describe, expect, it } from "vitest";
import { factsSchema, issuesFileSchema } from "@pipeline/core";
import {
  buildFacts,
  normalizeTrPhone,
  parseJsonldHours,
  parseOpeningHours,
  pickTrPhone,
  readExtracted,
  readPages,
  resolveTrProvince,
} from "./facts.js";
import { runRules, summarizeAxe, summarizeLhr } from "./audit-rules.js";
import type { LighthouseSummary } from "./audit-rules.js";

/* ------------------------------------------------------------------ */
/* Fixtures (synthetic crawl artifacts — no network, no lighthouse)    */
/* ------------------------------------------------------------------ */

const fullExtractedRaw = {
  phones: ["0532 123 45 67"],
  telHrefs: ["tel:05321234567"],
  waHrefs: ["https://wa.me/905321234567?text=Merhaba"],
  mailtos: ["mailto:info@ornek.com.tr?subject=hi"],
  hoursCandidates: ["Pzt - Cum 09:00 - 18:00", "Cmt 10:00 - 15:00", "Pazar Kapalı"],
  addressCandidates: ["Kısa adres", "Atatürk Cad. No:12 Daire 3, Kadıköy, İstanbul 34710"],
  jsonld: [
    {
      "@context": "https://schema.org",
      "@type": "Dentist",
      name: "Örnek Diş Kliniği",
      legalName: "Örnek Sağlık Hizmetleri Ltd. Şti.",
      telephone: "+90 212 345 67 89",
      email: "klinik@ornek.com.tr",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Atatürk Cad. No:12",
        addressLocality: "Kadıköy",
        addressRegion: "İstanbul",
        postalCode: "34710",
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday"],
          opens: "09:00",
          closes: "18:00",
        },
      ],
    },
  ],
  fonts: ["Arial"],
  mojibake: false,
  hasHttps: true,
  viewportMeta: true,
  mapsIframes: ["https://www.google.com/maps?q=%C3%96rnek+Di%C5%9F+Klini%C4%9Fi&output=embed"],
};

const pagesRaw = [
  {
    url: "https://ornek.com.tr/",
    title: "Örnek Diş Kliniği | Kadıköy",
    metaDescription: "Kadıköy'de diş kliniği",
    h1: "Örnek Diş Kliniği",
    ogSiteName: "Örnek Diş",
    links: [
      "https://www.instagram.com/ornekdis",
      { href: "https://www.facebook.com/ornekdis" },
      "/hizmetler",
    ],
  },
  { url: "https://ornek.com.tr/iletisim", title: "İletişim", links: [] },
];

/* ------------------------------------------------------------------ */
/* Phone normalization                                                 */
/* ------------------------------------------------------------------ */

describe("normalizeTrPhone", () => {
  it("normalizes 0-prefixed mobile with spaces", () => {
    expect(normalizeTrPhone("0532 123 45 67")).toBe("+905321234567");
  });

  it("normalizes +90 landline with parentheses", () => {
    expect(normalizeTrPhone("+90 (212) 345 67 89")).toBe("+902123456789");
  });

  it("normalizes bare 10-digit national number", () => {
    expect(normalizeTrPhone("5321234567")).toBe("+905321234567");
  });

  it("normalizes 0090 international prefix", () => {
    expect(normalizeTrPhone("0090 532 123 45 67")).toBe("+905321234567");
  });

  it("rejects garbage and foreign numbers", () => {
    expect(normalizeTrPhone("12345")).toBeNull();
    expect(normalizeTrPhone("+1 212 555 0100")).toBeNull();
    expect(normalizeTrPhone("")).toBeNull();
  });
});

describe("pickTrPhone", () => {
  it("prefers the mobile-looking number over a landline", () => {
    expect(pickTrPhone(["0212 345 67 89", "0532 123 45 67"])).toBe("+905321234567");
  });

  it("falls back to a valid landline when no mobile exists", () => {
    expect(pickTrPhone(["0212 345 67 89"])).toBe("+902123456789");
  });

  it("returns null when nothing is valid", () => {
    expect(pickTrPhone(["abc", "123"])).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Opening hours                                                       */
/* ------------------------------------------------------------------ */

describe("parseOpeningHours", () => {
  it("expands a day range with a time range", () => {
    const entries = parseOpeningHours(["Pzt - Cum 09:00 - 18:00"]);
    expect(entries).toHaveLength(5);
    expect(entries[0]).toEqual({ day: 1, opens: "09:00", closes: "18:00" });
    expect(entries[4]).toEqual({ day: 5, opens: "09:00", closes: "18:00" });
  });

  it("parses single days and closed days", () => {
    const entries = parseOpeningHours(["Cmt 10:00 - 15:00", "Pazar Kapalı"]);
    expect(entries).toEqual([
      { day: 6, opens: "10:00", closes: "15:00" },
      { day: 7, opens: null, closes: null },
    ]);
  });

  it("distinguishes cumartesi from cuma and pazartesi from pazar", () => {
    const entries = parseOpeningHours(["Cumartesi 10:00-14:00", "Pazartesi 08:30-17:00"]);
    expect(entries).toEqual([
      { day: 1, opens: "08:30", closes: "17:00" },
      { day: 6, opens: "10:00", closes: "14:00" },
    ]);
  });

  it("handles 'her gün'", () => {
    const entries = parseOpeningHours(["Her gün 08:00 - 22:00"]);
    expect(entries).toHaveLength(7);
    expect(entries[6]).toEqual({ day: 7, opens: "08:00", closes: "22:00" });
  });

  it("returns [] for unparseable input", () => {
    expect(parseOpeningHours(["hafta içi açığız", "", "09:00"])).toEqual([]);
    expect(parseOpeningHours([])).toEqual([]);
  });
});

describe("parseJsonldHours", () => {
  it("maps schema.org dayOfWeek to ISO days", () => {
    const entries = parseJsonldHours([
      { dayOfWeek: ["Monday", "Friday"], opens: "09:00", closes: "18:00" },
      { dayOfWeek: "https://schema.org/Sunday", opens: null, closes: null },
    ]);
    expect(entries).toEqual([
      { day: 1, opens: "09:00", closes: "18:00" },
      { day: 5, opens: "09:00", closes: "18:00" },
      { day: 7, opens: null, closes: null },
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* Readers                                                             */
/* ------------------------------------------------------------------ */

describe("readExtracted / readPages", () => {
  it("returns null for non-object extracted.json", () => {
    expect(readExtracted(null)).toBeNull();
    expect(readExtracted("oops")).toBeNull();
    expect(readExtracted([1, 2])).toBeNull();
  });

  it("fills defaults for a partial extracted.json", () => {
    const e = readExtracted({ phones: ["0532 123 45 67"], mojibake: "yes" });
    expect(e).not.toBeNull();
    expect(e?.phones).toEqual(["0532 123 45 67"]);
    expect(e?.telHrefs).toEqual([]);
    expect(e?.mojibake).toBeNull(); // non-boolean -> unknown
    expect(e?.hasHttps).toBeNull();
  });

  it("reads pages from an array or a wrapper object, tolerating junk", () => {
    expect(readPages(pagesRaw)).toHaveLength(2);
    expect(readPages({ pages: pagesRaw })).toHaveLength(2);
    expect(readPages("junk")).toEqual([]);
    const page = readPages(pagesRaw)[0];
    expect(page?.links).toContain("https://www.facebook.com/ornekdis");
    expect(page?.h1).toBe("Örnek Diş Kliniği");
  });
});

/* ------------------------------------------------------------------ */
/* Facts                                                               */
/* ------------------------------------------------------------------ */

describe("buildFacts", () => {
  it("prefers JSON-LD fields and validates against factsSchema", () => {
    const facts = buildFacts({
      domain: "ornek.com.tr",
      extracted: readExtracted(fullExtractedRaw),
      pages: readPages(pagesRaw),
    });
    expect(() => factsSchema.parse(facts)).not.toThrow();
    expect(facts.businessName).toBe("Örnek Diş Kliniği");
    expect(facts.sources.businessName).toBe("jsonld:name");
    expect(facts.legalName).toBe("Örnek Sağlık Hizmetleri Ltd. Şti.");
    expect(facts.phoneE164).toBe("+905321234567"); // text mobile beats jsonld landline
    expect(facts.whatsappE164).toBe("+905321234567");
    expect(facts.email).toBe("info@ornek.com.tr");
    expect(facts.address).toContain("Atatürk Cad. No:12");
    expect(facts.sources.address).toBe("jsonld:address");
    expect(facts.city).toBe("İstanbul");
    expect(facts.district).toBe("Kadıköy");
    expect(facts.mapsEmbedQuery).toBe("Örnek Diş Kliniği");
    // JSON-LD hours win over text candidates
    expect(facts.openingHours).toEqual([
      { day: 1, opens: "09:00", closes: "18:00" },
      { day: 2, opens: "09:00", closes: "18:00" },
    ]);
    expect(facts.sources.openingHours).toBe("jsonld:openingHoursSpecification");
    expect(facts.services).toEqual([]);
    expect(facts.prices).toEqual([]);
    expect(facts.socialLinks).toEqual([
      { platform: "instagram", url: "https://www.instagram.com/ornekdis" },
      { platform: "facebook", url: "https://www.facebook.com/ornekdis" },
    ]);
  });

  it("falls back businessName: og:site_name > title > domain", () => {
    const pages = readPages(pagesRaw);
    const noJsonld = readExtracted({ ...fullExtractedRaw, jsonld: [] });
    expect(buildFacts({ domain: "d", extracted: noJsonld, pages }).businessName).toBe("Örnek Diş");

    const noOg = readPages([{ url: "https://x.tr/", title: "Örnek Diş Kliniği | Kadıköy" }]);
    const fromTitle = buildFacts({ domain: "d", extracted: noJsonld, pages: noOg });
    expect(fromTitle.businessName).toBe("Örnek Diş Kliniği");
    expect(fromTitle.sources.businessName).toBe("title");

    const bare = buildFacts({ domain: "ornek.com.tr", extracted: null, pages: [] });
    expect(bare.businessName).toBe("ornek.com.tr");
    expect(bare.sources.businessName).toBe("domain");
    expect(() => factsSchema.parse(bare)).not.toThrow();
  });

  it("parses text hours when JSON-LD has none and keeps invalid email null", () => {
    const extracted = readExtracted({
      ...fullExtractedRaw,
      jsonld: [],
      mailtos: ["mailto:not-an-email"],
      mapsIframes: [],
    });
    const facts = buildFacts({ domain: "d", extracted, pages: [] });
    expect(facts.email).toBeNull();
    expect(facts.openingHours).toHaveLength(7); // Pzt-Cum + Cmt + Pazar(closed)
    expect(facts.openingHours[6]).toEqual({ day: 7, opens: null, closes: null });
    expect(facts.sources.openingHours).toBe("extracted.hoursCandidates");
    expect(facts.address).toBe("Atatürk Cad. No:12 Daire 3, Kadıköy, İstanbul 34710");
    expect(facts.sources.address).toBe("extracted.addressCandidates");
    expect(() => factsSchema.parse(facts)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/* Lighthouse / axe summaries                                          */
/* ------------------------------------------------------------------ */

const syntheticLhr = {
  categories: {
    performance: { score: 0.31 },
    accessibility: { score: 0.45 },
    seo: { score: 0.4 },
    "best-practices": { score: 0.48 },
  },
  audits: {
    "largest-contentful-paint": { numericValue: 4200 },
    "cumulative-layout-shift": { numericValue: 0.32 },
    "image-delivery-insight": { score: 0, title: "Improve image delivery" },
    "render-blocking-insight": { score: 0.2, title: "Render blocking requests" },
    "viewport-insight": { score: 1, title: "Viewport" },
  },
};

describe("summarizeLhr", () => {
  it("reads categories, metrics and failing insight audits", () => {
    const s = summarizeLhr(syntheticLhr, "mobile");
    expect(s?.categories.performance).toBe(0.31);
    expect(s?.lcpMs).toBe(4200);
    expect(s?.cls).toBe(0.32);
    expect(s?.failingInsights.map((f) => f.id).sort()).toEqual([
      "image-delivery-insight",
      "render-blocking-insight",
    ]);
  });

  it("falls back to the metrics audit when metric audits are renamed", () => {
    const s = summarizeLhr(
      {
        categories: {},
        audits: {
          metrics: {
            details: { items: [{ largestContentfulPaint: 3100, cumulativeLayoutShift: 0.2 }] },
          },
        },
      },
      "mobile",
    );
    expect(s?.lcpMs).toBe(3100);
    expect(s?.cls).toBe(0.2);
  });

  it("returns null for a non-object lhr", () => {
    expect(summarizeLhr(null, "mobile")).toBeNull();
  });
});

describe("summarizeAxe", () => {
  it("maps violations defensively", () => {
    const v = summarizeAxe([
      {
        id: "color-contrast",
        impact: "serious",
        help: "Elements must meet minimum color contrast",
        helpUrl: "https://dequeuniversity.com/rules/axe/color-contrast",
        nodes: [{ target: ["a.btn"] }, { target: [".nav"] }],
      },
      { bad: true },
      "junk",
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]?.id).toBe("color-contrast");
    expect(v[0]?.nodeCount).toBe(2);
    expect(v[0]?.sampleTargets).toEqual(["a.btn", ".nav"]);
    expect(summarizeAxe(null)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

const badExtracted = readExtracted({
  phones: ["0532 123 45 67"],
  telHrefs: [],
  waHrefs: [],
  mailtos: [],
  hoursCandidates: [],
  addressCandidates: [],
  jsonld: [],
  fonts: [],
  mojibake: true,
  hasHttps: false,
  viewportMeta: false,
  mapsIframes: [],
});

const poorMobile: LighthouseSummary = {
  formFactor: "mobile",
  categories: { performance: 0.31, accessibility: 0.45, seo: 0.4, "best-practices": 0.48 },
  lcpMs: 4200,
  cls: 0.32,
  failingInsights: [{ id: "image-delivery-insight", title: "Improve image delivery" }],
};

describe("runRules", () => {
  it("fires all crawl-based rules on a bad site and validates with issuesFileSchema", () => {
    const issues = runRules({
      url: "http://kotu-site.com.tr",
      extracted: badExtracted,
      pages: readPages([{ url: "http://kotu-site.com.tr/", title: "Site" }]),
      lhMobile: poorMobile,
      lhDesktop: { ...poorMobile, formFactor: "desktop", categories: { performance: 0.55 } },
      axeViolations: summarizeAxe([
        { id: "image-alt", impact: "critical", help: "Images must have alternate text", nodes: [{}] },
        { id: "color-contrast", impact: "serious", help: "Contrast", nodes: [{}] },
        { id: "region", impact: "moderate", help: "Landmarks", nodes: [{}] },
      ]),
    });
    expect(() => issuesFileSchema.parse(issues)).not.toThrow();

    const ids = issues.map((i) => i.id);
    expect(ids).toContain("no-https");
    expect(ids).toContain("no-tel-link");
    expect(ids).toContain("no-whatsapp-link");
    expect(ids).toContain("no-viewport-meta");
    expect(ids).toContain("mojibake-detected");
    expect(ids).toContain("missing-localbusiness-jsonld");
    expect(ids).toContain("cwv-poor");
    expect(ids).toContain("lh-performance-low");
    expect(ids).toContain("lh-accessibility-low");
    expect(ids).toContain("lh-seo-low");
    expect(ids).toContain("lh-best-practices-low");
    expect(ids).toContain("axe-image-alt");
    expect(ids).toContain("axe-color-contrast");
    expect(ids).not.toContain("axe-region"); // moderate impact excluded
    expect(ids).toContain("missing-meta-description");
    expect(ids).toContain("missing-h1");
    expect(ids).not.toContain("nap-mismatch"); // no tel: hrefs -> cannot mismatch

    // severity mapping per plan
    const byId = new Map(issues.map((i) => [i.id, i]));
    expect(byId.get("no-https")?.severity).toBe("critical");
    expect(byId.get("no-tel-link")?.severity).toBe("critical");
    expect(byId.get("no-whatsapp-link")?.severity).toBe("high");
    expect(byId.get("cwv-poor")?.severity).toBe("high");
    expect(byId.get("axe-image-alt")?.severity).toBe("high"); // critical impact -> high
    expect(byId.get("axe-color-contrast")?.severity).toBe("medium"); // serious -> medium
    expect(byId.get("missing-meta-description")?.severity).toBe("medium");
    expect(byId.get("lh-performance-low")?.severity).toBe("high");
    expect(byId.get("lh-seo-low")?.severity).toBe("medium");

    // every issue carries both titles, a fix and provenance
    for (const issue of issues) {
      expect(issue.title.length).toBeGreaterThan(0);
      expect(issue.title_tr.length).toBeGreaterThan(0);
      expect(issue.fix.length).toBeGreaterThan(0);
      expect(issue.business_impact.length).toBeGreaterThan(0);
      expect(issue.source_tool).toMatch(/^(rule:|lighthouse$|axe$)/);
      expect(issue.affected_urls.length).toBeGreaterThan(0);
    }

    // sorted by severity: criticals first
    expect(issues[0]?.severity).toBe("critical");
  });

  it("stays quiet on a healthy site", () => {
    const issues = runRules({
      url: "https://ornek.com.tr",
      extracted: readExtracted(fullExtractedRaw),
      pages: readPages(pagesRaw),
      lhMobile: {
        formFactor: "mobile",
        categories: { performance: 0.95, accessibility: 0.98, seo: 1, "best-practices": 1 },
        lcpMs: 1200,
        cls: 0.01,
        failingInsights: [],
      },
      lhDesktop: null,
      axeViolations: [],
    });
    expect(issues).toEqual([]);
  });

  it("flags nap-mismatch only when text and tel: numbers truly differ", () => {
    const base = {
      url: "https://ornek.com.tr",
      pages: [],
      lhMobile: null,
      lhDesktop: null,
      axeViolations: [],
    };
    const mismatch = runRules({
      ...base,
      extracted: readExtracted({
        ...fullExtractedRaw,
        phones: ["0532 123 45 67"],
        telHrefs: ["tel:+902123456789"],
      }),
    });
    expect(mismatch.map((i) => i.id)).toContain("nap-mismatch");

    const sameNumber = runRules({
      ...base,
      extracted: readExtracted({
        ...fullExtractedRaw,
        phones: ["0532 123 45 67"],
        telHrefs: ["tel:05321234567"],
      }),
    });
    expect(sameNumber.map((i) => i.id)).not.toContain("nap-mismatch");
  });

  it("skips absence-based rules when extracted.json is missing entirely", () => {
    const issues = runRules({
      url: "https://ornek.com.tr",
      extracted: null,
      pages: [],
      lhMobile: null,
      lhDesktop: null,
      axeViolations: [],
    });
    expect(issues).toEqual([]);
  });

  it("skips cwv-poor when metrics are within thresholds or unknown", () => {
    const ok = runRules({
      url: "https://x.tr",
      extracted: null,
      pages: [],
      lhMobile: {
        formFactor: "mobile",
        categories: { performance: 0.9 },
        lcpMs: 2400,
        cls: 0.05,
        failingInsights: [],
      },
      lhDesktop: null,
      axeViolations: [],
    });
    expect(ok.map((i) => i.id)).not.toContain("cwv-poor");
  });
});

describe("resolveTrProvince", () => {
  it("maps licence-plate codes to province names", () => {
    expect(resolveTrProvince("34")).toEqual({ name: "İstanbul", fromPlateCode: true });
    expect(resolveTrProvince("6")).toEqual({ name: "Ankara", fromPlateCode: true });
    expect(resolveTrProvince("35")).toEqual({ name: "İzmir", fromPlateCode: true });
    expect(resolveTrProvince("81")).toEqual({ name: "Düzce", fromPlateCode: true });
  });

  it("passes through real province names unchanged", () => {
    expect(resolveTrProvince("İstanbul")).toEqual({ name: "İstanbul", fromPlateCode: false });
    expect(resolveTrProvince("  Bursa ")).toEqual({ name: "Bursa", fromPlateCode: false });
  });

  it("rejects values that are neither a plate code nor a name", () => {
    expect(resolveTrProvince("0")).toBeNull();
    expect(resolveTrProvince("82")).toBeNull();
    expect(resolveTrProvince("34724")).toBeNull();
    expect(resolveTrProvince("")).toBeNull();
    expect(resolveTrProvince(null)).toBeNull();
  });
});
