import type { Direction } from "@pipeline/core";

/**
 * D10 §4.3 — a dark photograph with a ruled table lying on it.
 *
 * Built from `offforum.com` (operator pick, 2026-10-22). The home is a
 * full-bleed dark photograph with white type over it and a **hairline-ruled
 * information table** — dates, venue, two columns — laid directly on the
 * image, as if someone had drawn a form onto a photograph. The inner pages
 * invert: white ground, black fill-boxes used as highlight behind single
 * words, long index lists.
 *
 * Both halves are reproducible and both are new to the catalog. The ruled
 * table over an image belongs to nothing else here, and the black fill-box
 * is a highlight device the library has never had.
 *
 * It is the second genuinely dark direction, which matters more than it
 * sounds: §8.1 weights `colorMode` at 2 and the catalog had two values in
 * it, nearly all of them light. Two directions that can go dark is what
 * makes that axis start paying.
 *
 * What is NOT taken from the reference: its lineup page sets every name in a
 * different typeface. That is a festival conceit and build-rules §4 caps a
 * site at two families plus a mono — so the index lists here vary by weight
 * and case, not by face.
 */
export const nightRuled: Direction = {
  id: "night-ruled",
  label: "Night ruled",
  intent:
    "A dark photograph with the facts ruled onto it. For a business that " +
    "trades in the evening or by appointment — a restaurant, a bar, a " +
    "studio — where one atmospheric picture sets the room and the practical " +
    "details are drawn over it rather than tucked underneath.",
  type: {
    pairs: [
      { display: "Fraunces", body: "Inter Tight" },
      { display: "Archivo", body: "Public Sans" },
      { display: "Instrument Serif", body: "Karla" },
    ],
    mono: ["JetBrains Mono"],
    displayWeights: [400, 700],
    displayTracking: [-0.03, 0.01],
    scaleRatio: [5, 7],
    displayCase: ["sentence", "upper"],
  },
  color: {
    // Dark first. `light` is permitted because the reference's inner pages
    // invert, and the black fill-box device only works on a light ground.
    modes: ["dark", "light"],
    strategies: ["photo-led", "accent-block"],
    paperLightness: [0.1, 0.96],
    maxChroma: 0.06,
  },
  shape: {
    // One rounded option, and only one: the reference's CTA is a pill
    // against otherwise square rules. `999` is that pill; `0` is everything
    // else.
    radius: [0, 999],
    rules: ["hairline"],
    imageFrame: ["bleed", "masked"],
  },
  grid: {
    // `centered` earns its place here the way it does in `cinematic-calm` —
    // the reference centres its closing statement over the photograph, and
    // the image supplies the axis. Paired with hairline rules throughout.
    alignment: ["left-flush", "centered"],
    density: ["poster", "standard"],
  },
  motion: {
    profiles: ["calm", "editorial"],
    signatures: ["pinned-handoff", "text-transformation"],
    required: ["pinned-handoff"],
    heroEntrance: true,
    smoothScroll: true,
  },
  archetypes: {
    hero: ["photo-full", "split"],
    statement: ["quote-split", "word-reveal"],
    // `index` and `accordion`: the reference's lists are long, ruled and
    // indexed, never a card grid.
    services: ["index", "accordion"],
    team: ["roster", "lead"],
    gallery: ["full-bleed", "pairs"],
    testimonials: ["single-large"],
    // The ruled table over the image is exactly `rows`.
    visit: ["rows", "map-split"],
    faq: ["rows", "two-column"],
    process: ["numbered"],
    marquee: ["ticker"],
    closing: ["statement-cta", "banner"],
    contact: ["default"],
  },
  affinity: {
    tone: { premium: 3, warm: 2, traditional: 1, playful: 0, technical: -2 },
    tier: { premium: 3, mid: 1, budget: -2 },
    // Needs one good photograph, not six. A single atmospheric image is the
    // entire hero, which is why this sits between `cinematic-calm` and
    // `gallery-wall` rather than competing with either.
    photoProfile: { pro: 3, amateur: 1, "stock-heavy": -4 },
  },
  refs: [
    "data/directions/night-ruled/refs/offfforum-home.png",
    "data/directions/night-ruled/refs/offfforum-lineup.png",
    "data/directions/night-ruled/refs/offfforum-schedule.png",
  ],
  avoid: [
    "a scrim doing the work. The type sits on the photograph because the " +
      "photograph is dark where the type goes — chosen, not dimmed. A black " +
      "overlay at 60% is how every template does this and it reads as one.",
    "the pill radius on anything but the primary CTA. One rounded element " +
      "against square rules is a deliberate exception; two is an " +
      "inconsistency.",
    "cluster 2 (bright accent on near-black). The accent here is the paper " +
      "inverted, not a neon: chroma is capped at 0.06 and the contrast " +
      "comes from the photograph.",
  ],
};
