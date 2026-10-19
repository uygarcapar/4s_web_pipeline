import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { PixelSource } from "./palette.js";
import { foldForMatch } from "./fold.js";

/** One entry of the crawl's asset manifest, as far as this module cares. */
interface ManifestEntry {
  file: string;
  source_url?: string;
  content_type?: string;
  width?: number;
  height?: number;
}

/**
 * Which photographs speak for the business.
 *
 * Their old site almost certainly mixes two kinds of picture: stock they
 * licensed (a model smiling on a lilac backdrop) and photographs of their
 * actual premises and staff. Only the second kind should decide the palette —
 * on the reference build the dark ground came from the clinic's own treatment
 * room, and letting a stock photo's lilac win would have produced a page that
 * looks like nobody's.
 *
 * There is no flag in the manifest for this, so it is inferred. Stock
 * libraries leave fingerprints in the filename, and their images tend to be
 * perfectly standard sizes; the business's own photos are oddly sized,
 * frequently huge, and served from the site's own media path.
 */
const STOCK_HINTS = [
  "nsplsh", // Wix's Unsplash integration
  "unsplash",
  "shutterstock",
  "istock",
  "getty",
  "pexels",
  "freepik",
  "depositphotos",
  "adobestock",
];

export function looksLikeStock(entry: ManifestEntry): boolean {
  const haystack = foldForMatch(`${entry.file} ${entry.source_url ?? ""}`);
  return STOCK_HINTS.some((hint) => haystack.includes(hint));
}

/**
 * Weight per photograph. The business's own pictures count for more, and
 * bigger images count for a little more than thumbnails of the same thing —
 * a 5000px original is the real asset, a 150px crop is a listing thumbnail.
 */
export function weightFor(entry: ManifestEntry): number {
  const area = (entry.width ?? 0) * (entry.height ?? 0);
  if (area < 120_000) return 0; // thumbnails and icons decide nothing
  const size = area > 2_000_000 ? 1.5 : 1;
  // Stock is not discarded outright: a clinic whose only images are stock
  // still needs a palette. It is simply outvoted whenever real photographs
  // exist.
  return (looksLikeStock(entry) ? 0.25 : 1) * size;
}

/**
 * Decode each usable photograph down to a small thumbnail and return its raw
 * pixels. Downscaling is not an optimisation here — it is the point. At
 * 64×64 the per-pixel noise of JPEG compression is averaged away and what
 * survives is the picture's actual colour distribution.
 */
export async function samplePhotographs(input: {
  runDir: string;
  manifest: ManifestEntry[];
  /** Cap on how many images to decode; the largest are taken first. */
  limit?: number;
}): Promise<PixelSource[]> {
  const assetsDir = join(input.runDir, "crawl", "assets");
  const candidates = input.manifest
    .map((entry) => ({ entry, weight: weightFor(entry) }))
    .filter((c) => c.weight > 0)
    .sort(
      (a, b) =>
        (b.entry.width ?? 0) * (b.entry.height ?? 0) -
        (a.entry.width ?? 0) * (a.entry.height ?? 0),
    )
    .slice(0, input.limit ?? 24);

  const sources: PixelSource[] = [];
  for (const { entry, weight } of candidates) {
    try {
      const buf = readFileSync(join(assetsDir, entry.file));
      const { data } = await sharp(buf)
        .resize(64, 64, { fit: "inside" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      sources.push({ rgb: new Uint8Array(data), weight });
    } catch {
      // A single unreadable asset must not stop the stage; the palette is a
      // vote and one missing voter does not change it.
      continue;
    }
  }
  return sources;
}

export function readManifest(runDir: string): ManifestEntry[] {
  try {
    const raw = readFileSync(join(runDir, "crawl", "asset-manifest.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ManifestEntry[];
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { assets?: unknown }).assets)) {
      return (parsed as { assets: ManifestEntry[] }).assets;
    }
    return [];
  } catch {
    return [];
  }
}
