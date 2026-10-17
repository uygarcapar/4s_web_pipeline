import type { Issue, IssueCategory, IssueSeverity } from "@pipeline/core";
import type { CrawlPage, ExtractedSignals } from "./facts.js";
import { findLocalBusinessNode, isObj, normalizeTrPhone } from "./facts.js";

/**
 * Deterministic audit rules: pure functions over crawl artifacts plus
 * Lighthouse/axe summaries. No network, no LLM — every title_tr is a
 * static Turkish string. Severity follows docs/PLAN.md: critical = legal
 * risk or conversion blocker; high = CWV poor, axe critical, missing
 * LocalBusiness, NAP mismatch.
 */

/* ------------------------------------------------------------------ */
/* Lighthouse summary (defensive over LH 13 insight-era audit ids)     */
/* ------------------------------------------------------------------ */

export interface LighthouseSummary {
  formFactor: "mobile" | "desktop";
  /** Category id -> score 0..1 (null when Lighthouse could not score it). */
  categories: Record<string, number | null>;
  lcpMs: number | null;
  cls: number | null;
  /** Failing insight audits (LH 13 "*-insight" ids), for evidence. */
  failingInsights: { id: string; title: string }[];
}

function auditNumeric(audits: Record<string, unknown>, ids: string[]): number | null {
  for (const id of ids) {
    const a = audits[id];
    if (isObj(a) && typeof a.numericValue === "number") return a.numericValue;
  }
  return null;
}

/** Fallback: read a metric from the `metrics` audit's details.items[0]. */
function metricsValue(audits: Record<string, unknown>, key: string): number | null {
  const metrics = audits.metrics;
  if (!isObj(metrics) || !isObj(metrics.details)) return null;
  const items = metrics.details.items;
  if (!Array.isArray(items)) return null;
  const first = items[0];
  if (!isObj(first)) return null;
  const v = first[key];
  return typeof v === "number" ? v : null;
}

/** Summarize a raw lhr JSON defensively (audit ids differ across LH versions). */
export function summarizeLhr(
  lhr: unknown,
  formFactor: "mobile" | "desktop",
): LighthouseSummary | null {
  if (!isObj(lhr)) return null;
  const categories: Record<string, number | null> = {};
  if (isObj(lhr.categories)) {
    for (const [id, cat] of Object.entries(lhr.categories)) {
      categories[id] = isObj(cat) && typeof cat.score === "number" ? cat.score : null;
    }
  }
  const audits = isObj(lhr.audits) ? lhr.audits : {};
  const lcpMs =
    auditNumeric(audits, ["largest-contentful-paint"]) ??
    metricsValue(audits, "largestContentfulPaint");
  const cls =
    auditNumeric(audits, ["cumulative-layout-shift"]) ??
    metricsValue(audits, "cumulativeLayoutShift");

  const failingInsights: { id: string; title: string }[] = [];
  for (const [id, a] of Object.entries(audits)) {
    if (!id.endsWith("-insight") || !isObj(a)) continue;
    if (typeof a.score === "number" && a.score < 0.5) {
      failingInsights.push({ id, title: typeof a.title === "string" ? a.title : id });
    }
  }
  return { formFactor, categories, lcpMs, cls, failingInsights };
}

/* ------------------------------------------------------------------ */
/* axe summary                                                         */
/* ------------------------------------------------------------------ */

export interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string | null;
  nodeCount: number;
  sampleTargets: string[];
}

