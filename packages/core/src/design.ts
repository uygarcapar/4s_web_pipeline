import { z } from "zod";

/**
 * The declared design space (docs/DECISIONS.md D10).
 *
 * Three schemas, one per stage of the selection pipeline
 * (docs/D10-design-variation.md §6):
 *
 *   brief      → what the client is          (LLM, enum-heavy so it cannot drift)
 *   direction  → the design languages we own (authored offline, operator-approved)
 *   designSpec → the resolved decision       (deterministic, written per run)
 *
 * They live in `packages/core` because the orchestrator writes them and the
 * judge, the token generator and the admin panel all read them; a schema owned
 * by one stage would be re-declared by the next.
 *
 * Shape alone is not the point. The refines below are the part that matters:
 * a direction that requires a motion signature it also disables, or a spec
 * whose signature section index points past the end of its own section list,
 * is structurally valid and operationally broken.
 */

/* -------------------------------------------------------------------------- */
/* Shared vocabulary                                                          */
/* -------------------------------------------------------------------------- */

/** Motion profiles, quietest first (§4.2). */
export const MOTION_PROFILES = ["still", "calm", "editorial", "kinetic"] as const;

/**
 * Named scroll devices a direction may allow or require.
 *
 * An enum rather than `z.string()` (which is what §4.2 sketched) because
 * `DJ10` compares a measured page against this list in both directions — a
 * typo in a direction file would otherwise read as "this signature is absent"
 * and fail every page built in that direction, with nothing pointing at the
 * cause. **A3 extends this list** when a direction needs a device the four
 * first directions do not use.
 */
export const MOTION_SIGNATURES = [
  "pinned-handoff",
  "text-transformation",
  "pinned-rail",
  "lateral-move",
] as const;

export const COLOR_MODES = ["light", "dark", "split"] as const;
export const COLOR_STRATEGIES = [
  "mono-hue",
  "photo-led",
  "duotone",
  "accent-block",
] as const;
export const SHAPE_RULES = ["none", "hairline", "heavy"] as const;
export const IMAGE_FRAMES = ["bleed", "inset", "masked", "collage"] as const;
export const GRID_ALIGNMENTS = ["centered", "left-flush", "asymmetric"] as const;
export const GRID_DENSITIES = ["poster", "standard", "editorial"] as const;
export const DISPLAY_CASES = ["sentence", "upper"] as const;

/** Radii a direction may offer: square, soft, card, pill (§4.2). */
export const RADII = [0, 4, 12, 999] as const;

/**
 * An inclusive `[min, max]` range. Rejects an inverted pair, which is the
 * typo that turns a sampler into an infinite loop or an empty set.
 */
const rangeSchema = (label: string) =>
  z
    .tuple([z.number(), z.number()])
    .refine(([min, max]) => min <= max, {
      message: `${label}: min must be ≤ max`,
    });

/* -------------------------------------------------------------------------- */
/* brief — §6.1                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What the `brief` stage reads off `facts.json`, `content.json` and the asset
 * manifest. Every field is an enum or a count except `ownSentence`, which is
 * verbatim client copy for a statement section — the one place prose is
 * allowed, and it is quoted, never written.
 */
