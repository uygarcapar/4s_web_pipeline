import type { SiteConfig } from "@/lib/schema";
import { getSectionComponent } from "@/sections/registry";

/**
 * Renders `config.sections` in order through the section registry.
 * Section `id`s double as React keys and anchor targets.
 */
export function SectionRenderer({ config }: { config: SiteConfig }) {
  return (
    <>
      {config.sections.map((section) => {
        // `variant` carries the layout archetype the design stage chose for
        // this client (docs/DECISIONS.md D6).
        const Section = getSectionComponent(section.type, section.variant);
        return <Section key={section.id} section={section} config={config} />;
      })}
    </>
  );
}
