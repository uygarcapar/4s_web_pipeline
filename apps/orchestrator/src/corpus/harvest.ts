/**
 * Corpus harvester — measures award-winning sites so the design stage and the
 * judge argue from evidence instead of taste (docs/DECISIONS.md D9).
 *
 * Deliberately a one-off tool, not a pipeline stage. The corpus must be stable
 * for two runs to be comparable, so it is harvested on the operator's command,
 * reviewed, and committed. Re-harvesting is a decision, never a side effect of
 * generating a client site.
 *
 * Discovery is not done here: award galleries block automated browsers (local
 * Playwright gets 403 from awwwards.com), so the URL list is collected through
 * Firecrawl's stealth proxy and kept in data/corpus/sites.txt. Measurement is
 * local because `getComputedStyle` is the only way to learn what a site's type
 * scale actually resolves to, and because it costs nothing to repeat.
 *
 * Usage: tsx src/corpus/harvest.ts [sitesFile] [outDir] [limit]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";

const NAV_TIMEOUT_MS = 30_000;
const SETTLE_MS = 2_500;
const CONCURRENCY = 4;

export interface TypeSample {
  selector: string;
  fontFamily: string;
  /** px */
  fontSize: number;
  fontWeight: number;
  /** em, normalised from the computed px value */
  letterSpacing: number;
  lineHeight: number;
  text: string;
}

export interface SiteMeasurement {
  url: string;
  ok: boolean;
  error?: string;
  title?: string;
  /** Distinct font families actually painted, most-used first. */
  fonts?: string[];
  /** Every @font-face family the page loaded, whether painted or not. */
  loadedFaces?: string[];
  type?: TypeSample[];
  /** display/body font-size ratio — the single number design-rules §4 pins. */
  displayToBodyRatio?: number | null;
  colours?: { background: string; foreground: string; distinct: number };
  structure?: {
    sections: number;
    hasFixedHeader: boolean;
    headerBlendMode: string | null;
    documentHeightRatio: number;
  };
  motion?: {
    libraries: string[];
    /** Elements whose transform changed between two scroll positions. */
    transformedOnScroll: number;
    smoothScroll: boolean;
  };
  /**
   * Read out of the stylesheets rather than off one element: the design
   * system as the site's own authors declared it.
   */
  deep?: {
    /** `:root` custom properties — most modern sites put their whole token set here. */
    customProperties: Record<string, string>;
    /** Every distinct painted font-size, ascending: the real type scale. */
    typeScale: number[];
    /** @font-face families with where the file came from (reveals the foundry). */
    fontFaces: { family: string; src: string }[];
    /** Distinct easing curves in use. */
    easings: string[];
    /** Distinct transition/animation durations, seconds. */
    durations: number[];
    /** Distinct container max-widths, px. */
    containers: number[];
    /** Distinct non-zero spacing values, px — the spacing scale. */
    spacing: number[];
    /** Top-level section tags in document order. */
    sectionSequence: string[];
    /** Stylesheets that could not be read (cross-origin), for a second pass. */
    blockedSheets: string[];
  };
  /**
   * What the page actually DOES, sampled at several scroll positions. CSS
   * says what a site declares; this says how it behaves, which is the half
   * a stylesheet cannot tell you.
   */
  behaviour?: {
    /** Motion kinds observed, by frequency of the elements exhibiting them. */
    motionKinds: Record<string, number>;
    /** Elements that held viewport position while the page scrolled past. */
    pinned: number;
    /** Elements moving at a different rate from the scroll. */
    parallax: number;
    /** Elements translating on X — lateral motion. */
    horizontal: number;
    /** Headings broken into per-word or per-character spans for animation. */
    textSplit: "none" | "word" | "char";
    /** Distinct grid-template-columns declarations in use. */
    grids: string[];
    /** Variable-font axis settings actually applied. */
    variableAxes: string[];
  };
  /** Config literals mined out of the site's own JS bundles. */
  scripts?: {
    bytes: number;
    /** gsap/ScrollTrigger option literals, e.g. "scrub: true", "pin: true". */
    gsapOptions: string[];
    /** Properties the timelines animate, e.g. yPercent, clipPath, scale. */
    animatedProps: string[];
    lenisConfig: string | null;
  };
  /**
   * The layers a single desktop pass cannot see: what happens on load, on
   * hover, at phone width, and when the visitor asks for less motion.
   */
  extra?: {
    /** Elements whose opacity/transform settled between 200ms and 2.5s. */
    entranceAnimated: number;
    /** Property deltas on the most prominent call to action, on hover. */
    hoverDelta: string[];
    /** Custom cursor: `cursor: none` plus a fixed follower element. */
    customCursor: boolean;
    media: { canvas: number; webgl: boolean; video: number };
    /** Painted colours, most frequent first, with body contrast ratio. */
    palette: { colour: string; count: number }[];
    bodyContrast: number | null;
    /** Display and body size at 390px — the real ends of the clamp(). */
    mobileType: { display: number | null; body: number | null } | null;
    /**
     * Does the site honour prefers-reduced-motion? Compares the motion
     * profile with the preference set against the default run.
     */
    reducedMotion: { honoured: boolean; movingElements: number } | null;
    /** Tag skeleton of the first few full-height sections. */
    sectionSkeletons: string[];
  };
  screenshot?: string;
}

