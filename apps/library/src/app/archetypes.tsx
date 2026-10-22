import type { ComponentType } from "react";

import type { SectionConfig, SiteConfig } from "@/lib/schema";
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

/** Not in the reference config, so stated here (like STATEMENT and VISIT). */
const PROCESS: SectionConfig = {
  type: "process",
  id: "process",
  variant: "numbered",
  title: "Tedavi süreci",
  steps: [
    {
      title: "İlk muayene",
      description:
        "Ağız içi muayene ve panoramik röntgenle mevcut durum çıkarılır.",
      duration: "30 dakika",
    },
    {
      title: "Tedavi planı",
      description:
        "Seçenekler, süre ve ücret yazılı olarak paylaşılır; karar size bırakılır.",
    },
    {
      title: "Uygulama",
      description:
        "Planlanan tedavi, randevu aralıkları kemik ve diş yapınıza göre belirlenerek uygulanır.",
    },
    {
      title: "Kontrol",
      description: "Tedavi sonrası altıncı ayda kontrol muayenesi yapılır.",
    },
  ],
};


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
  entry("closing/banner", "closing", "banner", ClosingBanner, bySectionType("closing")),
  entry("closing/split-panel", "closing", "split-panel", ClosingSplitPanel, bySectionType("closing")),
  entry("faq/rows", "faq", "rows", FaqRows, bySectionType("faq")),
  entry("faq/two-column", "faq", "two-column", FaqTwoColumn, bySectionType("faq")),
  entry("marquee/static-band", "marquee", "static-band", MarqueeStaticBand, bySectionType("marquee")),
  entry("statement/quote-split", "statement", "quote-split", StatementQuoteSplit, STATEMENT),
  entry("statement/static", "statement", "static", StatementStatic, STATEMENT),
  entry("testimonials/ruled-list", "testimonials", "ruled-list", TestimonialsRuledList, bySectionType("testimonials")),
  entry("testimonials/single-large", "testimonials", "single-large", TestimonialsSingleLarge, bySectionType("testimonials")),
  entry("visit/card", "visit", "card", VisitCard, VISIT),
  entry("visit/map-split", "visit", "map-split", VisitMapSplit, VISIT),
  entry("visit/stacked", "visit", "stacked", VisitStacked, VISIT),
  entry("process/numbered", "process", "numbered", ProcessNumbered, PROCESS),
  entry("process/timeline", "process", "timeline", ProcessTimeline, PROCESS),
  entry("process/rail", "process", "rail", ProcessRail, PROCESS),
  entry("contact/default", "contact", "default", Contact, bySectionType("contact")),
].filter((a): a is LibraryArchetype => a !== null);
