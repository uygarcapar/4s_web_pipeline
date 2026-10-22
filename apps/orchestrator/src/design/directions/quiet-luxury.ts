import type { Direction } from "@pipeline/core";

/**
 * D10 §4.3 — premium, restrained, photo-forward.
 *
 * The one direction that can fail on the client rather than on the build: it
 * is carried by photography, so a business with thin or stock imagery should
 * be scored away from it by `affinity.photoProfile` rather than built in it
 * and repaired. That condition is recorded against Q1 in
 * docs/D10-design-variation.md §13.
 *
 * Its motion is the corpus finding we were not using: 46 of 57 measured sites
 * tween `filter`, and none of our own work did.
 */
export const quietLuxury: Direction = {
  id: "quiet-luxury",
  label: "Quiet luxury",
  intent:
    "Premium and restrained, carried by the photographs. Aesthetic clinics, " +
    "salons, boutique hospitality and high-tier tradespeople whose own " +
    "images are good enough to fill a screen. The type gets out of the way; " +
    "the work is the argument.",
  type: {
    pairs: [
      { display: "Instrument Serif", body: "Karla" },
      { display: "Fraunces", body: "Public Sans" },
      { display: "Archivo", body: "Archivo" },
    ],
    mono: [],
    displayWeights: [300, 400],
    displayTracking: [-0.01, 0.01],
    scaleRatio: [4, 6],
    displayCase: ["sentence", "upper"],
  },
  color: {
    modes: ["dark", "split"],
    strategies: ["photo-led"],
    // Near-black is the photograph's own hue pushed down, never #0B0B0B (§5).
    paperLightness: [0.12, 0.28],
    maxChroma: 0.04,
  },
  shape: {
    // 999 is for buttons only — a pill-shaped card is a different language.
    radius: [0, 999],
    rules: ["none"],
    imageFrame: ["bleed", "masked"],
  },
  grid: {
    alignment: ["centered", "asymmetric"],
    density: ["poster", "standard"],
  },
  motion: {
    profiles: ["calm"],
    signatures: ["pinned-handoff"],
    required: [],
    heroEntrance: false,
    smoothScroll: true,
  },
  // Photograph-led: every option here gives an image room. That is also
  // why the scorer pushes this direction away from a client with no
  // usable photographs — these layouts have nothing to render without them.
  archetypes: {
    hero: ["photo-full", "collage"],
    statement: ["static", "quote-split"],
    services: ["alternating", "rail-pinned"],
    team: ["lead", "portrait-rows"],
    gallery: ["full-bleed", "pairs"],
    testimonials: ["single-large"],
    visit: ["card", "map-split"],
    faq: ["two-column"],
    process: ["timeline"],
    marquee: ["static-band"],
    closing: ["statement-cta", "split-panel"],
    contact: ["default"],
  },
  affinity: {
    tone: { premium: 3, warm: 1, clinical: 1, technical: -2, playful: -3 },
    tier: { premium: 3, mid: 0, budget: -3 },
    // The sharpest discriminator in the catalog: without real photographs
    // this direction has nothing to render.
    photoProfile: { pro: 4, amateur: -1, "stock-heavy": -4 },
  },
  refs: [
    "data/directions/quiet-luxury/refs/odysseeclinic.jpg",
    "data/directions/quiet-luxury/refs/milledollars.jpg",
    "data/directions/quiet-luxury/refs/belgradearbor.jpg",
    "data/directions/quiet-luxury/refs/lxlcreative.jpg",
  ],
  avoid: [
    "cluster 2 (single bright accent on near-black): there is no accent. " +
      "The darks are the photograph's hue pushed to near-black (§5) and " +
      "chroma is capped at 0.04, so the page cannot acquire a neon.",
    "cluster 4 (stock-photo luxury): the photographs are the client's own. " +
      "A business whose images are stock scores out of this direction via " +
      "`affinity.photoProfile`; it is not rescued by a darker palette.",
  ],
};
