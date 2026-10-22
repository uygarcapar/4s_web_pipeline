import type { Direction } from "@pipeline/core";

/**
 * D10 §4.3 — one photograph carries the page.
 *
 * Replaces `quiet-luxury`, and the replacement exists because of *how* that
 * one failed. The operator rejected it on 2026-10-22, but it was reviewed in
 * `/library`, where every image is a grey SVG placeholder — so a direction
 * whose entire argument is "the photographs carry it" was judged with its
 * photographs missing. Meanwhile two of the five reference sites the
 * operator then chose (`mont-fort.com`, `oryzo.ai`) are light, wide-tracked
 * type over an enormous image: the register was never the problem.
 *
 * What changes is that the photograph stops being optional. `quiet-luxury`
 * declared `photo-led` and still rendered without one; this direction scores
 * so far away from a photo-poor client that the selector will not hand it to
 * one, and its archetypes are the ones that fail loudly rather than quietly
 * when an image is absent.
 *
 * Also built from `terminal-industries.com`, which is the dark end of the
 * same idea — a cinematic full-bleed render with floating chrome over it —
 * and is why `modes` includes `dark`.
 */
export const cinematicCalm: Direction = {
  id: "cinematic-calm",
  label: "Cinematic calm",
  intent:
    "One large photograph, and type that sits quietly on it. For a business " +
    "with genuinely good imagery — a clinic with a photographed interior, a " +
    "hotel, a restaurant — where the picture says more than a headline " +
    "could and the words only have to name things.",
  type: {
    pairs: [
      { display: "Public Sans", body: "Public Sans" },
      { display: "Inter Tight", body: "Inter Tight" },
      { display: "Karla", body: "Karla" },
    ],
    mono: ["JetBrains Mono"],
    // 400-500, the operator's floor. Montfort's wordmark is light, but it
    // is also 40px of wide-tracked uppercase over a mountain — the weight
    // reads as deliberate because the image behind it is doing the work.
    // Below 400 and the page looks unfinished the moment the image is dull.
    displayWeights: [400, 500],
    // The one direction with POSITIVE tracking. Every reference in this
    // register spaces its uppercase wide; it is what separates "quiet" from
    // "small", and it is the opposite of stark-display's move.
    displayTracking: [0.04, 0.12],
    // Moderate. The photograph is the scale; the type does not compete.
    scaleRatio: [4, 5.5],
    // `sentence`, even though the references are uppercase wordmarks.
    //
    // Their caps are a LOGO, and the template already sets its nav, eyebrows
    // and button labels in capitals through `upperTR`. A generated hero
    // headline is a Turkish sentence, and nothing enforces `displayCase` on
    // it today — the only reason `stark-display` appears to honour `upper`
    // is that Anton has no lowercase glyphs. Declaring `upper` here would be
    // a claim the renderer does not keep.
    //
    // Enforcing it is a template change, not a token one: CSS
    // `text-transform: uppercase` is wrong for Turkish — it maps `için` to
    // `IÇIN` instead of `İÇİN`, which is the whole reason `upperTR` exists
    // and bare `.toUpperCase()` is an ESLint error here.
    displayCase: ["sentence"],
  },
  color: {
    // Pale like Montfort or dark like Terminal, never mid. Both references
    // work because the page is almost all one value and the photograph
    // supplies the range.
    modes: ["light", "dark"],
    strategies: ["photo-led"],
    paperLightness: [0.1, 0.97],
    maxChroma: 0.05,
  },
  shape: {
    // The largest radius in the catalog — Terminal's floating pill nav and
    // Oryzo's translucent panels both round generously, and it is what makes
    // chrome read as sitting ON the image rather than cut into it.
    radius: [12, 999],
    rules: ["hairline", "none"],
    imageFrame: ["bleed", "masked"],
  },
  grid: {
    // `centered` is permitted here and nowhere else: Montfort centres its
    // wordmark over the peak and it works, because the image supplies the
    // axis. It is paired with `hairline` rules in every archetype below, so
    // it cannot repeat quiet-luxury's centred-with-no-rules failure.
    alignment: ["centered", "left-flush"],
    density: ["poster", "standard"],
  },
  motion: {
    profiles: ["calm"],
    signatures: ["pinned-handoff"],
    required: [],
    heroEntrance: true,
    smoothScroll: true,
  },
  archetypes: {
    // Every one of these puts a photograph on screen. A client routed here
    // without pictures gets a visibly empty page rather than a quietly
    // mediocre one — which is the failure mode worth having, because it is
    // the one somebody notices.
    hero: ["photo-full", "split", "collage"],
    statement: ["quote-split", "static"],
    services: ["alternating", "image-grid"],
    team: ["portrait-rows", "lead"],
    gallery: ["full-bleed", "mosaic"],
    testimonials: ["single-large"],
    visit: ["map-split", "card"],
    faq: ["two-column"],
    process: ["timeline"],
    marquee: ["static-band"],
    closing: ["split-panel", "statement-cta"],
    contact: ["default"],
  },
  affinity: {
    tone: { premium: 3, warm: 2, traditional: 1, technical: -2, playful: -2 },
    tier: { premium: 3, mid: 1, budget: -2 },
    // The sharpest discriminator in the catalog, and sharper than
    // quiet-luxury's was. Without photographs this direction has nothing to
    // render, and the whole point of the rebuild is that it never gets
    // handed to a client who cannot feed it.
    photoProfile: { pro: 4, amateur: 0, "stock-heavy": -6 },
  },
  refs: [
    "data/directions/cinematic-calm/refs/montfort.png",
    "data/directions/cinematic-calm/refs/oryzo.png",
    "data/directions/cinematic-calm/refs/terminal-industries.png",
  ],
  avoid: [
    "a page with no photograph above the fold. If the client's imagery " +
      "cannot fill a hero, this is the wrong direction and the scorer " +
      "should already have said so — rendering it anyway is what made " +
      "`quiet-luxury` look empty.",
    "cluster 2 (acid accent on near-black): Terminal earns its lime because " +
      "the rest of the page is a photograph and one button is the only " +
      "chrome. A generated site has a nav, a sticky bar and several CTAs, " +
      "and the same colour across all of them is a different page entirely.",
    "tight tracking. Negative tracking at these weights reads as cramped " +
      "rather than quiet, and the whole register depends on air.",
  ],
};