/** Runs in the page. Keep it self-contained — nothing from module scope. */
function measureInPage(): Omit<SiteMeasurement, "url" | "ok" | "screenshot"> {
  const px = (v: string): number => Number.parseFloat(v) || 0;

  const painted = new Map<string, number>();
  const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
  for (const el of all) {
    if (!el.textContent?.trim()) continue;
    const fam = getComputedStyle(el).fontFamily.split(",")[0]!.replace(/["']/g, "").trim();
    if (fam) painted.set(fam, (painted.get(fam) ?? 0) + 1);
  }
  const fonts = [...painted.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);

  const loadedFaces = [
    ...new Set(
      Array.from(document.fonts as unknown as Iterable<FontFace>).map((f) =>
        f.family.replace(/["']/g, ""),
      ),
    ),
  ];

  // The largest text on the page is the display step; body is the commonest
  // paragraph. Measuring what is painted beats reading a stylesheet, because
  // the cascade and the clamp() both resolve here.
  const sample = (el: Element, selector: string): TypeSample => {
    const cs = getComputedStyle(el);
    const size = px(cs.fontSize);
    return {
      selector,
      fontFamily: cs.fontFamily.split(",")[0]!.replace(/["']/g, "").trim(),
      fontSize: Math.round(size * 10) / 10,
      fontWeight: Number.parseInt(cs.fontWeight, 10) || 400,
      letterSpacing:
        cs.letterSpacing === "normal"
          ? 0
          : Math.round((px(cs.letterSpacing) / size) * 1000) / 1000,
      lineHeight:
        cs.lineHeight === "normal"
          ? 0
          : Math.round((px(cs.lineHeight) / size) * 100) / 100,
      text: (el.textContent ?? "").trim().slice(0, 40),
    };
  };

  const type: TypeSample[] = [];
  const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
    .filter((h) => (h.textContent ?? "").trim().length > 1)
    .sort((a, b) => px(getComputedStyle(b).fontSize) - px(getComputedStyle(a).fontSize));
  if (headings[0]) type.push(sample(headings[0], "display"));
  if (headings[1]) type.push(sample(headings[1], "heading-2"));

  const paras = Array.from(document.querySelectorAll("p")).filter(
    (p) => (p.textContent ?? "").trim().length > 60,
  );
  if (paras[0]) type.push(sample(paras[0], "body"));

  const display = type.find((t) => t.selector === "display");
  const body = type.find((t) => t.selector === "body");
  const displayToBodyRatio =
    display && body && body.fontSize > 0
      ? Math.round((display.fontSize / body.fontSize) * 10) / 10
      : null;

  const bodyCs = getComputedStyle(document.body);
  const bgs = new Set<string>();
  for (const el of all.slice(0, 2000)) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)") bgs.add(bg);
  }

  const header = document.querySelector("header, nav");
  const headerCs = header ? getComputedStyle(header) : null;

  /* ---- deep pass: the site's own declared design system ---------------- */
  const customProperties: Record<string, string> = {};
  const fontFaces: { family: string; src: string }[] = [];
  const blockedSheets: string[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRule[];
    try {
      rules = Array.from(sheet.cssRules);
    } catch {
      // Cross-origin stylesheet: readable only by fetching the file itself.
      if (sheet.href) blockedSheets.push(sheet.href);
      continue;
    }
    const walk = (list: CSSRule[]): void => {
      for (const rule of list) {
        if (rule instanceof CSSFontFaceRule) {
          const fam = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
          const src = rule.style.getPropertyValue("src").slice(0, 160);
          if (fam) fontFaces.push({ family: fam, src });
        } else if (rule instanceof CSSStyleRule) {
          // Token blocks live on :root / html / body, not on components.
          if (/^(:root|html|body)\b/.test(rule.selectorText)) {
            for (const prop of Array.from(rule.style)) {
              if (prop.startsWith("--")) {
                customProperties[prop] = rule.style.getPropertyValue(prop).trim().slice(0, 80);
              }
            }
          }
        } else if ("cssRules" in rule) {
          walk(Array.from((rule as CSSGroupingRule).cssRules));
        }
      }
    };
    walk(rules);
  }

  const sizes = new Set<number>();
  const easings = new Set<string>();
  const durations = new Set<number>();
  const containers = new Set<number>();
  const spacing = new Set<number>();

  for (const el of all.slice(0, 1500)) {
    const cs = getComputedStyle(el);
    if (el.textContent?.trim()) sizes.add(Math.round(px(cs.fontSize)));
    if (cs.transitionTimingFunction && cs.transitionTimingFunction !== "ease") {
      for (const e of cs.transitionTimingFunction.split(/,\s*(?![^(]*\))/)) easings.add(e.trim());
    }
    for (const d of cs.transitionDuration.split(",")) {
      const v = Number.parseFloat(d);
      if (v > 0) durations.add(Math.round(v * 1000) / 1000);
    }
    const mw = px(cs.maxWidth);
    if (mw > 320 && mw < 2600) containers.add(Math.round(mw));
    for (const v of [cs.paddingTop, cs.paddingLeft, cs.marginTop, cs.gap]) {
      const n = Math.round(px(v));
      if (n > 0 && n <= 400) spacing.add(n);
    }
  }

  const sectionSequence = Array.from(
    document.querySelectorAll("body > *, main > *, body > div > *"),
  )
    .filter((el) => (el as HTMLElement).offsetHeight > 200)
    .slice(0, 20)
    .map((el) => {
      const cls = (el.className?.toString() ?? "").split(/\s+/)[0] ?? "";
      // HTML tag names are ASCII; en-US fold, never tr-TR (I -> ı).
      return `${el.tagName.toLocaleLowerCase("en-US")}${cls ? "." + cls.slice(0, 20) : ""}`;
    });

  return {
    title: document.title.slice(0, 80),
    fonts: fonts.slice(0, 6),
    loadedFaces: loadedFaces.slice(0, 10),
    type,
    displayToBodyRatio,
    colours: {
      background: bodyCs.backgroundColor,
      foreground: bodyCs.color,
      distinct: bgs.size,
    },
    structure: {
      sections: document.querySelectorAll("section, main > div > div").length,
      hasFixedHeader: headerCs?.position === "fixed" || headerCs?.position === "sticky",
      headerBlendMode:
        headerCs && headerCs.mixBlendMode !== "normal" ? headerCs.mixBlendMode : null,
      documentHeightRatio:
        Math.round((document.body.scrollHeight / window.innerHeight) * 10) / 10,
    },
    motion: {
      libraries: [
        typeof (window as unknown as Record<string, unknown>).gsap !== "undefined" ? "gsap" : "",
        typeof (window as unknown as Record<string, unknown>).ScrollTrigger !== "undefined"
          ? "ScrollTrigger"
          : "",
        typeof (window as unknown as Record<string, unknown>).Lenis !== "undefined" ? "lenis" : "",
        document.querySelector("[data-lenis], .lenis") ? "lenis-dom" : "",
        typeof (window as unknown as Record<string, unknown>).THREE !== "undefined" ? "three" : "",
      ].filter(Boolean),
      transformedOnScroll: 0,
      smoothScroll:
        getComputedStyle(document.documentElement).scrollBehavior === "smooth" ||
        document.querySelector("[data-lenis], .lenis") !== null,
    },
    deep: {
      customProperties,
      typeScale: [...sizes].filter((s) => s > 8).sort((a, b) => a - b),
      fontFaces: fontFaces.slice(0, 20),
      easings: [...easings].slice(0, 12),
      durations: [...durations].sort((a, b) => a - b).slice(0, 12),
      containers: [...containers].sort((a, b) => a - b).slice(0, 8),
      spacing: [...spacing].sort((a, b) => a - b),
      sectionSequence,
      blockedSheets: blockedSheets.slice(0, 8),
    },
  };
}

async function measureSite(browser: Browser, url: string, outDir: string): Promise<SiteMeasurement> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  // tsx/esbuild (--keep-names) injects __name() into serialised evaluate fns.
  await page.addInitScript("globalThis.__name = globalThis.__name ?? ((fn) => fn);");

  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
    if (!res || res.status() >= 400) {
      return { url, ok: false, error: `HTTP ${res?.status() ?? "no response"}` };
    }
    await page.waitForTimeout(SETTLE_MS);

    const before = await transformFingerprint(page);
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.5));
    await page.waitForTimeout(1200);
    const after = await transformFingerprint(page);
    const transformedOnScroll = countChanged(before, after);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const m = (await page.evaluate(measureInPage)) as Omit<
      SiteMeasurement,
      "url" | "ok" | "screenshot"
    >;
    if (m.motion) m.motion.transformedOnScroll = transformedOnScroll;

    // Cross-origin stylesheets are invisible to CSSOM, and on these sites that
    // is usually where the whole token block lives (a CDN-hosted bundle).
    // Fetch the file and read it as text instead of giving up on it.
    if (m.deep?.blockedSheets.length) {
      for (const href of m.deep.blockedSheets) {
        try {
          const res = await page.request.get(href, { timeout: 10_000 });
          if (!res.ok()) continue;
          const css = (await res.text()).slice(0, 400_000);
          for (const match of css.matchAll(
            /(--[a-z0-9-]+)\s*:\s*([^;}]{1,80})/gi,
          )) {
            const key = match[1]!;
            if (!(key in m.deep.customProperties)) {
              m.deep.customProperties[key] = match[2]!.trim();
            }
          }
          for (const face of css.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
            const body = face[1] ?? "";
            const fam = /font-family\s*:\s*["']?([^;"']+)/i.exec(body)?.[1]?.trim();
            const src = /src\s*:\s*([^;]+)/i.exec(body)?.[1]?.trim().slice(0, 160);
            if (fam && m.deep.fontFaces.length < 30) {
              m.deep.fontFaces.push({ family: fam, src: src ?? "" });
            }
          }
        } catch {
          /* a sheet we cannot read is not a reason to lose the site */
        }
      }
    }

    const behaviour = await profileMotion(page).catch(() => undefined);
    const scripts = await mineScripts(page).catch(() => undefined);
    const movingDesktop =
      (behaviour?.pinned ?? 0) + (behaviour?.parallax ?? 0) + (behaviour?.horizontal ?? 0);
    const extra = await profileExtra(browser, page, url, movingDesktop).catch(() => undefined);

    const slug = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
    const shot = join(outDir, "shots", `${slug}.jpg`);
    await page.screenshot({ path: shot, type: "jpeg", quality: 70 });

    return {
      url,
      ok: true,
      ...m,
      ...(behaviour !== undefined ? { behaviour } : {}),
      ...(scripts !== undefined ? { scripts } : {}),
      ...(extra !== undefined ? { extra } : {}),
      screenshot: `shots/${slug}.jpg`,
    };
  } catch (err) {
    return { url, ok: false, error: err instanceof Error ? err.message.slice(0, 120) : String(err) };
  } finally {
    await context.close();
  }
}

