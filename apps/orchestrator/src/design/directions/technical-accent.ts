import type { Direction } from "@pipeline/core";

/**
 * D10 §4.3 — the drawing-office register, and the catalog's only real accent.
 *
 * Built from `heronaiapp.com` (operator pick, 2026-10-22): off-white paper
 * carrying faint construction lines, crop marks at the corners, ruler ticks
 * down the edges, a mono uppercase nav in a hairline-ruled strip — and one
 * hot orange used **as a pointer**. Not a fill: it marks a single nav item,
 * two 6px squares inside a line drawing, one arrow. The restraint is the
 * whole effect; the same colour across a nav, a sticky bar and three CTAs
 * would be a different page entirely.
 *
 * It exists because `colorMode` and the accent were the two axes doing
 * nothing. The §8.1 distance weights `colorMode` at 2 and the catalog had
 * two values in it; every direction was light and every accent was either
 * the ink or a near-neutral. A direction whose argument IS a colour widens
 * a measurement, not just the mood board.
 *
 * It also suits the client this pipeline sees most: a business with precise,
 * boring, verifiable facts — hours, prices, a treatment list — and no
 * photographs worth a hero. A drawing office makes a virtue of exactly that.
 */
export const technicalAccent: Direction = {
  id: "technical-accent",
  label: "Technical accent",
  intent:
    "Drafting paper and one hot colour. For a business whose credibility is " +
    "in its precision — a clinic that publishes its prices, a workshop, a " +
    "laboratory — where ruled structure reads as competence and the single " +
    "accent is the only thing asking to be clicked.",
  type: {
    // Public Sans: the neutral grotesk, which is what a drawing office
    // sets its labels in. Not Archivo or Anton — both went elsewhere after
    // the operator labelled this direction's renders the same site as
    // `kinetic-bold`'s.
    pairs: [
      { display: "Public Sans", body: "Public Sans" },
      { display: "Public Sans", body: "Inter Tight" },
      { display: "Public Sans", body: "Karla" },
    ],
    // The mono is load-bearing here, not an accent: the nav, the ruler
    // labels and the index numbers are all mono in the reference.
    mono: ["JetBrains Mono", "Space Mono"],
    displayWeights: [600, 800],
    displayTracking: [-0.04, -0.02],
    scaleRatio: [5, 6.5],
    displayCase: ["upper", "sentence"],
  },
  color: {
    modes: ["light"],
    // The only `accent-block` direction with chroma to spend. The paper
    // stays near-neutral and the accent does all the colour work.
    strategies: ["accent-block"],
    paperLightness: [0.95, 0.99],
    maxChroma: 0.19,
  },
  shape: {
    // Square. A drawing has no rounded corners, and the hairline grid only
    // reads as a grid when the boxes meet at right angles.
    radius: [0],
    rules: ["hairline"],
    imageFrame: ["inset", "bleed"],
  },
  grid: {
    alignment: ["left-flush", "asymmetric"],
    density: ["standard", "editorial"],
  },
  motion: {
    profiles: ["editorial"],
    signatures: ["pinned-rail", "text-transformation"],
    required: ["pinned-rail"],
    heroEntrance: true,
    smoothScroll: true,
  },
  archetypes: {
    // Ruled, indexed, columnar. `index` twice because a numbered list under
    // hairlines is this direction's native way of saying anything.
    hero: ["index", "split", "offset-grid"],
    statement: ["static", "quote-split"],
    services: ["index", "accordion", "image-grid"],
    team: ["roster", "grid"],
    gallery: ["contact-sheet", "pairs"],
    testimonials: ["ruled-list"],
    visit: ["rows", "stacked"],
    faq: ["two-column", "rows"],
    process: ["numbered", "timeline"],
    marquee: ["static-band"],
    closing: ["banner", "split-panel"],
    contact: ["default"],
  },
  affinity: {
    tone: { technical: 3, clinical: 3, premium: 1, traditional: 0, playful: -2 },
    tier: { mid: 2, premium: 2, budget: 1 },
    // Works with or without photographs — the drawing-office language is
    // made of rules and numbers, and a client with pictures simply gets
    // them inset into the grid.
    photoProfile: { amateur: 2, "stock-heavy": 2, pro: 1 },
  },
  refs: [
    "data/directions/technical-accent/refs/heron-home.png",
    "data/directions/technical-accent/refs/heron-about.png",
    "data/directions/technical-accent/refs/heron-dashboard.png",
  ],
  avoid: [
    "the accent as a fill. It marks ONE thing per screen — a single nav " +
      "item, an index number, an arrow. A generated site has a nav, a " +
      "sticky bar and several CTAs, and painting all of them is the fastest " +
      "way to turn this into cluster 2 (bright accent, everywhere).",
    "rounded corners anywhere. The hairline grid only reads as a grid when " +
      "its boxes meet at right angles; a 12px radius makes it a card deck.",
    "decorative mono. The mono carries labels, index numbers and ruler " +
      "marks — things with content. Not an 'A · B · C' string.",
  ],
};
