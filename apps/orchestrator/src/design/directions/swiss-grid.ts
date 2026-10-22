import type { Direction } from "@pipeline/core";

/**
 * **Widened in Phase E, because it could only ever serve one client.**
 *
 * It froze colour mode, motion profile, alignment, image frame, radius AND
 * density — 12 of the 18 points §8.1 weighs — leaving a ceiling of 0.333
 * against a 0.40 threshold. Two swiss-grid clients could never be far
 * enough apart, so the second one was always rejected and the direction
 * yielded exactly one site. Nothing failed; a capacity probe found it.
 * `maxInternalDistance` is now a test, so the next one fails loudly.
 *
 * Four axes are unfrozen above and each is argued at its site. `radius`
 * stays frozen on purpose: buying distance by rounding the corners would
 * trade away the thing being measured.
 *
 * D10 §4.3 — precise, systematic, technical. The only direction whose mono
 * accent is required rather than optional: the index numbers, the time-and-
 * place labels and the field captions are the language, not decoration.
 */
export const swissGrid: Direction = {
  id: "swiss-grid",
  label: "Swiss grid",
  intent:
    "Precise and systematic. Engineering, repair, logistics, B2B services " +
    "and clinics with a clinical brand — a business judged on competence " +
    "rather than warmth, whose site should read like a well-kept index of " +
    "what it does.",
  type: {
    // Archivo dropped: it belongs to `stark-display` now. Inter Tight and
    // Public Sans are the grotesks this style was actually set in.
    pairs: [
      { display: "Inter Tight", body: "Inter Tight" },
      { display: "Inter Tight", body: "Public Sans" },
      { display: "Public Sans", body: "Karla" },
    ],
    // Required, not optional: see `avoid`.
    mono: ["JetBrains Mono", "Space Mono"],
    displayWeights: [400, 500],
    displayTracking: [-0.02, -0.005],
    scaleRatio: [4, 6],
    displayCase: ["sentence", "upper"],
  },
  color: {
    modes: ["light", "split"],
    strategies: ["accent-block", "mono-hue"],
    paperLightness: [0.95, 1],
    maxChroma: 0.18,
  },
  shape: {
    // Square stays frozen, and deliberately: the International Style has no
    // rounded corners, and unfreezing an axis by betraying the direction
    // would buy distance with the thing the distance is measuring.
    radius: [0],
    rules: ["heavy", "hairline"],
    // Full-bleed as well as inset. Müller-Brockmann's posters run the
    // photograph to the trim; an inset-only grid was a narrower reading of
    // the idiom than the idiom deserves.
    imageFrame: ["inset", "bleed"],
  },
  grid: {
    // Flush-left is at least as Swiss as asymmetric, and arguably more so.
    alignment: ["asymmetric", "left-flush"],
    // A dense page is entirely in character — the style was made for
    // timetables and catalogues before it was made for posters.
    density: ["standard", "editorial"],
  },
  motion: {
    // `calm` as well: a Swiss page that does not move is not a lesser
    // version of one that does.
    profiles: ["editorial", "calm"],
    signatures: ["pinned-rail", "lateral-move", "pinned-handoff"],
    required: [],
    heroEntrance: false,
    smoothScroll: true,
  },
  // The ruled, columnar half of the library. `marquee/static-band` rather
  // than `ticker` and `statement/static` rather than `word-reveal` for the
  // same reason this direction's motion profile is `calm`: nothing here
  // moves to be noticed.
  archetypes: {
    hero: ["index", "offset-grid", "split"],
    statement: ["static"],
    services: ["index", "image-grid", "accordion"],
    team: ["grid", "roster"],
    gallery: ["contact-sheet", "mosaic"],
    testimonials: ["ruled-list"],
    visit: ["rows", "stacked"],
    faq: ["two-column", "rows"],
    process: ["numbered", "timeline"],
    marquee: ["static-band"],
    closing: ["split-panel", "banner"],
    contact: ["default"],
  },
  affinity: {
    tone: { technical: 3, clinical: 3, premium: 1, warm: -2, playful: -3 },
    tier: { mid: 2, premium: 1, budget: 1 },
    photoProfile: { "stock-heavy": 2, amateur: 2, pro: 1 },
  },
  refs: [
    "data/directions/swiss-grid/refs/aspensearch.jpg",
    "data/directions/swiss-grid/refs/seasats.jpg",
    "data/directions/swiss-grid/refs/cerebrium.jpg",
    "data/directions/swiss-grid/refs/noho.jpg",
  ],
  avoid: [
    "cluster 5 (decorative mono): the mono accent carries numbers, labels " +
      "and real values — an index, a phone number, a time. Never an " +
      "'A · B · C' string, never a '→' suffix on a button.",
    "cluster 2 (acid accent on near-black): the accent-block strategy fills " +
      "whole cells of the grid on light paper, which is the opposite move " +
      "from a neon highlight floating on charcoal.",
    "The grid is structural, not decorative: a rule exists because two " +
      "fields meet there. A hairline added for texture puts this direction " +
      "straight into the template look it is furthest from.",
  ],
};
