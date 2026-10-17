import type { ComponentType } from "react";

import type { SectionConfig, SectionType, SiteConfig } from "@/lib/schema";
import { Contact } from "@/sections/contact";
import { Faq } from "@/sections/faq";
import { Gallery } from "@/sections/gallery";
import { Hero } from "@/sections/hero";
import { Hours } from "@/sections/hours";
import { MapEmbed } from "@/sections/map";
import { Services } from "@/sections/services";
import { Testimonials } from "@/sections/testimonials";

/** Narrows the discriminated union to the section config of one type. */
type SectionOfType<T extends SectionType> = Extract<SectionConfig, { type: T }>;

/**
 * Section registry: maps every section type in the schema to its server
 * component. The discriminated union guarantees exhaustiveness — adding a
 * type to `sectionSchema` without registering a component is a type error.
 */
export const sectionRegistry: {
  [T in SectionType]: ComponentType<{
    section: SectionOfType<T>;
    config: SiteConfig;
  }>;
} = {
  hero: Hero,
  services: Services,
  gallery: Gallery,
  testimonials: Testimonials,
  faq: Faq,
  contact: Contact,
  map: MapEmbed,
  hours: Hours,
};

/**
 * Looks a section's component up with the correct prop correlation. The cast
 * is safe because `sectionRegistry` is keyed by the same discriminant.
 */
export function getSectionComponent(
  type: SectionType,
): ComponentType<{ section: SectionConfig; config: SiteConfig }> {
  return sectionRegistry[type] as ComponentType<{
    section: SectionConfig;
    config: SiteConfig;
  }>;
}
