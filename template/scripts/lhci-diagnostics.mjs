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

  return out;
}
