import type { ComponentType } from "react";

import type { SectionConfig, SectionType, SiteConfig } from "@/lib/schema";
import { Closing } from "@/sections/closing";
import { ClosingBanner } from "@/sections/closing/banner";
import { ClosingSplitPanel } from "@/sections/closing/split-panel";
import { FaqRows } from "@/sections/faq/rows";
import { FaqTwoColumn } from "@/sections/faq/two-column";
import { MarqueeStaticBand } from "@/sections/marquee/static-band";
import { StatementQuoteSplit } from "@/sections/statement/quote-split";
import { StatementStatic } from "@/sections/statement/static-display";
import { TestimonialsRuledList } from "@/sections/testimonials/ruled-list";
import { TestimonialsSingleLarge } from "@/sections/testimonials/single-large";
import { VisitCard } from "@/sections/visit/card";
import { VisitMapSplit } from "@/sections/visit/map-split";
import { VisitStacked } from "@/sections/visit/stacked";
import { ProcessNumbered } from "@/sections/process/numbered";
import { ProcessRail } from "@/sections/process/rail";
import { ProcessTimeline } from "@/sections/process/timeline";
import { Contact } from "@/sections/contact";
import { Signature } from "@/sections/signature";
import { SignatureCustom } from "@/sections/signature/custom";
import { Faq } from "@/sections/faq";
import { Gallery } from "@/sections/gallery";
import { GalleryContactSheet } from "@/sections/gallery/contact-sheet";
import { GalleryFullBleed } from "@/sections/gallery/full-bleed";
import { GalleryMosaic } from "@/sections/gallery/mosaic";
import { GalleryPairs } from "@/sections/gallery/pairs";
import { HeroPhotoFull } from "@/sections/hero/photo-full";
import { HeroCollage } from "@/sections/hero/collage";
import { HeroIndex } from "@/sections/hero/index-list";
import { HeroMarquee } from "@/sections/hero/marquee";
import { HeroOffsetGrid } from "@/sections/hero/offset-grid";
import { HeroSplit } from "@/sections/hero/split";
import { HeroTypeOnly } from "@/sections/hero/type-only";
import { Hours } from "@/sections/hours";
import { Marquee } from "@/sections/marquee";
import { MapEmbed } from "@/sections/map";
import { Statement } from "@/sections/statement";
import { Visit } from "@/sections/visit";
import { ServicesAccordion } from "@/sections/services/accordion";
import { ServicesAlternating } from "@/sections/services/alternating";
import { ServicesImageGrid } from "@/sections/services/image-grid";
import { ServicesIndex } from "@/sections/services/index-columns";
import { ServicesRailPinned } from "@/sections/services/rail-pinned";
import { TeamGrid } from "@/sections/team/grid";
import { TeamLead } from "@/sections/team/lead";
import { TeamPortraitRows } from "@/sections/team/portrait-rows";
import { TeamRoster } from "@/sections/team/roster";
import { TeamStickySwap } from "@/sections/team/sticky-swap";
import { Testimonials } from "@/sections/testimonials";

/** Narrows the discriminated union to the section config of one type. */
type SectionOfType<T extends SectionType> = Extract<SectionConfig, { type: T }>;

type SectionComponent<T extends SectionType> = ComponentType<{
  section: SectionOfType<T>;
  config: SiteConfig;
}>;

/**
 * Section registry: the default component per section type. The discriminated
 * union guarantees exhaustiveness — adding a type to `sectionSchema` without
 * registering a component is a type error.
 */
export const sectionRegistry: { [T in SectionType]: SectionComponent<T> } = {
  hero: HeroSplit,
  // The §9 fallback. `signature/custom` is the slot a model writes; this
  // is what renders when it did not converge.
  signature: Signature,
  statement: Statement,
  visit: Visit,
  closing: Closing,
  marquee: Marquee,
  process: ProcessNumbered,
  services: ServicesIndex,
  team: TeamStickySwap,
  gallery: Gallery,
  testimonials: Testimonials,
  faq: Faq,
  contact: Contact,
  map: MapEmbed,
  hours: Hours,
};

/**
 * Layout archetypes. The design stage picks one per section from the
 * client's own material and writes it into `site.config.ts` as the section's
 * `variant`, so two businesses in the same trade do not get the same
 * structure (docs/DECISIONS.md D6, design-rules.md §10.2).
 *
 * Only archetypes that actually exist are listed. The orchestrator's
 * `ARCHETYPES` table must stay in step with this one, or the design stage
 * will choose a layout the template cannot render and silently fall back to
 * the default — which would quietly undo the variation it exists to create.
 */
const archetypeRegistry: {
  [T in SectionType]?: Record<string, SectionComponent<T>>;
} = {
  hero: {
    "photo-full": HeroPhotoFull,
    "type-only": HeroTypeOnly,
    "split": HeroSplit,
    "index": HeroIndex,
    "collage": HeroCollage,
    "offset-grid": HeroOffsetGrid,
    "marquee": HeroMarquee,
  },
  signature: {
    // One entry, and it is the only component in the template a model may
    // write. It ships re-exporting the default, so the registry rule
    // (build-rules §4) holds whether or not the §9 loop ever ran.
    "custom": SignatureCustom,
  },
  statement: {
    "word-reveal": Statement,
    "static": StatementStatic,
    "quote-split": StatementQuoteSplit,
  },
  visit: {
    "rows": Visit,
    "map-split": VisitMapSplit,
    "stacked": VisitStacked,
    "card": VisitCard,
  },
  gallery: {
    "mosaic": GalleryMosaic,
    "full-bleed": GalleryFullBleed,
    "pairs": GalleryPairs,
    "contact-sheet": GalleryContactSheet,
  },
  closing: {
    "statement-cta": Closing,
    "split-panel": ClosingSplitPanel,
    "banner": ClosingBanner,
  },
  marquee: {
    "ticker": Marquee,
    "static-band": MarqueeStaticBand,
  },
  process: {
    "numbered": ProcessNumbered,
    "timeline": ProcessTimeline,
    "rail": ProcessRail,
  },
  services: {
    "rail-pinned": ServicesRailPinned,
    "alternating": ServicesAlternating,
    "accordion": ServicesAccordion,
    "image-grid": ServicesImageGrid,
    "index": ServicesIndex,
  },
  team: {
    "sticky-swap": TeamStickySwap,
    "grid": TeamGrid,
    "roster": TeamRoster,
    "lead": TeamLead,
    "portrait-rows": TeamPortraitRows,
  },
  faq: {
    "two-column": FaqTwoColumn,
    "rows": FaqRows,
  },
  testimonials: {
    "single-large": TestimonialsSingleLarge,
    "ruled-list": TestimonialsRuledList,
  },
};

/**
 * Looks a section's component up, preferring its archetype and falling back
 * to the type's default. The cast is safe because both registries are keyed
 * by the same discriminant.
 */
export function getSectionComponent(
  type: SectionType,
  variant?: string,
): ComponentType<{ section: SectionConfig; config: SiteConfig }> {
  const byArchetype = variant
    ? (archetypeRegistry[type] as Record<string, unknown> | undefined)?.[variant]
    : undefined;
  const component = byArchetype ?? sectionRegistry[type];
  return component as ComponentType<{
    section: SectionConfig;
    config: SiteConfig;
  }>;
}
