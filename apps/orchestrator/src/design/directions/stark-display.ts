import type { Direction } from "@pipeline/core";

/**
 * D10 §4.3 — the type IS the image.
 *
 * Replaces `editorial-serif`, which the operator rejected outright on
 * 2026-10-22: a thin Fraunces headline over a third of the viewport read as
 * unfinished, not restrained. The lesson that survives the rejection is that
 * a page carried by typography has to be carried *completely* — at viewport
 * width, in a weight that looks decided. Half-measures look like a draft.
 *
 * Built from `paulkalkbrenner.net` (the name at full width with a tiny
 * photograph set inside the wordmark) and `bennettandclive.com` (oversized
 * condensed uppercase deliberately overflowing the frame, brand split to the
 * two edges). Both are monochrome; in both, the only colour on the page is
 * whatever is inside a photograph.
 *
 * This is the direction for a client with little usable imagery, which is
 * most crawled SMB sites — the place `editorial-serif` was meant to serve
 * and did not.
 */
export const starkDisplay: Direction = {
  id: "stark-display",
  label: "Stark display",
  intent:
    "Monochrome and typographic. For a business whose name and words are " +
    "better than its photographs — a practice, a studio, a firm with two " +
    "usable pictures and a clear sentence about itself. The type runs to the " +
    "edges of the viewport and the page needs nothing else to feel finished.",
  type: {
    // Archivo, and only Archivo — it is this direction's alone now. The
    // body varies instead, which keeps `typePair` unfrozen while the face
    // a visitor actually reads stays constant and distinctive.
    //
    // Anton and Bebas Neue went to `kinetic-bold`: sharing all three faces
    // with it is why the operator called their renders the same site.
    pairs: [
      { display: "Archivo", body: "Archivo" },
      { display: "Archivo", body: "Public Sans" },
      { display: "Archivo", body: "Inter Tight" },
    ],
    mono: ["Space Mono", "JetBrains Mono"],
    // The operator's floor is 400; this direction sits well above it because
    // the whole argument is mass.
    displayWeights: [700, 900],
    // Tighter than kinetic-bold: at viewport width the default spacing
    // opens into gaps that read as broken words.
    displayTracking: [-0.055, -0.04],
    // The highest in the catalog. kinetic-bold tops out at 7; this starts
    // where that ends, because the headline IS the hero image.
    scaleRatio: [7, 9],
    displayCase: ["upper", "sentence"],
  },
  color: {
    // No accent anywhere. Both references are black-on-white with colour
    // only inside photographs, and an accent would be the first thing to
    // make this look like every other template.
    modes: ["light"],
    strategies: ["mono-hue"],
    paperLightness: [0.96, 1],
    // Near-neutral: the client's hue survives as a trace in the ink, not as
    // a brand colour. `rampViolations` still guarantees contrast.
    maxChroma: 0.03,
  },
  shape: {
    radius: [0],
    rules: ["hairline"],
    // `bleed` or `inset` — never `masked` or `collage`. A picture here is
    // either full-bleed or a small rectangle sitting inside the type, and
    // both are square-cornered.
    imageFrame: ["bleed", "inset"],
  },
  grid: {
    // Never `centered`. Centring with no rules is exactly what made
    // quiet-luxury's numbered index read as broken spacing.
    alignment: ["left-flush", "asymmetric"],
    density: ["poster", "standard"],
  },
  motion: {
    // Movement, but not kinetic-bold's. The references scroll rather than
    // perform: the type is already the event.
    profiles: ["editorial"],
    signatures: ["text-transformation", "pinned-rail"],
    required: ["text-transformation"],
    heroEntrance: true,
    smoothScroll: true,
  },
  archetypes: {
    // Type-led layouts first. `type-only` and `index` are the two the
    // references actually use; `marquee` is the band of the client's own
    // phrases at display scale.
    hero: ["type-only", "index", "marquee"],
    statement: ["word-reveal", "static"],
    services: ["index", "accordion"],
    team: ["roster", "portrait-rows"],
    // Small staggered pictures against huge type, as the Bennett & Clive
    // work page does it — numbered, not a gallery wall.
    gallery: ["contact-sheet", "pairs"],
    testimonials: ["ruled-list"],
    visit: ["rows", "stacked"],
    faq: ["rows", "two-column"],
    process: ["numbered"],
    marquee: ["ticker"],
    closing: ["statement-cta", "banner"],
    contact: ["default"],
  },
  affinity: {
    tone: { technical: 2, clinical: 2, premium: 2, traditional: -1, playful: -2 },
    tier: { premium: 2, mid: 2, budget: 0 },
    // The one direction that does not need photographs. That is its job in
    // the catalog: every other direction scores a stock-heavy client down,
    // and someone has to be able to serve them well.
    photoProfile: { "stock-heavy": 3, amateur: 2, pro: 0 },
  },
  refs: [
    "data/directions/stark-display/refs/paulkalkbrenner.png",
    "data/directions/stark-display/refs/bennettandclive-home.png",
    "data/directions/stark-display/refs/bennettandclive-work.png",
  ],
  avoid: [
    "any accent colour. The references are monochrome and the colour in " +
      "them is inside the photographs; an accent button is the single " +
      "fastest way to make this read as a template with big type rather " +
      "than as a designed page.",
    "cluster 1 (centred everything): the type is flush to an edge or it is " +
      "nothing. Centred display at this scale has no axis to read along.",
    "a headline that fits comfortably. If the longest line does not reach " +
      "the measure, the scale is too small for this direction — that is the " +
      "`editorial-serif` failure this replaces.",
  ],
};