/** One sample of what every tracked element looks like right now. */
interface Frame {
  scrollY: number;
  items: { top: number; tx: number; ty: number; scale: number; opacity: number; clip: string }[];
}

/**
 * Sample the page at several scroll depths and classify what moves.
 *
 * A stylesheet cannot answer "does this site pin a section" or "is that
 * parallax" — those are relationships between scroll position and element
 * position, only visible by scrolling and looking. This is the measurement
 * the corpus was missing.
 */
async function profileMotion(
  page: import("playwright").Page,
): Promise<NonNullable<SiteMeasurement["behaviour"]>> {
  const sample = async (): Promise<Frame> =>
    page.evaluate(() => {
      const parse = (t: string): { tx: number; ty: number; scale: number } => {
        if (!t || t === "none") return { tx: 0, ty: 0, scale: 1 };
        const m = /matrix\(([^)]+)\)/.exec(t) ?? /matrix3d\(([^)]+)\)/.exec(t);
        if (!m) return { tx: 0, ty: 0, scale: 1 };
        const n = m[1]!.split(",").map(Number);
        return n.length === 6
          ? { tx: n[4]!, ty: n[5]!, scale: n[0]! }
          : { tx: n[12]!, ty: n[13]!, scale: n[0]! };
      };
      const els = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((el) => el.offsetHeight > 40)
        .slice(0, 120);
      return {
        scrollY: window.scrollY,
        items: els.map((el) => {
          const cs = getComputedStyle(el);
          const { tx, ty, scale } = parse(cs.transform);
          return {
            top: Math.round(el.getBoundingClientRect().top),
            tx: Math.round(tx),
            ty: Math.round(ty),
            scale: Math.round(scale * 100) / 100,
            opacity: Math.round(Number.parseFloat(cs.opacity) * 100) / 100,
            clip: cs.clipPath === "none" ? "" : cs.clipPath.slice(0, 30),
          };
        }),
      };
    });

  const frames: Frame[] = [];
  for (const depth of [0, 0.3, 0.6, 0.9]) {
    await page.evaluate((d) => {
      window.scrollTo({ top: document.body.scrollHeight * d, behavior: "auto" });
    }, depth);
    await page.waitForTimeout(900);
    frames.push(await sample());
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  const kinds: Record<string, number> = {};
  let pinned = 0;
  let parallax = 0;
  let horizontal = 0;
  const bump = (k: string): void => {
    kinds[k] = (kinds[k] ?? 0) + 1;
  };

  const n = Math.min(...frames.map((f) => f.items.length));
  for (let i = 0; i < n; i += 1) {
    const s = frames.map((f) => f.items[i]!);
    const scrolls = frames.map((f) => f.scrollY);

    // Pinned: viewport position barely moves while the page scrolls a lot.
    const topSpread = Math.max(...s.map((x) => x.top)) - Math.min(...s.map((x) => x.top));
    const scrollSpread = Math.max(...scrolls) - Math.min(...scrolls);
    if (scrollSpread > 800 && topSpread < 120) {
      pinned += 1;
      bump("pin");
    }
    // Parallax: the element's own transform tracks scroll instead of sitting still.
    const tySpread = Math.max(...s.map((x) => x.ty)) - Math.min(...s.map((x) => x.ty));
    if (tySpread > 40) {
      parallax += 1;
      bump("parallax");
    }
    const txSpread = Math.max(...s.map((x) => x.tx)) - Math.min(...s.map((x) => x.tx));
    if (txSpread > 40) {
      horizontal += 1;
      bump("horizontal");
    }
    if (Math.max(...s.map((x) => x.opacity)) - Math.min(...s.map((x) => x.opacity)) > 0.25) {
      bump("reveal");
    }
    if (Math.max(...s.map((x) => x.scale)) - Math.min(...s.map((x) => x.scale)) > 0.06) {
      bump("scale");
    }
    if (new Set(s.map((x) => x.clip)).size > 1) bump("clip");
  }

  const rest = await page.evaluate(() => {
    // Headings broken up for animation: many single-word or single-char spans.
    const heads = Array.from(document.querySelectorAll("h1, h2")).slice(0, 6);
    let word = 0;
    let char = 0;
    for (const h of heads) {
      const spans = Array.from(h.querySelectorAll("span")).filter(
        (s) => s.children.length === 0,
      );
      if (spans.length < 3) continue;
      const texts = spans.map((s) => (s.textContent ?? "").trim()).filter(Boolean);
      if (texts.length >= 3 && texts.every((t) => t.length <= 2)) char += 1;
      else if (texts.length >= 3) word += 1;
    }

    const grids = new Set<string>();
    const axes = new Set<string>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *")).slice(0, 900)) {
      const cs = getComputedStyle(el);
      if (cs.display.includes("grid")) {
        const cols = cs.gridTemplateColumns;
        if (cols && cols !== "none" && cols.length < 90) grids.add(cols);
      }
      if (cs.fontVariationSettings && cs.fontVariationSettings !== "normal") {
        axes.add(cs.fontVariationSettings.slice(0, 50));
      }
    }
    return {
      textSplit: (char > 0 ? "char" : word > 0 ? "word" : "none") as "none" | "word" | "char",
      grids: [...grids].slice(0, 10),
      variableAxes: [...axes].slice(0, 6),
    };
  });

  return { motionKinds: kinds, pinned, parallax, horizontal, ...rest };
}

