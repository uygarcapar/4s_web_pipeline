import { z } from "zod";

/**
 * Zod schemas for the site configuration (single source of truth).
 *
 * Every schema is `.strict()`: unknown keys are a hard error so the
 * LLM fill stage cannot silently invent fields. `site.config.ts` is
 * validated with `siteConfigSchema.parse` at module load — an invalid
 * config fails the build, never ships.
 */

/** "HH:MM" 24h time, e.g. "09:00". */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM 24h time");

/** E.164 Turkish number: +90 followed by exactly 10 digits. */
const e164TRSchema = z
  .string()
  .regex(/^\+90[2345]\d{9}$/, "Expected Turkish E.164 number (+90XXXXXXXXXX)");

/** Call-to-action: tel / WhatsApp deep link, or a plain link (href required). */
export const ctaSchema = z
  .object({
    label: z.string().min(1),
    action: z.enum(["tel", "whatsapp", "link"]),
    href: z.string().min(1).optional(),
  })
  .strict()
  .refine((cta) => cta.action !== "link" || cta.href !== undefined, {
    message: 'href is required when action is "link"',
    path: ["href"],
  });

export const imageSchema = z
  .object({
    src: z.string().min(1),
    alt: z.string().min(1),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Sections                                                                   */
/* -------------------------------------------------------------------------- */

const sectionBase = {
  id: z.string().min(1),
};

export const heroSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("hero"),
    /** Layout archetype, chosen per site by the design stage (D6). */
    variant: z.enum(["default", "centered", "photo-full", "seam-bottom"]).optional(),
    headline: z.string().min(1),
    subheadline: z.string().min(1).optional(),
    ctaPrimary: ctaSchema,
    ctaSecondary: ctaSchema.optional(),
    image: imageSchema.optional(),
  })
  .strict();

export const servicesSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("services"),
    /** Layout archetype, chosen per site by the design stage (D6). */
    variant: z.enum(["default", "list", "rail-pinned", "stack"]).optional(),
    title: z.string().min(1).optional(),
    items: z
      .array(
        z
          .object({
            title: z.string().min(1),
            description: z.string().min(1),
            icon: z.string().min(1).optional(),
            /**
             * A photograph of the work, from the crawl. Optional because a
             * business may have written about a service without ever
             * photographing it — and a card with no picture is better than
             * one with a stock placeholder (design-rules.md §9).
             */
            image: imageSchema.optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const teamSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("team"),
    /** Layout archetype, chosen per site by the design stage (D6). */
    variant: z.enum(["default", "sticky-swap", "grid"]).optional(),
    title: z.string().min(1),
    intro: z.string().min(1).optional(),
    members: z
      .array(
        z
          .object({
            name: z.string().min(1),
            /**
             * The person's own title, taken verbatim from their page on the
             * old site. Never inferred from a photograph and never invented:
             * getting this wrong misstates a real person's qualifications
             * (design-rules.md §9).
             */
            role: z.string().min(1),
            bio: z.string().min(1).optional(),
            photo: imageSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

export const gallerySectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("gallery"),
    variant: z.enum(["default", "strip"]).optional(),
    title: z.string().min(1).optional(),
    images: z.array(imageSchema).min(1),
  })
  .strict();

export const testimonialsSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("testimonials"),
    variant: z.enum(["default", "compact"]).optional(),
    title: z.string().min(1).optional(),
    items: z
      .array(
        z
          .object({
            quote: z.string().min(1),
            author: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const faqSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("faq"),
    variant: z.enum(["default", "compact"]).optional(),
    title: z.string().min(1).optional(),
    items: z
      .array(
        z
          .object({
            question: z.string().min(1),
            answer: z.string().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const contactSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("contact"),
    variant: z.enum(["default", "split"]).optional(),
    title: z.string().min(1).optional(),
    /** The form is a mailto/tel fallback only — the site has no backend. */
    showForm: z.boolean(),
  })
  .strict();

export const mapSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("map"),
    variant: z.enum(["default", "tall"]).optional(),
    // No extra props: the map renders from config.contact.mapsEmbedQuery.
  })
  .strict();

export const hoursSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("hours"),
    variant: z.enum(["default", "compact"]).optional(),
    title: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
  })
  .strict();

/**
 * One sentence the business wrote about itself, verbatim.
 *
 * `text` may be trimmed at punctuation but never rewritten — the reference
 * build's own note is the rule: "the clinic's own sentence from its Biz Kimiz
 * page, trimmed only at the comma. No claim here is ours."
 * (template/pattern-library.md §2.1)
 */
export const statementSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("statement"),
    variant: z.enum(["word-reveal"]).optional(),
    text: z.string().min(40),
  })
  .strict();

/**
 * Address, hours and a pressable number as one section rather than three.
 * Renders entirely from `config.contact`, `config.openingHours` and
 * `config.hoursNote`; it carries no copy of its own beyond an optional title
 * (template/pattern-library.md §2.2).
 */
export const visitSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("visit"),
    variant: z.enum(["rows"]).optional(),
    title: z.string().min(1).optional(),
  })
  .strict();

