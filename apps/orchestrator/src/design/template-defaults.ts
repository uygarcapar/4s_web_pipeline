import type { DesignSpec } from "@pipeline/core";

import { DIRECTIONS } from "./directions/index.js";
import { sampleSpec } from "./sample-spec.js";

/**
 * The template's own design, as a `DesignSpec`.
 *
 * `template/` is a working Next app as well as the thing a run copies, so it
 * needs a stylesheet and a font module of its own. Those used to be
 * hand-maintained, and the cost showed up twice: the eight type-step classes
 * were simply absent until B4, and the `--paper-*` / `--ink-*` ramp was
 * never defined at all — so every section written against `--ink-400`
 * rendered an invalid declaration, inherited near-black text, and looked
 * correct for the wrong reason until the first generated ramp replaced it.
 *
 * Sampling it from the real catalog removes the possibility. The template
 * renders what a run renders, through the same two generators, and
 * `template-defaults.test.ts` fails if the committed files drift from this
 * spec.
 *
 * `swiss-grid` because the template's committed faces are Archivo (its third
 * pairing) and because a light, ruled, standard-density page is the least
 * opinionated backdrop for reviewing an archetype in isolation.
 */
export const DEFAULT_SPEC: DesignSpec = (() => {
  const direction = DIRECTIONS["swiss-grid"]!;
  const sampled = sampleSpec(direction, "template-default", 0);
  return {
    ...sampled,
    seed: "template-default",
    type: {
      ...sampled.type,
      // Pinned rather than sampled: these are the faces vendored in
      // template/public/fonts, and a resample that drew Inter Tight would
      // leave the template's own `pnpm dev` loading a font that is not there.
      display: "Archivo",
      body: "Archivo",
      mono: "JetBrains Mono",
    },
    signature: { sectionIndex: 0, concept: "the template's own default" },
  };
})();

/** Faces the template must keep vendored for `DEFAULT_SPEC` to load. */
export const DEFAULT_FACE_SLUGS = ["archivo", "jetbrains-mono"] as const;
