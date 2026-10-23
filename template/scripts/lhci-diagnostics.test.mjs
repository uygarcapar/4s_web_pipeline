import { describe, expect, it } from "vitest";

import { lhciDiagnostics } from "./lhci-diagnostics.mjs";

/**
 * The shape and the numbers are the ones minaguzellik.com actually produced
 * when the lhci gate failed: a text LCP whose time is almost all render
 * delay, fonts outweighing images by 3.5x, and two render-blocking
 * stylesheets. The fix loop saw none of it and optimised images twice.
 */
const failingLhr = {
  configSettings: { throttlingMethod: "simulate", formFactor: "mobile" },
  audits: {
    "largest-contentful-paint-element": {
      details: {
        items: [
          {
            items: [
              {
                node: {
                  snippet: '<h1 class="t-h2 mt-5 max-w-[14ch] text-[var(--paper-50)]">',
                  selector: "section#hero > div.mx-auto > div.-mx-5 > h1.t-h2",
                },
              },
            ],
          },
          {
            items: [
              { phase: "TTFB", timing: 452.1, percent: "11%" },
              { phase: "Load Delay", timing: 0, percent: "0%" },
              { phase: "Load Time", timing: 0, percent: "0%" },
              { phase: "Render Delay", timing: 3500.9, percent: "89%" },
            ],
          },
        ],
      },
    },
    "resource-summary": {
      details: {
        items: [
          { resourceType: "total", requestCount: 26, transferSize: 597_606 },
          { resourceType: "font", requestCount: 6, transferSize: 237_260 },
          { resourceType: "script", requestCount: 9, transferSize: 218_726 },
          { resourceType: "image", requestCount: 7, transferSize: 68_198 },
          { resourceType: "stylesheet", requestCount: 2, transferSize: 38_195 },
          { resourceType: "third-party", requestCount: 0, transferSize: 0 },
        ],
      },
    },
    "render-blocking-resources": {
      details: {
        items: [
          { url: "http://localhost:3101/_next/static/chunks/32i4fi7i4kt25.css", wastedMs: 751.6 },
          { url: "http://localhost:3101/_next/static/chunks/0sr45_ghknouw.css", wastedMs: 151.8 },
        ],
      },
    },
  },
};

const joined = (lhr) => lhciDiagnostics(lhr).join("\n");

describe("lhciDiagnostics", () => {
  it("names the LCP element, so a text LCP is not mistaken for an image", () => {
    expect(joined(failingLhr)).toContain("LCP element — <h1");
  });

  it("reports the phase split, which is where the time actually went", () => {
    const text = joined(failingLhr);
    expect(text).toContain("LCP phase Render Delay = 3501ms (89%)");
    expect(text).toContain("LCP phase TTFB = 452ms (11%)");
  });

  it("reports resource weight by type, so fonts outweighing images is visible", () => {
    const text = joined(failingLhr);
    expect(text).toContain("font — 6 request(s), 232 KB");
    expect(text).toContain("image — 7 request(s), 67 KB");
  });

  it("says the throttling is simulated, so a stable number is not read as noise", () => {
    expect(joined(failingLhr)).toContain("throttling=simulate formFactor=mobile");
  });

  it("lists render-blocking resources with their cost", () => {
    expect(joined(failingLhr)).toContain("32i4fi7i4kt25.css (752ms)");
  });

  it("skips resource types that are noise at digest size", () => {
    expect(joined(failingLhr)).not.toContain("third-party");
  });

  it("caps the element snippet so one minified line cannot flood the digest", () => {
    const long = {
      audits: {
        "largest-contentful-paint-element": {
          details: { items: [{ items: [{ node: { snippet: "x".repeat(500) } }] }] },
        },
      },
    };
    const [line] = lhciDiagnostics(long);
    expect(line.length).toBeLessThan(200);
  });

  describe("degrades instead of throwing", () => {
    // A diagnostic block that throws would take the whole digest with it,
    // and the LHR shape moves between Lighthouse majors.
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["a string", "not an lhr"],
      ["an empty object", {}],
      ["no audits", { configSettings: { throttlingMethod: "simulate" } }],
      ["audits of the wrong type", { audits: "nope" }],
      ["details missing", { audits: { "resource-summary": {} } }],
      ["items not an array", { audits: { "resource-summary": { details: { items: 7 } } } }],
      ["rows that are null", { audits: { "resource-summary": { details: { items: [null] } } } }],
    ])("%s", (_label, input) => {
      expect(() => lhciDiagnostics(input)).not.toThrow();
      expect(Array.isArray(lhciDiagnostics(input))).toBe(true);
    });
  });

  it("returns nothing when there is no report at all", () => {
    expect(lhciDiagnostics(null)).toEqual([]);
  });
});