/**
 * The last thing on the page: one display-sized line and the call to action,
 * on its own screen.
 *
 * A visitor who has read everything should not have to scroll back to the
 * hero to find the phone number, and a footer full of links is not an ask.
 * The copy is the client's own; the number comes from `config.contact`, so
 * this section cannot state a fact of its own (D10 §7.1 "closing").
 */
export const closingSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("closing"),
    variant: z.enum(["statement-cta"]).optional(),
    headline: z.string().min(1),
    body: z.string().min(1).optional(),
    ctaPrimary: ctaSchema,
    ctaSecondary: ctaSchema.optional(),
  })
  .strict();

/**
 * A band of short phrases running across the page.
 *
 * `items` are the client's own words — service names, districts served, a
 * list they already publish — never decoration. Generic cluster 5 in
 * design-rules.md §2 fails a marquee of `A · B · C` with no content behind
 * it, which is what this section becomes if it is handed filler.
 */
export const marqueeSectionSchema = z
  .object({
    ...sectionBase,
    type: z.literal("marquee"),
    variant: z.enum(["ticker"]).optional(),
    /** Three is the minimum that reads as a list rather than a slogan. */
    items: z.array(z.string().min(1)).min(3),
  })
  .strict();

export const sectionSchema = z.discriminatedUnion("type", [
  heroSectionSchema,
  statementSectionSchema,
  visitSectionSchema,
  closingSectionSchema,
  marqueeSectionSchema,
  servicesSectionSchema,
  teamSectionSchema,
  gallerySectionSchema,
  testimonialsSectionSchema,
  faqSectionSchema,
  contactSectionSchema,
  mapSectionSchema,
  hoursSectionSchema,
]);

/* -------------------------------------------------------------------------- */
/* Global config                                                              */
/* -------------------------------------------------------------------------- */

export const openingHoursEntrySchema = z
  .object({
    /** ISO weekday: 1 = Monday … 7 = Sunday. */
    day: z.number().int().min(1).max(7),
    /** "09:00" or null when closed that day. */
    opens: timeSchema.nullable(),
    closes: timeSchema.nullable(),
  })
  .strict()
  .refine((entry) => (entry.opens === null) === (entry.closes === null), {
    message: "opens and closes must both be set or both be null",
    path: ["closes"],
  });

