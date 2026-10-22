import type { Direction } from "@pipeline/core";

/**
 * D10 §4.3 — the language `diskent-landing` was built in, and the one every
 * rule in design-rules.md §3–§4 was written from before A1 split them out.
 *
 * It stays in the catalog as one option among four rather than the floor.
 */
export const kineticBold: Direction = {
  id: "kinetic-bold",
  label: "Kinetic bold",
  intent:
    "Confident, modern, motion-led. For clinics and studios with good real " +
    "photography and a clear one-sentence identity — a business whose own " +
    "material can carry a full-bleed hero and whose owner wants the site to " +
    "feel newer than the neighbours'.",
  type: {
    pairs: [
      { display: "Archivo", body: "Archivo" },
      { display: "Anton", body: "Inter Tight" },
      { display: "Bebas Neue", body: "Karla" },
    ],
    mono: ["Space Mono"],
    displayWeights: [700, 800],
    displayTracking: [-0.045, -0.03],
    scaleRatio: [5.5, 7],
    displayCase: ["sentence", "upper"],
  },
  color: {
    modes: ["light", "split"],
    strategies: ["mono-hue"],
    paperLightness: [0.93, 0.99],
    maxChroma: 0.14,
  },
  shape: {
    radius: [0, 4],
    rules: ["hairline"],
    imageFrame: ["bleed", "masked"],
  },
  grid: {
    alignment: ["left-flush", "asymmetric"],
    density: ["standard", "editorial"],
  },
  motion: {
    profiles: ["kinetic"],
    signatures: ["pinned-handoff", "text-transformation", "pinned-rail"],
    required: ["pinned-handoff", "text-transformation"],
    heroEntrance: true,
    smoothScroll: true,
  },
  // Every name here exists in the template registry; archetypes.test.ts
  // fails the build if one does not. Chosen for how loud each layout is:
  // this direction's whole argument is scale and movement.
  archetypes: {
    hero: ["photo-full", "marquee", "offset-grid"],
    statement: ["word-reveal"],
    services: ["rail-pinned", "image-grid"],
    team: ["sticky-swap"],
    gallery: ["full-bleed", "mosaic"],
    testimonials: ["single-large"],
    visit: ["map-split", "card"],
    faq: ["rows"],
    process: ["rail"],
    marquee: ["ticker"],
    closing: ["statement-cta", "banner"],
    contact: ["default"],
  },
  affinity: {
    tone: { premium: 2, clinical: 1, technical: 1, traditional: -2, warm: -1 },
    tier: { premium: 2, mid: 1, budget: -1 },
    photoProfile: { pro: 3, amateur: 1, "stock-heavy": -3 },
  },
  refs: [
    "data/directions/kinetic-bold/refs/hobro-digital.jpg",
    "data/directions/kinetic-bold/refs/sharplink.jpg",
    "data/directions/kinetic-bold/refs/unitedcarriers.jpg",
    "data/directions/kinetic-bold/refs/trevornoah.jpg",
  ],
  avoid: [
    "cluster 2 (acid accent on near-black): the accent is derived from the " +
      "client's photographs and the paper stays light — this direction's " +
      "contrast comes from scale and motion, never from a neon on charcoal.",
    "cluster 5 (decorative mono): the mono accent carries index numbers and " +
      "labels with content, never an 'A · B · C' string or a '→' suffix.",
  ],
};
