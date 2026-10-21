/**
 * Component vocabulary pass.
 *
 * The main harvest measured how award sites *look* and *move* but not what
 * kinds of block they are built from — `div[div]` says nothing. Authors name
 * their components in class names and data attributes, though, so counting
 * those tokens across the corpus gives the taxonomy the first pass missed:
 * which block types are common, and which we have no equivalent for.
 *
 * Usage: tsx src/corpus/vocabulary.ts [sitesFile] [outFile]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const CONCURRENCY = 5;

/**
 * Tokens that name a *kind of block*, not a utility. Tailwind-style utility
 * classes are excluded by the stop-list below, or the counts would be nothing
 * but `flex` and `px-4`.
 */
const COMPONENT_TOKENS = [
  "marquee", "ticker", "accordion", "carousel", "slider", "swiper", "rail",
  "gallery", "grid", "masonry", "slideshow", "lightbox", "modal", "drawer",
  "tabs", "stepper", "timeline", "testimonial", "quote", "faq", "pricing",
  "hero", "banner", "curtain", "reveal", "parallax", "sticky", "pin",
  "marquee-item", "card", "tile", "panel", "split", "showcase", "feature",
  "stat", "counter", "number", "logo-wall", "logos", "clients", "partners",
  "cta", "newsletter", "footer", "nav", "menu", "burger", "cursor", "noise",
  "grain", "scramble", "typewriter", "spotlight", "magnetic", "drag",
  "horizontal", "video", "canvas", "shader", "marquee-track", "ribbon",
  "accordion-item", "process", "manifesto", "intro", "outro", "closing",
] as const;

const STOP = new Set([
  "flex", "grid-cols", "container", "wrapper", "inner", "content", "wrap",
  "row", "col", "item", "list", "block", "text", "title", "heading",
]);

async function main(): Promise<void> {
  const sitesFile = process.argv[2] ?? "data/corpus/sites.txt";
  const outFile = process.argv[3] ?? "data/corpus/vocabulary.json";
  const urls = readFileSync(sitesFile, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const browser = await chromium.launch();
  const perSite: { url: string; tokens: string[] }[] = [];
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < urls.length) {
      const url = urls[cursor++]!;
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      try {
        const page = await ctx.newPage();
        await page.addInitScript("globalThis.__name = globalThis.__name ?? ((fn) => fn);");
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
        await page.waitForTimeout(2000);
        const tokens = await page.evaluate((known: readonly string[]) => {
          const found = new Set<string>();
          for (const el of Array.from(document.querySelectorAll("*")).slice(0, 4000)) {
            const bag = [
              el.className?.toString() ?? "",
              ...Array.from(el.attributes)
                .filter((a) => a.name.startsWith("data-"))
                .map((a) => `${a.name} ${a.value}`),
            ]
              .join(" ")
              // class names are ASCII; tr-TR would fold I to ı and miss matches
              .toLocaleLowerCase("en-US");
            for (const k of known) if (bag.includes(k)) found.add(k);
          }
          return [...found];
        }, COMPONENT_TOKENS);
        perSite.push({ url, tokens: tokens.filter((t) => !STOP.has(t)) });
        console.log(`${perSite.length}/${urls.length} ${url} — ${tokens.length} tokens`);
      } catch {
        perSite.push({ url, tokens: [] });
      } finally {
        await ctx.close();
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();

  const counts = new Map<string, number>();
  for (const s of perSite) for (const t of s.tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  writeFileSync(
    outFile,
    JSON.stringify({ sites: perSite.length, ranked, perSite }, null, 2) + "\n",
  );
  console.log(`\nTOP COMPONENT TOKENS across ${perSite.length} sites`);
  for (const [t, n] of ranked.slice(0, 30)) console.log(`  ${String(n).padStart(3)}  ${t}`);
}

await main();
