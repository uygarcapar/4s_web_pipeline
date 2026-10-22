import type { ComponentType } from "react";

import type { SectionConfig, SiteConfig } from "@/lib/schema";
import { Closing } from "@/sections/closing";
import { Contact } from "@/sections/contact";
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
import { ServicesAccordion } from "@/sections/services/accordion";
import { ServicesAlternating } from "@/sections/services/alternating";
import { ServicesImageGrid } from "@/sections/services/image-grid";
import { ServicesIndex } from "@/sections/services/index-columns";
import { ServicesRailPinned } from "@/sections/services/rail-pinned";
import { Statement } from "@/sections/statement";
import { TeamGrid } from "@/sections/team/grid";
import { TeamLead } from "@/sections/team/lead";
import { TeamPortraitRows } from "@/sections/team/portrait-rows";
import { TeamRoster } from "@/sections/team/roster";
import { TeamStickySwap } from "@/sections/team/sticky-swap";
import { Testimonials } from "@/sections/testimonials";
import { Visit } from "@/sections/visit";
import { siteConfig } from "~config";

/**
 * The archetype inventory the library renders.
 *
 * This is also **what B3 works from**: D10 §7.1 targets 45 archetypes across
 * eleven section types, and the eleven below are everything the template has
 * today. Seeing the gap as a grid rather than a table is most of the point.
 *
 * Section fixtures come from the template's own `site.config.ts`, so an
 * archetype renders here exactly as it would in a run, with no second set of
 * fixture content to drift.
 */
export interface LibraryArchetype {
  /** Stable id, used in the preview URL. */
  id: string;
  sectionType: SectionConfig["type"];
  archetype: string;
  component: ComponentType<{ section: never; config: SiteConfig }>;
  section: SectionConfig;
}

const bySectionType = (type: SectionConfig["type"]): SectionConfig | undefined =>
  siteConfig.sections.find((s) => s.type === type);

/** Not in the reference config, so stated here. */
const STATEMENT: SectionConfig = {
  type: "statement",
  id: "statement",
  variant: "word-reveal",
  text:
    "Kadıköy'de yirmi yıldır aynı sokakta, aynı ekiple çalışıyoruz; " +
    "hastalarımızın çoğu bize komşularının tavsiyesiyle geliyor.",
};

const VISIT: SectionConfig = { type: "visit", id: "visit", title: "Bize gelin" };

function entry(
  id: string,
  sectionType: SectionConfig["type"],
  archetype: string,
  component: unknown,
  section: SectionConfig | undefined,
): LibraryArchetype | null {
  if (section === undefined) return null;
  return {
    id,
    sectionType,
    archetype,
    component: component as LibraryArchetype["component"],
    section,
  };
}

export const LIBRARY_ARCHETYPES: LibraryArchetype[] = [
  entry("hero/photo-full", "hero", "photo-full", HeroPhotoFull, bySectionType("hero")),
  entry("hero/type-only", "hero", "type-only", HeroTypeOnly, bySectionType("hero")),
  entry("hero/split", "hero", "split", HeroSplit, bySectionType("hero")),
  entry("hero/index", "hero", "index", HeroIndex, bySectionType("hero")),
  entry("hero/collage", "hero", "collage", HeroCollage, bySectionType("hero")),
  entry("hero/offset-grid", "hero", "offset-grid", HeroOffsetGrid, bySectionType("hero")),
  entry("hero/marquee", "hero", "marquee", HeroMarquee, bySectionType("hero")),
  entry("statement/word-reveal", "statement", "word-reveal", Statement, STATEMENT),
  entry("services/rail-pinned", "services", "rail-pinned", ServicesRailPinned, bySectionType("services")),
  entry("services/alternating", "services", "alternating", ServicesAlternating, bySectionType("services")),
  entry("services/accordion", "services", "accordion", ServicesAccordion, bySectionType("services")),
  entry("services/image-grid", "services", "image-grid", ServicesImageGrid, bySectionType("services")),
  entry("services/index", "services", "index", ServicesIndex, bySectionType("services")),
  entry("visit/default", "visit", "default", Visit, VISIT),
  entry("marquee/ticker", "marquee", "ticker", Marquee, bySectionType("marquee")),
  entry("closing/statement-cta", "closing", "statement-cta", Closing, bySectionType("closing")),
  entry("team/sticky-swap", "team", "sticky-swap", TeamStickySwap, bySectionType("team")),
  entry("team/grid", "team", "grid", TeamGrid, bySectionType("team")),
  entry("team/roster", "team", "roster", TeamRoster, bySectionType("team")),
  entry("team/lead", "team", "lead", TeamLead, bySectionType("team")),
  entry("team/portrait-rows", "team", "portrait-rows", TeamPortraitRows, bySectionType("team")),
  entry("gallery/default", "gallery", "default", Gallery, bySectionType("gallery")),
  entry("gallery/mosaic", "gallery", "mosaic", GalleryMosaic, bySectionType("gallery")),
  entry("gallery/full-bleed", "gallery", "full-bleed", GalleryFullBleed, bySectionType("gallery")),
  entry("gallery/pairs", "gallery", "pairs", GalleryPairs, bySectionType("gallery")),
  entry("gallery/contact-sheet", "gallery", "contact-sheet", GalleryContactSheet, bySectionType("gallery")),
  entry("testimonials/default", "testimonials", "default", Testimonials, bySectionType("testimonials")),
  entry("faq/default", "faq", "default", Faq, bySectionType("faq")),
  entry("hours/default", "hours", "default", Hours, bySectionType("hours")),
  entry("contact/default", "contact", "default", Contact, bySectionType("contact")),
].filter((a): a is LibraryArchetype => a !== null);
