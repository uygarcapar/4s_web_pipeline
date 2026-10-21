import type { Direction } from "@pipeline/core";

/**
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
    pairs: [
      { display: "Inter Tight", body: "Inter Tight" },
      { display: "Public Sans", body: "Public Sans" },
      { display: "Archivo", body: "Archivo" },
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
    radius: [0],
    rules: ["heavy", "hairline"],
    imageFrame: ["inset"],
  },
  grid: {
    alignment: ["asymmetric"],
    density: ["standard"],
  },
  motion: {
    profiles: ["editorial"],
    signatures: ["pinned-rail", "lateral-move", "pinned-handoff"],
    required: [],
    heroEntrance: false,
    smoothScroll: true,
  },
  archetypes: {
    hero: ["statement-left", "grid-split"],
    statement: ["quote-rule"],
    services: ["grid-bordered", "list-rule", "rail-pinned"],
    gallery: ["grid-bordered"],
    testimonials: ["quote-rule"],
    faq: ["accordion-rule"],
    visit: ["map-split"],
    contact: ["split-form"],
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