/** sRGB relative luminance, for the contrast ratio. */
function luminance(rgb: string): number | null {
  const m = /rgba?\(([^)]+)\)/.exec(rgb);
  if (!m) return null;
  const [r, g, b] = m[1]!.split(",").map((v) => Number.parseFloat(v) / 255);
  if (r === undefined || g === undefined || b === undefined) return null;
  const f = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Everything one desktop pass at one moment cannot see: the load animation,
 * hover, phone width, and whether the site honours a reduced-motion request.
 * Each needs either time or a different context, which is why it is separate.
 */
async function profileExtra(
  browser: Browser,
  page: import("playwright").Page,
  url: string,
  desktopMoving: number,
): Promise<NonNullable<SiteMeasurement["extra"]>> {
  // --- on-load entrance: what settles between 200ms and 2.5s
  const snap = async (): Promise<string[]> =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((el) => el.offsetHeight > 30)
        .slice(0, 100)
        .map((el) => {
          const cs = getComputedStyle(el);
          return `${cs.opacity}|${cs.transform}`;
        }),
    );
  const early = await snap();
  await page.waitForTimeout(2300);
  const late = await snap();
  let entranceAnimated = 0;
  for (let i = 0; i < Math.min(early.length, late.length); i += 1) {
    if (early[i] !== late[i]) entranceAnimated += 1;
  }

  // --- hover the most prominent call to action
  const hoverDelta = await page
    .evaluate(() => {
      const cta = Array.from(document.querySelectorAll<HTMLElement>("a, button")).find(
        (el) => el.offsetHeight >= 32 && (el.textContent ?? "").trim().length > 2,
      );
      if (!cta) return null;
      cta.setAttribute("data-corpus-cta", "1");
      const cs = getComputedStyle(cta);
      return [cs.backgroundColor, cs.color, cs.transform, cs.opacity, cs.borderColor].join("|");
    })
    .then(async (before) => {
      if (!before) return [];
      await page.hover("[data-corpus-cta]", { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => {
        const cta = document.querySelector<HTMLElement>("[data-corpus-cta]");
        if (!cta) return null;
        const cs = getComputedStyle(cta);
        return [cs.backgroundColor, cs.color, cs.transform, cs.opacity, cs.borderColor].join("|");
      });
      if (!after) return [];
      const names = ["background", "colour", "transform", "opacity", "border"];
      return before
        .split("|")
        .map((v, i) => (v !== after.split("|")[i] ? names[i]! : ""))
        .filter(Boolean);
    })
    .catch(() => [] as string[]);

  // --- palette, media, cursor, section skeletons
  const rest = await page.evaluate(() => {
    const counts = new Map<string, number>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *")).slice(0, 1500)) {
      const cs = getComputedStyle(el);
      for (const c of [cs.color, cs.backgroundColor]) {
        if (c && c !== "rgba(0, 0, 0, 0)") counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    const canvases = Array.from(document.querySelectorAll("canvas"));
    const webgl = canvases.some((c) => {
      try {
        return !!(c as HTMLCanvasElement).getContext("webgl2") ||
          !!(c as HTMLCanvasElement).getContext("webgl");
      } catch {
        return false;
      }
    });
    const bodyCs = getComputedStyle(document.body);

    const skeletons = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((el) => el.offsetHeight > window.innerHeight * 0.6 && el.children.length > 0)
      .slice(0, 5)
      .map((el) => {
        const kids = Array.from(el.children)
          .slice(0, 6)
          .map((k) => k.tagName.toLocaleLowerCase("en-US"))
          .join(">");
        return `${el.tagName.toLocaleLowerCase("en-US")}[${kids}]`;
      });

    return {
      palette: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([colour, count]) => ({ colour, count })),
      bg: bodyCs.backgroundColor,
      fg: bodyCs.color,
      media: { canvas: canvases.length, webgl, video: document.querySelectorAll("video").length },
      customCursor:
        bodyCs.cursor === "none" ||
        document.querySelector("[class*='cursor'][class*='follow'], .custom-cursor") !== null,
      sectionSkeletons: skeletons,
    };
  });

  const lb = luminance(rest.bg);
  const lf = luminance(rest.fg);
  const bodyContrast =
    lb !== null && lf !== null
      ? Math.round(((Math.max(lb, lf) + 0.05) / (Math.min(lb, lf) + 0.05)) * 100) / 100
      : null;

  // --- phone width: the other end of every clamp()
  const mobileType = await (async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    try {
      const p = await ctx.newPage();
      await p.addInitScript("globalThis.__name = globalThis.__name ?? ((fn) => fn);");
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
      await p.waitForTimeout(1800);
      return await p.evaluate(() => {
        const n = (v: string): number => Number.parseFloat(v) || 0;
        const heads = Array.from(document.querySelectorAll("h1, h2")).sort(
          (a, b) => n(getComputedStyle(b).fontSize) - n(getComputedStyle(a).fontSize),
        );
        const para = Array.from(document.querySelectorAll("p")).find(
          (x) => (x.textContent ?? "").trim().length > 60,
        );
        return {
          display: heads[0] ? Math.round(n(getComputedStyle(heads[0]).fontSize)) : null,
          body: para ? Math.round(n(getComputedStyle(para).fontSize)) : null,
        };
      });
    } catch {
      return null;
    } finally {
      await ctx.close();
    }
  })();

  // --- does it honour prefers-reduced-motion?
  const reducedMotion = await (async () => {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    try {
      const p = await ctx.newPage();
      await p.addInitScript("globalThis.__name = globalThis.__name ?? ((fn) => fn);");
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
      await p.waitForTimeout(1800);
      const read = async (): Promise<string[]> =>
        p.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLElement>("body *"))
            .filter((el) => el.offsetHeight > 40)
            .slice(0, 100)
            .map((el) => getComputedStyle(el).transform),
        );
      const a = await read();
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
      await p.waitForTimeout(900);
      const b = await read();
      let movingElements = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        if (a[i] !== b[i]) movingElements += 1;
      }
      // Honoured if the preference meaningfully quiets the page.
      return { honoured: movingElements < Math.max(2, desktopMoving * 0.4), movingElements };
    } catch {
      return null;
    } finally {
      await ctx.close();
    }
  })();

  return {
    entranceAnimated,
    hoverDelta,
    customCursor: rest.customCursor,
    media: rest.media,
    palette: rest.palette,
    bodyContrast,
    mobileType,
    reducedMotion,
    sectionSkeletons: rest.sectionSkeletons,
  };
}