/** Defensive mapping of axe-core result violations. */
export function summarizeAxe(violations: unknown): AxeViolation[] {
  if (!Array.isArray(violations)) return [];
  const out: AxeViolation[] = [];
  for (const v of violations) {
    if (!isObj(v) || typeof v.id !== "string") continue;
    const nodes = Array.isArray(v.nodes) ? v.nodes : [];
    const sampleTargets: string[] = [];
    for (const n of nodes.slice(0, 3)) {
      if (isObj(n) && Array.isArray(n.target)) {
        sampleTargets.push(n.target.filter((t): t is string => typeof t === "string").join(" "));
      }
    }
    out.push({
      id: v.id,
      impact: typeof v.impact === "string" ? v.impact : null,
      help: typeof v.help === "string" ? v.help : v.id,
      helpUrl: typeof v.helpUrl === "string" ? v.helpUrl : null,
      nodeCount: nodes.length,
      sampleTargets,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export interface RuleInput {
  url: string;
  /** null when crawl/extracted.json is missing — absence-based rules are skipped. */
  extracted: ExtractedSignals | null;
  pages: CrawlPage[];
  lhMobile: LighthouseSummary | null;
  lhDesktop: LighthouseSummary | null;
  axeViolations: AxeViolation[];
}

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function homepage(pages: CrawlPage[]): CrawlPage | null {
  const root = pages.find((p) => {
    if (!p.url) return false;
    try {
      return new URL(p.url).pathname === "/";
    } catch {
      return false;
    }
  });
  return root ?? pages[0] ?? null;
}

function pct(score: number | null): string {
  return score === null ? "n/a" : String(Math.round(score * 100));
}

/** Run every deterministic rule; result is sorted by severity. */
export function runRules(input: RuleInput): Issue[] {
  const issues: Issue[] = [];
  const { url, extracted, pages, lhMobile, lhDesktop } = input;
  const home = homepage(pages);
  const affected = [home?.url ?? url];

  // --- no-https (critical, security: legal/security risk) -----------
  if (extracted?.hasHttps === false || url.startsWith("http://")) {
    issues.push({
      id: "no-https",
      category: "security",
      severity: "critical",
      title: "Site is served without HTTPS",
      title_tr: "Site HTTPS olmadan sunuluyor",
      evidence: [
        `hasHttps=${String(extracted?.hasHttps ?? "unknown")}`,
        `url=${url}`,
      ],
      affected_urls: affected,
      fix: "Install a TLS certificate and redirect all HTTP traffic to HTTPS.",
      effort: "low",
      business_impact:
        "Browsers flag the site as 'Not secure', which scares visitors away and hurts rankings.",
      source_tool: "rule:no-https",
      confidence: 1,
    });
  }

  // --- no-tel-link (critical, conversion blocker) --------------------
  if (extracted && extracted.phones.length > 0 && extracted.telHrefs.length === 0) {
    issues.push({
      id: "no-tel-link",
      category: "content_conversion",
      severity: "critical",
      title: "Phone number is shown but not clickable on mobile (no tel: link)",
      title_tr: "Telefon numarası var ama mobilde tıklanamıyor (tel: bağlantısı yok)",
      evidence: extracted.phones.slice(0, 3).map((p) => `phone in text: ${p}`),
      affected_urls: affected,
      fix: "Wrap the phone number in an <a href=\"tel:+90...\"> link so mobile visitors can call with one tap.",
      effort: "low",
      business_impact:
        "Mobile visitors cannot call with a single tap, losing calls from ready-to-buy customers.",
      source_tool: "rule:no-tel-link",
      confidence: 0.95,
    });
  }

  // --- no-whatsapp-link (high, content_conversion) -------------------
  if (extracted && extracted.waHrefs.length === 0) {
    issues.push({
      id: "no-whatsapp-link",
      category: "content_conversion",
      severity: "high",
      title: "No WhatsApp contact link on the site",
      title_tr: "Sitede WhatsApp iletişim bağlantısı yok",
      evidence: ["no wa.me or api.whatsapp.com links found in crawl"],
      affected_urls: affected,
      fix: "Add a wa.me/90XXXXXXXXXX link or floating WhatsApp button on every page.",
      effort: "low",
      business_impact:
        "WhatsApp is the default contact channel for Turkish SMB customers; its absence loses enquiries.",
      source_tool: "rule:no-whatsapp-link",
      confidence: 0.9,
    });
  }

  // --- no-viewport-meta (high, performance/ux) -----------------------
  if (extracted?.viewportMeta === false) {
    issues.push({
      id: "no-viewport-meta",
      category: "performance",
      severity: "high",
      title: "Missing viewport meta tag (page is not mobile-responsive)",
      title_tr: "Viewport meta etiketi yok (sayfa mobil uyumlu değil)",
      evidence: ["viewportMeta=false in crawl extraction"],
      affected_urls: affected,
      fix: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to every page.",
      effort: "low",
      business_impact:
        "The site renders as a zoomed-out desktop page on phones, making it unusable for most visitors.",
      source_tool: "rule:no-viewport-meta",
      confidence: 1,
    });
  }

  // --- mojibake-detected (high, content_conversion) ------------------
  if (extracted?.mojibake === true) {
    issues.push({
      id: "mojibake-detected",
      category: "content_conversion",
      severity: "high",
      title: "Broken Turkish characters (mojibake) detected in page text",
      title_tr: "Sayfa metninde bozuk Türkçe karakterler (mojibake) tespit edildi",
      evidence: ["mojibake=true in crawl extraction (ş/ğ/ı/İ/ç/ö/ü rendered incorrectly)"],
      affected_urls: affected,
      fix: "Serve all pages as UTF-8 and re-encode the content so Turkish characters display correctly.",
      effort: "medium",
      business_impact:
        "Garbled text looks unprofessional and destroys trust with Turkish-speaking customers.",
      source_tool: "rule:mojibake-detected",
      confidence: 0.9,
    });
  }

  // --- missing-localbusiness-jsonld (high, seo_local) ----------------
  if (extracted && findLocalBusinessNode(extracted.jsonld) === null) {
    issues.push({
      id: "missing-localbusiness-jsonld",
      category: "seo_local",
      severity: "high",
      title: "No LocalBusiness structured data (JSON-LD) on the site",
      title_tr: "Sitede LocalBusiness yapılandırılmış verisi (JSON-LD) yok",
      evidence: [
        extracted.jsonld.length === 0
          ? "no JSON-LD blocks found in crawl"
          : `${extracted.jsonld.length} JSON-LD block(s) found, none typed LocalBusiness`,
      ],
      affected_urls: affected,
      fix: "Add a LocalBusiness JSON-LD block with name, address, telephone and openingHoursSpecification.",
      effort: "low",
      business_impact:
        "Google cannot show rich local results (hours, map, phone), weakening local search visibility.",
      source_tool: "rule:missing-localbusiness-jsonld",
      confidence: 0.95,
    });
  }

  // --- nap-mismatch (high, seo_local) --------------------------------
  if (extracted) {
    const textNums = [
      ...new Set(
        extracted.phones
          .map((p) => normalizeTrPhone(p))
          .filter((p): p is string => p !== null),
      ),
    ];
    const telNums = [
      ...new Set(
        extracted.telHrefs
          .map((h) => normalizeTrPhone(h.replace(/^tel:/i, "")))
          .filter((p): p is string => p !== null),
      ),
    ];
    const overlap = textNums.some((n) => telNums.includes(n));
    if (textNums.length > 0 && telNums.length > 0 && !overlap) {
      issues.push({
        id: "nap-mismatch",
        category: "seo_local",
        severity: "high",
        title: "Phone number in page text differs from the tel: link (NAP mismatch)",
        title_tr: "Metindeki telefon numarası tel: bağlantısıyla uyuşmuyor (NAP tutarsızlığı)",
        evidence: [
          `text phones: ${textNums.join(", ")}`,
          `tel: hrefs: ${telNums.join(", ")}`,
        ],
        affected_urls: affected,
        fix: "Use one canonical phone number consistently in visible text, tel: links and structured data.",
        effort: "low",
        business_impact:
          "Inconsistent name/address/phone data confuses customers and hurts local SEO rankings.",
        source_tool: "rule:nap-mismatch",
        confidence: 0.85,
      });
    }
  }

  // --- cwv-poor (high, performance, from mobile lhr) -----------------
  if (lhMobile) {
    const lcpPoor = lhMobile.lcpMs !== null && lhMobile.lcpMs > 2500;
    const clsPoor = lhMobile.cls !== null && lhMobile.cls > 0.1;
    if (lcpPoor || clsPoor) {
      const evidence: string[] = [];
      if (lhMobile.lcpMs !== null) {
        evidence.push(`LCP ${Math.round(lhMobile.lcpMs)} ms (threshold 2500 ms)`);
      }
      if (lhMobile.cls !== null) {
        evidence.push(`CLS ${lhMobile.cls.toFixed(3)} (threshold 0.1)`);
      }
      for (const insight of lhMobile.failingInsights.slice(0, 5)) {
        evidence.push(`failing insight: ${insight.id} (${insight.title})`);
      }
      issues.push({
        id: "cwv-poor",
        category: "performance",
        severity: "high",
        title: "Core Web Vitals in the poor band on mobile (LCP/CLS)",
        title_tr: "Mobilde Core Web Vitals 'kötü' bandında (LCP/CLS)",
        evidence,
        affected_urls: [url],
        fix: "Optimize the largest image/text paint and reserve space for late-loading elements.",
        effort: "medium",
        business_impact:
          "Slow, unstable pages lose mobile visitors before the content appears and rank worse on Google.",
        source_tool: "lighthouse",
        confidence: 0.85,
      });
    }
  }

  // --- lh-category-low: one issue per category scoring < 0.5 ---------
  if (lhMobile) {
    const meta: Record<
      string,
      { title: string; title_tr: string; category: IssueCategory; severity: IssueSeverity }
    > = {
      performance: {
        title: "Lighthouse performance score is very low on mobile",
        title_tr: "Lighthouse performans puanı mobilde çok düşük",
        category: "performance",
        severity: "high",
      },
      accessibility: {
        title: "Lighthouse accessibility score is very low",
        title_tr: "Lighthouse erişilebilirlik puanı çok düşük",
        category: "accessibility",
        severity: "high",
      },
      seo: {
        title: "Lighthouse SEO score is very low",
        title_tr: "Lighthouse SEO puanı çok düşük",
        category: "seo_technical",
        severity: "medium",
      },
      "best-practices": {
        title: "Lighthouse best-practices score is very low",
        title_tr: "Lighthouse 'best practices' puanı çok düşük",
        category: "security",
        severity: "medium",
      },
    };
    for (const [catId, m] of Object.entries(meta)) {
      const mobileScore = lhMobile.categories[catId] ?? null;
      if (mobileScore === null || mobileScore >= 0.5) continue;
      const desktopScore = lhDesktop?.categories[catId] ?? null;
      issues.push({
        id: `lh-${catId}-low`,
        category: m.category,
        severity: m.severity,
        title: m.title,
        title_tr: m.title_tr,
        evidence: [
          `mobile ${catId} score: ${pct(mobileScore)}/100`,
          ...(desktopScore !== null ? [`desktop ${catId} score: ${pct(desktopScore)}/100`] : []),
        ],
        affected_urls: [url],
        fix: `Address the failing Lighthouse ${catId} audits listed in the saved report.`,
        effort: "medium",
        business_impact:
          "Scores below 50 indicate problems severe enough to cost visitors, rankings or both.",
        source_tool: "lighthouse",
        confidence: 0.8,
      });
    }
  }

  // --- axe critical/serious violations: one issue per rule id --------
  for (const v of input.axeViolations) {
    if (v.impact !== "critical" && v.impact !== "serious") continue;
    issues.push({
      id: `axe-${v.id}`,
      category: "accessibility",
      severity: v.impact === "critical" ? "high" : "medium",
      title: `Accessibility violation: ${v.help}`,
      title_tr: `Erişilebilirlik ihlali: ${v.id} (${v.impact === "critical" ? "kritik" : "ciddi"})`,
      evidence: [
        `axe rule: ${v.id} (impact: ${v.impact})`,
        `${v.nodeCount} affected element(s)`,
        ...v.sampleTargets.map((t) => `element: ${t}`),
        ...(v.helpUrl ? [`docs: ${v.helpUrl}`] : []),
      ],
      affected_urls: [url],
      fix: `Fix the elements failing the axe rule '${v.id}'.`,
      effort: "low",
      business_impact:
        "Accessibility barriers exclude users with disabilities and carry legal and SEO risk.",
      source_tool: "axe",
      confidence: 0.9,
    });
  }

  // --- missing-meta-description (medium, seo_technical) --------------
  if (home && (home.metaDescription === null || home.metaDescription.trim() === "")) {
    issues.push({
      id: "missing-meta-description",
      category: "seo_technical",
      severity: "medium",
      title: "Homepage has no meta description",
      title_tr: "Ana sayfada meta description yok",
      evidence: [`no meta description on ${home.url ?? url}`],
      affected_urls: [home.url ?? url],
      fix: "Add a unique ~155-character meta description summarizing the business and location.",
      effort: "low",
      business_impact:
        "Google invents its own snippet, lowering click-through from search results.",
      source_tool: "rule:missing-meta-description",
      confidence: 0.95,
    });
  }

  // --- missing-h1 (medium, seo_technical) ----------------------------
  if (home && (home.h1 === null || home.h1.trim() === "")) {
    issues.push({
      id: "missing-h1",
      category: "seo_technical",
      severity: "medium",
      title: "Homepage has no H1 heading",
      title_tr: "Ana sayfada H1 başlığı yok",
      evidence: [`no <h1> found on ${home.url ?? url}`],
      affected_urls: [home.url ?? url],
      fix: "Add a single descriptive H1 naming the business and its main service.",
      effort: "low",
      business_impact:
        "Search engines lack a clear page topic signal, weakening rankings for core keywords.",
      source_tool: "rule:missing-h1",
      confidence: 0.95,
    });
  }

  return issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
