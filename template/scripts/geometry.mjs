/**
 * Geometry checks — the part of design quality that a script can decide more
 * cheaply and more reliably than a model (design-rules.md §12).
 *
 * Three checks, each one of them something that shipped broken at least once
 * on the hand-built reference site before being caught by eye:
 *
 *   responsive  — horizontal overflow and tap targets under 44px
 *   overlap     — text sitting on top of other text
 *   reload      — a refresh landing somewhere other than the top, and anchors
 *                 that miss their target because pin spacers moved it
 *
 * A check that produces false positives is worse than no check: it trains the
 * fix loop to ignore it. Two hard-won exclusions encode that — see
 * `collectLeaves`.
 */

/** Width matrix. Narrow enough for a folding phone, wide enough for a studio display. */
export const WIDTHS = [
  { name: "fold", w: 344, h: 882, mobile: true },
  { name: "iphone-se", w: 375, h: 667, mobile: true },
  { name: "iphone", w: 390, h: 844, mobile: true },
  { name: "iphone-max", w: 430, h: 932, mobile: true },
  { name: "phone-landscape", w: 844, h: 390, mobile: true },
  { name: "ipad", w: 768, h: 1024, mobile: true },
  { name: "ipad-air", w: 820, h: 1180, mobile: true },
  { name: "breakpoint", w: 1024, h: 800, mobile: false },
  { name: "laptop", w: 1280, h: 800, mobile: false },
  { name: "laptop-hidpi", w: 1512, h: 900, mobile: false },
  { name: "desktop", w: 1920, h: 1080, mobile: false },
  { name: "wide", w: 2560, h: 1440, mobile: false },
];

/** Minimum interactive target, both axes (design-rules.md §7). */
const MIN_TAP = 44;

/**
 * Elements whose stacking is the design, not a defect: a pinned caption that
 * fades in over a leaving headline, labels that swap in place, the duplicated
 * halves of a seamless marquee.
 */
const DELIBERATE_STACKS = [
  "[data-stacked]",
  ".hero-caption",
  ".team-label",
  ".marquee-track",
  ".footer-mark",
  ".char",
];

/**
 * Elements wider than the viewport are normal and intended: a horizontal
 * treatment rail, a marquee track, a full-bleed wordmark. What is actually a
 * defect is the *document* overflowing, because only that gives the visitor a
 * sideways scrollbar. So child bleed is collected as diagnostics and only
 * reported when `hOverflow` is true — otherwise the deliberate lateral move
 * that the design rules require would fail its own gate.
 */
const ALLOWED_BLEED = "[data-bleed], .marquee-track, .footer-mark, .char, [data-rail]";

/**
 * Runs inside the page. Returns every painted leaf text box in document
 * coordinates, plus the two kinds of defect we can decide from geometry.
 */
function collectLeaves([deliberate, allowedBleed, minTap]) {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const leaves = [];
  const bleeders = [];

  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();

    if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && !el.closest(allowedBleed)) {
      bleeders.push(
        `${el.localName} "${(el.textContent || "").trim().slice(0, 24)}"`,
      );
    }

    // Text directly inside this element, ignoring text that belongs to its
    // children. Measuring elements alone misses the commonest overlap of
    // all: a bare text node in a container that also has element children —
    // a heading beside its own "+" icon, a label beside its value. Those
    // text nodes belong to no element, so an element-only sweep is blind to
    // them.
    let text = "";
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
    }
    text = text.trim();
    if (!text) continue;
    if (deliberate.some((sel) => el.closest(sel))) continue;

    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.opacity === "0") continue;

    // A closed <details> still reports a non-zero box for its hidden content
    // in Chromium, so geometry alone says it is on the page.
    // checkVisibility is what actually knows it is not being painted.
    if (
      el.checkVisibility &&
      !el.checkVisibility({
        contentVisibilityAuto: true,
        opacityProperty: true,
        visibilityProperty: true,
      })
    ) {
      continue;
    }

    // A fixed element's document coordinates are meaningless — it travels
    // with the viewport, so adding scrollY puts it wherever the page happens
    // to be scrolled. Comparing it against flow content invents overlaps.
    let fixed = false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (getComputedStyle(n).position === "fixed") {
        fixed = true;
        break;
      }
    }
    if (fixed) continue;

    // Measure the text itself, not its container: a Range over the element's
    // own text nodes gives the box the reader actually sees, which is what
    // decides whether two pieces of text collide.
    const range = document.createRange();
    let box = null;
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      if (!(node.textContent ?? "").trim()) continue;
      range.selectNodeContents(node);
      const tr = range.getBoundingClientRect();
      if (tr.width < 1 || tr.height < 1) continue;
      box = box
        ? {
            left: Math.min(box.left, tr.left),
            top: Math.min(box.top, tr.top),
            right: Math.max(box.right, tr.right),
            bottom: Math.max(box.bottom, tr.bottom),
          }
        : { left: tr.left, top: tr.top, right: tr.right, bottom: tr.bottom };
    }
    if (!box) continue;

    const w = box.right - box.left;
    const h = box.bottom - box.top;
    if (w < 2 || h < 2) continue;
    leaves.push({
      text: text.slice(0, 26),
      x: box.left + window.scrollX,
      y: box.top + window.scrollY,
      w,
      h,
      el,
    });
  }

  const overlaps = [];
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i];
      const b = leaves[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox <= 4 || oy <= 4) continue;

      // Consecutive lines of one heading overlap by design: display leading
      // is tighter than the glyphs are tall, and the line masks carry
      // descender padding on purpose (design-rules.md §6). That shows up as a
      // shallow vertical overlap between boxes that are otherwise stacked.
      // A real collision covers a substantial part of the shorter box.
      const vShare = oy / Math.min(a.h, b.h);
      if (vShare < 0.35) continue;

      // And it has to be a real horizontal coincidence too, so two labels
      // sharing one baseline in a flex row do not count.
      const hShare = ox / Math.min(a.w, b.w);
      const share = (ox * oy) / Math.min(a.w * a.h, b.w * b.h);
      if (share > 0.12 && hShare > 0.1) {
        overlaps.push(`"${a.text}" over "${b.text}"`);
      }
    }
  }

  const smallTargets = [];
  for (const el of document.querySelectorAll("a, button, summary, [role='button']")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.height < minTap || r.width < minTap) {
      smallTargets.push(
        `"${(el.textContent || "").trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)}`,
      );
    }
  }

  return {
    hOverflow: de.scrollWidth > vw,
    bleeders: [...new Set(bleeders)].slice(0, 6),
    overlaps: [...new Set(overlaps)].slice(0, 6),
    smallTargets: [...new Set(smallTargets)].slice(0, 6),
  };
}