/**
 * Mine the site's own JS for animation configuration. The bundles are minified
 * but option keys and tweened property names survive minification, so the
 * grammar of the motion is still readable even when the code is not.
 */
async function mineScripts(
  page: import("playwright").Page,
): Promise<NonNullable<SiteMeasurement["scripts"]>> {
  const srcs = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"))
      .map((s) => s.src)
      .filter((s) => s.startsWith("http"))
      .slice(0, 12),
  );

  const gsapOptions = new Set<string>();
  const animatedProps = new Set<string>();
  let lenisConfig: string | null = null;
  let bytes = 0;

  for (const src of srcs) {
    try {
      const res = await page.request.get(src, { timeout: 12_000 });
      if (!res.ok()) continue;
      const js = (await res.text()).slice(0, 1_200_000);
      bytes += js.length;

      // Only literal values. Minification rewrites identifiers, so
      // `start: e` or `duration: r` carries no information — keeping them
      // filled the corpus with noise that reads like data.
      for (const m of js.matchAll(
        /\b(scrub|pin|pinSpacing|start|end|stagger|ease|duration|snap|anticipatePin)\s*:\s*("[^"]{1,30}"|'[^']{1,30}'|true|false|\d+(?:\.\d+)?)/g,
      )) {
        gsapOptions.add(`${m[1]}: ${m[2]!.replace(/['"]/g, "")}`);
      }
      for (const m of js.matchAll(
        /\b(yPercent|xPercent|clipPath|scaleX|scaleY|rotateX|rotateY|skewY|autoAlpha|opacity|scale|filter|backgroundColor)\s*:/g,
      )) {
        animatedProps.add(m[1]!);
      }
      const lenis = /new\s+Lenis\s*\(\s*(\{[^}]{0,160}\})/.exec(js);
      if (lenis && !lenisConfig) lenisConfig = lenis[1]!.replace(/\s+/g, " ").slice(0, 160);
    } catch {
      /* a bundle we cannot fetch is not a reason to lose the site */
    }
  }

  return {
    bytes,
    gsapOptions: [...gsapOptions].slice(0, 30),
    animatedProps: [...animatedProps].slice(0, 20),
    lenisConfig,
  };
}

