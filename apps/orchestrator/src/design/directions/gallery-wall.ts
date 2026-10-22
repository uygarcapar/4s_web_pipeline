import type { Direction } from "@pipeline/core";

/**
 * D10 §4.3 — many photographs at once, and type that lies on them.
 *
 * Built from `almirakho.com` (operator pick, 2026-10-22): the viewport is
 * tiled with photographs edge to edge, no margin anywhere, and the type sits
 * **over** the images — names across faces, a block of uppercase description
 * in a corner. Nothing is framed, nothing is captioned underneath.
 *
 * The distinction from `cinematic-calm` is the whole point and it is a
 * distinction §8.1 can measure. `cinematic-calm` is ONE photograph with
 * quiet type on it; this is six, and the composition is the grid they make.
 * A client with one good picture belongs in the first and a client with a
 * real gallery belongs here — which is most salons, restaurants and clinics
 * that have ever hired a photographer for an afternoon.
 */
export const galleryWall: Direction = {
  id: "gallery-wall",
  label: "Gallery wall",
  intent:
    "A wall of the client's own photographs, with the words laid over them. " +
    "For a business whose work is visible and plentiful — a salon, a " +
    "restaurant, a clinic with a real gallery — where six pictures say more " +
    "than one and the page is the grid they make.",
  type: {
    // Archivo dropped, as everywhere outside `stark-display`. Plain
    // grotesks only: type that sits on a photograph has to stay out of the
    // way of the picture under it.
    pairs: [
      { display: "Inter Tight", body: "Inter Tight" },
      { display: "Public Sans", body: "Inter Tight" },
      { display: "Karla", body: "Karla" },
    ],
    mono: ["JetBrains Mono"],
    displayWeights: [400, 600],
    displayTracking: [-0.02, 0.02],
    scaleRatio: [4.5, 6],
    displayCase: ["upper", "sentence"],
  },
  color: {
    // The photographs supply every colour. Paper is whatever is left between
    // them, which is almost nothing.
    modes: ["light", "dark"],
    strategies: ["photo-led"],
    paperLightness: [0.12, 0.98],
    maxChroma: 0.04,
  },
  shape: {
    radius: [0],
    // No rules and no frames: tiles meet each other directly, and a hairline
    // between them would turn the wall into a table.
    rules: ["none"],
    imageFrame: ["bleed"],
    },
  grid: {
    alignment: ["left-flush", "asymmetric"],
    // Never `poster`: the whole argument is density. A poster-density
    // gallery wall is four pictures with air around them, which is a
    // different direction and a worse one.
    density: ["standard", "editorial"],
  },
  motion: {
    profiles: ["calm", "editorial"],
    signatures: ["pinned-handoff"],
    required: [],
    heroEntrance: false,
    smoothScroll: true,
  },
  archetypes: {
    // Every entry is image-bearing, and the gallery options are the dense
    // ones. `mosaic` and `contact-sheet` are the wall; `strip` is not.
    hero: ["collage", "offset-grid", "photo-full"],
    statement: ["quote-split", "static"],
    services: ["image-grid", "alternating"],
    team: ["portrait-rows", "grid"],
    gallery: ["mosaic", "contact-sheet"],
    testimonials: ["ruled-list"],
    visit: ["card", "map-split"],
    faq: ["two-column"],
    process: ["timeline"],
    marquee: ["static-band"],
    closing: ["split-panel", "banner"],
    contact: ["default"],
  },
  affinity: {
    tone: { warm: 3, premium: 2, playful: 1, clinical: -1, technical: -3 },
    tier: { premium: 2, mid: 2, budget: 0 },
    // Needs MORE photographs than cinematic-calm, not fewer: one good
    // picture fills that direction's hero and leaves this one with five
    // empty tiles.
    photoProfile: { pro: 4, amateur: 1, "stock-heavy": -6 },
  },
  refs: [
    "data/directions/gallery-wall/refs/almirakho-home.png",
    "data/directions/gallery-wall/refs/almirakho-works.png",
    "data/directions/gallery-wall/refs/almirakho-about.png",
  ],
  avoid: [
    "captions under pictures. The type goes ON the image or it goes in its " +
      "own block; a photograph with a label beneath it is a card, and three " +
      "of those are generic cluster 4.",
    "margins between tiles. The wall is edge to edge — gutters turn it into " +
      "a grid of cards, which is the one thing it must not become.",
    "fewer than four usable photographs. Below that this direction is a " +
      "page of grey rectangles, and the scorer should have sent the client " +
      "to `cinematic-calm` or `stark-display` instead.",
  ],
};