/** Walk the page so every ScrollTrigger fires and every pin is measured. */
async function settle(page, viewportHeight) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += Math.round(viewportHeight * 0.6)) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

export async function checkGeometry({ chromium, url }) {
  const problems = [];
  const browser = await chromium.launch();

  try {
    for (const size of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width: size.w, height: size.h },
        isMobile: size.mobile,
        hasTouch: size.mobile,
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 160)));

      await page.goto(url, { waitUntil: "networkidle" });
      await settle(page, size.h);

      const res = await page.evaluate(collectLeaves, [
        DELIBERATE_STACKS,
        ALLOWED_BLEED,
        MIN_TAP,
      ]);

      const label = `${size.name} ${size.w}×${size.h}`;
      if (res.hOverflow) {
        problems.push(`${label}: horizontal overflow`);
        // Only now are the individual bleeders worth naming — they are the
        // diagnosis for the overflow, not defects in their own right.
        for (const b of res.bleeders) problems.push(`${label}:   culprit — ${b}`);
      }
      for (const o of res.overlaps) problems.push(`${label}: text overlap — ${o}`);
      for (const t of res.smallTargets) problems.push(`${label}: tap target under ${MIN_TAP}px — ${t}`);
      for (const e of pageErrors) problems.push(`${label}: page error — ${e}`);

      await ctx.close();
    }

    // Reload stability: a refresh must land at the top, whatever the page
    // height turns out to be once the pins are measured.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (const depth of [400, Math.round(height * 0.4), Math.round(height * 0.8)]) {
      await page.evaluate((y) => window.scrollTo(0, y), depth);
      await page.waitForTimeout(500);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(2200);
      const landed = await page.evaluate(() => Math.round(window.scrollY));
      if (landed > 4) {
        problems.push(
          `reload from ${depth}px landed at ${landed}px instead of the top — scroll restoration is not owned`,
        );
      }
    }

    // Anchors: every in-page target must clear the fixed bar.
    const anchors = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="#"]')]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && h.length > 1)
        .slice(0, 8),
    );
    for (const hash of [...new Set(anchors)]) {
      await page.goto(url + hash, { waitUntil: "networkidle" });
      await page.waitForTimeout(2200);
      const result = await page.evaluate((h) => {
        const el = document.getElementById(decodeURIComponent(h.slice(1)));
        if (!el) return null;
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight;
        return {
          offset: Math.round(el.getBoundingClientRect().top - margin),
          // A target at the very top cannot be scrolled any higher, and one
          // at the very bottom any lower — in both cases the browser is
          // already as close as it can get and the miss is not a defect.
          pinnedToTop: window.scrollY <= 1,
          pinnedToBottom: window.scrollY >= maxScroll - 1,
        };
      }, hash);
      const offset = result?.offset ?? null;
      const atLimit = Boolean(result?.pinnedToTop || result?.pinnedToBottom);
      if (offset !== null && !atLimit && Math.abs(offset) > 24) {
        problems.push(
          `anchor ${hash} landed ${offset}px from its scroll-margin — a pinned section moved the target after the jump`,
        );
      }
    }
    await ctx.close();
  } finally {
    await browser.close();
  }

  return problems;
}