/** Transform of the first 60 elements, to see what scroll actually moves. */
async function transformFingerprint(page: import("playwright").Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .slice(0, 60)
      .map((el) => getComputedStyle(el).transform),
  );
}

function countChanged(a: string[], b: string[]): number {
  let n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) if (a[i] !== b[i]) n += 1;
  return n;
}

async function main(): Promise<void> {
  const sitesFile = process.argv[2] ?? "data/corpus/sites.txt";
  const outDir = process.argv[3] ?? "data/corpus";
  const limit = Number.parseInt(process.argv[4] ?? "999", 10);

  const urls = readFileSync(sitesFile, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .slice(0, limit);

  mkdirSync(join(outDir, "shots"), { recursive: true });
  const browser = await chromium.launch();
  const results: SiteMeasurement[] = [];

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < urls.length) {
      const i = cursor;
      cursor += 1;
      const url = urls[i]!;
      const r = await measureSite(browser, url, outDir);
      results[i] = r;
      const label = r.ok
        ? `${r.fonts?.[0] ?? "?"} · ratio ${r.displayToBodyRatio ?? "?"} · ${r.motion?.libraries.join("+") || "no-lib"}`
        : `FAILED ${r.error}`;
      console.log(`[${i + 1}/${urls.length}] ${url} — ${label}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();

  writeFileSync(
    join(outDir, "measurements.json"),
    JSON.stringify(results.filter(Boolean), null, 2) + "\n",
  );
  const ok = results.filter((r) => r?.ok).length;
  console.log(`\nmeasured ${ok}/${urls.length} sites → ${join(outDir, "measurements.json")}`);
}

await main();
