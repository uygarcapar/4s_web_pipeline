import type { ComponentType } from "react";

import type { SectionConfig, SectionType, SiteConfig } from "@/lib/schema";
import { Closing } from "@/sections/closing";
import { Contact } from "@/sections/contact";
import { Faq } from "@/sections/faq";
import { Gallery } from "@/sections/gallery";
import { Hero } from "@/sections/hero";
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
import { Services } from "@/sections/services";
import { Statement } from "@/sections/statement";
import { Visit } from "@/sections/visit";
import { ServicesAccordion } from "@/sections/services/accordion";
import { ServicesAlternating } from "@/sections/services/alternating";
import { ServicesImageGrid } from "@/sections/services/image-grid";
import { ServicesIndex } from "@/sections/services/index-columns";
import { ServicesRailPinned } from "@/sections/services/rail-pinned";
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
  hero: Hero,
  statement: Statement,
  visit: Visit,
  closing: Closing,
  marquee: Marquee,
  services: Services,
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
  statement: { "word-reveal": Statement },
  visit: { "rows": Visit },
  closing: { "statement-cta": Closing },
  marquee: { "ticker": Marquee },
  services: {
    "rail-pinned": ServicesRailPinned,
    "alternating": ServicesAlternating,
    "accordion": ServicesAccordion,
    "image-grid": ServicesImageGrid,
    "index": ServicesIndex,
  },
  team: { "sticky-swap": TeamStickySwap },
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
