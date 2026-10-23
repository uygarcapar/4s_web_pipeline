/**
 * What a failing Lighthouse assertion does not say.
 *
 * An assertion failure reaches the digest as one line:
 *
 *     largest-contentful-paint — expected <= 3500, actual 3952 (http://…)
 *
 * That line does not say which element the LCP is, nor which phase consumed
 * the time, nor where the page's bytes actually went. The digest is the only
 * thing the fix loop can see, and on the first real client it read "LCP too
 * slow" next to "image-delivery-insight 0.5" and spent two iterations
 * compressing images — while the LCP was a text element with 89% of its time
 * in render delay, and fonts were 232 KB against images' 67 KB.
 *
 * That conclusion was not unreasonable from the digest; images were the only
 * lead it offered. So the digest carries the rest now: the LCP element, the
 * phase split, and per-type resource weight, which together distinguish an
 * image problem from a font, script or markup one.
 *
 * Pure on purpose — it takes a parsed Lighthouse result and returns lines, so
 * it can be tested against a fixture without running Lighthouse. Every field
 * is treated as optional: the LHR shape moves between Lighthouse majors, and
 * a diagnostic block that throws would take the whole digest with it.
 */

/** Resource types worth reporting; the rest are noise at digest size. */
const REPORTED_RESOURCE_TYPES = ["total", "font", "script", "image", "stylesheet"];

const asArray = (value) => (Array.isArray(value) ? value : []);

/**
 * Diagnostic lines for a failing performance gate.
 *
 * @param {unknown} lhr Parsed Lighthouse result, or null when none was found.
 * @returns {string[]} Lines for the digest, each already prefixed "context:".
 */
export function lhciDiagnostics(lhr) {
  const audits = lhr && typeof lhr === "object" ? lhr.audits : null;
  if (!audits || typeof audits !== "object") return [];
  const out = [];

  const settings = (lhr.configSettings ?? {});
  if (settings.throttlingMethod) {
    out.push(
      `context: throttling=${settings.throttlingMethod}` +
        ` formFactor=${settings.formFactor ?? "?"} — a simulated LCP is modelled` +
        " from the network graph, so it is reproducible and not machine noise",
    );
  }

  // One audit, two tables in its details: the element, then the phase split.
  for (const table of asArray(audits["largest-contentful-paint-element"]?.details?.items)) {
    for (const row of asArray(table?.items)) {
      if (row?.node?.snippet) {
        out.push(`context: LCP element — ${String(row.node.snippet).slice(0, 140)}`);
      }
      if (row?.phase) {
        out.push(
          `context: LCP phase ${row.phase} = ${Math.round(row.timing ?? 0)}ms` +
            (row.percent ? ` (${row.percent})` : ""),
        );
      }
    }
  }

  // Where the bytes went. A resource class over its own budget is otherwise
  // invisible: the font budget is a warn, and warns are easy to skip past.
  for (const row of asArray(audits["resource-summary"]?.details?.items)) {
    if (!REPORTED_RESOURCE_TYPES.includes(row?.resourceType)) continue;
    out.push(
      `context: ${row.resourceType} — ${row.requestCount ?? "?"} request(s), ` +
        `${Math.round((row.transferSize ?? 0) / 1024)} KB`,
    );
  }

  for (const row of asArray(audits["render-blocking-resources"]?.details?.items).slice(0, 3)) {
    out.push(
      `context: render-blocking — ${String(row?.url ?? "").slice(-70)} ` +
        `(${Math.round(row?.wastedMs ?? 0)}ms)`,
    );
  }

  out.push(...imageLines(audits));

  return out;
}

/** Image audits whose details name the specific file at fault. */
const IMAGE_AUDITS = [
  "image-delivery-insight",
  "uses-responsive-images",
  "modern-image-formats",
  "uses-optimized-images",
  "unsized-images",
];

/**
 * Which image, and why.
 *
 * `image-delivery-insight — expected >= 0.9, actual 0.5` names no file. On
 * the first real client the fix loop burned two iterations on that one line:
 * the first rewrote the wrong component, the second was about to repeat it.
 * The report had the answer the whole time — one image, its request URL, the
 * bytes wasted, and a `reason` giving natural against displayed dimensions,
 * which is what says whether the file is too big or merely requested too
 * large.
 *
 * The request URL matters as much as the reason: it carries next/image's
 * `w=` and `q=`, so a change that did not take effect is visible as the same
 * parameters coming back. `quality={60}` reads as applied in the source and
 * is silently ignored unless the value is in `images.qualities` — the URL is
 * the only place that shows it.
 */
function imageLines(audits) {
  const out = [];
  for (const id of IMAGE_AUDITS) {
    const audit = audits[id];
    if (!audit || audit.score === null || audit.score === undefined) continue;
    if (audit.score >= 0.9) continue;
    for (const row of asArray(audit.details?.items).slice(0, 4)) {
      const url = String(row?.url ?? row?.node?.snippet ?? "").slice(-100);
      const wasted = row?.wastedBytes ? ` wasted=${Math.round(row.wastedBytes / 1024)} KB` : "";
      const total = row?.totalBytes ? ` of ${Math.round(row.totalBytes / 1024)} KB` : "";
      out.push(`context: ${id} — ${url}${wasted}${total}`);
      for (const sub of asArray(row?.subItems?.items).slice(0, 1)) {
        if (sub?.reason) {
          out.push(`context: ${id} reason — ${String(sub.reason).slice(0, 170)}`);
        }
      }
    }
  }
  return out;
}