export const briefSchema = z
  .object({
    tone: z.enum([
      "warm",
      "clinical",
      "premium",
      "playful",
      "traditional",
      "technical",
    ]),
    tier: z.enum(["budget", "mid", "premium"]),
    audience: z.enum(["local-everyday", "local-premium", "b2b", "tourist"]),
    photoProfile: z
      .object({
        usableCount: z.number().int().min(0),
        quality: z.enum(["pro", "amateur", "stock-heavy"]),
        dominant: z.enum(["people", "space", "product", "work"]),
      })
      .strict(),
    contentVolume: z.enum(GRID_DENSITIES),
    /** Verbatim, or null when the client wrote nothing usable. Never invented. */
    ownSentence: z.string().min(1).nullable(),
    brandAssets: z
      .object({ hasLogo: z.boolean(), hasBrandFont: z.boolean() })
      .strict(),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* direction — §4.2                                                           */
/* -------------------------------------------------------------------------- */

export const directionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    /** One paragraph: what this language is FOR. Read by the operator, not parsed. */
    intent: z.string().min(1),
    type: z
      .object({
        pairs: z
          .array(
            z
              .object({ display: z.string().min(1), body: z.string().min(1) })
              .strict(),
          )
          .min(2),
        /** Empty = this direction has no mono accent. */
        mono: z.array(z.string().min(1)),
        displayWeights: z.array(z.number().int().min(100).max(900)).min(1),
        /** em. Negative is tighter than default. */
        displayTracking: rangeSchema("displayTracking"),
        /** display font-size ÷ body font-size. */
        scaleRatio: rangeSchema("scaleRatio"),
        displayCase: z.array(z.enum(DISPLAY_CASES)).min(1),
      })
      .strict(),
    color: z
      .object({
        modes: z.array(z.enum(COLOR_MODES)).min(1),
        strategies: z.array(z.enum(COLOR_STRATEGIES)).min(1),
        /** OKLCH L range for the page's paper. */
        paperLightness: rangeSchema("paperLightness"),
        maxChroma: z.number().min(0).max(0.4),
      })
      .strict(),
    shape: z
      .object({
        radius: z.array(z.union(RADII.map((r) => z.literal(r)))).min(1),
        rules: z.array(z.enum(SHAPE_RULES)).min(1),
        imageFrame: z.array(z.enum(IMAGE_FRAMES)).min(1),
      })
      .strict(),
    grid: z
      .object({
        alignment: z.array(z.enum(GRID_ALIGNMENTS)).min(1),
        density: z.array(z.enum(GRID_DENSITIES)).min(1),
      })
      .strict(),
    motion: z
      .object({
        profiles: z.array(z.enum(MOTION_PROFILES)).min(1),
        /** Signatures this direction PERMITS. Anything else measured on the page fails DJ10. */
        signatures: z.array(z.enum(MOTION_SIGNATURES)),
        /**
         * Signatures a page in this direction MUST carry.
         *
         * Not in D10 §4.2 as first drafted, but §3.3 defines DJ10 as checking
         * both halves — required-present and disabled-absent — and A1 found
         * (K8) that a presence-only check silently passes a calm site that
         * still pins. Without this field the required half has no input.
         */
        required: z.array(z.enum(MOTION_SIGNATURES)),
        heroEntrance: z.boolean(),
        smoothScroll: z.boolean(),
      })
      .strict(),
    /** SectionType → allowed archetype ids. */
    archetypes: z.record(z.string().min(1), z.array(z.string().min(1)).min(1)),
    /** Scoring weights for §6.2. Keys are brief enum values. */
    affinity: z
      .object({
        tone: z.record(z.string(), z.number()),
        tier: z.record(z.string(), z.number()),
        photoProfile: z.record(z.string(), z.number()),
      })
      .strict(),
    /**
     * Reference screenshots, repo-relative, under `data/directions/<id>/refs/`
     * (§4.1). At least three: the signature stage (§9) and DJ18 compare a
     * built page against this set, and a direction described only in prose is
     * the prose-rule failure D10 exists to end.
     *
     * Not in §4.2 as drafted, though §4.1 defines the directory and A3's
     * acceptance requires "each lists ≥3 refs" — the field had nowhere to go.
     */
    refs: z.array(z.string().min(1)).min(3),
    /** Which generic clusters (§2) this direction sits near, and how it stays out. */
    avoid: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((direction, ctx) => {
    const { signatures, required } = direction.motion;
    for (const signature of required) {
      if (signatures.includes(signature)) continue;
      ctx.addIssue({
        code: "custom",
        message:
          `motion.required lists "${signature}" but motion.signatures does ` +
          "not permit it: DJ10 would demand the signature and then fail the " +
          "page for carrying it.",
        path: ["motion", "required"],
      });
    }
  });

/* -------------------------------------------------------------------------- */
/* designSpec — §5                                                            */
/* -------------------------------------------------------------------------- */

/**
 * `runs/<domain>/design/design.json`. Fully resolved: every downstream stage
 * reads it and nothing re-decides style after it.
 *
 * `version: 2` because v1 is the pre-D10 design.json, which has no direction
 * and no resolved ranges. The literal is what lets a reader tell them apart.
 */
export const designSpecSchema = z
  .object({
    version: z.literal(2),
    direction: z.string().min(1),
    /** sha256(domain + candidateIndex) — the seed the sampler used (§6.3). */
    seed: z.string().min(1),
    type: z
      .object({
        display: z.string().min(1),
        body: z.string().min(1),
        mono: z.string().min(1).optional(),
        displayWeight: z.number().int().min(100).max(900),
        displayTracking: z.number(),
        scaleRatio: z.number().positive(),
        displayCase: z.enum(DISPLAY_CASES),
      })
      .strict(),
    color: z
      .object({
        mode: z.enum(COLOR_MODES),
        strategy: z.enum(COLOR_STRATEGIES),
        /** OKLCH hue, degrees. */
        brandH: z.number().min(0).max(360),
        /** OKLCH chroma. */
        brandC: z.number().min(0).max(0.4),
      })
      .strict(),
    shape: z
      .object({
        radius: z.union(RADII.map((r) => z.literal(r))),
        rules: z.enum(SHAPE_RULES),
        imageFrame: z.enum(IMAGE_FRAMES),
      })
      .strict(),
    grid: z
      .object({
        alignment: z.enum(GRID_ALIGNMENTS),
        density: z.enum(GRID_DENSITIES),
      })
      .strict(),
    motion: z
      .object({
        profile: z.enum(MOTION_PROFILES),
        signatures: z.array(z.enum(MOTION_SIGNATURES)),
        heroEntrance: z.boolean(),
        smoothScroll: z.boolean(),
      })
      .strict(),
    sections: z
      .array(
        z
          .object({ type: z.string().min(1), archetype: z.string().min(1) })
          .strict(),
      )
      .min(3),
    /** The one bold element (§9). */
    signature: z
      .object({
        sectionIndex: z.number().int().min(0),
        concept: z.string().min(1),
      })
      .strict(),
    /** Audit trail for §8: which directions lost, and by how much. */
    rejected: z.array(
      z
        .object({
          direction: z.string().min(1),
          reason: z.string().min(1),
          distance: z.number(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((spec, ctx) => {
    if (spec.signature.sectionIndex >= spec.sections.length) {
      ctx.addIssue({
        code: "custom",
        message:
          `signature.sectionIndex ${spec.signature.sectionIndex} is past the ` +
          `end of sections (length ${spec.sections.length}): the bold element ` +
          "would be attached to a section that does not exist.",
        path: ["signature", "sectionIndex"],
      });
    }
  });

/* -------------------------------------------------------------------------- */
/* Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type Brief = z.infer<typeof briefSchema>;
export type Direction = z.infer<typeof directionSchema>;
export type DesignSpec = z.infer<typeof designSpecSchema>;

export type MotionProfile = (typeof MOTION_PROFILES)[number];
export type MotionSignature = (typeof MOTION_SIGNATURES)[number];
export type ColorMode = (typeof COLOR_MODES)[number];
export type ColorStrategy = (typeof COLOR_STRATEGIES)[number];
export type GridDensity = (typeof GRID_DENSITIES)[number];
