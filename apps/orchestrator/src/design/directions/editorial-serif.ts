import type { Direction } from "@pipeline/core";

/**
 * D10 §4.3 — calm authority. The direction A1 existed to make buildable:
 * weight 400, near-zero tracking and no pinned hand-off were all hard fails
 * under the pre-split rules.
 *
 * Fraunces and Newsreader are variable and carry `opsz`, so the display step
 * gets a real optical-size curve rather than a body face scaled up — the
 * thing that made every earlier run read as a 2014 web page.
 */
export const editorialSerif: Direction = {
  id: "editorial-serif",
  label: "Editorial serif",
  intent:
    "Calm authority for a business whose credibility is its age and its " +
    "own words. Long-established practices, law- and finance-adjacent " +
    "services, dentists and clinics with real text on the current site. " +
    "The site reads; it does not perform.",
  type: {
    pairs: [
      { display: "Fraunces", body: "Karla" },
      { display: "Newsreader", body: "Public Sans" },
      { display: "Instrument Serif", body: "Inter Tight" },
    ],
    mono: [],
    displayWeights: [300, 400],
    displayTracking: [-0.015, 0],
    scaleRatio: [3, 4.5],
    displayCase: ["sentence"],
  },
  color: {
    modes: ["light"],
    strategies: ["mono-hue", "photo-led"],
    paperLightness: [0.94, 0.99],
    maxChroma: 0.06,
  },
  shape: {
    radius: [0],
    rules: ["none", "hairline"],
    imageFrame: ["inset"],
  },
  grid: {
    alignment: ["left-flush"],
    density: ["editorial"],
  },
  motion: {
    profiles: ["calm"],
    signatures: [],
    required: [],
    heroEntrance: false,
    smoothScroll: true,
  },
  archetypes: {
    hero: ["photo-full", "statement-left"],
    statement: ["quote-rule"],
    services: ["list-rule", "grid-bordered"],
    gallery: ["inset-pairs"],
    testimonials: ["quote-large"],
    faq: ["accordion-rule"],
    visit: ["map-split"],
    contact: ["split-form"],
  },
  affinity: {
    tone: { traditional: 3, clinical: 2, premium: 1, playful: -3, technical: 0 },
    tier: { mid: 2, premium: 2, budget: 0 },
    photoProfile: { "stock-heavy": 2, amateur: 1, pro: 1 },
  },
  refs: [
    "data/directions/editorial-serif/refs/neutomni.jpg",
    "data/directions/editorial-serif/refs/brand-squarespace.jpg",
    "data/directions/editorial-serif/refs/huyml.jpg",
    "data/directions/editorial-serif/refs/gionatannese.jpg",
  ],
  avoid: [
    "cluster 1 (cream + serif + terracotta): paper lightness and hue are " +
      "derived from the client's photographs, never the #F4F1EA-and-clay " +
      "combination that every template ships. Chroma is capped at 0.06 so a " +
      "warm photograph cannot drift the page into it.",
    "cluster 3 (broadsheet): generous measure, one column of running text, " +
      "no dense multi-column setting — the density is `editorial` because the " +
      "client has copy, not because the page should look like a newspaper.",
  ],
};