export const siteConfigSchema = z
  .object({
    business: z
      .object({
        name: z.string().min(1),
        /**
         * Registered trade name. Null when the business does not publish one:
         * facts are verbatim, so an unpublished legal name stays absent
         * rather than being guessed from the brand (DECISIONS D8).
         */
        legalName: z.string().min(1).nullable(),
        slogan: z.string().min(1),
      })
      .strict(),
    /** schema.org type for JSON-LD, e.g. "Dentist", "Restaurant". */
    businessType: z.string().min(1).default("LocalBusiness"),
    contact: z
      .object({
        phoneE164: e164TRSchema,
        /**
         * Null when the business advertises no WhatsApp channel. Deriving a
         * wa.me link from a mobile number would promise a channel nobody
         * watches, so every WhatsApp CTA is dropped instead (DECISIONS D8).
         */
        whatsappE164: e164TRSchema.nullable(),
        email: z.email(),
        address: z.string().min(1),
        district: z.string().min(1),
        city: z.string().min(1),
        /** Free-text query for the Google Maps embed iframe. */
        mapsEmbedQuery: z.string().min(1),
      })
      .strict(),
    /**
     * Day-mapped hours. Empty when the business publishes hours without
     * saying which days they apply to — inventing the mapping is exactly
     * what the verbatim-facts rule forbids. `hoursNote` then carries the
     * published string and the refine below keeps a site from shipping with
     * no hours at all (DECISIONS D5 / D8).
     */
    openingHours: z.array(openingHoursEntrySchema).max(7),
    /** Hours published without a day mapping, verbatim ("10.00-19.30"). */
    hoursNote: z.string().min(1).nullable(),
    /**
     * The business's own social profiles, from the crawl. Carried so the
     * rebuild does not drop a channel the old site advertised; the footer is
     * the only place they render.
     */
    socialLinks: z
      .array(
        z
          .object({ platform: z.string().min(1), url: z.url() })
          .strict(),
      )
      .default([]),
    brand: z
      .object({
        /** OKLCH hue (0-360) driving the brand color ramp. */
        hue: z.number().min(0).max(360),
        /** OKLCH chroma (0-0.37) driving the brand color ramp. */
        chroma: z.number().min(0).max(0.37),
        fontHeading: z.string().min(1),
        fontBody: z.string().min(1),
      })
      .strict(),
    seo: z
      .object({
        title: z.string().min(1),
        description: z.string().min(1),
      })
      .strict(),
    kvkk: z
      .object({
        companyTitle: z.string().min(1),
        mersisNo: z.string().regex(/^\d{16}$/).optional(),
        dataController: z.string().min(1),
      })
      .strict(),
    sellsOnline: z.boolean(),
    /**
     * The direction's motion flags, copied here by the design stage from
     * `design.json` (DECISIONS D10 §4.2).
     *
     * They live on the config because the template reads the config and
     * nothing else: `layout.tsx` has to know whether to mount Lenis before
     * it renders, and a hero has to know whether to animate on load. Reading
     * `design.json` at runtime would make a client site depend on a pipeline
     * artifact that is not shipped with it.
     *
     * A direction that declares `smoothScroll: false` and still gets Lenis
     * is the K8 failure: the direction is selected, recorded, and then
     * ignored, with DJ10 correctly failing a page nobody changed.
     */
    motion: z
      .object({
        profile: z.enum(["still", "calm", "editorial", "kinetic"]),
        heroEntrance: z.boolean(),
        smoothScroll: z.boolean(),
      })
      .strict()
      // Defaulted so a config written before D10 still parses as what it
      // actually was: the kinetic language every earlier run was built in.
      .default({ profile: "kinetic", heroEntrance: true, smoothScroll: true }),
    sections: z.array(sectionSchema).min(1),
  })
  .strict()
  .refine(
    (config) => config.openingHours.length > 0 || config.hoursNote !== null,
    {
      message:
        "hoursNote is required when openingHours is empty: a visitor must be " +
        "able to see when the business is open (DECISIONS D5)",
      path: ["hoursNote"],
    },
  )
  /**
   * D8: a business with no published WhatsApp number cannot have a WhatsApp
   * CTA. `resolveCta` degrades one to the phone so no dead href ever reaches
   * the page, but degrading is a safety net, not a licence to plan the CTA —
   * a button whose label promises WhatsApp is wrong even when its href works.
   *
   * Enforced here because this is the boundary the pipeline cannot talk its
   * way past: `generate` writes site.config.ts, and the module-load
   * `.parse()` turns a bad plan into a build failure instead of a shipped
   * page. No gate downstream can catch it — there is no broken link to find
   * and the label is content.
   */
  .superRefine((config, ctx) => {
    if (config.contact.whatsappE164 !== null) return;
    config.sections.forEach((section, index) => {
      if (section.type !== "hero") return;
      for (const key of ["ctaPrimary", "ctaSecondary"] as const) {
        if (section[key]?.action !== "whatsapp") continue;
        ctx.addIssue({
          code: "custom",
          message:
            `${key} uses action "whatsapp" but contact.whatsappE164 is null. ` +
            "The business publishes no WhatsApp number, so plan a tel CTA " +
            "instead (DECISIONS D8).",
          path: ["sections", index, key, "action"],
        });
      }
    });
  });

/* -------------------------------------------------------------------------- */
/* Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type SiteConfigInput = z.input<typeof siteConfigSchema>;
export type SectionConfig = z.infer<typeof sectionSchema>;
export type SectionType = SectionConfig["type"];
export type Cta = z.infer<typeof ctaSchema>;
export type SectionImage = z.infer<typeof imageSchema>;
export type OpeningHoursEntry = z.infer<typeof openingHoursEntrySchema>;

export type HeroSection = z.infer<typeof heroSectionSchema>;
export type StatementSection = z.infer<typeof statementSectionSchema>;
export type VisitSection = z.infer<typeof visitSectionSchema>;
export type ClosingSection = z.infer<typeof closingSectionSchema>;
export type MarqueeSection = z.infer<typeof marqueeSectionSchema>;
export type ServicesSection = z.infer<typeof servicesSectionSchema>;
export type TeamSection = z.infer<typeof teamSectionSchema>;
export type GallerySection = z.infer<typeof gallerySectionSchema>;
export type TestimonialsSection = z.infer<typeof testimonialsSectionSchema>;
export type FaqSection = z.infer<typeof faqSectionSchema>;
export type ContactSection = z.infer<typeof contactSectionSchema>;
export type MapSection = z.infer<typeof mapSectionSchema>;
export type HoursSection = z.infer<typeof hoursSectionSchema>;

/** Props contract every section component in the registry implements. */
export interface SectionComponentProps<T extends SectionConfig = SectionConfig> {
  section: T;
  config: SiteConfig;
}
